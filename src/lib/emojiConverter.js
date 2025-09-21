// src/lib/emojiConverter.js
// Conversor de emojis para texto ASCII compatível com Windows CMD

/**
 * Mapeamento de emojis para texto ASCII
 */
const emojiToAscii = {
  // Status e Sistema
  '🤖': '[BOT]',
  '✅': '[OK]',
  '❌': '[ERRO]',
  '⚠️': '[AVISO]',
  '🔄': '[SYNC]',
  '⚡': '[SISTEMA]',
  '🎯': '[ACAO]',
  '🎉': '[SUCESSO]',
  
  // Funcionalidades
  '📊': '[STATS]',
  '💾': '[MEMORIA]',
  '🛡️': '[SEGURANCA]',
  '🔧': '[CONFIG]',
  '🖥️': '[DESKTOP]',
  '🌐': '[API]',
  '👥': '[USUARIOS]',
  '📋': '[LOG]',
  '🔍': '[HEALTH]',
  '📦': '[BACKUP]',
  '🧪': '[TESTE]',
  '📡': '[MONITOR]',
  
  // Ações
  '🧹': '[LIMPEZA]',
  '🔒': '[LIMITE]',
  '📈': '[ATIVIDADE]',
  '💬': '[MENSAGEM]',
  '🔑': '[AUTH]',
  '⏰': '[TEMPO]',
  '📝': '[NOVO]',
  '🗑️': '[DELETAR]',
  '📂': '[PASTA]',
  '📄': '[ARQUIVO]',
  
  // Símbolos comuns
  '•': '-',
  '→': '->',
  '←': '<-',
  '↔️': '<->',
  '🔗': '[LINK]'
};

/**
 * Converte emojis em uma string para texto ASCII
 * @param {string} text - Texto com emojis
 * @returns {string} - Texto com emojis convertidos para ASCII
 */
export function convertEmojisToAscii(text) {
  if (typeof text !== 'string') {
    return text;
  }
  
  let convertedText = text;
  
  // Substituir emojis conhecidos primeiro
  for (const [emoji, ascii] of Object.entries(emojiToAscii)) {
    convertedText = convertedText.replace(new RegExp(escapeRegExp(emoji), 'g'), ascii);
  }
  
  // Converter caracteres especiais comuns que aparecem como ?? no Windows
  convertedText = convertedText
    // Acentos português
    .replace(/[àáâãä]/g, 'a')
    .replace(/[èéêë]/g, 'e')
    .replace(/[ìíîï]/g, 'i')
    .replace(/[òóôõö]/g, 'o')
    .replace(/[ùúûü]/g, 'u')
    .replace(/[ç]/g, 'c')
    .replace(/[ñ]/g, 'n')
    // Versões maiúsculas
    .replace(/[ÀÁÂÃÄ]/g, 'A')
    .replace(/[ÈÉÊË]/g, 'E')
    .replace(/[ÌÍÎÏ]/g, 'I')
    .replace(/[ÒÓÔÕÖ]/g, 'O')
    .replace(/[ÙÚÛÜ]/g, 'U')
    .replace(/[Ç]/g, 'C')
    .replace(/[Ñ]/g, 'N');
  
  // Remover todos os emojis e símbolos Unicode problemáticos
  // Manter apenas ASCII básico (32-126) + espaços e quebras de linha
  convertedText = convertedText.replace(/[^\x20-\x7E\r\n\t]/g, '');
  
  // Limpar múltiplos espaços e caracteres vazios
  convertedText = convertedText.replace(/\s+/g, ' ').trim();
  
  return convertedText;
}

/**
 * Escapa caracteres especiais para regex
 */
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Verifica se o sistema precisa de conversão ASCII (Windows CMD)
 * @returns {boolean}
 */
export function shouldConvertEmojis() {
  // Sempre converter no Windows para garantir compatibilidade
  return process.platform === 'win32';
}

/**
 * Converte texto condicionalmente baseado no ambiente
 * @param {string} text - Texto original
 * @returns {string} - Texto convertido ou original
 */
export function conditionalConvert(text) {
  return shouldConvertEmojis() ? convertEmojisToAscii(text) : text;
}