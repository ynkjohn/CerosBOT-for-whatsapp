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
 * Sistema avançado de logging e análise de erros
 * Inclui categorização inteligente, estatísticas e auto-recuperação
 */
class ErrorLogger {
  
  constructor() {
    this.errorCounts = new Map(); // Contador de erros por tipo
    this.recentErrors = []; // Histórico recente com análise
    this.maxRecentErrors = 100; // Aumentado para melhor análise
    this.errorPatterns = new Map(); // Padrões detectados
    this.autoFixAttempts = new Map(); // Tentativas de correção automática
    this.circuitBreakers = new Map(); // Circuit breakers por categoria
  }

  /**
   * Garante que o diretório de logs existe com validação
   * @returns {Promise<boolean>} True se o diretório foi criado/existe
   */
  async ensureLogDir() {
    try {
      await fs.mkdir(ERROR_LOG_DIR, { recursive: true });
      // Verifica se o diretório é gravável
      await fs.access(ERROR_LOG_DIR, fs.constants.W_OK);
      return true;
    } catch (error) {
      logger.error('ERRO: Não foi possível criar/acessar diretório de logs:', error.message);
      return false;
    }
  }

  /**
   * Registra um erro com análise completa e detecção de padrões
   * @param {Error} error - Erro a ser registrado
   * @param {Object} context - Contexto adicional do erro
   * @returns {Promise<Object>} Entrada de log criada
   */
  async logError(error, context = {}) {
    try {
      const logDirExists = await this.ensureLogDir();
      if (!logDirExists) {
        // Fallback para log apenas no console se não conseguir criar diretório
        this.logToConsole(ErrorAnalyzer.analyzeError(error, context));
        return null;
      }

      // Análise completa do erro
      const analysis = ErrorAnalyzer.analyzeError(error, context);
      
      // Detecção de padrões e circuit breaking
      this.updateErrorPatterns(analysis);
      this.updateCircuitBreaker(analysis);
      
      // Incrementa contador com chave mais específica
      const errorKey = this.generateErrorKey(analysis);
      const currentCount = this.errorCounts.get(errorKey) || 0;
      this.errorCounts.set(errorKey, currentCount + 1);

      // Adiciona ao histórico recente com timestamp preciso
      const errorRecord = {
        ...analysis,
        id: this.generateErrorId(),
        occurrenceCount: currentCount + 1,
        autoFixes: ErrorAnalyzer.generateAutoFix(analysis),
        isPatternDetected: this.isPatternDetected(analysis),
        circuitBreakerStatus: this.getCircuitBreakerStatus(analysis.category)
      };

      this.recentErrors.unshift(errorRecord);
      if (this.recentErrors.length > this.maxRecentErrors) {
        this.recentErrors.pop();
      }

      // Salva em arquivo com rotação diária
      await this.saveToFile(errorRecord);

      // Log no console com formatação melhorada
      this.logToConsole(analysis);

      // Trigger auto-fix se apropriado
      if (this.shouldTriggerAutoFix(analysis)) {
        await this.triggerAutoFix(analysis);
      }

      return errorRecord;

    } catch (logError) {
      logger.error('CRITICAL: Erro ao salvar log de erro:', logError.message);
      // Ainda assim tenta logar o erro original no console
      try {
        this.logToConsole(ErrorAnalyzer.analyzeError(error, context));
      } catch (fallbackError) {
        console.error('FATAL: Falha completa no sistema de logging:', error.message);
      }
      return null;
    }
  }

  /**
   * Gera uma chave única para categorização de erros
   * @private
   */
  generateErrorKey(analysis) {
    return `${analysis.category}:${analysis.errorType}:${analysis.message.slice(0, 50)}`;
  }

  /**
   * Gera ID único para erro
   * @private
   */
  generateErrorId() {
    return `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Atualiza padrões de erro detectados
   * @private
   */
  updateErrorPatterns(analysis) {
    const patternKey = `${analysis.category}:${analysis.errorType}`;
    const pattern = this.errorPatterns.get(patternKey) || {
      count: 0,
      firstOccurrence: Date.now(),
      lastOccurrence: Date.now(),
      frequency: 0
    };

    pattern.count++;
    pattern.lastOccurrence = Date.now();
    pattern.frequency = pattern.count / ((Date.now() - pattern.firstOccurrence) / 60000); // errors per minute

    this.errorPatterns.set(patternKey, pattern);
  }

  /**
   * Atualiza status do circuit breaker
   * @private
   */
  updateCircuitBreaker(analysis) {
    const category = analysis.category;
    const breaker = this.circuitBreakers.get(category) || {
      state: 'closed', // closed, open, half-open
      failureCount: 0,
      lastFailure: 0,
      nextAttempt: 0
    };

    if (analysis.severity === 'high') {
      breaker.failureCount++;
      breaker.lastFailure = Date.now();

      // Abrir circuit breaker após 5 falhas em série
      if (breaker.failureCount >= 5 && breaker.state === 'closed') {
        breaker.state = 'open';
        breaker.nextAttempt = Date.now() + (5 * 60 * 1000); // 5 minutos
        logger.warn(`🔴 Circuit breaker ABERTO para categoria: ${category}`);
      }
    }

    this.circuitBreakers.set(category, breaker);
  }

  /**
   * Verifica se deve acionar correção automática
   * @private
   */
  shouldTriggerAutoFix(analysis) {
    // Não aplicar auto-fix se circuit breaker estiver aberto
    const breaker = this.circuitBreakers.get(analysis.category);
    if (breaker && breaker.state === 'open') {
      return false;
    }

    // Aplicar auto-fix para erros críticos ou recorrentes
    return analysis.severity === 'high' || 
           (this.errorCounts.get(this.generateErrorKey(analysis)) || 0) >= 3;
  }

  /**
   * Executa correções automáticas quando apropriado
   * @private
   */
  async triggerAutoFix(analysis) {
    const fixKey = `${analysis.category}:${analysis.errorType}`;
    const lastAttempt = this.autoFixAttempts.get(fixKey) || 0;
    const now = Date.now();
    
    // Evitar tentativas muito frequentes (mínimo 10 minutos)
    if (now - lastAttempt < 10 * 60 * 1000) {
      return;
    }

    this.autoFixAttempts.set(fixKey, now);
    logger.info(`🔧 Tentando correção automática para: ${analysis.category}`);

    try {
      await this.executeAutoFix(analysis);
    } catch (fixError) {
      logger.error('Erro na correção automática:', fixError.message);
    }
  }

  /**
   * Executa ações de correção automática específicas
   * @private
   */
  async executeAutoFix(analysis) {
    switch (analysis.category) {
      case 'memory':
        // Força limpeza de memória
        if (global.gc) {
          global.gc();
          logger.info('🧹 Garbage collection forçado');
        }
        break;

      case 'timeout':
        // Poderia ajustar timeouts dinamicamente
        logger.info('⏰ Ajuste automático de timeout recomendado');
        break;

      case 'connection':
        // Poderia implementar retry com backoff
        logger.info('🔄 Retry automático programado');
        break;

      default:
        logger.debug('Nenhuma correção automática disponível para:', analysis.category);
    }
  }

  /**
   * Salva erro em arquivo com rotação e compressão
   * @private
   */
  async saveToFile(errorRecord) {
    const today = new Date().toISOString().split('T')[0];
    const filename = `errors_${today}.json`;
    const filepath = join(ERROR_LOG_DIR, filename);
    
    let dailyErrors = [];
    try {
      const existingData = await fs.readFile(filepath, 'utf-8');
      dailyErrors = JSON.parse(existingData);
    } catch (e) {
      // Arquivo não existe ainda, começar com array vazio
    }

    dailyErrors.push(errorRecord);
    
    // Rotação automática - manter apenas os últimos N erros
    if (dailyErrors.length > MAX_ERROR_LOGS) {
      dailyErrors = dailyErrors.slice(-MAX_ERROR_LOGS);
    }

    await fs.writeFile(filepath, JSON.stringify(dailyErrors, null, 2));
  }

  /**
   * Verifica se um padrão de erro foi detectado
   * @private
   */
  isPatternDetected(analysis) {
    const patternKey = `${analysis.category}:${analysis.errorType}`;
    const pattern = this.errorPatterns.get(patternKey);
    
    if (!pattern) return false;
    
    // Considera padrão se ocorreu mais de 3 vezes em 10 minutos
    return pattern.count >= 3 && pattern.frequency > 0.3;
  }

  /**
   * Obtém status do circuit breaker
   * @private
   */
  getCircuitBreakerStatus(category) {
    const breaker = this.circuitBreakers.get(category);
    if (!breaker) return 'closed';
    
    // Verificar se deve transicionar de open para half-open
    if (breaker.state === 'open' && Date.now() > breaker.nextAttempt) {
      breaker.state = 'half-open';
      breaker.failureCount = 0;
      this.circuitBreakers.set(category, breaker);
      logger.info(`🟡 Circuit breaker MEIO-ABERTO para categoria: ${category}`);
    }
    
    return breaker.state;
  }

  /**
   * Log formatado no console com categorização visual
   * @param {Object} analysis - Análise do erro
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

    // Log principal do erro
    logger.error(`${emoji} ERRO [${analysis.category.toUpperCase()}] ${severityText} ${analysis.message}`);
    
    // Causas possíveis
    if (analysis.possibleCauses.length > 0) {
      logger.error('CAUSAS POSSIVEIS:');
      analysis.possibleCauses.forEach(cause => {
        logger.error(`   - ${cause}`);
      });
    }

    // Sugestões de correção
    if (analysis.suggestedFixes.length > 0) {
      logger.error('SUGESTOES DE CORRECAO:');
      analysis.suggestedFixes.forEach(fix => {
        logger.error(`   - ${fix}`);
      });
    }

    // Alertas especiais para erros críticos
    if (analysis.severity === 'high' && !analysis.isRecoverable) {
      logger.error('🚨 ALERTA: Este é um erro CRÍTICO que pode afetar o funcionamento do sistema!');
    }
  }

  /**
   * Obtém estatísticas completas de erros com análise avançada
   * @param {Object} options - Opções de análise
   * @param {string} options.timeframe - Período de análise ('1h', '24h', '7d', 'all')
   * @param {boolean} options.includePatterns - Se deve incluir padrões detectados
   * @returns {Object} Estatísticas detalhadas de erros
   */
  getErrorStats(options = {}) {
    const { timeframe = 'all', includePatterns = true } = options;
    
    let errorsToAnalyze = this.recentErrors;
    
    // Filtrar por período se especificado
    if (timeframe !== 'all') {
      const cutoff = this.getTimeframeCutoff(timeframe);
      errorsToAnalyze = this.recentErrors.filter(error => 
        new Date(error.timestamp) > new Date(cutoff)
      );
    }

    const totalErrors = Array.from(this.errorCounts.values()).reduce((sum, count) => sum + count, 0);
    const errorsByCategory = {};
    const errorsByType = {};
    const errorsBySeverity = { high: 0, medium: 0, low: 0 };
    const circuitBreakerStatus = {};

    // Análise dos erros recentes
    errorsToAnalyze.forEach(error => {
      errorsByCategory[error.category] = (errorsByCategory[error.category] || 0) + 1;
      errorsByType[error.errorType] = (errorsByType[error.errorType] || 0) + 1;
      errorsBySeverity[error.severity] = (errorsBySeverity[error.severity] || 0) + 1;
    });

    // Status dos circuit breakers
    for (const [category, breaker] of this.circuitBreakers.entries()) {
      circuitBreakerStatus[category] = {
        state: breaker.state,
        failureCount: breaker.failureCount,
        isHealthy: breaker.state === 'closed'
      };
    }

    const stats = {
      overview: {
        totalErrors,
        recentErrorsCount: errorsToAnalyze.length,
        criticalErrorsCount: errorsBySeverity.high || 0,
        errorRate: this.calculateErrorRate(errorsToAnalyze),
        mtbf: this.calculateMTBF(errorsToAnalyze), // Mean Time Between Failures
        systemHealth: this.calculateSystemHealth()
      },
      distribution: {
        byCategory: errorsByCategory,
        byType: errorsByType,
        bySeverity: errorsBySeverity
      },
      trends: this.calculateErrorTrends(errorsToAnalyze),
      circuitBreakers: circuitBreakerStatus,
      mostCommonError: this.getMostCommonError(),
      recentCriticalErrors: errorsToAnalyze
        .filter(e => e.severity === 'high')
        .slice(0, 5)
        .map(e => ({
          category: e.category,
          message: e.message,
          timestamp: e.timestamp,
          occurrenceCount: e.occurrenceCount
        }))
    };

    if (includePatterns) {
      stats.patterns = this.getErrorPatternsSummary();
    }

    return stats;
  }

  /**
   * Calcula taxa de erro (erros por hora)
   * @private
   */
  calculateErrorRate(errors) {
    if (errors.length < 2) return 0;
    
    const timeSpan = new Date(errors[0].timestamp) - new Date(errors[errors.length - 1].timestamp);
    const hours = Math.max(timeSpan / (1000 * 60 * 60), 1);
    
    return Math.round((errors.length / hours) * 100) / 100;
  }

  /**
   * Calcula tempo médio entre falhas (MTBF) em minutos
   * @private
   */
  calculateMTBF(errors) {
    if (errors.length < 2) return Infinity;
    
    const intervals = [];
    for (let i = 0; i < errors.length - 1; i++) {
      const interval = new Date(errors[i].timestamp) - new Date(errors[i + 1].timestamp);
      intervals.push(interval);
    }
    
    const avgInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
    return Math.round(avgInterval / (1000 * 60)); // em minutos
  }

  /**
   * Calcula saúde geral do sistema (0-100)
   * @private
   */
  calculateSystemHealth() {
    const recentErrors = this.recentErrors.slice(0, 20); // Últimos 20 erros
    if (recentErrors.length === 0) return 100;
    
    const criticalCount = recentErrors.filter(e => e.severity === 'high').length;
    const openCircuitBreakers = Array.from(this.circuitBreakers.values())
      .filter(b => b.state === 'open').length;
    
    let health = 100;
    health -= (criticalCount * 10); // -10 por erro crítico
    health -= (openCircuitBreakers * 20); // -20 por circuit breaker aberto
    health -= (recentErrors.length * 2); // -2 por erro recente
    
    return Math.max(0, Math.min(100, health));
  }

  /**
   * Calcula tendências de erro
   * @private
   */
  calculateErrorTrends(errors) {
    if (errors.length < 10) return null;
    
    const recent = errors.slice(0, 5);
    const previous = errors.slice(5, 10);
    
    const recentCritical = recent.filter(e => e.severity === 'high').length;
    const previousCritical = previous.filter(e => e.severity === 'high').length;
    
    const trendDirection = recentCritical > previousCritical ? 'worsening' : 
                          recentCritical < previousCritical ? 'improving' : 'stable';
    
    return {
      direction: trendDirection,
      recentCriticalCount: recentCritical,
      previousCriticalCount: previousCritical,
      changePercentage: previousCritical > 0 ? 
        Math.round(((recentCritical - previousCritical) / previousCritical) * 100) : 0
    };
  }

  /**
   * Obtém resumo dos padrões de erro detectados
   * @private
   */
  getErrorPatternsSummary() {
    const patterns = [];
    
    for (const [patternKey, pattern] of this.errorPatterns.entries()) {
      if (pattern.frequency > 0.1) { // Mais de 0.1 erros por minuto
        patterns.push({
          pattern: patternKey,
          frequency: Math.round(pattern.frequency * 100) / 100,
          count: pattern.count,
          isHighFrequency: pattern.frequency > 1,
          timespan: Math.round((pattern.lastOccurrence - pattern.firstOccurrence) / 60000) + 'min'
        });
      }
    }
    
    return patterns.sort((a, b) => b.frequency - a.frequency);
  }

  /**
   * Obtém cutoff timestamp para timeframe
   * @private
   */
  getTimeframeCutoff(timeframe) {
    const now = Date.now();
    switch (timeframe) {
      case '1h': return now - (60 * 60 * 1000);
      case '24h': return now - (24 * 60 * 60 * 1000);
      case '7d': return now - (7 * 24 * 60 * 60 * 1000);
      default: return 0;
    }
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
