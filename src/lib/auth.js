// src/lib/auth.js
import { promises as fs } from 'fs';
import { logger } from './logger.js';
import crypto from 'crypto';

const AUTH_FILE = process.env.AUTH_FILE || 'auth.json';
const SESSION_DURATION = parseInt(process.env.SESSION_DURATION) || 24 * 60 * 60 * 1000; // 24 horas
const CLEANUP_INTERVAL = 60 * 60 * 1000; // Limpa sessões expiradas a cada 1 hora

class AuthManager {
  constructor() {
    this.users = new Map(); // username -> { password, createdAt, lastLogin }
    this.sessions = new Map(); // phoneNumber -> { username, expiresAt }
    this.awaitingLogin = new Map(); // phoneNumber -> { step, username?, timestamp }
    
    // Gera salt único por instância para mais segurança
    this.salt = crypto.randomBytes(16).toString('hex');
    
    // Cleanup automático de sessões expiradas
    this.cleanupTimer = setInterval(() => this.cleanupSessions(), CLEANUP_INTERVAL);
  }

  /**
   * Carrega usuários e sessões do arquivo
   */
  async loadAuth() {
    try {
      const data = await fs.readFile(AUTH_FILE, 'utf-8');
      const authData = JSON.parse(data);
      
      // Carrega usuários
      if (authData.users) {
        this.users = new Map(Object.entries(authData.users));
      }
      
      // Carrega sessões válidas (remove expiradas)
      if (authData.sessions) {
        const now = Date.now();
        for (const [phone, session] of Object.entries(authData.sessions)) {
          if (session.expiresAt > now) {
            this.sessions.set(phone, session);
          }
        }
      }
      
      logger.info('AUTH: Sistema de autenticação carregado: %d usuários, %d sessões ativas', 
                  this.users.size, this.sessions.size);
                  
    } catch (error) {
      if (error.code === 'ENOENT') {
        logger.info('📄 Arquivo de autenticação não encontrado, criando novo...');
        await this.saveAuth();
      } else {
        logger.error('❌ Erro ao carregar autenticação:', error);
      }
    }
  }

  /**
   * Salva usuários e sessões no arquivo
   */
  async saveAuth() {
    try {
      const authData = {
        users: Object.fromEntries(this.users),
        sessions: Object.fromEntries(this.sessions),
        lastSaved: new Date().toISOString()
      };
      
      await fs.writeFile(AUTH_FILE, JSON.stringify(authData, null, 2));
      logger.debug('💾 Dados de autenticação salvos');
    } catch (error) {
      logger.error('❌ Erro ao salvar autenticação:', error);
    }
  }

  /**
   * Hash seguro da senha
   */
  hashPassword(password) {
    return crypto.createHash('sha256').update(password + this.salt).digest('hex');
  }

  /**
   * Cria um novo usuário admin
   */
  async createUser(username, password, createdBy) {
    if (this.users.has(username)) {
      throw new Error('Usuário já existe');
    }

    if (username.length < 3) {
      throw new Error('Usuário deve ter pelo menos 3 caracteres');
    }

    if (password.length < 6) {
      throw new Error('Senha deve ter pelo menos 6 caracteres');
    }

    const hashedPassword = this.hashPassword(password);
    
    this.users.set(username, {
      password: hashedPassword,
      createdAt: Date.now(),
      createdBy: createdBy,
      lastLogin: null
    });

    await this.saveAuth();
    logger.info('👤 Novo usuário admin criado: %s por %s', username, createdBy);
    
    return true;
  }

  /**
   * Remove um usuário
   */
  async removeUser(username) {
    if (!this.users.has(username)) {
      throw new Error('Usuário não encontrado');
    }

    this.users.delete(username);
    
    // Remove sessões ativas deste usuário
    for (const [phone, session] of this.sessions.entries()) {
      if (session.username === username) {
        this.sessions.delete(phone);
      }
    }

    await this.saveAuth();
    logger.info('🗑️ Usuário removido: %s', username);
    
    return true;
  }

  /**
   * Inicia processo de login
   */
  startLogin(phoneNumber) {
    this.awaitingLogin.set(phoneNumber, {
      step: 'username',
      timestamp: Date.now()
    });

    // Auto-cleanup de logins em andamento (5 minutos)
    setTimeout(() => {
      if (this.awaitingLogin.has(phoneNumber)) {
        this.awaitingLogin.delete(phoneNumber);
      }
    }, 5 * 60 * 1000);
  }

  /**
   * Processa step do login
   */
  async processLogin(phoneNumber, input) {
    const loginData = this.awaitingLogin.get(phoneNumber);
    
    if (!loginData) {
      throw new Error('Nenhum processo de login ativo. Use /login para começar.');
    }

    // Timeout de 5 minutos
    if (Date.now() - loginData.timestamp > 5 * 60 * 1000) {
      this.awaitingLogin.delete(phoneNumber);
      throw new Error('Login expirou. Use /login para tentar novamente.');
    }

    if (loginData.step === 'username') {
      const username = input.trim().toLowerCase();
      
      if (!this.users.has(username)) {
        this.awaitingLogin.delete(phoneNumber);
        throw new Error('Usuário não encontrado.');
      }

      // Avança para próximo step
      this.awaitingLogin.set(phoneNumber, {
        step: 'password',
        username: username,
        timestamp: Date.now()
      });

      return { step: 'password', message: '🔑 Agora digite a senha:' };
    }

    if (loginData.step === 'password') {
      const username = loginData.username;
      const password = input.trim();
      
      const user = this.users.get(username);
      const hashedPassword = this.hashPassword(password);

      if (user.password !== hashedPassword) {
        this.awaitingLogin.delete(phoneNumber);
        throw new Error('Senha incorreta.');
      }

      // Login bem-sucedido
      this.awaitingLogin.delete(phoneNumber);
      
      const sessionExpires = Date.now() + SESSION_DURATION;
      this.sessions.set(phoneNumber, {
        username: username,
        expiresAt: sessionExpires,
        loginAt: Date.now()
      });

      // Atualiza último login
      user.lastLogin = Date.now();
      this.users.set(username, user);
      
      await this.saveAuth();
      
      logger.info('✅ Login bem-sucedido: %s (%s)', username, phoneNumber.slice(-4));
      
      const expiresIn = Math.round(SESSION_DURATION / 1000 / 60 / 60);
      return { 
        step: 'complete', 
        message: `✅ Login realizado com sucesso!\n\n👤 Usuário: ${username}\n⏰ Sessão válida por: ${expiresIn}h\n\nVocê agora tem acesso aos comandos de administrador.`
      };
    }

    throw new Error('Estado de login inválido.');
  }

  /**
   * Verifica se usuário está logado como admin
   */
  isLoggedIn(phoneNumber) {
    const session = this.sessions.get(phoneNumber);
    
    if (!session) {
      return false;
    }

    if (Date.now() > session.expiresAt) {
      this.sessions.delete(phoneNumber);
      this.saveAuth().catch(err => logger.error('Erro ao salvar auth:', err));
      return false;
    }

    return true;
  }

  /**
   * Obtém dados da sessão
   */
  getSession(phoneNumber) {
    return this.sessions.get(phoneNumber);
  }

  /**
   * Faz logout
   */
  async logout(phoneNumber) {
    const session = this.sessions.get(phoneNumber);
    
    if (session) {
      this.sessions.delete(phoneNumber);
      await this.saveAuth();
      logger.info('🚪 Logout: %s (%s)', session.username, phoneNumber.slice(-4));
      return session.username;
    }
    
    return null;
  }

  /**
   * Verifica se está aguardando input de login
   */
  isAwaitingLogin(phoneNumber) {
    return this.awaitingLogin.has(phoneNumber);
  }

  /**
   * Cancela processo de login
   */
  cancelLogin(phoneNumber) {
    const was = this.awaitingLogin.has(phoneNumber);
    this.awaitingLogin.delete(phoneNumber);
    return was;
  }

  /**
   * Lista usuários (sem senhas)
   */
  listUsers() {
    const users = [];
    
    for (const [username, userData] of this.users.entries()) {
      users.push({
        username,
        createdAt: new Date(userData.createdAt).toLocaleString('pt-BR'),
        lastLogin: userData.lastLogin ? new Date(userData.lastLogin).toLocaleString('pt-BR') : 'Nunca',
        createdBy: userData.createdBy
      });
    }

    return users.sort((a, b) => a.username.localeCompare(b.username));
  }

  /**
   * Lista sessões ativas
   */
  listSessions() {
    const sessions = [];
    const now = Date.now();

    for (const [phone, session] of this.sessions.entries()) {
      if (session.expiresAt > now) {
        const timeLeft = Math.round((session.expiresAt - now) / 1000 / 60);
        sessions.push({
          username: session.username,
          phone: phone.slice(0, 4) + '****' + phone.slice(-4),
          loginTime: new Date(session.loginAt).toLocaleString('pt-BR'),
          expiresIn: `${Math.floor(timeLeft / 60)}h ${timeLeft % 60}m`
        });
      }
    }

    return sessions.sort((a, b) => a.username.localeCompare(b.username));
  }

  /**
   * Limpa sessões expiradas (método interno automático)
   */
  async cleanupSessions() {
    try {
      const now = Date.now();
      let cleaned = 0;

      for (const [phone, session] of this.sessions.entries()) {
        if (session.expiresAt <= now) {
          this.sessions.delete(phone);
          cleaned++;
        }
      }

      if (cleaned > 0) {
        await this.saveAuth();
        logger.debug('🧹 %d sessões expiradas removidas automaticamente', cleaned);
      }
    } catch (error) {
      logger.error('❌ Erro na limpeza automática de sessões:', error);
    }
  }

  /**
   * Limpa sessões expiradas (comando manual)
   */
  async cleanupExpiredSessions() {
    const now = Date.now();
    let cleaned = 0;

    for (const [phone, session] of this.sessions.entries()) {
      if (session.expiresAt <= now) {
        this.sessions.delete(phone);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      await this.saveAuth();
      logger.info('🧹 %d sessões expiradas removidas', cleaned);
    }

    return cleaned;
  }

  /**
   * Obtém estatísticas
   */
  getStats() {
    const now = Date.now();
    let activeSessions = 0;
    
    for (const session of this.sessions.values()) {
      if (session.expiresAt > now) {
        activeSessions++;
      }
    }

    return {
      totalUsers: this.users.size,
      activeSessions: activeSessions,
      awaitingLogin: this.awaitingLogin.size
    };
  }
}

// Instância global
export const authManager = new AuthManager();
