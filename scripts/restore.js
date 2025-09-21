#!/usr/bin/env node
// scripts/restore.js - Script de restauração de backup
import 'dotenv/config';
import { listBackups, restoreBackup, validateBackup } from '../src/lib/backup.js';
import { saveMemory } from '../src/lib/memory.js';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'list';
  
  console.log('🔄 Fernando AI - Sistema de Restauração\n');
  
  try {
    if (command === 'list') {
      console.log('📋 Backups disponíveis:\n');
      
      const backups = await listBackups();
      
      if (backups.length === 0) {
        console.log('📦 Nenhum backup encontrado');
        return;
      }
      
      backups.forEach((backup, index) => {
        console.log(`${index + 1}. 📦 ${backup.id}`);
        console.log(`   📅 ${backup.date}`);
        console.log(`   📝 ${backup.description}`);
        console.log(`   📊 ${backup.chats} chats, ${backup.messages} mensagens`);
        console.log(`   💽 ${backup.size}\n`);
      });
      
    } else if (command === 'restore') {
      const backupId = args[1];
      
      if (!backupId) {
        console.log('❌ Use: npm run restore restore [backup-id]');
        process.exit(1);
      }
      
      console.log(`🔍 Verificando backup: ${backupId}`);
      
      const validation = await validateBackup(backupId);
      
      if (!validation.isValid) {
        console.log(`❌ Backup inválido: ${validation.error}`);
        process.exit(1);
      }
      
      console.log(`✅ Backup válido: ${validation.summary}\n`);
      
      const confirm = await question('⚠️ ATENÇÃO: Isso vai sobrescrever a memória atual!\nDeseja continuar? (digite "sim" para confirmar): ');
      
      if (confirm.toLowerCase() !== 'sim') {
        console.log('❌ Operação cancelada');
        process.exit(0);
      }
      
      console.log('\n🔄 Restaurando backup...');
      
      const result = await restoreBackup(backupId);
      
      console.log('💾 Salvando estado restaurado...');
      await saveMemory();
      
      console.log(`\n✅ **Backup restaurado com sucesso!**`);
      console.log(`📊 Chats: ${result.oldStats.chatCount} → ${result.newStats.chatCount}`);
      console.log(`📨 Mensagens: ${result.oldStats.totalMessages} → ${result.newStats.totalMessages}`);
      
    } else if (command === 'validate') {
      const backupId = args[1];
      
      if (!backupId) {
        console.log('❌ Use: npm run restore validate [backup-id]');
        process.exit(1);
      }
      
      console.log(`🔍 Validando backup: ${backupId}`);
      
      const validation = await validateBackup(backupId);
      
      if (validation.isValid) {
        console.log('✅ Backup válido!');
        console.log(`📊 Contém: ${validation.summary}`);
        console.log('\nChecks realizados:');
        Object.entries(validation.checks).forEach(([check, passed]) => {
          console.log(`  ${passed ? '✅' : '❌'} ${check}`);
        });
      } else {
        console.log('❌ Backup inválido!');
        console.log(`Erro: ${validation.error}`);
      }
      
    } else {
      console.log('❌ Comando inválido!');
      console.log('\nUso:');
      console.log('  npm run restore list                - Lista backups');
      console.log('  npm run restore restore [id]       - Restaura backup');
      console.log('  npm run restore validate [id]      - Valida backup');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

main();
