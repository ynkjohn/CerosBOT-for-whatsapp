// src/api/server.js
import express from 'express';
import { logActivity, getActivityLog } from '../lib/activityLogger.js';
import cors from 'cors';
import { promises as fs } from 'fs';
import { join } from 'path';
import { getMemoryStats, clearMemory, cleanupInactiveChats } from '../lib/memory.js';
import { getRateLimitStats, rateLimiter } from '../lib/rateLimit.js';
import { testLLMConnection, getModelInfo } from '../lib/llm.js';
import { createBackup, listBackups, restoreBackup, deleteBackup } from '../lib/backup.js';
import { authManager } from '../lib/auth.js';
import { errorLogger } from '../lib/errorHandler.js';
import { logger } from '../lib/logger.js';

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Endpoint para logs de atividade (deve vir após o app e middlewares)
app.get('/api/activity', async (req, res) => {
  try {
    const log = await getActivityLog();
    res.json({ success: true, data: log });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Store para o status do bot
let botStatus = {
  connected: false,
  uptime: 0,
  lastUpdate: new Date()
};

// Função para atualizar status do bot (será chamada pelo bot principal)
export function updateBotStatus(status) {
  botStatus = {
    ...botStatus,
    ...status,
    lastUpdate: new Date()
  };
}

// ==================== ROTAS DA API ====================

// Status geral do sistema
app.get('/api/status', (req, res) => {
  try {
    const memStats = getMemoryStats();
    const rateStats = getRateLimitStats();
    const modelInfo = getModelInfo();
    
    res.json({
      success: true,
      data: {
        bot: {
          connected: botStatus.connected,
          uptime: Math.floor(process.uptime()),
          lastUpdate: botStatus.lastUpdate
        },
        memory: {
          chatCount: memStats.chatCount,
          totalMessages: memStats.totalMessages,
          memorySizeKB: memStats.memorySizeKB,
          avgMessagesPerChat: memStats.avgMessagesPerChat
        },
        rateLimit: {
          totalUsers: rateStats.totalUsers,
          activeUsersHour: rateStats.activeUsersHour,
          totalRequestsHour: rateStats.totalRequestsHour
        },
        model: {
          name: modelInfo.model,
          endpoint: modelInfo.endpoint
        },
        system: {
          nodeMemoryMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          platform: process.platform
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Configurações do .env
app.get('/api/config', async (req, res) => {
  try {
    const envContent = await fs.readFile('.env', 'utf-8');
    const config = {};
    
    envContent.split('\n').forEach(rawLine => {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) return; // ignora comentários e linhas vazias

      const [keyPart, ...valueParts] = line.split('=');
      if (!keyPart) return;

      const key = keyPart.trim();
      const value = valueParts.join('=').trim();

      if (key && value !== undefined) {
        config[key] = value;
      }
    });
    
    res.json({ success: true, data: config });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Salvar configurações no .env
app.post('/api/config', async (req, res) => {
  try {
    const newConfig = req.body;
    
    // Validação de entrada básica
    if (!newConfig || typeof newConfig !== 'object') {
      return res.status(400).json({ success: false, error: 'Configuração inválida' });
    }
    let envContent = '';
    
    // Lê o .env atual para preservar comentários
    try {
      envContent = await fs.readFile('.env', 'utf-8');
    } catch (e) {
      // Se não existir, cria novo
    }
    
    // Atualiza apenas as chaves fornecidas
    const lines = envContent.split('\n');
    const updatedKeys = new Set();
    
    const newLines = lines.map(line => {
      const [key] = line.split('=');
      if (key && newConfig.hasOwnProperty(key.trim()) && !key.startsWith('#')) {
        updatedKeys.add(key.trim());
        return `${key.trim()}=${newConfig[key.trim()]}`;
      }
      return line;
    });
    
    // Adiciona novas chaves que não existiam
    Object.entries(newConfig).forEach(([key, value]) => {
      if (!updatedKeys.has(key)) {
        newLines.push(`${key}=${value}`);
      }
    });
    
    await fs.writeFile('.env', newLines.join('\n'));
    
    logger.info('🔧 Configurações atualizadas via Control Panel');
    res.json({ success: true, message: 'Configurações salvas! Reinicie o bot para aplicar.' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Testar conexão com LLM
app.post('/api/test-llm', async (req, res) => {
  try {
    const result = await testLLMConnection();
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Estatísticas detalhadas
app.get('/api/stats', (req, res) => {
  try {
    const memStats = getMemoryStats();
    const rateStats = getRateLimitStats();
    const errorStats = errorLogger.getErrorStats();
    
    res.json({
      success: true,
      data: {
        memory: memStats,
        rateLimit: rateStats,
        errors: errorStats,
        system: {
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          platform: process.platform,
          nodeVersion: process.version
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Logs recentes
app.get('/api/logs', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const errors = errorLogger.getRecentErrors(limit);
    
    res.json({
      success: true,
      data: {
        errors: errors,
        stats: errorLogger.getErrorStats()
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/logs', async (req, res) => {
  try {
    errorLogger.clearErrors();
    res.json({
      success: true,
      message: 'Logs limpos com sucesso'
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Ações do sistema
app.post('/api/actions/:action', async (req, res) => {
  try {
    const { action } = req.params;
    const { params = {} } = req.body;
    
    switch (action) {
      case 'clear-memory':
        const result = clearMemory();
        logger.info('🧹 Memória limpa via Control Panel');
        res.json({ 
          success: true, 
          message: `Memória limpa! ${result.chatCount} chats e ${result.totalMessages} mensagens removidas.` 
        });
        break;
        
      case 'cleanup-chats':
        const days = parseInt(params.days) || 30;
        if (days < 1 || days > 365) {
          return res.status(400).json({ success: false, error: 'Dias deve estar entre 1 e 365' });
        }
        const cleanupResult = cleanupInactiveChats(days);
        logger.info(`🧹 Cleanup de chats inativos (${days} dias) via Control Panel`);
        res.json({
          success: true,
          message: `Cleanup concluído! ${cleanupResult.removedChats} chats removidos.`,
          data: cleanupResult
        });
        break;
        
      case 'reset-rate-limit':
        const phone = params.phone;
        let resetResult;
        
        if (phone === 'all') {
          resetResult = rateLimiter.resetAll();
          logger.info('🔄 Rate limit resetado para todos os usuários via Control Panel');
          res.json({
            success: true,
            message: `Rate limit resetado para ${resetResult} usuários.`
          });
        } else if (phone) {
          resetResult = rateLimiter.resetUser(phone);
          logger.info(`🔄 Rate limit resetado para ${phone} via Control Panel`);
          res.json({
            success: true,
            message: resetResult ? `Rate limit resetado para ${phone}.` : 'Usuário não encontrado.'
          });
        } else {
          res.status(400).json({ success: false, error: 'Parâmetro phone é obrigatório' });
        }
        break;
        
      case 'create-backup':
        const backupId = await createBackup();
        logger.info('💾 Backup criado via Control Panel');
        res.json({
          success: true,
          message: 'Backup criado com sucesso!',
          data: { backupId }
        });
        break;
        
      case 'restart-bot':
        logger.info('🔄 Reinicializando bot via Control Panel');
        
        // Verificar se está rodando com PM2
        if (process.env.PM2_HOME || process.env.name === 'cerosai-bot') {
          // Import dinâmico para ES6
          const { exec } = await import('child_process');
          
          res.json({
            success: true,
            message: 'Bot será reiniciado via PM2...'
          });
          
          // Usar PM2 restart
          setTimeout(() => {
            exec('pm2 restart cerosai-bot', (error, stdout, stderr) => {
              if (error) {
                logger.error('Erro no PM2 restart:', error);
                // Fallback para process.exit se PM2 falhar
                process.exit(0);
              } else {
                logger.info('PM2 restart executado com sucesso');
              }
            });
          }, 1000);
        } else {
          // Fallback para restart manual se não estiver usando PM2
          res.json({
            success: true,
            message: 'Bot será reiniciado em 2 segundos...'
          });
          setTimeout(() => process.exit(0), 2000);
        }
        break;
        
      default:
        res.status(400).json({ success: false, error: 'Ação não reconhecida' });
    }
  } catch (error) {
    logger.error('Erro na ação:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Backups
app.get('/api/backups', async (req, res) => {
  try {
    const backups = await listBackups();
    res.json({ success: true, data: backups });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/backups/restore/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await restoreBackup(id);
    logger.info(`🔄 Backup ${id} restaurado via Control Panel`);
    res.json({
      success: true,
      message: 'Backup restaurado com sucesso!',
      data: result
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/backups/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    await deleteBackup(filename);
    logger.info(`🗑️ Backup ${filename} deletado via Control Panel`);
    res.json({
      success: true,
      message: `Backup ${filename} deletado com sucesso!`
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Usuários admin
app.get('/api/users', (req, res) => {
  try {
    const users = authManager.listUsers();
    const sessions = authManager.listSessions();
    
    res.json({
      success: true,
      data: {
        users: users,
        sessions: sessions,
        stats: authManager.getStats()
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/users', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Validação de entrada
    if (!username || typeof username !== 'string' || username.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'Username é obrigatório e deve ser uma string não vazia' });
    }
    
    if (!password || typeof password !== 'string' || password.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'Password é obrigatório e deve ser uma string não vazia' });
    }
    
    if (username.trim().length < 3) {
      return res.status(400).json({ success: false, error: 'Username deve ter pelo menos 3 caracteres' });
    }
    
    if (password.trim().length < 6) {
      return res.status(400).json({ success: false, error: 'Password deve ter pelo menos 6 caracteres' });
    }
    
    await authManager.createUser(username.trim(), password.trim(), 'control-panel');
    logger.info(`👤 Usuário ${username.trim()} criado via Control Panel`);
    res.json({
      success: true,
      message: `Usuário ${username.trim()} criado com sucesso!`
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.delete('/api/users/:username', async (req, res) => {
  try {
    const { username } = req.params;
    await authManager.removeUser(username);
    logger.info(`👤 Usuário ${username} removido via Control Panel`);
    res.json({
      success: true,
      message: `Usuário ${username} removido com sucesso!`
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Middleware de erro
app.use((err, req, res, next) => {
  logger.error('Erro na API:', err);
  res.status(500).json({ success: false, error: 'Erro interno do servidor' });
});

// Iniciar servidor
export function startAPIServer() {
  app.listen(PORT, () => {
    logger.info(`API: Control Panel rodando em http://localhost:${PORT}`);
  });
}
