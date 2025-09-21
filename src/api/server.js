// src/api/server.js
import express from 'express';
import { logActivity, getActivityLog } from '../lib/activityLogger.js';
import cors from 'cors';
import { promises as fs } from 'fs';
import { join } from 'path';
import { exec } from 'child_process';
import { getMemoryStats, clearMemory, cleanupInactiveChats } from '../lib/memory.js';
import { getRateLimitStats, rateLimiter } from '../lib/rateLimit.js';
import { testLLMConnection, getModelInfo } from '../lib/llm.js';
import { createBackup, listBackups, restoreBackup, deleteBackup } from '../lib/backup.js';
import { authManager } from '../lib/auth.js';
import { errorLogger, withErrorHandling } from '../lib/errorHandler.js';
import { performanceMonitor } from '../lib/performance.js';
import { logger } from '../lib/logger.js';

const app = express();
const PORT = process.env.PORT || 3001;

/**
 * Configurações de segurança e middleware
 */
const setupSecurityMiddleware = () => {
  // Headers de segurança
  app.use((req, res, next) => {
    // Previne ataques de clickjacking
    res.setHeader('X-Frame-Options', 'DENY');
    
    // Previne MIME type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');
    
    // XSS Protection (para navegadores legados)
    res.setHeader('X-XSS-Protection', '1; mode=block');
    
    // Controle de cache para dados sensíveis
    if (req.path.includes('/api/')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    }
    
    // CORS personalizado com validação de origem
    const allowedOrigins = [
      'http://localhost:3001',
      'http://127.0.0.1:3001',
      'app://.' // Para Electron
    ];
    
    const origin = req.headers.origin;
    if (!origin || allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin || '*');
    }
    
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    
    next();
  });

  // Rate limiting básico para API
  app.use('/api/', (req, res, next) => {
    const key = req.ip || 'unknown';
    if (rateLimiter.isLimited(key, 'api')) {
      return res.status(429).json({
        success: false,
        error: 'Muitas requisições. Tente novamente em alguns minutos.',
        retryAfter: 60
      });
    }
    next();
  });

  // Parsing com limites de segurança
  app.use(express.json({ 
    limit: '1mb',
    strict: true
  }));
  
  app.use(express.urlencoded({ 
    extended: false,
    limit: '1mb'
  }));
};

/**
 * Middleware de validação de entrada
 */
const validateInput = (schema) => {
  return (req, res, next) => {
    const { body, query, params } = req;
    const data = { ...body, ...query, ...params };
    
    for (const [key, rules] of Object.entries(schema)) {
      const value = data[key];
      
      if (rules.required && (value === undefined || value === null || value === '')) {
        return res.status(400).json({
          success: false,
          error: `Campo obrigatório: ${key}`,
          field: key
        });
      }
      
      if (value !== undefined) {
        if (rules.type && typeof value !== rules.type) {
          return res.status(400).json({
            success: false,
            error: `Tipo inválido para ${key}. Esperado: ${rules.type}`,
            field: key
          });
        }
        
        if (rules.minLength && value.length < rules.minLength) {
          return res.status(400).json({
            success: false,
            error: `${key} deve ter pelo menos ${rules.minLength} caracteres`,
            field: key
          });
        }
        
        if (rules.maxLength && value.length > rules.maxLength) {
          return res.status(400).json({
            success: false,
            error: `${key} deve ter no máximo ${rules.maxLength} caracteres`,
            field: key
          });
        }
        
        if (rules.pattern && !rules.pattern.test(value)) {
          return res.status(400).json({
            success: false,
            error: `Formato inválido para ${key}`,
            field: key
          });
        }
      }
    }
    
    next();
  };
};

// Configurar middleware de segurança
setupSecurityMiddleware();

/**
 * Endpoint para logs de atividade com paginação e filtros
 * @route GET /api/activity
 * @query {number} page - Página (padrão: 1)
 * @query {number} limit - Limite por página (padrão: 50, máximo: 100)
 * @query {string} type - Filtro por tipo de atividade
 * @query {string} since - Data mínima (ISO string)
 */
app.get('/api/activity', withErrorHandling(async (req, res) => {
  const { 
    page = 1, 
    limit = 50, 
    type = null, 
    since = null 
  } = req.query;

  // Validação de parâmetros
  const pageNum = Math.max(1, parseInt(page) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 50));
  
  const options = {
    page: pageNum,
    limit: limitNum,
    type: type || undefined,
    since: since ? new Date(since) : undefined
  };

  const log = await getActivityLog(options);
  
  // Registrar acesso para auditoria
  await logActivity('api_activity_accessed', {
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    params: options
  });

  res.json({ 
    success: true, 
    data: log,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total: log.total || 0
    }
  });
}, { context: 'api_activity' }));

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

/**
 * Status geral do sistema com métricas avançadas
 * @route GET /api/status
 * @query {boolean} detailed - Se deve incluir métricas detalhadas
 */
app.get('/api/status', withErrorHandling(async (req, res) => {
  const detailed = req.query.detailed === 'true';
  
  const memStats = getMemoryStats();
  const rateStats = getRateLimitStats();
  const modelInfo = getModelInfo();
  const perfStats = performanceMonitor.getStats();
  const errorStats = errorLogger.getErrorStats({ timeframe: '24h' });
  
  const response = {
    success: true,
    data: {
      bot: {
        connected: botStatus.connected,
        uptime: Math.floor(process.uptime()),
        lastUpdate: botStatus.lastUpdate,
        health: errorStats.overview?.systemHealth || 100
      },
      memory: {
        chatCount: memStats.totalChats,
        totalMessages: memStats.totalMessages,
        memorySizeKB: memStats.memoryUsageKB,
        memorySizeMB: memStats.memoryUsageMB,
        avgMessagesPerChat: memStats.averageMessagesPerChat,
        largestChat: memStats.largestChat
      },
      rateLimit: {
        totalUsers: rateStats.totalUsers || 0,
        activeUsersHour: rateStats.activeUsersHour || 0,
        totalRequestsHour: rateStats.totalRequestsHour || 0
      },
      model: {
        name: modelInfo.model,
        endpoint: modelInfo.endpoint,
        maxTokens: modelInfo.maxTokens,
        temperature: modelInfo.temperature
      },
      performance: {
        avgResponseTime: Math.round(perfStats.avgTime / 1000), // em segundos
        isSlow: perfStats.isSlow,
        successRate: perfStats.successRate,
        throughput: perfStats.throughput
      },
      errors: {
        recentCount: errorStats.overview?.recentErrorsCount || 0,
        criticalCount: errorStats.overview?.criticalErrorsCount || 0,
        errorRate: errorStats.overview?.errorRate || 0
      },
      system: {
        nodeMemoryMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        nodeMemoryRssMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
        platform: process.platform,
        nodeVersion: process.version,
        pid: process.pid
      }
    },
    timestamp: new Date().toISOString()
  };

  // Incluir métricas detalhadas se solicitado
  if (detailed) {
    response.data.detailed = {
      performance: perfStats,
      errors: errorStats,
      memory: memStats
    };
  }

  res.json(response);
}, { context: 'api_status' }));

/**
 * Configurações do .env com validação e sanitização
 * @route GET /api/config
 * @query {boolean} secure - Se deve ocultar valores sensíveis (padrão: true)
 */
app.get('/api/config', withErrorHandling(async (req, res) => {
  const secure = req.query.secure !== 'false'; // padrão true
  
  const envContent = await fs.readFile('.env', 'utf-8');
  const config = {};
  const sensitiveKeys = [
    'API_KEY', 'SECRET', 'TOKEN', 'PASSWORD', 'PRIVATE_KEY',
    'DATABASE_URL', 'AUTH_SECRET'
  ];
  
  envContent.split('\n').forEach(rawLine => {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) return; // ignora comentários e linhas vazias

    const [keyPart, ...valueParts] = line.split('=');
    if (!keyPart) return;

    const key = keyPart.trim();
    let value = valueParts.join('=').trim();

    if (key && value !== undefined) {
      // Ocultar valores sensíveis se modo seguro estiver ativo
      if (secure && sensitiveKeys.some(sensitive => 
        key.toUpperCase().includes(sensitive.toUpperCase())
      )) {
        value = '*'.repeat(Math.min(value.length, 8));
      }
      
      config[key] = value;
    }
  });
  
  // Adicionar metadados úteis
  const metadata = {
    totalKeys: Object.keys(config).length,
    hiddenKeys: secure ? sensitiveKeys.filter(key => 
      Object.keys(config).some(configKey => 
        configKey.toUpperCase().includes(key)
      )
    ).length : 0,
    lastModified: (await fs.stat('.env')).mtime
  };
  
  res.json({ 
    success: true, 
    data: config,
    metadata 
  });
}, { context: 'api_config_read' }));

/**
 * Schema de validação para configurações
 */
const configValidationSchema = {
  API_ENDPOINT: {
    type: 'string',
    pattern: /^https?:\/\/.+/,
    required: false
  },
  MODEL_NAME: {
    type: 'string',
    minLength: 1,
    maxLength: 100,
    required: false
  },
  MAX_TOKENS: {
    type: 'string',
    pattern: /^\d+$/,
    required: false
  },
  TEMPERATURE: {
    type: 'string',
    pattern: /^[0-9]*\.?[0-9]+$/,
    required: false
  },
  MAX_HISTORY_MESSAGES: {
    type: 'string',
    pattern: /^\d+$/,
    required: false
  },
  REQUEST_TIMEOUT: {
    type: 'string',
    pattern: /^\d+$/,
    required: false
  },
  ADMIN_NUMBERS: {
    type: 'string',
    pattern: /^[\d,\s]+$/,
    required: false
  }
};

/**
 * Salvar configurações no .env com validação robusta
 * @route POST /api/config
 * @body {Object} config - Configurações a serem salvas
 */
app.post('/api/config', 
  validateInput(configValidationSchema),
  withErrorHandling(async (req, res) => {
    const newConfig = req.body;
    
    // Validação adicional de segurança
    const dangerousKeys = ['__proto__', 'constructor', 'prototype'];
    for (const key of Object.keys(newConfig)) {
      if (dangerousKeys.includes(key)) {
        return res.status(400).json({
          success: false,
          error: `Chave não permitida: ${key}`,
          field: key
        });
      }
    }

    // Validações específicas de domínio
    const validationErrors = [];
    
    if (newConfig.MAX_TOKENS) {
      const maxTokens = parseInt(newConfig.MAX_TOKENS);
      if (maxTokens < 50 || maxTokens > 8192) {
        validationErrors.push('MAX_TOKENS deve estar entre 50 e 8192');
      }
    }
    
    if (newConfig.TEMPERATURE) {
      const temp = parseFloat(newConfig.TEMPERATURE);
      if (temp < 0 || temp > 2) {
        validationErrors.push('TEMPERATURE deve estar entre 0 e 2');
      }
    }
    
    if (newConfig.MAX_HISTORY_MESSAGES) {
      const maxHistory = parseInt(newConfig.MAX_HISTORY_MESSAGES);
      if (maxHistory < 1 || maxHistory > 200) {
        validationErrors.push('MAX_HISTORY_MESSAGES deve estar entre 1 e 200');
      }
    }

    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Validação falhou',
        details: validationErrors
      });
    }

    // Backup do arquivo atual
    try {
      const currentEnv = await fs.readFile('.env', 'utf-8');
      const backupPath = `.env.backup.${Date.now()}`;
      await fs.writeFile(backupPath, currentEnv);
      logger.info('CONFIG: Backup criado em %s', backupPath);
    } catch (e) {
      logger.warn('CONFIG: Não foi possível criar backup do .env');
    }
    
    let envContent = '';
    
    // Lê o .env atual para preservar comentários e estrutura
    try {
      envContent = await fs.readFile('.env', 'utf-8');
    } catch (e) {
      // Se não existir, cria novo
      logger.info('CONFIG: Criando novo arquivo .env');
    }
    
    // Atualiza apenas as chaves fornecidas, preservando comentários
    const lines = envContent.split('\n');
    const updatedKeys = new Set();
    
    const newLines = lines.map(line => {
      const trimmedLine = line.trim();
      if (trimmedLine.startsWith('#') || !trimmedLine.includes('=')) {
        return line; // Preserva comentários e linhas vazias
      }
      
      const [key] = line.split('=');
      const trimmedKey = key?.trim();
      
      if (trimmedKey && newConfig.hasOwnProperty(trimmedKey)) {
        updatedKeys.add(trimmedKey);
        return `${trimmedKey}=${newConfig[trimmedKey]}`;
      }
      return line;
    });
    
    // Adiciona novas chaves que não existiam
    for (const [key, value] of Object.entries(newConfig)) {
      if (!updatedKeys.has(key)) {
        newLines.push(`${key}=${value}`);
      }
    }
    
    const finalContent = newLines.join('\n');
    await fs.writeFile('.env', finalContent);
    
    // Log da atividade de configuração
    await logActivity('config_updated', {
      updatedKeys: Object.keys(newConfig),
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    logger.info('CONFIG: Configuração atualizada via Control Panel (%d chaves)', 
      Object.keys(newConfig).length);
    
    res.json({ 
      success: true, 
      message: 'Configuração salva com sucesso',
      updatedKeys: Object.keys(newConfig)
    });
  }, { context: 'api_config_save' }));

/**
 * Testar conexão com LLM
 * @route POST /api/test-llm
 */
app.post('/api/test-llm', withErrorHandling(async (req, res) => {
  const result = await testLLMConnection();
  
  // Log da atividade de teste
  await logActivity('llm_test_performed', {
    success: result.success,
    working: result.working,
    ip: req.ip
  });
  
  res.json({ 
    success: true, 
    data: result,
    timestamp: new Date().toISOString()
  });
}, { context: 'api_test_llm' }));

/**
 * Estatísticas detalhadas do sistema
 * @route GET /api/stats
 * @query {string} timeframe - Período de análise ('1h', '24h', '7d', 'all')
 * @query {boolean} includePatterns - Se deve incluir padrões de erro
 */
app.get('/api/stats', withErrorHandling(async (req, res) => {
  const { timeframe = '24h', includePatterns = 'true' } = req.query;
  
  const memStats = getMemoryStats();
  const rateStats = getRateLimitStats();
  const perfStats = performanceMonitor.getStats({ timeframe });
  const errorStats = errorLogger.getErrorStats({ 
    timeframe,
    includePatterns: includePatterns === 'true'
  });
  
  const systemStats = {
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    cpu: process.cpuUsage(),
    platform: process.platform,
    nodeVersion: process.version,
    loadAverage: process.platform !== 'win32' ? process.loadavg() : null
  };
  
  // Calcular health score geral
  const healthScore = Math.round(
    (perfStats.successRate * 0.4) +
    (Math.max(0, 100 - perfStats.avgTime / 1000) * 0.3) +
    (errorStats.overview?.systemHealth || 100) * 0.3
  );
  
  res.json({
    success: true,
    data: {
      overview: {
        healthScore,
        uptime: Math.floor(systemStats.uptime),
        totalChats: memStats.totalChats,
        totalMessages: memStats.totalMessages,
        avgResponseTime: Math.round(perfStats.avgTime / 1000),
        successRate: perfStats.successRate,
        errorRate: errorStats.overview?.errorRate || 0
      },
      memory: memStats,
      performance: perfStats,
      rateLimit: rateStats,
      errors: errorStats,
      system: systemStats
    },
    metadata: {
      timeframe,
      generatedAt: new Date().toISOString(),
      includesPatterns: includePatterns === 'true'
    }
  });
}, { context: 'api_stats' }));

// Continue with other endpoints...

/**
 * Logs recentes com paginação e filtros
 * @route GET /api/logs
 * @query {number} limit - Limite de logs (padrão: 100, máximo: 500)
 * @query {string} severity - Filtro por severidade ('low', 'medium', 'high')
 * @query {string} category - Filtro por categoria
 */
app.get('/api/logs', withErrorHandling(async (req, res) => {
  const { 
    limit = 100, 
    severity = null, 
    category = null 
  } = req.query;
  
  const limitNum = Math.min(500, Math.max(1, parseInt(limit) || 100));
  let errors = errorLogger.getRecentErrors(limitNum);
  
  // Aplicar filtros se especificados
  if (severity) {
    errors = errors.filter(error => error.severity === severity);
  }
  
  if (category) {
    errors = errors.filter(error => error.category === category);
  }
  
  const stats = errorLogger.getErrorStats({ timeframe: '24h' });
  
  res.json({
    success: true,
    data: {
      errors,
      stats,
      filters: {
        severity,
        category,
        applied: !!(severity || category)
      }
    },
    metadata: {
      totalReturned: errors.length,
      limitApplied: limitNum,
      generatedAt: new Date().toISOString()
    }
  });
}, { context: 'api_logs' }));

/**
 * Limpar logs de erro
 * @route DELETE /api/logs
 */
app.delete('/api/logs', withErrorHandling(async (req, res) => {
  const initialStats = errorLogger.getErrorStats();
  errorLogger.clearErrors();
  
  await logActivity('logs_cleared', {
    initialErrorCount: initialStats.overview?.recentErrorsCount || 0,
    ip: req.ip
  });
  
  logger.info('LOGS: Logs de erro limpos via Control Panel');
  
  res.json({
    success: true,
    message: 'Logs limpos com sucesso',
    data: {
      clearedErrors: initialStats.overview?.recentErrorsCount || 0,
      clearedAt: new Date().toISOString()
    }
  });
}, { context: 'api_logs_clear' }));

// Ações do sistema
app.post('/api/actions/:action', async (req, res) => {
  try {
    logger.debug('API Action request:', { params: req.params, body: req.body });
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
        try {
          logger.info('🔄 Reinicializando bot via Control Panel');
          
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
                setTimeout(() => process.exit(0), 1000);
              } else {
                logger.info('PM2 restart executado com sucesso');
              }
            });
          }, 1000);
        } catch (error) {
          logger.error('Erro no restart-bot:', error);
          res.status(500).json({ success: false, error: error.message });
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
