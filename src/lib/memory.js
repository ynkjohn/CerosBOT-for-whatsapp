// src/lib/memory.js
import { promises as fs } from 'fs';
import { logger } from './logger.js';

const MEMORY_FILE = './memoria.json';
let cache = {};

/**
 * Carrega memória do arquivo JSON
 */
export async function loadMemory() {
  try {
    const data = await fs.readFile(MEMORY_FILE, 'utf-8');
    cache = JSON.parse(data);
    
    if (typeof cache !== 'object' || cache === null) {
      cache = {};
    }
    
    logger.info('MEMORY: Memoria carregada com sucesso');
  } catch (error) {
    if (error.code === 'ENOENT') {
      logger.info('MEMORY: Arquivo de memoria nao existe, criando novo');
      cache = {};
      await saveMemory();
    } else {
      logger.error('MEMORY: Erro ao carregar memoria, usando cache vazio:', error.message);
      cache = {};
    }
  }
}

/**
 * Salva memória no arquivo JSON
 */
export async function saveMemory() {
  try {
    const data = JSON.stringify(cache, null, 2);
    await fs.writeFile(MEMORY_FILE, data, 'utf-8');
  } catch (error) {
    logger.error('MEMORY: Erro ao salvar memoria:', error);
  }
}

/**
 * Adiciona mensagem ao cache
 */
export function pushMessage(chatId, role, content) {
  if (!chatId || !role || !content) {
    return;
  }

  if (!cache[chatId]) {
    cache[chatId] = [];
  }

  const message = {
    role,
    content,
    timestamp: new Date().toISOString(),
    tokens: content.length
  };

  cache[chatId].push(message);

  // Limitar a 50 mensagens por chat
  if (cache[chatId].length > 50) {
    cache[chatId] = cache[chatId].slice(-50);
  }

  // Auto-save a cada 10 mensagens
  if (cache[chatId].length % 10 === 0) {
    saveMemory();
  }
}

/**
 * Obtém mensagens de um chat
 */
export function getMessages(chatId, limit = 20) {
  if (!cache[chatId]) {
    return [];
  }
  
  return cache[chatId].slice(-limit);
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
 * Lista todos os chats ativos
 */
export function listChats() {
  return Object.keys(cache);
}

/**
 * Obtém estatísticas de uso da memória
 */
export function getMemoryStats() {
  const totalChats = Object.keys(cache).length;
  let totalMessages = 0;
  
  for (const messages of Object.values(cache)) {
    totalMessages += Array.isArray(messages) ? messages.length : 0;
  }
  
  return {
    totalChats,
    totalMessages,
    memoryUsage: JSON.stringify(cache).length
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
 * Remove chats inativos (sem mensagens recentes)
 */
export async function cleanupInactiveChats(daysOld = 7) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysOld);
  
  let removedChats = 0;
  let removedMessages = 0;
  
  for (const [chatId, messages] of Object.entries(cache)) {
    if (!Array.isArray(messages) || messages.length === 0) {
      delete cache[chatId];
      removedChats++;
      continue;
    }
    
    const lastMessage = messages[messages.length - 1];
    if (lastMessage.timestamp && new Date(lastMessage.timestamp) < cutoff) {
      removedMessages += messages.length;
      delete cache[chatId];
      removedChats++;
    }
  }
  
  if (removedChats > 0) {
    await saveMemory();
    logger.info('CLEANUP: Limpeza automatica: %d chats inativos removidos (%d mensagens)', 
      removedChats, removedMessages);
  }
  
  return { removedChats, removedMessages };
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