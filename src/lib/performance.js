// src/lib/performance.js
import { logger } from './logger.js';

/**
 * Classe para monitoramento avançado de performance do sistema
 * Inclui métricas de LLM, uso de memória e recursos do sistema
 */
class PerformanceMonitor {
  constructor() {
    this.requestTimes = [];
    this.maxSamples = 50; // Ampliado para análise mais precisa
    this.systemMetrics = {
      startTime: Date.now(),
      totalRequests: 0,
      errors: 0,
      lastCleanup: Date.now()
    };
  }

  /**
   * Registra o tempo de uma requisição com análise detalhada
   * @param {number} duration - Duração em milissegundos
   * @param {Object} metadata - Metadados adicionais da requisição
   * @param {string} metadata.type - Tipo de operação ('llm', 'memory', 'api')
   * @param {boolean} metadata.success - Se a operação foi bem-sucedida
   * @param {number} metadata.tokens - Número de tokens processados (se aplicável)
   */
  recordRequest(duration, metadata = {}) {
    if (!Number.isFinite(duration) || duration < 0) {
      logger.warn('PERF: Duração inválida fornecida:', duration);
      return;
    }

    const record = {
      duration,
      timestamp: Date.now(),
      type: metadata.type || 'unknown',
      success: metadata.success !== false,
      tokens: metadata.tokens || 0
    };

    this.requestTimes.push(record);

    // Atualizar métricas do sistema
    this.systemMetrics.totalRequests++;
    if (!record.success) {
      this.systemMetrics.errors++;
    }

    // Manter apenas as últimas amostras para eficiência de memória
    if (this.requestTimes.length > this.maxSamples) {
      this.requestTimes.shift();
    }

    // Log de alerta para requisições muito lentas
    if (duration > 120000) { // Mais de 2 minutos
      logger.error('🐌 PERF: Requisição extremamente lenta detectada: %ds (%s)', 
        Math.round(duration / 1000), metadata.type || 'unknown');
    } else if (duration > 60000) { // Mais de 1 minuto
      logger.warn('⏰ PERF: Requisição lenta detectada: %ds (%s)', 
        Math.round(duration / 1000), metadata.type || 'unknown');
    }

    // Auto-cleanup para evitar memory leaks
    this.performAutoCleanup();
  }

  /**
   * Executa limpeza automática de métricas antigas
   * @private
   */
  performAutoCleanup() {
    const now = Date.now();
    const cleanupInterval = 60 * 60 * 1000; // 1 hora
    
    if (now - this.systemMetrics.lastCleanup > cleanupInterval) {
      // Remove registros mais antigos que 24 horas
      const cutoff = now - (24 * 60 * 60 * 1000);
      this.requestTimes = this.requestTimes.filter(record => record.timestamp > cutoff);
      this.systemMetrics.lastCleanup = now;
      
      logger.debug('PERF: Auto-limpeza de métricas executada');
    }
  }

  /**
   * Obtém tempo médio das últimas requisições com análise por tipo
   * @param {string} type - Tipo de operação para filtrar ('llm', 'memory', 'api')
   * @returns {number} Tempo médio em milissegundos
   */
  getAverageTime(type = null) {
    let records = this.requestTimes;
    
    if (type) {
      records = records.filter(r => r.type === type);
    }
    
    if (records.length === 0) return 0;
    
    const total = records.reduce((sum, req) => sum + req.duration, 0);
    return Math.round(total / records.length);
  }

  /**
   * Verifica se o modelo/sistema está lento baseado em critérios múltiplos
   * @param {Object} criteria - Critérios de avaliação
   * @param {number} criteria.maxAvgTime - Tempo médio máximo aceitável (ms)
   * @param {number} criteria.maxRecentTime - Tempo máximo para requisições recentes (ms)
   * @returns {boolean} True se o sistema está lento
   */
  isModelSlow(criteria = {}) {
    const { maxAvgTime = 30000, maxRecentTime = 60000 } = criteria;
    
    if (this.requestTimes.length === 0) return false;
    
    const avgTime = this.getAverageTime();
    const recentRecord = this.requestTimes[this.requestTimes.length - 1];
    
    return avgTime > maxAvgTime || (recentRecord && recentRecord.duration > maxRecentTime);
  }

  /**
   * Obtém estatísticas completas de performance
   * @param {Object} options - Opções de análise
   * @param {string} options.timeframe - Período de análise ('1h', '24h', 'all')
   * @param {string} options.groupBy - Agrupar por ('type', 'hour', 'success')
   * @returns {Object} Estatísticas detalhadas de performance
   */
  getStats(options = {}) {
    const { timeframe = 'all', groupBy = null } = options;
    
    if (this.requestTimes.length === 0) {
      return {
        avgTime: 0,
        minTime: 0,
        maxTime: 0,
        medianTime: 0,
        totalRequests: 0,
        successRate: 100,
        isSlow: false,
        uptime: Date.now() - this.systemMetrics.startTime,
        throughput: 0,
        errorRate: 0,
        byType: {},
        trends: null
      };
    }

    // Filtrar por período se especificado
    let records = this.requestTimes;
    if (timeframe !== 'all') {
      const cutoff = this.getTimeframeCutoff(timeframe);
      records = records.filter(r => r.timestamp > cutoff);
    }

    const durations = records.map(r => r.duration);
    const successfulRequests = records.filter(r => r.success).length;
    
    // Estatísticas básicas
    const stats = {
      avgTime: Math.round(durations.reduce((sum, d) => sum + d, 0) / durations.length),
      minTime: Math.min(...durations),
      maxTime: Math.max(...durations),
      medianTime: this.calculateMedian(durations),
      totalRequests: records.length,
      successRate: Math.round((successfulRequests / records.length) * 100),
      isSlow: this.isModelSlow(),
      uptime: Date.now() - this.systemMetrics.startTime,
      throughput: this.calculateThroughput(records),
      errorRate: Math.round(((records.length - successfulRequests) / records.length) * 100),
      byType: this.groupStatsByType(records),
      trends: this.calculateTrends(records)
    };

    return stats;
  }

  /**
   * Calcula a mediana de um array de números
   * @private
   */
  calculateMedian(numbers) {
    const sorted = [...numbers].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 
      ? (sorted[mid - 1] + sorted[mid]) / 2 
      : sorted[mid];
  }

  /**
   * Calcula throughput (requisições por minuto)
   * @private
   */
  calculateThroughput(records) {
    if (records.length < 2) return 0;
    
    const timeSpan = Math.max(records[records.length - 1].timestamp - records[0].timestamp, 60000);
    return Math.round((records.length / timeSpan) * 60000); // req/min
  }

  /**
   * Agrupa estatísticas por tipo de operação
   * @private
   */
  groupStatsByType(records) {
    const byType = {};
    const types = [...new Set(records.map(r => r.type))];
    
    for (const type of types) {
      const typeRecords = records.filter(r => r.type === type);
      const durations = typeRecords.map(r => r.duration);
      
      byType[type] = {
        count: typeRecords.length,
        avgTime: Math.round(durations.reduce((sum, d) => sum + d, 0) / durations.length),
        successRate: Math.round((typeRecords.filter(r => r.success).length / typeRecords.length) * 100)
      };
    }
    
    return byType;
  }

  /**
   * Calcula tendências de performance
   * @private
   */
  calculateTrends(records) {
    if (records.length < 10) return null;
    
    const recent = records.slice(-10);
    const older = records.slice(-20, -10);
    
    if (older.length === 0) return null;
    
    const recentAvg = recent.reduce((sum, r) => sum + r.duration, 0) / recent.length;
    const olderAvg = older.reduce((sum, r) => sum + r.duration, 0) / older.length;
    
    const trend = ((recentAvg - olderAvg) / olderAvg) * 100;
    
    return {
      direction: trend > 5 ? 'degrading' : trend < -5 ? 'improving' : 'stable',
      percentage: Math.round(Math.abs(trend)),
      recentAvg: Math.round(recentAvg),
      previousAvg: Math.round(olderAvg)
    };
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
      default: return 0;
    }
  }

  /**
   * Sugere otimizações baseado na análise de performance
   * @param {Object} customThresholds - Limites personalizados para sugestões
   * @returns {Array<Object>} Array de sugestões com prioridade e categoria
   */
  getSuggestions(customThresholds = {}) {
    const stats = this.getStats();
    const suggestions = [];
    
    const thresholds = {
      slowAvg: 60000,        // 1 minuto
      moderateAvg: 30000,    // 30 segundos
      verySlowMax: 180000,   // 3 minutos
      lowSuccessRate: 95,    // 95%
      highErrorRate: 5,      // 5%
      ...customThresholds
    };

    // Sugestões baseadas em tempo médio
    if (stats.avgTime > thresholds.slowAvg) {
      suggestions.push({
        category: 'performance',
        priority: 'high',
        issue: `Tempo médio muito alto: ${Math.round(stats.avgTime/1000)}s`,
        solutions: [
          'Reduzir MAX_TOKENS no .env',
          'Reduzir MAX_HISTORY_MESSAGES no .env',
          'Executar: npm run optimize',
          'Considerar modelo menor/mais rápido'
        ]
      });
    } else if (stats.avgTime > thresholds.moderateAvg) {
      suggestions.push({
        category: 'performance',
        priority: 'medium',
        issue: `Tempo médio elevado: ${Math.round(stats.avgTime/1000)}s`,
        solutions: [
          'Verificar recursos de CPU/GPU disponíveis',
          'Fechar outros programas pesados',
          'Considerar ajustar TEMPERATURE no .env'
        ]
      });
    }

    // Sugestões baseadas em tempo máximo
    if (stats.maxTime > thresholds.verySlowMax) {
      suggestions.push({
        category: 'timeout',
        priority: 'high',
        issue: `Requisições muito lentas detectadas: ${Math.round(stats.maxTime/1000)}s`,
        solutions: [
          'Aumentar REQUEST_TIMEOUT no .env',
          'Verificar modelo não está sobrecarregado',
          'Considerar usar modelo mais estável'
        ]
      });
    }

    // Sugestões baseadas em taxa de sucesso
    if (stats.successRate < thresholds.lowSuccessRate) {
      suggestions.push({
        category: 'reliability',
        priority: 'high',
        issue: `Taxa de sucesso baixa: ${stats.successRate}%`,
        solutions: [
          'Verificar estabilidade da conexão LLM',
          'Aumentar MAX_RETRIES no .env',
          'Verificar logs de erro para padrões',
          'Executar: npm run health'
        ]
      });
    }

    // Sugestões baseadas em tendências
    if (stats.trends && stats.trends.direction === 'degrading') {
      suggestions.push({
        category: 'maintenance',
        priority: 'medium',
        issue: `Performance degradando: ${stats.trends.percentage}% pior`,
        solutions: [
          'Executar limpeza de memória: npm run cleanup',
          'Reiniciar bot: npm run pm2:restart',
          'Verificar uso de recursos do sistema',
          'Considerar backup e restore se persistir'
        ]
      });
    }

    return suggestions.sort((a, b) => {
      const priority = { high: 3, medium: 2, low: 1 };
      return priority[b.priority] - priority[a.priority];
    });
  }

  /**
   * Gera relatório completo de performance
   * @returns {string} Relatório formatado para exibição
   */
  generateReport() {
    const stats = this.getStats();
    const suggestions = this.getSuggestions();
    
    let report = '📊 **RELATÓRIO DE PERFORMANCE**\n\n';
    
    // Estatísticas principais
    report += '**Estatísticas Gerais:**\n';
    report += `• Tempo médio: ${Math.round(stats.avgTime/1000)}s\n`;
    report += `• Tempo mediano: ${Math.round(stats.medianTime/1000)}s\n`;
    report += `• Taxa de sucesso: ${stats.successRate}%\n`;
    report += `• Throughput: ${stats.throughput} req/min\n`;
    report += `• Uptime: ${Math.round(stats.uptime/1000/60)} minutos\n\n`;
    
    // Estatísticas por tipo
    if (Object.keys(stats.byType).length > 0) {
      report += '**Por Tipo de Operação:**\n';
      for (const [type, typeStats] of Object.entries(stats.byType)) {
        report += `• ${type}: ${Math.round(typeStats.avgTime/1000)}s (${typeStats.successRate}%)\n`;
      }
      report += '\n';
    }
    
    // Tendências
    if (stats.trends) {
      const emoji = stats.trends.direction === 'improving' ? '📈' : 
                   stats.trends.direction === 'degrading' ? '📉' : '📊';
      report += `**Tendência:** ${emoji} ${stats.trends.direction} (${stats.trends.percentage}%)\n\n`;
    }
    
    // Sugestões
    if (suggestions.length > 0) {
      report += '**Sugestões de Otimização:**\n';
      suggestions.forEach((suggestion, index) => {
        const emoji = suggestion.priority === 'high' ? '🔴' : 
                     suggestion.priority === 'medium' ? '🟡' : '🟢';
        report += `${emoji} **${suggestion.issue}**\n`;
        suggestion.solutions.forEach(solution => {
          report += `   • ${solution}\n`;
        });
        if (index < suggestions.length - 1) report += '\n';
      });
    } else {
      report += '✅ **Sistema funcionando dentro dos parâmetros normais**\n';
    }
    
    return report;
  }
}

// Instância global
export const performanceMonitor = new PerformanceMonitor();

/**
 * Wrapper avançado para medir performance de funções com metadados
 * @param {Function} fn - Função a ser instrumentada
 * @param {Object} options - Opções de instrumentação
 * @param {string} options.type - Tipo de operação para categorização
 * @param {string} options.name - Nome da operação para logging
 * @param {boolean} options.logResult - Se deve logar o resultado (padrão: false)
 * @returns {Function} Função instrumentada
 */
export function measureTime(fn, options = {}) {
  const { type = 'unknown', name = fn.name || 'anonymous', logResult = false } = options;
  
  return async function(...args) {
    const startTime = Date.now();
    const startMemory = process.memoryUsage().heapUsed;
    
    try {
      logger.debug('PERF: Iniciando %s (%s)', name, type);
      
      const result = await fn.apply(this, args);
      const duration = Date.now() - startTime;
      const memoryDelta = process.memoryUsage().heapUsed - startMemory;
      
      // Estimar tokens se for operação de LLM
      let tokens = 0;
      if (type === 'llm' && result && typeof result === 'string') {
        tokens = Math.ceil(result.length / 4); // Estimativa simples
      }
      
      performanceMonitor.recordRequest(duration, {
        type,
        success: true,
        tokens,
        memoryDelta,
        functionName: name
      });
      
      if (logResult) {
        logger.debug('PERF: %s completado em %dms (Δmem: %dKB)', 
          name, duration, Math.round(memoryDelta / 1024));
      }
      
      return result;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      const memoryDelta = process.memoryUsage().heapUsed - startMemory;
      
      performanceMonitor.recordRequest(duration, {
        type,
        success: false,
        tokens: 0,
        memoryDelta,
        functionName: name,
        errorType: error.constructor.name
      });
      
      logger.debug('PERF: %s falhou após %dms: %s', name, duration, error.message);
      throw error;
    }
  };
}

/**
 * Utilitário para benchmark simples de operações
 * @param {Function} operation - Operação a ser testada
 * @param {Object} options - Opções do benchmark
 * @param {number} options.iterations - Número de iterações (padrão: 10)
 * @param {string} options.name - Nome do benchmark
 * @returns {Promise<Object>} Resultados do benchmark
 */
export async function benchmark(operation, options = {}) {
  const { iterations = 10, name = 'operation' } = options;
  const results = [];
  
  logger.info('PERF: Iniciando benchmark de %s (%d iterações)', name, iterations);
  
  for (let i = 0; i < iterations; i++) {
    const startTime = Date.now();
    try {
      await operation();
      results.push({ success: true, duration: Date.now() - startTime });
    } catch (error) {
      results.push({ success: false, duration: Date.now() - startTime, error: error.message });
    }
  }
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  const durations = successful.map(r => r.duration);
  
  const stats = {
    totalIterations: iterations,
    successful: successful.length,
    failed: failed.length,
    successRate: Math.round((successful.length / iterations) * 100),
    avgTime: durations.length > 0 ? Math.round(durations.reduce((sum, d) => sum + d, 0) / durations.length) : 0,
    minTime: durations.length > 0 ? Math.min(...durations) : 0,
    maxTime: durations.length > 0 ? Math.max(...durations) : 0,
    errors: failed.map(f => f.error)
  };
  
  logger.info('PERF: Benchmark %s concluído: %d/%d sucessos, tempo médio: %dms', 
    name, stats.successful, stats.totalIterations, stats.avgTime);
  
  return stats;
}
