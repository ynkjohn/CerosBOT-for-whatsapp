import pino from 'pino';
import { conditionalConvert } from './emojiConverter.js';

const baseLogger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: { target: 'pino-pretty', options: { translateTime: 'SYS:standard', ignore: 'pid,hostname' } }
});

/**
 * Logger wrapper que converte emojis para ASCII no Windows
 */
export const logger = {
  debug: (msg, ...args) => baseLogger.debug(conditionalConvert(msg), ...args),
  info: (msg, ...args) => baseLogger.info(conditionalConvert(msg), ...args),
  warn: (msg, ...args) => baseLogger.warn(conditionalConvert(msg), ...args),
  error: (msg, ...args) => baseLogger.error(conditionalConvert(msg), ...args),
  fatal: (msg, ...args) => baseLogger.fatal(conditionalConvert(msg), ...args),
  trace: (msg, ...args) => baseLogger.trace(conditionalConvert(msg), ...args),
  child: (options) => baseLogger.child(options)
};