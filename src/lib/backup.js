// src/lib/backup.js
import { promises as fs } from 'fs';
import { join } from 'path';
import { logger } from './logger.js';
import { exportMemory, importMemory } from './memory.js';

const BACKUP_DIR = process.env.BACKUP_DIR || './backups';
const MAX_BACKUPS = parseInt(process.env.MAX_BACKUPS) || 10;

/**
 * Garante que o diretório de backup existe
 */
async function ensureBackupDir() {
  try {
    await fs.mkdir(BACKUP_DIR, { recursive: true });
  } catch (error) {
    logger.error('Erro ao criar diretório de backup:', error);
    throw error;
  }
}

/**
 * Cria um backup da memória atual
 */
export async function createBackup(description = 'Backup automático') {
  try {
    await ensureBackupDir();
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupId = `backup-${timestamp}`;
    const filename = `${backupId}.json`;
    const filepath = join(BACKUP_DIR, filename);
    
    const memoryExport = exportMemory();
    
    const backupData = {
      id: backupId,
      description,
      createdAt: new Date().toISOString(),
      version: '1.0',
      memory: memoryExport
    };
    
    await fs.writeFile(filepath, JSON.stringify(backupData, null, 2), 'utf-8');
    
    logger.info('💾 Backup criado: %s (%d chats, %d mensagens)', 
                backupId, 
                memoryExport.stats.chatCount, 
                memoryExport.stats.totalMessages);
    
    // Limpa backups antigos
    await cleanupOldBackups();
    
    return backupId;
    
  } catch (error) {
    logger.error('❌ Erro ao criar backup:', error);
    throw error;
  }
}

/**
 * Lista todos os backups disponíveis
 */
export async function listBackups() {
  try {
    await ensureBackupDir();
    
    const files = await fs.readdir(BACKUP_DIR);
    const backupFiles = files.filter(file => file.startsWith('backup-') && file.endsWith('.json'));
    
    const backups = [];
    
    for (const file of backupFiles) {
      try {
        const filepath = join(BACKUP_DIR, file);
        const stats = await fs.stat(filepath);
        const content = await fs.readFile(filepath, 'utf-8');
        const data = JSON.parse(content);
        
        backups.push({
          id: data.id || file.replace('.json', ''),
          description: data.description || 'Sem descrição',
          date: new Date(data.createdAt || stats.ctime).toLocaleString('pt-BR'),
          size: formatBytes(stats.size),
          chats: data.memory?.stats?.chatCount || 0,
          messages: data.memory?.stats?.totalMessages || 0,
          filepath: filepath
        });
        
      } catch (parseError) {
        logger.warn('⚠️ Backup corrompido ignorado: %s', file);
      }
    }
    
    // Ordena por data (mais recente primeiro)
    backups.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    return backups;
    
  } catch (error) {
    logger.error('❌ Erro ao listar backups:', error);
    throw error;
  }
}

/**
 * Restaura um backup específico
 */
export async function restoreBackup(backupId) {
  try {
    const backups = await listBackups();
    const backup = backups.find(b => b.id === backupId);
    
    if (!backup) {
      throw new Error(`Backup '${backupId}' não encontrado`);
    }
    
    const content = await fs.readFile(backup.filepath, 'utf-8');
    const backupData = JSON.parse(content);
    
    if (!backupData.memory) {
      throw new Error('Backup não contém dados de memória válidos');
    }
    
    // Cria backup da situação atual antes de restaurar
    const currentBackupId = await createBackup('Backup antes de restauração');
    logger.info('📦 Backup atual salvo como: %s', currentBackupId);
    
    // Importa os dados do backup
    const result = importMemory(backupData.memory);
    
    logger.info('📥 Backup restaurado: %s (%d chats, %d mensagens)', 
                backupId, 
                result.newStats.chatCount, 
                result.newStats.totalMessages);
    
    return result;
    
  } catch (error) {
    logger.error('❌ Erro ao restaurar backup:', error);
    throw error;
  }
}

/**
 * Remove backups antigos mantendo apenas os mais recentes
 */
async function cleanupOldBackups() {
  try {
    const backups = await listBackups();
    
    if (backups.length <= MAX_BACKUPS) {
      return; // Não precisa limpar
    }
    
    const toRemove = backups.slice(MAX_BACKUPS);
    let removedCount = 0;
    
    for (const backup of toRemove) {
      try {
        await fs.unlink(backup.filepath);
        removedCount++;
        logger.debug('🗑️ Backup antigo removido: %s', backup.id);
      } catch (error) {
        logger.warn('⚠️ Erro ao remover backup %s:', backup.id, error);
      }
    }
    
    if (removedCount > 0) {
      logger.info('🧹 Limpeza de backups: %d arquivos removidos', removedCount);
    }
    
  } catch (error) {
    logger.error('❌ Erro na limpeza de backups:', error);
  }
}

/**
 * Remove um backup específico
 */
export async function deleteBackup(backupId) {
  try {
    const backups = await listBackups();
    const backup = backups.find(b => b.id === backupId);
    
    if (!backup) {
      throw new Error(`Backup '${backupId}' não encontrado`);
    }
    
    await fs.unlink(backup.filepath);
    logger.info('🗑️ Backup removido: %s', backupId);
    
    return true;
    
  } catch (error) {
    logger.error('❌ Erro ao remover backup:', error);
    throw error;
  }
}

/**
 * Obtém informações de um backup específico
 */
export async function getBackupInfo(backupId) {
  try {
    const backups = await listBackups();
    const backup = backups.find(b => b.id === backupId);
    
    if (!backup) {
      throw new Error(`Backup '${backupId}' não encontrado`);
    }
    
    const content = await fs.readFile(backup.filepath, 'utf-8');
    const data = JSON.parse(content);
    
    return {
      ...backup,
      fullData: data
    };
    
  } catch (error) {
    logger.error('❌ Erro ao obter info do backup:', error);
    throw error;
  }
}

/**
 * Formata bytes em formato legível
 */
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Cria backup de emergência em caso de erro crítico
 */
export async function createEmergencyBackup(errorInfo) {
  try {
    const backupId = await createBackup(`Backup de emergência - ${errorInfo}`);
    logger.warn('🚨 Backup de emergência criado: %s', backupId);
    return backupId;
  } catch (backupError) {
    logger.error('💥 FALHA CRÍTICA: Não foi possível criar backup de emergência:', backupError);
    throw backupError;
  }
}

/**
 * Valida integridade de um backup
 */
export async function validateBackup(backupId) {
  try {
    const backup = await getBackupInfo(backupId);
    
    const checks = {
      hasMemory: !!backup.fullData.memory,
      hasStats: !!backup.fullData.memory?.stats,
      hasData: !!backup.fullData.memory?.data,
      validStructure: typeof backup.fullData.memory?.data === 'object',
      chatCount: backup.fullData.memory?.stats?.chatCount || 0,
      messageCount: backup.fullData.memory?.stats?.totalMessages || 0
    };
    
    const isValid = checks.hasMemory && checks.hasStats && checks.hasData && checks.validStructure;
    
    return {
      isValid,
      checks,
      summary: `${checks.chatCount} chats, ${checks.messageCount} mensagens`
    };
    
  } catch (error) {
    return {
      isValid: false,
      error: error.message
    };
  }
}
