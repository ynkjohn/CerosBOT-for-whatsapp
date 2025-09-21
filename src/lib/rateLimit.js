// src/lib/rateLimit.js
import { logger } from './logger.js';

// Configurações de rate limiting
const MAX_REQUESTS_PER_MINUTE = parseInt(process.env.MAX_REQUESTS_PER_MINUTE) || 10;
const MAX_REQUESTS_PER_HOUR = parseInt(process.env.MAX_REQUESTS_PER_HOUR) || 50;
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minuto
const RATE_LIMIT_HOUR_MS = 60 * 60 * 1000; // 1 hora
const MAX_STORED_REQUESTS = 100; // Limite máximo de timestamps por usuário

class RateLimiter {
  constructor() {
    this.requests = new Map(); // userPhone -> { minute: [...timestamps], hour: [...timestamps] }
    
    // Limpeza automática de dados antigos
    setInterval(() => this.cleanup(), 5 * 60 * 1000); // A cada 5 minutos
  }

  /**
   * Registra um hit do usuário
   */
  hit(userPhone) {
    const now = Date.now();
    
    if (!this.requests.has(userPhone)) {
      this.requests.set(userPhone, { minute: [], hour: [] });
    }
    
    const userData = this.requests.get(userPhone);
    
    // Remove timestamps antigos
    userData.minute = userData.minute.filter(time => now - time < RATE_LIMIT_WINDOW_MS);
    userData.hour = userData.hour.filter(time => now - time < RATE_LIMIT_HOUR_MS);
    
    // Adiciona timestamp atual
    userData.minute.push(now);
    userData.hour.push(now);
    
    // Previne memory leak - mantém apenas os mais recentes
    if (userData.minute.length > MAX_STORED_REQUESTS) {
      userData.minute = userData.minute.slice(-MAX_STORED_REQUESTS);
    }
    if (userData.hour.length > MAX_STORED_REQUESTS) {
      userData.hour = userData.hour.slice(-MAX_STORED_REQUESTS);
    }
    
    logger.debug('📊 Rate limit - %s: %d/min, %d/h', 
                userPhone.slice(-4), userData.minute.length, userData.hour.length);
  }

  /**
   * Verifica se usuário excedeu o limite (método somente leitura)
   */
  isLimited(userPhone) {
    if (!this.requests.has(userPhone)) {
      return false;
    }
    
    const now = Date.now();
    const userData = this.requests.get(userPhone);
    
    // Conta timestamps válidos sem modificar os arrays (evita race conditions)
    const minuteCount = userData.minute.filter(time => now - time < RATE_LIMIT_WINDOW_MS).length;
    const hourCount = userData.hour.filter(time => now - time < RATE_LIMIT_HOUR_MS).length;
    
    return minuteCount >= MAX_REQUESTS_PER_MINUTE || hourCount >= MAX_REQUESTS_PER_HOUR;
  }

  /**
   * Obtém informações sobre o limite do usuário
   */
  getUserStats(userPhone) {
    if (!this.requests.has(userPhone)) {
      return {
        requestsThisMinute: 0,
        requestsThisHour: 0,
        limitPerMinute: MAX_REQUESTS_PER_MINUTE,
        limitPerHour: MAX_REQUESTS_PER_HOUR,
        isLimited: false
      };
    }
    
    const now = Date.now();
    const userData = this.requests.get(userPhone);
    
    // Remove timestamps antigos
    userData.minute = userData.minute.filter(time => now - time < RATE_LIMIT_WINDOW_MS);
    userData.hour = userData.hour.filter(time => now - time < RATE_LIMIT_HOUR_MS);
    
    return {
      requestsThisMinute: userData.minute.length,
      requestsThisHour: userData.hour.length,
      limitPerMinute: MAX_REQUESTS_PER_MINUTE,
      limitPerHour: MAX_REQUESTS_PER_HOUR,
      isLimited: this.isLimited(userPhone)
    };
  }

  /**
   * Remove dados antigos para economizar memória
   */
  cleanup() {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [userPhone, userData] of this.requests.entries()) {
      userData.minute = userData.minute.filter(time => now - time < RATE_LIMIT_WINDOW_MS);
      userData.hour = userData.hour.filter(time => now - time < RATE_LIMIT_HOUR_MS);
      
      // Se não há requests recentes, remove o usuário
      if (userData.minute.length === 0 && userData.hour.length === 0) {
        this.requests.delete(userPhone);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      logger.debug('🧹 Rate limit cleanup: %d usuários removidos', cleaned);
    }
  }

  /**
   * Obtém estatísticas gerais
   */
  getStats() {
    const totalUsers = this.requests.size;
    let activeMinute = 0;
    let activeHour = 0;
    let totalRequestsMinute = 0;
    let totalRequestsHour = 0;
    
    const now = Date.now();
    
    for (const userData of this.requests.values()) {
      const minuteRequests = userData.minute.filter(time => now - time < RATE_LIMIT_WINDOW_MS).length;
      const hourRequests = userData.hour.filter(time => now - time < RATE_LIMIT_HOUR_MS).length;
      
      if (minuteRequests > 0) activeMinute++;
      if (hourRequests > 0) activeHour++;
      
      totalRequestsMinute += minuteRequests;
      totalRequestsHour += hourRequests;
    }
    
    return {
      totalUsers,
      activeUsersMinute: activeMinute,
      activeUsersHour: activeHour,
      totalRequestsMinute,
      totalRequestsHour,
      avgRequestsPerUserMinute: activeMinute > 0 ? Math.round(totalRequestsMinute / activeMinute) : 0,
      avgRequestsPerUserHour: activeHour > 0 ? Math.round(totalRequestsHour / activeHour) : 0
    };
  }

  /**
   * Reseta os limites de um usuário (comando admin)
   */
  resetUser(userPhone) {
    if (this.requests.has(userPhone)) {
      this.requests.delete(userPhone);
      logger.info('🔄 Rate limit resetado para %s', userPhone.slice(-4));
      return true;
    }
    return false;
  }

  /**
   * Reseta todos os limites (comando admin)
   */
  resetAll() {
    const count = this.requests.size;
    this.requests.clear();
    logger.info('🔄 Rate limit resetado para todos os usuários (%d)', count);
    return count;
  }
}

// Instância global
export const rateLimiter = new RateLimiter();

// Função de conveniência
export function isRateLimited(userPhone) {
  return rateLimiter.isLimited(userPhone);
}

// Função para obter stats de usuário
export function getUserRateStats(userPhone) {
  return rateLimiter.getUserStats(userPhone);
}

// Função para obter stats gerais
export function getRateLimitStats() {
  return rateLimiter.getStats();
}
