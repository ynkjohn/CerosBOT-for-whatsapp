// src/lib/memory.js
import { promises as fs } from 'fs';
import { logger } from './logger.js';

const MEMORY_FILE = './memoria.json';
let cache = {};

/**
 * Estima o número de tokens baseado no comprimento do texto
 * Aproximação: 1 token ≈ 4 caracteres para português
 * @param {string} text - Texto para estimar
 * @returns {number} Número estimado de tokens
 */
function estimateTokenCount(text) {
  if (!text || typeof text !== 'string') return 0;
  return Math.ceil(text.length / 4);
}

/**
 * Compacta a memória removendo mensagens mais antigas quando necessário
 * @returns {Promise<number>} Número de mensagens removidas
 */
async function compactMemory() {
  let removedCount = 0;
  const maxMessagesPerChat = 30; // Reduz para compactar
  
  for (const [chatId, messages] of Object.entries(cache)) {
    if (Array.isArray(messages) && messages.length > maxMessagesPerChat) {
      const originalLength = messages.length;
      cache[chatId] = messages.slice(-maxMessagesPerChat);
      removedCount += originalLength - maxMessagesPerChat;
    }
  }
  
  if (removedCount > 0) {
    logger.info('MEMORY: Compactação removeu %d mensagens antigas', removedCount);
    await saveMemory();
  }
  
  return removedCount;
}

/**
 * Carrega memória do arquivo JSON com validação e tratamento de erros robusto
 * @returns {Promise<boolean>} True se carregou com sucesso, false caso contrário
 */
export async function loadMemory() {
  try {
    const data = await fs.readFile(MEMORY_FILE, 'utf-8');
    const parsedData = JSON.parse(data);
    
    // Validação da estrutura de dados
    if (typeof parsedData !== 'object' || parsedData === null) {
      logger.warn('MEMORY: Dados inválidos no arquivo, usando cache vazio');
      cache = {};
    } else {
      // Validação adicional da estrutura interna
      const isValidStructure = Object.values(parsedData).every(chatData => 
        Array.isArray(chatData) && 
        chatData.every(msg => 
          msg && 
          typeof msg === 'object' && 
          typeof msg.role === 'string' && 
          typeof msg.content === 'string'
        )
      );
      
      if (isValidStructure) {
        cache = parsedData;
        logger.info('MEMORY: Memoria carregada com sucesso');
        return true;
      } else {
        logger.warn('MEMORY: Estrutura de dados corrompida, usando cache vazio');
        cache = {};
      }
    }
    
    await saveMemory();
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') {
      logger.info('MEMORY: Arquivo de memoria nao existe, criando novo');
      cache = {};
      await saveMemory();
      return true;
    } else {
      logger.error('MEMORY: Erro ao carregar memoria, usando cache vazio:', error.message);
      cache = {};
      return false;
    }
  }
}

/**
 * Salva memória no arquivo JSON com validação atomica
 * @returns {Promise<boolean>} True se salvou com sucesso, false caso contrário
 */
export async function saveMemory() {
  try {
    const data = JSON.stringify(cache, null, 2);
    
    // Validação antes de escrever
    if (data.length > 10 * 1024 * 1024) { // 10MB limit
      logger.warn('MEMORY: Arquivo de memoria muito grande (%dMB), executando limpeza', 
        Math.round(data.length / 1024 / 1024));
      await compactMemory();
    }
    
    await fs.writeFile(MEMORY_FILE, data, 'utf-8');
    return true;
  } catch (error) {
    logger.error('MEMORY: Erro ao salvar memoria:', error.message);
    return false;
  }
}

/**
 * Adiciona mensagem ao cache com validação de entrada e gestão inteligente de memória
 * @param {string} chatId - ID único do chat
 * @param {string} role - Papel da mensagem ('user', 'assistant', 'system')
 * @param {string} content - Conteúdo da mensagem
 * @param {Object} options - Opções adicionais
 * @param {boolean} options.autoSave - Se deve salvar automaticamente (padrão: true)
 * @param {number} options.maxMessages - Limite de mensagens por chat (padrão: 50)
 * @returns {boolean} True se a mensagem foi adicionada com sucesso
 */
export function pushMessage(chatId, role, content, options = {}) {
  // Validação rigorosa de entrada
  if (!chatId || typeof chatId !== 'string' || chatId.trim().length === 0) {
    logger.warn('MEMORY: chatId inválido fornecido');
    return false;
  }
  
  if (!role || typeof role !== 'string' || !['user', 'assistant', 'system'].includes(role)) {
    logger.warn('MEMORY: role inválido fornecido: %s', role);
    return false;
  }
  
  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    logger.warn('MEMORY: content vazio ou inválido');
    return false;
  }

  const { autoSave = true, maxMessages = 50 } = options;
  const trimmedChatId = chatId.trim();
  const trimmedContent = content.trim();

  if (!cache[trimmedChatId]) {
    cache[trimmedChatId] = [];
  }

  const message = {
    role,
    content: trimmedContent,
    timestamp: new Date().toISOString(),
    tokens: estimateTokenCount(trimmedContent)
  };

  cache[trimmedChatId].push(message);

  // Limitar mensagens por chat com configuração flexível
  if (cache[trimmedChatId].length > maxMessages) {
    const removedCount = cache[trimmedChatId].length - maxMessages;
    cache[trimmedChatId] = cache[trimmedChatId].slice(-maxMessages);
    logger.debug('MEMORY: Removidas %d mensagens antigas do chat %s', removedCount, trimmedChatId);
  }

  // Auto-save inteligente a cada 10 mensagens ou baseado em configuração
  if (autoSave && cache[trimmedChatId].length % 10 === 0) {
    saveMemory().catch(error => 
      logger.error('MEMORY: Erro no auto-save:', error.message)
    );
  }
  
  return true;
}

/**
 * Obtém mensagens de um chat com validação e filtragem
 * @param {string} chatId - ID do chat
 * @param {number} limit - Número máximo de mensagens a retornar (padrão: 20)
 * @param {Object} options - Opções de filtragem
 * @param {string[]} options.roles - Array de roles para filtrar
 * @param {Date} options.since - Data mínima das mensagens
 * @returns {Array<Object>} Array de mensagens filtradas
 */
export function getMessages(chatId, limit = 20, options = {}) {
  if (!chatId || typeof chatId !== 'string') {
    logger.warn('MEMORY: chatId inválido para getMessages');
    return [];
  }

  const trimmedChatId = chatId.trim();
  if (!cache[trimmedChatId]) {
    return [];
  }

  let messages = [...cache[trimmedChatId]]; // Clone para não modificar o original

  // Filtro por roles se especificado
  if (options.roles && Array.isArray(options.roles)) {
    messages = messages.filter(msg => options.roles.includes(msg.role));
  }

  // Filtro por data se especificado
  if (options.since && options.since instanceof Date) {
    messages = messages.filter(msg => {
      const msgDate = new Date(msg.timestamp);
      return msgDate >= options.since;
    });
  }

  // Aplicar limite com validação
  const validLimit = Math.max(1, Math.min(limit, 100)); // Entre 1 e 100
  return messages.slice(-validLimit);
}

/**
 * Obtém thread completo de um chat
 */
export function getThread(chatId) {
  if (!cache[chatId]) {
    cache[chatId] = [];
  }
  return [...cache[chatId]];
}

/**
 * Remove um chat da memória
 */
export function removeChat(chatId) {
  delete cache[chatId];
}

/**
 * Limpa a memória de um chat específico
 */
export async function clearChatMemory(chatId) {
  try {
    if (cache[chatId]) {
      const messageCount = cache[chatId].length;
      delete cache[chatId];
      await saveMemory();
      
      logger.info('CLEANUP: Memoria do chat %s limpa (%d mensagens removidas)', 
        chatId, messageCount);
      
      return messageCount;
    }
    return 0;
  } catch (error) {
    logger.error('Erro ao limpar memória do chat:', error);
    return 0;
  }
}

/**
 * Lista todos os chats ativos com informações detalhadas
 * @param {Object} options - Opções de filtragem
 * @param {number} options.minMessages - Mínimo de mensagens para incluir
 * @param {boolean} options.includeStats - Se deve incluir estatísticas por chat
 * @returns {Array<Object>} Array de informações dos chats
 */
export function listChats(options = {}) {
  const { minMessages = 0, includeStats = false } = options;
  const chatList = [];
  
  for (const [chatId, messages] of Object.entries(cache)) {
    if (Array.isArray(messages) && messages.length >= minMessages) {
      const chatInfo = { chatId, messageCount: messages.length };
      
      if (includeStats) {
        const lastMessage = messages[messages.length - 1];
        chatInfo.lastActivity = lastMessage?.timestamp;
        chatInfo.totalTokens = messages.reduce((sum, msg) => sum + (msg.tokens || 0), 0);
        chatInfo.roles = [...new Set(messages.map(msg => msg.role))];
      }
      
      chatList.push(chatInfo);
    }
  }
  
  return chatList.sort((a, b) => b.messageCount - a.messageCount);
}

/**
 * Limpa chats inativos baseado em critérios
 * @param {Object} criteria - Critérios de limpeza
 * @param {number} criteria.maxAge - Idade máxima em dias
 * @param {number} criteria.minMessages - Mínimo de mensagens para manter
 * @returns {Promise<{removed: number, chatsRemoved: string[]}>} Resultado da limpeza
 */
export async function cleanupInactiveChats(criteria = {}) {
  const { maxAge = 30, minMessages = 5 } = criteria;
  const cutoffDate = new Date(Date.now() - maxAge * 24 * 60 * 60 * 1000);
  const chatsRemoved = [];
  let messagesRemoved = 0;
  
  for (const [chatId, messages] of Object.entries(cache)) {
    if (Array.isArray(messages)) {
      const lastMessage = messages[messages.length - 1];
      const lastActivity = lastMessage ? new Date(lastMessage.timestamp) : new Date(0);
      
      // Remove chats antigos com poucas mensagens
      if (lastActivity < cutoffDate && messages.length < minMessages) {
        messagesRemoved += messages.length;
        chatsRemoved.push(chatId);
        delete cache[chatId];
      }
    }
  }
  
  if (chatsRemoved.length > 0) {
    await saveMemory();
    logger.info('MEMORY: Limpeza removeu %d chats inativos (%d mensagens)', 
      chatsRemoved.length, messagesRemoved);
  }
  
  return { removed: messagesRemoved, chatsRemoved };
}

/**
 * Obtém estatísticas detalhadas de uso da memória
 * @returns {Object} Estatísticas completas do sistema de memória
 */
export function getMemoryStats() {
  const totalChats = Object.keys(cache).length;
  let totalMessages = 0;
  let totalTokens = 0;
  const chatSizes = [];
  const roleDistribution = { user: 0, assistant: 0, system: 0 };
  
  for (const [chatId, messages] of Object.entries(cache)) {
    if (Array.isArray(messages)) {
      const messageCount = messages.length;
      totalMessages += messageCount;
      chatSizes.push(messageCount);
      
      // Contar tokens e distribuição de roles
      for (const message of messages) {
        if (message.tokens) totalTokens += message.tokens;
        if (message.role && roleDistribution.hasOwnProperty(message.role)) {
          roleDistribution[message.role]++;
        }
      }
    }
  }
  
  const memoryUsageBytes = JSON.stringify(cache).length;
  const averageMessagesPerChat = totalChats > 0 ? Math.round(totalMessages / totalChats) : 0;
  
  return {
    totalChats,
    totalMessages,
    totalTokens,
    memoryUsageBytes,
    memoryUsageKB: Math.round(memoryUsageBytes / 1024),
    memoryUsageMB: Math.round(memoryUsageBytes / 1024 / 1024 * 100) / 100,
    averageMessagesPerChat,
    largestChat: Math.max(...chatSizes, 0),
    smallestChat: Math.min(...chatSizes, 0),
    roleDistribution,
    lastUpdate: new Date().toISOString()
  };
}

/**
 * Limpa toda a memória
 */
export async function clearMemory() {
  const stats = getMemoryStats();
  cache = {};
  await saveMemory();
  
  logger.info('CLEANUP: Memoria completamente limpa: %d chats, %d mensagens', 
    stats.totalChats, stats.totalMessages);
}

/**
 * Exporta dados da memória para backup
 */
export function exportMemory() {
  try {
    return {
      version: '1.0',
      timestamp: Date.now(),
      data: cache,
      stats: getMemoryStats()
    };
  } catch (error) {
    logger.error('Erro ao exportar memória:', error);
    return {
      version: '1.0',
      timestamp: Date.now(),
      data: {},
      stats: {
        totalChats: 0,
        totalMessages: 0,
        memoryUsage: 0
      }
    };
  }
}

/**
 * Importa dados de memória de um backup
 */
export function importMemory(backupData) {
  try {
    if (!backupData || !backupData.data) {
      throw new Error('Dados de backup inválidos');
    }
    
    const oldStats = getMemoryStats();
    cache = backupData.data || {};
    const newStats = getMemoryStats();
    
    logger.info('Memória importada: %d → %d chats, %d → %d mensagens', 
                oldStats.totalChats, newStats.totalChats,
                oldStats.totalMessages, newStats.totalMessages);
    
    return { oldStats, newStats };
  } catch (error) {
    logger.error('Erro ao importar memória:', error);
    cache = {};
    return { 
      oldStats: { totalChats: 0, totalMessages: 0 }, 
      newStats: { totalChats: 0, totalMessages: 0 } 
    };
  }
}

export default {
  loadMemory,
  saveMemory,
  pushMessage,
  getMessages,
  getThread,
  removeChat,
  listChats,
  getMemoryStats,
  clearMemory,
  cleanupInactiveChats,
  clearChatMemory,
  exportMemory,
  importMemory
};