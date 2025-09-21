// src/bot.js
import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode-terminal';
import { logger } from './lib/logger.js';
import { loadMemory, saveMemory, pushMessage, getThread, clearMemory, getMemoryStats } from './lib/memory.js';
import { askLLM } from './lib/llm.js';
import { rateLimiter, isRateLimited } from './lib/rateLimit.js';
import { commands } from './lib/commands.js';
import { createBackup } from './lib/backup.js';
import { errorLogger, withErrorHandling } from './lib/errorHandler.js';
import { ContextManager } from './lib/contextManager.js';
import { authManager } from './lib/auth.js';
import { startAPIServer, updateBotStatus } from './api/server.js';
import { logActivity } from './lib/activityLogger.js';
import 'dotenv/config';

// ------------- Configurações -------------
const answered = new Map(); // Anti-duplicado por 5s
const ADMIN_NUMBERS = (process.env.ADMIN_NUMBERS || 'seu_numero_aqui').split(',').map(n => n.trim());
const DUPLICATE_TIMEOUT = parseInt(process.env.DUPLICATE_TIMEOUT) || 5000;
const GROUP_RANDOM_CHANCE = parseFloat(process.env.GROUP_RANDOM_CHANCE) || 0.25;
// ----------------------------------------

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: './wwebjs_auth' }),
  puppeteer: { 
    headless: true, 
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
      '--disable-gpu'
    ]
  }
});

// Eventos do cliente
client.on('qr', qr => {
  logger.info('📱 Escaneie o QR Code para conectar');
  qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
  logger.info('CONNECTED: Ceros AI conectado e operacional!');
  logger.info('📊 Bot Info: %s', client.info.pushname);
  
  // Atualiza status da API
  updateBotStatus({ connected: true });
  
  // Backup automático na inicialização
  createBackup().catch(err => logger.error('Erro no backup inicial:', err));
});

client.on('disconnected', (reason) => {
  logger.warn('🔌 Bot desconectado: %s', reason);
  updateBotStatus({ connected: false });
  errorLogger.logError(new Error(`WhatsApp desconectado: ${reason}`), {
    context: 'whatsapp_disconnect',
    reason: reason
  });
});

client.on('auth_failure', () => {
  logger.error('❌ Falha na autenticação!');
  errorLogger.logError(new Error('Falha na autenticação do WhatsApp'), {
    context: 'whatsapp_auth_failure'
  });
});

// Limpeza automática do cache de duplicados
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamp] of answered.entries()) {
    if (now - timestamp > DUPLICATE_TIMEOUT) {
      answered.delete(key);
    }
  }
}, 60000); // Limpa a cada minuto

client.on('message', async msg => {
  try {
    // Ignora mensagens próprias, status e mídia não suportada
    if (msg.fromMe || msg.isStatus) return;
    
    const chat = await msg.getChat();
    const id = chat.id._serialized;

    // Log de atividade: mensagem recebida
    logActivity({
      type: 'mensagem',
      user: msg.author || msg.from,
      chatName: chat.name || 'Privado',
      body: msg.body
    });
    const sender = (msg.author || msg.from).replace(/[^0-9]/g, '');

    // Sistema anti-duplicado
    const key = `${id}:${msg.body}:${sender}`;
    const now = Date.now();
    if (answered.has(key) && now - answered.get(key) < DUPLICATE_TIMEOUT) return;
    answered.set(key, now);

    // Rate limiting por usuário
    if (isRateLimited(sender)) {
      logger.warn('Rate limit atingido para %s', sender);
      return;
    }

    // ========== SISTEMA DE LOGIN ==========
    // Verifica se está aguardando dados de login
    if (authManager.isAwaitingLogin(sender) && !msg.body.startsWith('/')) {
      try {
        const result = await authManager.processLogin(sender, msg.body);
        await msg.reply(result.message);
        return;
      } catch (error) {
        await msg.reply(`❌ ${error.message}`);
        return;
      }
    }

    // ========== COMANDOS ADMIN ==========
    // Admin permanente (via .env) OU admin logado via /login
    const isPermAdmin = ADMIN_NUMBERS.includes(sender);
    const isLoggedAdmin = authManager.isLoggedIn(sender);
    const isAdmin = isPermAdmin || isLoggedAdmin;
    
    if (isAdmin && msg.body.startsWith('/')) {
      // Log de atividade: comando usado
      logActivity({
        type: 'comando',
        user: msg.author || msg.from,
        chatName: chat.name || 'Privado',
        body: msg.body
      });
      const command = msg.body.trim();
      await commands.handleAdmin(command, msg, chat, client);
      return;
    }

    // ========== COMANDOS USUÁRIO ==========
    if (msg.body.startsWith('/')) {
      await commands.handleUser(msg.body.trim(), msg, chat, sender);
      return;
    }

    // ========== PROCESSAMENTO NORMAL ==========
    const isMentioned = msg.mentionedIds.includes(client.info.me._serialized);
    const isPrivateChat = !chat.isGroup;
    const isRandomReply = chat.isGroup && Math.random() < GROUP_RANDOM_CHANCE;
    
    const mustReply = isPrivateChat || isMentioned || isRandomReply;

    if (!mustReply) return;

    // Log específico para menções
    if (isMentioned) {
      logActivity({
        type: 'mencao',
        user: msg.author || msg.from,
        chatName: chat.name || 'Privado',
        body: `Mencionou o bot: "${msg.body}"`
      });
    }

    // Aplica rate limiting
    rateLimiter.hit(sender);

    // Log da interação
    logger.info('📨 Nova mensagem de %s em %s', sender, chat.name || 'Chat Privado');
    
    // Mostra que está "digitando" para mensagens longas
    await chat.sendStateTyping();

    pushMessage(id, 'user', msg.body);

    // Obtém e limpa o contexto para evitar confusão da IA
    let contextMessages = getThread(id);
    contextMessages = ContextManager.autoCleanIfConfused(contextMessages);

    const messages = [
      { 
        role: 'system', 
        content: `Você é o Ceros AI, um assistente virtual inteligente e prestativo.
        
COMPORTAMENTO:
- Seja útil, preciso e mantenha consistência nas respostas
- Responda SEMPRE em português brasileiro
- Mantenha o contexto da conversa anterior
- Se não souber algo, seja honesto sobre isso
- Evite repetir informações desnecessariamente
- Seja conciso mas informativo
        
DATA ATUAL: ${new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        
IMPORTANTE: Analise todo o histórico da conversa antes de responder para manter coerência.` 
      },
      ...contextMessages
    ];

    const answer = await askLLM(messages);
    
    if (!answer) {
      await msg.reply('🤖 Hmm, parece que fiquei sem palavras aqui... Tenta perguntar de novo?');
      return;
    }

    // Log da conversa
    console.log('');
    console.log('┌─────────────────────────────────┐');
    console.log(`│ 💬 ${(chat.name || 'Chat Privado').slice(0, 23).padEnd(23)} │`);
    console.log('├─────────────────────────────────┤');
    console.log(`│ 👤 ${msg.body.slice(0, 23).padEnd(23)}${msg.body.length > 23 ? '..' : '  '} │`);
    console.log('├─────────────────────────────────┤');
    console.log(`│ BOT ${answer.slice(0, 23).padEnd(23)}${answer.length > 23 ? '..' : '  '} │`);
    console.log('└─────────────────────────────────┘');
    console.log('');

    pushMessage(id, 'assistant', answer);
    await msg.reply(answer);

    // Log de atividade: resposta enviada pelo bot
    logActivity({
      type: 'resposta_bot',
      user: 'Bot CerosAI',
      chatName: chat.name || 'Privado',
      body: `Respondeu para ${(msg.author || msg.from).replace('@c.us', '')}: "${answer.slice(0, 100)}${answer.length > 100 ? '...' : ''}"`
    });

  } catch (error) {
    await errorLogger.logError(error, {
      context: 'message_processing',
      chatId: id,
      sender: sender,
      messageBody: msg.body.slice(0, 100),
      chatName: chat.name || 'Chat Privado'
    });
    
    logger.error('Erro no processamento da mensagem:', error);
    try {
      await msg.reply('🤖 Ops! Algo deu errado aqui. Pode tentar novamente?');
    } catch (replyError) {
      await errorLogger.logError(replyError, {
        context: 'error_reply_failed',
        originalError: error.message
      });
      logger.error('Erro ao enviar mensagem de erro:', replyError);
    }
  }
});

// Inicialização
async function initialize() {
  try {
    logger.info('INIT: Iniciando Ceros AI...');
    
    await loadMemory();
    logger.info('MEMORY: Memória carregada com sucesso');

    // Carrega sistema de autenticação
    await authManager.loadAuth();
    logger.info('AUTH: Sistema de autenticação inicializado');

    // Inicia servidor da API
    startAPIServer();
    logger.info('API: Control Panel inicializada');

    // Save automático da memória e auth
    setInterval(async () => {
      try {
        await saveMemory();
        await authManager.saveAuth();
        logger.debug('💾 Dados salvos automaticamente');
      } catch (error) {
        logger.error('Erro no save automático:', error);
      }
    }, 30000);

    // Backup automático (a cada 6 horas)
    setInterval(async () => {
      try {
        await createBackup();
        logger.info('BACKUP: Backup automatico criado');
      } catch (error) {
        logger.error('Erro no backup automático:', error);
      }
    }, 6 * 60 * 60 * 1000);

    // Limpeza automática de logs de erro e sessões (diariamente)
    setInterval(async () => {
      try {
        await errorLogger.cleanupOldLogs(7); // Remove logs mais antigos que 7 dias
        await authManager.cleanupExpiredSessions(); // Limpa sessões expiradas
      } catch (error) {
        logger.error('Erro na limpeza automática:', error);
      }
    }, 24 * 60 * 60 * 1000);

    // Inicializa o cliente
    logger.info('🔗 Inicializando conexão com WhatsApp...');
    await client.initialize();
    
  } catch (error) {
    logger.error('FATAL: Erro fatal na inicialização do WhatsApp:', error.message || error);
    logger.error('💡 Dica: Certifique-se de que não há outro bot rodando e que o WhatsApp Web pode ser acessado');
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('SHUTDOWN: Recebido SIGINT, fazendo shutdown graceful...');
  await saveMemory();
  await createBackup();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('🔄 Recebido SIGTERM, fazendo shutdown graceful...');
  await saveMemory();
  await createBackup();
  process.exit(0);
});

// ...existing code...

// Chama a função de inicialização após a definição
initialize();
