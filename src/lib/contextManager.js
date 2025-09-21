// src/lib/contextManager.js
import { logger } from './logger.js';

/**
 * Gerenciador inteligente de contexto para evitar confusão da IA
 */
class ContextManager {
  
  /**
   * Limpa contexto confuso ou redundante mantendo informações importantes
   */
  static cleanContext(messages) {
    if (!Array.isArray(messages) || messages.length === 0) {
      return messages;
    }

    let cleanedMessages = [...messages];
    
    // Remove mensagens duplicadas consecutivas
    cleanedMessages = this.removeDuplicateConsecutive(cleanedMessages);
    
    // Remove loops de conversa inúteis
    cleanedMessages = this.removeConversationLoops(cleanedMessages);
    
    // Mantém apenas contexto relevante recente
    cleanedMessages = this.keepRelevantContext(cleanedMessages);
    
    return cleanedMessages;
  }

  /**
   * Remove mensagens idênticas consecutivas
   */
  static removeDuplicateConsecutive(messages) {
    const result = [];
    let lastMessage = null;
    
    for (const message of messages) {
      if (!lastMessage || 
          lastMessage.content !== message.content || 
          lastMessage.role !== message.role) {
        result.push(message);
        lastMessage = message;
      }
    }
    
    return result;
  }

  /**
   * Remove loops de conversa que confundem a IA
   */
  static removeConversationLoops(messages) {
    // Procura por padrões repetitivos nos últimos 10 mensagens
    const recentMessages = messages.slice(-20);
    const patterns = new Map();
    
    // Identifica padrões repetitivos
    for (let i = 0; i < recentMessages.length - 1; i++) {
      const pattern = `${recentMessages[i].role}:${recentMessages[i].content.slice(0, 50)}`;
      patterns.set(pattern, (patterns.get(pattern) || 0) + 1);
    }
    
    // Remove mensagens que fazem parte de loops (aparecem mais de 2 vezes)
    return messages.filter(msg => {
      const pattern = `${msg.role}:${msg.content.slice(0, 50)}`;
      return (patterns.get(pattern) || 0) <= 2;
    });
  }

  /**
   * Mantém apenas contexto relevante baseado em importância
   */
  static keepRelevantContext(messages) {
    const maxMessages = parseInt(process.env.MAX_HISTORY_MESSAGES) || 100;
    
    if (messages.length <= maxMessages) {
      return messages;
    }

    // Estratégia: manter mensagens mais recentes + algumas importantes do início
    const recentMessages = messages.slice(-(maxMessages * 0.8)); // 80% recentes
    const oldImportantMessages = this.selectImportantMessages(
      messages.slice(0, messages.length - (maxMessages * 0.8)), 
      maxMessages * 0.2 // 20% antigas importantes
    );

    return [...oldImportantMessages, ...recentMessages];
  }

  /**
   * Seleciona mensagens importantes baseado em critérios
   */
  static selectImportantMessages(messages, maxCount) {
    return messages
      .map((msg, index) => ({
        ...msg,
        score: this.calculateMessageImportance(msg, index),
        originalIndex: index
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.floor(maxCount))
      .sort((a, b) => a.originalIndex - b.originalIndex)
      .map(({ score, originalIndex, ...msg }) => msg);
  }

  /**
   * Calcula importância de uma mensagem
   */
  static calculateMessageImportance(message, index) {
    let score = 0;
    const content = message.content.toLowerCase();

    // Mensagens do sistema são importantes
    if (message.role === 'system') {
      score += 100;
    }

    // Mensagens com perguntas são importantes
    if (content.includes('?')) {
      score += 20;
    }

    // Mensagens com informações específicas
    if (content.match(/\d+/) || // contém números
        content.includes('nome') ||
        content.includes('endereço') ||
        content.includes('telefone') ||
        content.includes('email') ||
        content.includes('data')) {
      score += 15;
    }

    // Mensagens mais longas tendem a ser mais informativas
    if (content.length > 100) {
      score += 10;
    }

    // Penaliza mensagens muito curtas ou vazias
    if (content.length < 10) {
      score -= 10;
    }

    // Penaliza spam ou mensagens inúteis
    if (content.includes('kkk') ||
        content.includes('haha') ||
        content.includes('emoji') ||
        content.match(/^[^a-zA-Z0-9\s]*$/)) {
      score -= 5;
    }

    return Math.max(0, score);
  }

  /**
   * Detecta se o contexto está confuso/misturado
   */
  static isContextConfused(messages) {
    if (messages.length < 4) return false;

    const recentMessages = messages.slice(-6);
    let topicChanges = 0;
    let contradictions = 0;

    // Conta mudanças bruscas de tópico
    for (let i = 1; i < recentMessages.length; i++) {
      const prev = recentMessages[i - 1].content.toLowerCase();
      const curr = recentMessages[i].content.toLowerCase();
      
      // Verifica mudança brusca de assunto
      if (this.getTopicSimilarity(prev, curr) < 0.3) {
        topicChanges++;
      }
    }

    // Detecta contradições nas respostas da IA
    const aiMessages = recentMessages.filter(m => m.role === 'assistant');
    for (let i = 1; i < aiMessages.length; i++) {
      if (this.hasContradiction(aiMessages[i - 1].content, aiMessages[i].content)) {
        contradictions++;
      }
    }

    return topicChanges > 3 || contradictions > 1;
  }

  /**
   * Calcula similaridade entre dois tópicos (simplificado)
   */
  static getTopicSimilarity(text1, text2) {
    const words1 = new Set(text1.split(/\s+/).filter(w => w.length > 3));
    const words2 = new Set(text2.split(/\s+/).filter(w => w.length > 3));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return union.size === 0 ? 0 : intersection.size / union.size;
  }

  /**
   * Detecta contradições básicas
   */
  static hasContradiction(text1, text2) {
    const contradictoryPairs = [
      ['sim', 'não'],
      ['verdade', 'falso'],
      ['correto', 'errado'],
      ['pode', 'não pode'],
      ['é', 'não é']
    ];

    const t1 = text1.toLowerCase();
    const t2 = text2.toLowerCase();

    return contradictoryPairs.some(([word1, word2]) =>
      (t1.includes(word1) && t2.includes(word2)) ||
      (t1.includes(word2) && t2.includes(word1))
    );
  }

  /**
   * Limpa contexto automaticamente se detectar confusão
   */
  static autoCleanIfConfused(messages) {
    if (this.isContextConfused(messages)) {
      logger.info('🧹 Contexto confuso detectado, aplicando limpeza inteligente');
      return this.cleanContext(messages);
    }
    return messages;
  }
}

export { ContextManager };
