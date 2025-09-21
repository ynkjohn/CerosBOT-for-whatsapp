// src/lib/performance.js
import { logger } from './logger.js';

class PerformanceMonitor {
  constructor() {
    this.requestTimes = [];
    this.maxSamples = 10; // Mantém apenas os últimos 10 requests
  }

  /**
   * Registra o tempo de uma requisição
   */
  recordRequest(duration) {
    this.requestTimes.push({
      duration,
      timestamp: Date.now()
    });

    // Mantém apenas as últimas amostras
    if (this.requestTimes.length > this.maxSamples) {
      this.requestTimes.shift();
    }

    // Log se demorou muito
    if (duration > 60000) { // Mais de 1 minuto
      logger.warn('⏰ Requisição LLM demorou %d segundos', Math.round(duration / 1000));
    }
  }

  /**
   * Obtém tempo médio das últimas requisições
   */
  getAverageTime() {
    if (this.requestTimes.length === 0) return 0;
    
    const total = this.requestTimes.reduce((sum, req) => sum + req.duration, 0);
    return Math.round(total / this.requestTimes.length);
  }

  /**
   * Verifica se o modelo está lento
   */
  isModelSlow() {
    const avgTime = this.getAverageTime();
    return avgTime > 30000; // Mais de 30 segundos em média
  }

  /**
   * Obtém estatísticas de performance
   */
  getStats() {
    if (this.requestTimes.length === 0) {
      return {
        avgTime: 0,
        minTime: 0,
        maxTime: 0,
        totalRequests: 0,
        isSlow: false
      };
    }

    const times = this.requestTimes.map(r => r.duration);
    const avgTime = this.getAverageTime();
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);

    return {
      avgTime: Math.round(avgTime / 1000), // em segundos
      minTime: Math.round(minTime / 1000),
      maxTime: Math.round(maxTime / 1000),
      totalRequests: this.requestTimes.length,
      isSlow: this.isModelSlow()
    };
  }

  /**
   * Sugere otimizações baseado na performance
   */
  getSuggestions() {
    const stats = this.getStats();
    const suggestions = [];

    if (stats.avgTime > 60) { // Mais de 1 minuto
      suggestions.push('Considere reduzir MAX_TOKENS no .env');
      suggestions.push('Considere reduzir MAX_HISTORY_MESSAGES no .env');
      suggestions.push('Verifique se há outros processos pesados rodando');
    }

    if (stats.avgTime > 30) { // Mais de 30 segundos
      suggestions.push('Modelo está lento - considere usar um modelo menor');
      suggestions.push('Verifique recursos de CPU/GPU disponíveis');
    }

    if (stats.maxTime > 120) { // Mais de 2 minutos
      suggestions.push('Considere aumentar REQUEST_TIMEOUT no .env');
    }

    return suggestions;
  }
}

// Instância global
export const performanceMonitor = new PerformanceMonitor();

/**
 * Wrapper para medir performance de funções
 */
export function measureTime(fn) {
  return async function(...args) {
    const startTime = Date.now();
    
    try {
      const result = await fn.apply(this, args);
      const duration = Date.now() - startTime;
      performanceMonitor.recordRequest(duration);
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      performanceMonitor.recordRequest(duration);
      throw error;
    }
  };
}
