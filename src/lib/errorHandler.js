// src/lib/errorHandler.js
import { promises as fs } from 'fs';
import { join } from 'path';
import { logger } from './logger.js';

const ERROR_LOG_DIR = process.env.ERROR_LOG_DIR || './logs/errors';
const MAX_ERROR_LOGS = parseInt(process.env.MAX_ERROR_LOGS) || 100;

/**
 * Analisador inteligente de erros
 */
class ErrorAnalyzer {
  
  /**
   * Analisa um erro e identifica a causa provável
   */
  static analyzeError(error, context = {}) {
    const analysis = {
      errorType: error.constructor.name,
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      context,
      category: 'unknown',
      severity: 'medium',
      possibleCauses: [],
      suggestedFixes: [],
      isRecoverable: true
    };

    // Análise baseada na mensagem de erro
    const message = error.message.toLowerCase();
    const stack = error.stack?.toLowerCase() || '';

    // ===== ERROS DE CONEXÃO =====
    if (message.includes('fetch') || message.includes('econnrefused') || message.includes('enotfound')) {
      analysis.category = 'connection';
      analysis.severity = 'high';
      analysis.possibleCauses = [
        'Servidor LLM offline ou inacessível',
        'Problema de rede ou firewall',
        'URL do endpoint incorreta',
        'Porta bloqueada ou serviço parado'
      ];
      analysis.suggestedFixes = [
        'Verificar se LM Studio está rodando',
        'Testar conexão: curl ' + (process.env.API_ENDPOINT || 'http://localhost:1234'),
        'Verificar API_ENDPOINT no .env',
        'Reiniciar LM Studio',
        'Verificar firewall/antivírus'
      ];
    }

    // ===== ERROS DE TIMEOUT =====
    else if (message.includes('aborted') || message.includes('timeout')) {
      analysis.category = 'timeout';
      analysis.severity = 'medium';
      analysis.possibleCauses = [
        'Modelo LLM muito lento para responder',
        'Prompt muito longo ou complexo',
        'Recursos insuficientes (CPU/GPU/RAM)',
        'Modelo sobrecarregado'
      ];
      analysis.suggestedFixes = [
        'Aumentar REQUEST_TIMEOUT no .env',
        'Reduzir MAX_HISTORY_MESSAGES',
        'Reduzir MAX_TOKENS',
        'Executar: npm run optimize',
        'Usar modelo menor/mais rápido',
        'Fechar outros programas pesados'
      ];
    }

    // ===== ERROS DE AUTENTICAÇÃO WHATSAPP =====
    else if (message.includes('qr') || message.includes('auth') || stack.includes('whatsapp')) {
      analysis.category = 'whatsapp_auth';
      analysis.severity = 'high';
      analysis.possibleCauses = [
        'Sessão do WhatsApp expirada',
        'QR Code não foi escaneado',
        'WhatsApp desconectado do celular',
        'Conta WhatsApp temporariamente bloqueada'
      ];
      analysis.suggestedFixes = [
        'Escanear novo QR Code',
        'Deletar pasta wwebjs_auth e reconectar',
        'Verificar se WhatsApp está ativo no celular',
        'Aguardar se conta foi temporariamente limitada',
        'Verificar conexão com internet'
      ];
    }

    // ===== ERROS DE MEMÓRIA =====
    else if (message.includes('memory') || message.includes('heap') || message.includes('enomem')) {
      analysis.category = 'memory';
      analysis.severity = 'high';
      analysis.isRecoverable = false;
      analysis.possibleCauses = [
        'Memória RAM insuficiente',
        'Memory leak no aplicativo',
        'Muitas conversas em memória',
        'Histórico muito longo'
      ];
      analysis.suggestedFixes = [
        'Reiniciar o bot',
        'Executar: npm run cleanup',
        'Reduzir MAX_HISTORY_MESSAGES',
        'Limpar memória: /limparmemoria',
        'Adicionar mais RAM ao sistema'
      ];
    }

    // ===== ERROS DE ARQUIVO =====
    else if (message.includes('enoent') || message.includes('file') || message.includes('directory')) {
      analysis.category = 'filesystem';
      analysis.severity = 'medium';
      analysis.possibleCauses = [
        'Arquivo ou diretório não encontrado',
        'Permissões insuficientes',
        'Disco cheio',
        'Caminho incorreto'
      ];
      analysis.suggestedFixes = [
        'Verificar se arquivo/pasta existe',
        'Verificar permissões de escrita',
        'Verificar espaço em disco',
        'Executar: npm run setup'
      ];
    }

    // ===== ERROS DE RATE LIMIT =====
    else if (message.includes('rate') || message.includes('limit') || message.includes('429')) {
      analysis.category = 'rate_limit';
      analysis.severity = 'low';
      analysis.possibleCauses = [
        'Muitas requisições em pouco tempo',
        'API limitando requests',
        'Sistema de rate limit ativado'
      ];
      analysis.suggestedFixes = [
        'Aguardar alguns minutos',
        'Reduzir MAX_REQUESTS_PER_MINUTE',
        'Usar: /resetrate all'
      ];
    }

    // ===== ERROS DE API/LLM =====
    else if (message.includes('400') || message.includes('401') || message.includes('500')) {
      analysis.category = 'api_error';
      analysis.severity = 'high';
      analysis.possibleCauses = [
        'Erro no servidor LLM',
        'Parâmetros inválidos enviados',
        'Modelo não suporta a requisição',
        'Servidor sobrecarregado'
      ];
      analysis.suggestedFixes = [
        'Verificar logs do LM Studio',
        'Testar conexão: /testllm',
        'Reiniciar LM Studio',
        'Verificar configurações do modelo'
      ];
    }

    // ===== ERROS DE JSON/PARSING =====
    else if (message.includes('json') || message.includes('parse') || message.includes('syntax')) {
      analysis.category = 'parsing';
      analysis.severity = 'medium';
      analysis.possibleCauses = [
        'Resposta malformada da API',
        'Arquivo de configuração corrompido',
        'Dados de memória corrompidos'
      ];
      analysis.suggestedFixes = [
        'Verificar formato da resposta da API',
        'Executar: npm run health',
        'Restaurar backup: /restore [id]'
      ];
    }

    // ===== OUTROS ERROS =====
    else {
      analysis.possibleCauses = [
        'Erro não catalogado',
        'Problema específico do contexto',
        'Bug no código'
      ];
      analysis.suggestedFixes = [
        'Verificar logs detalhados',
        'Reiniciar o bot',
        'Executar: npm run health'
      ];
    }

    return analysis;
  }

  /**
   * Determina se um erro é crítico
   */
  static isCriticalError(analysis) {
    return analysis.severity === 'high' && !analysis.isRecoverable;
  }

  /**
   * Gera sugestões automáticas de correção
   */
  static generateAutoFix(analysis) {
    const autoFixes = [];

    switch (analysis.category) {
      case 'connection':
        autoFixes.push('Testar conexão LLM automaticamente em 30s');
        break;
      case 'timeout':
        autoFixes.push('Aplicar otimizações de performance automaticamente');
        break;
      case 'memory':
        autoFixes.push('Limpeza automática de memória agendada');
        break;
      case 'whatsapp_auth':
        autoFixes.push('Tentativa de reconexão automática agendada');
        break;
    }

    return autoFixes;
  }
}

/**
 * Sistema de logging de erros
 */
class ErrorLogger {
  
  constructor() {
    this.errorCounts = new Map(); // Contador de erros por tipo
    this.recentErrors = []; // Histórico recente
    this.maxRecentErrors = 50;
  }

  /**
   * Garante que o diretório de logs existe
   */
  async ensureLogDir() {
    try {
      await fs.mkdir(ERROR_LOG_DIR, { recursive: true });
    } catch (error) {
      logger.error('Erro ao criar diretório de logs:', error);
    }
  }

  /**
   * Registra um erro com análise completa
   */
  async logError(error, context = {}) {
    try {
      await this.ensureLogDir();

      // Análise do erro
      const analysis = ErrorAnalyzer.analyzeError(error, context);
      
      // Incrementa contador
      const errorKey = `${analysis.category}:${analysis.errorType}`;
      this.errorCounts.set(errorKey, (this.errorCounts.get(errorKey) || 0) + 1);

      // Adiciona ao histórico recente
      this.recentErrors.unshift(analysis);
      if (this.recentErrors.length > this.maxRecentErrors) {
        this.recentErrors.pop();
      }

      // Log estruturado
      const logEntry = {
        id: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        ...analysis,
        occurrenceCount: this.errorCounts.get(errorKey),
        autoFixes: ErrorAnalyzer.generateAutoFix(analysis)
      };

      // Salva em arquivo JSON
      const filename = `error_${new Date().toISOString().split('T')[0]}.json`;
      const filepath = join(ERROR_LOG_DIR, filename);
      
      let dailyErrors = [];
      try {
        const existingData = await fs.readFile(filepath, 'utf-8');
        dailyErrors = JSON.parse(existingData);
      } catch (e) {
        // Arquivo não existe ainda
      }

      dailyErrors.push(logEntry);
      
      // Limita número de erros por dia
      if (dailyErrors.length > MAX_ERROR_LOGS) {
        dailyErrors = dailyErrors.slice(-MAX_ERROR_LOGS);
      }

      await fs.writeFile(filepath, JSON.stringify(dailyErrors, null, 2));

      // Log no console
      this.logToConsole(analysis);

      return logEntry;

    } catch (logError) {
      logger.error('Erro ao salvar log de erro:', logError);
    }
  }

  /**
   * Log formatado no console
   */
  logToConsole(analysis) {
    const emoji = {
      connection: '🔌',
      timeout: '⏰', 
      whatsapp_auth: '📱',
      memory: '💾',
      filesystem: '📁',
      rate_limit: '🚦',
      api_error: '🌐',
      parsing: '📄',
      unknown: '❓'
    }[analysis.category] || '❌';

    const severityText = {
      low: '[BAIXA]',
      medium: '[MEDIA]',
      high: '[ALTA]'
    }[analysis.severity] || '[ALTA]';

    logger.error(`${emoji} ERRO [${analysis.category.toUpperCase()}] ${severityText} ${analysis.message}`);
    
    if (analysis.possibleCauses.length > 0) {
      logger.error('CAUSAS POSSIVEIS:');
      analysis.possibleCauses.forEach(cause => {
        logger.error(`   - ${cause}`);
      });
    }

    if (analysis.suggestedFixes.length > 0) {
      logger.error('SUGESTOES DE CORRECAO:');
      analysis.suggestedFixes.forEach(fix => {
        logger.error(`   - ${fix}`);
      });
    }
  }

  /**
   * Obtém estatísticas de erros
   */
  getErrorStats() {
    const totalErrors = Array.from(this.errorCounts.values()).reduce((sum, count) => sum + count, 0);
    const errorsByCategory = {};
    const errorsByType = {};

    this.recentErrors.forEach(error => {
      errorsByCategory[error.category] = (errorsByCategory[error.category] || 0) + 1;
      errorsByType[error.errorType] = (errorsByType[error.errorType] || 0) + 1;
    });

    return {
      totalErrors,
      recentErrorsCount: this.recentErrors.length,
      errorsByCategory,
      errorsByType,
      mostCommonError: this.getMostCommonError(),
      criticalErrorsCount: this.recentErrors.filter(e => e.severity === 'high').length
    };
  }

  /**
   * Identifica o erro mais comum
   */
  getMostCommonError() {
    let maxCount = 0;
    let mostCommon = null;

    for (const [errorKey, count] of this.errorCounts.entries()) {
      if (count > maxCount) {
        maxCount = count;
        mostCommon = errorKey;
      }
    }

    return mostCommon ? { error: mostCommon, count: maxCount } : null;
  }

  /**
   * Obtém erros recentes
   */
  getRecentErrors(limit = 10) {
    return this.recentErrors.slice(0, limit);
  }

  /**
   * Limpa todos os logs de erro
   */
  clearErrors() {
    this.recentErrors = [];
    this.errorCounts.clear();
  }

  /**
   * Limpa logs antigos
   */
  async cleanupOldLogs(daysOld = 30) {
    try {
      const files = await fs.readdir(ERROR_LOG_DIR);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);
      
      let removedCount = 0;
      
      for (const file of files) {
        if (file.startsWith('error_') && file.endsWith('.json')) {
          const filePath = join(ERROR_LOG_DIR, file);
          const stats = await fs.stat(filePath);
          
          if (stats.mtime < cutoffDate) {
            await fs.unlink(filePath);
            removedCount++;
          }
        }
      }
      
      if (removedCount > 0) {
        logger.info(`LIMPEZA: Removidos ${removedCount} logs de erro antigos`);
      }
      
    } catch (error) {
      logger.error('Erro na limpeza de logs:', error);
    }
  }
}

// Instância global
export const errorLogger = new ErrorLogger();

/**
 * Wrapper para capturar erros automaticamente
 */
export function withErrorHandling(fn, context = {}) {
  return async function(...args) {
    try {
      return await fn.apply(this, args);
    } catch (error) {
      await errorLogger.logError(error, { ...context, function: fn.name });
      throw error; // Re-throw para manter comportamento original
    }
  };
}

/**
 * Decorator para métodos de classe
 */
export function errorHandler(context = {}) {
  return function(target, propertyName, descriptor) {
    const method = descriptor.value;
    
    descriptor.value = async function(...args) {
      try {
        return await method.apply(this, args);
      } catch (error) {
        await errorLogger.logError(error, { 
          ...context, 
          class: target.constructor.name,
          method: propertyName 
        });
        throw error;
      }
    };
    
    return descriptor;
  };
}

export { ErrorAnalyzer };
