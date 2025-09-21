// src/lib/llm.js
import { config } from 'dotenv';
import { logger } from './logger.js';
import { performanceMonitor, measureTime } from './performance.js';
import { errorLogger } from './errorHandler.js';
import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

// Caminho para o arquivo .env
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '../../.env');

// Configurações dinâmicas que serão atualizadas automaticamente
let llmConfig = {};

// Função para carregar configurações do .env
function loadEnvConfig() {
  try {
    // Recarrega o .env
    config({ path: envPath });
    
    const newConfig = {
      ENDPOINT: process.env.API_ENDPOINT,
      MODEL: process.env.MODEL_NAME,
      MAX_TOKENS: parseInt(process.env.MAX_TOKENS) || 800,
      TEMPERATURE: parseFloat(process.env.TEMPERATURE) || 0.75,
      TOP_P: parseFloat(process.env.TOP_P) || 0.9,
      REQUEST_TIMEOUT: parseInt(process.env.REQUEST_TIMEOUT) || 120000,
      MAX_RETRIES: parseInt(process.env.MAX_RETRIES) || 3
    };

    // Validação das configurações
    if (!newConfig.ENDPOINT) {
      logger.error('ERRO: API_ENDPOINT não configurado no .env');
      return false;
    }

    if (!newConfig.MODEL) {
      logger.error('ERRO: MODEL_NAME não configurado no .env');
      return false;
    }

    // Verifica se houve mudanças
    const configChanged = JSON.stringify(llmConfig) !== JSON.stringify(newConfig);
    
    if (configChanged && Object.keys(llmConfig).length > 0) {
      logger.info('🔄 Configurações do LLM atualizadas automaticamente');
      logger.info('📝 Novo modelo: %s', newConfig.MODEL);
      logger.info('🌐 Novo endpoint: %s', newConfig.ENDPOINT);
    }

    llmConfig = newConfig;
    return true;
  } catch (error) {
    logger.error('Erro ao carregar configurações do .env:', error);
    return false;
  }
}

// Carrega configurações iniciais
loadEnvConfig();
logger.info('LLM configurado: %s via %s', llmConfig.MODEL, llmConfig.ENDPOINT);

// Monitora mudanças no arquivo .env
if (fs.existsSync(envPath)) {
  fs.watchFile(envPath, { interval: 1000 }, (curr, prev) => {
    if (curr.mtime > prev.mtime) {
      logger.info('📁 Arquivo .env alterado, recarregando configurações...');
      loadEnvConfig();
    }
  });
  logger.info('👀 Monitoramento automático do .env ativado');
} else {
  logger.warn('⚠️ Arquivo .env não encontrado para monitoramento');
}

/**
 * Cria um controller para timeout de requisições com AbortController
 * @param {number} timeoutMs - Tempo limite em milissegundos
 * @returns {{controller: AbortController, timeout: NodeJS.Timeout}} Controller e timeout ID
 * @throws {Error} Se timeoutMs não for um número válido
 */
function createTimeoutController(timeoutMs) {
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) {
    throw new Error('Timeout deve ser um número inteiro positivo');
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, timeoutMs);
  
  return { controller, timeout };
}

/**
 * Valida a resposta da API do LLM e extrai o conteúdo
 * @param {Object} data - Dados de resposta da API
 * @returns {string} Conteúdo da mensagem extraída
 * @throws {Error} Se a estrutura da resposta for inválida
 */
function validateResponse(data) {
  if (!data || typeof data !== 'object') {
    throw new Error('Resposta da API inválida: dados ausentes ou formato incorreto');
  }
  if (!data) {
    throw new Error('Resposta vazia da API');
  }
  
  if (data.error) {
    throw new Error(`Erro da API: ${data.error.message || data.error}`);
  }
  
  if (!data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
    throw new Error('Formato de resposta inválido: sem choices');
  }
  
  const choice = data.choices[0];
  if (!choice.message || !choice.message.content) {
    throw new Error('Formato de resposta inválido: sem conteúdo');
  }
  
  return choice.message.content.trim();
}

/**
 * Prepara e valida as mensagens para envio ao LLM
 * @param {Array<Object>} messages - Array de mensagens com role e content
 * @returns {Array<Object>} Mensagens processadas e validadas
 * @throws {Error} Se o formato das mensagens for inválido
 */
function prepareMessages(messages) {
  if (!Array.isArray(messages)) {
    throw new Error('Mensagens devem ser um array');
  }
  
  if (messages.length === 0) {
    throw new Error('Array de mensagens não pode estar vazio');
  }
  if (!Array.isArray(messages)) {
    throw new Error('Messages deve ser um array');
  }
  
  return messages.map(msg => ({
    role: msg.role,
    content: msg.content.slice(0, 2000) // Limita tamanho para acelerar processamento
  }));
}

/**
 * Calcula delay exponencial para retry com jitter para evitar thundering herd
 * @param {number} attempt - Número da tentativa atual (1-based)
 * @returns {number} Delay em milissegundos
 */
function getRetryDelay(attempt) {
  const baseDelay = 1000; // 1 segundo base
  const exponentialDelay = baseDelay * Math.pow(2, attempt - 1);
  // Adiciona jitter de ±25% para evitar que todos os clientes tentem simultaneamente
  const jitter = exponentialDelay * 0.25 * (Math.random() - 0.5);
  return Math.min(exponentialDelay + jitter, 30000); // Máximo de 30 segundos
  return Math.min(1000 * Math.pow(2, attempt - 1), 10000); // Max 10s
}

/**
 * Faz requisição para o modelo LLM com retry robusto
 */
export const askLLM = measureTime(async function(messages) {
  if (!messages || messages.length === 0) {
    throw new Error('Mensagens não podem estar vazias');
  }

  const preparedMessages = prepareMessages(messages);
  
  for (let attempt = 1; attempt <= llmConfig.MAX_RETRIES; attempt++) {
    const { controller, timeout } = createTimeoutController(llmConfig.REQUEST_TIMEOUT);
    
    try {
      logger.info('BOT: Enviando para LLM (tentativa %d/%d) - Aguarde, modelo pode demorar...', attempt, llmConfig.MAX_RETRIES);
      
      const requestBody = {
        model: llmConfig.MODEL,
        messages: preparedMessages,
        max_tokens: llmConfig.MAX_TOKENS,
        temperature: llmConfig.TEMPERATURE,
        top_p: llmConfig.TOP_P,
        stream: false // Garante resposta única
      };

      const response = await fetch(llmConfig.ENDPOINT, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'User-Agent': 'FernandoAI/1.0'
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Erro desconhecido');
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      const content = validateResponse(data);
      
      logger.debug('✅ Resposta recebida do LLM (%d chars)', content.length);
      
      // Log de uso de tokens se disponível
      if (data.usage) {
        logger.debug('📊 Tokens: %d prompt + %d completion = %d total', 
                    data.usage.prompt_tokens || 0,
                    data.usage.completion_tokens || 0,
                    data.usage.total_tokens || 0);
      }
      
      return content;

    } catch (error) {
      clearTimeout(timeout);
      
      const isLastAttempt = attempt === llmConfig.MAX_RETRIES;
      const isTimeoutError = error.name === 'AbortError';
      const isNetworkError = error.message.includes('fetch') || isTimeoutError;
      
      logger.warn('⚠️ Tentativa %d falhou: %s', attempt, error.message);

      if (isLastAttempt) {
        await errorLogger.logError(error, {
          context: 'llm_request_failed',
          endpoint: llmConfig.ENDPOINT,
          model: llmConfig.MODEL,
          attempt: attempt,
          maxRetries: llmConfig.MAX_RETRIES,
          messageCount: preparedMessages.length,
          isTimeoutError,
          isNetworkError
        });
        
        logger.error('ERRO: Todas as tentativas falharam para LLM');
        
        // Erro mais específico para timeout
        if (isTimeoutError) {
          throw new Error(`Timeout após ${llmConfig.REQUEST_TIMEOUT}ms - modelo pode estar sobrecarregado`);
        }
        
        throw new Error(`Falha na comunicação com LLM: ${error.message}`);
      }

      // Apenas faz retry em erros de rede ou temporários
      if (isNetworkError || error.message.includes('500') || error.message.includes('502') || error.message.includes('503')) {
        const delay = getRetryDelay(attempt);
        logger.debug('⏰ Aguardando %dms antes da próxima tentativa...', delay);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        // Erros permanentes (400, 401, etc.) não fazem retry
        throw error;
      }
    }
  }
});

/**
 * Testa a conexão com o LLM
 */
export async function testLLMConnection() {
  try {
    const testMessages = [
      { role: 'system', content: 'Você é um assistente de teste.' },
      { role: 'user', content: 'Responda apenas "OK" se estiver funcionando.' }
    ];
    
    const response = await askLLM(testMessages);
    const isWorking = response.toLowerCase().includes('ok');
    
    logger.info('🧪 Teste de conexão LLM: %s', isWorking ? '✅ OK' : '⚠️ Resposta inesperada');
    
    return {
      success: true,
      response: response,
      working: isWorking
    };
    
  } catch (error) {
    logger.error('ERRO: Teste de conexão LLM falhou: %s', error.message);
    
    return {
      success: false,
      error: error.message,
      working: false
    };
  }
}

/**
 * Obtém informações sobre o modelo
 */
export function getModelInfo() {
  return {
    endpoint: llmConfig.ENDPOINT,
    model: llmConfig.MODEL,
    maxTokens: llmConfig.MAX_TOKENS,
    temperature: llmConfig.TEMPERATURE,
    topP: llmConfig.TOP_P,
    timeout: llmConfig.REQUEST_TIMEOUT,
    maxRetries: llmConfig.MAX_RETRIES
  };
}
