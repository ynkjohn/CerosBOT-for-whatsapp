#!/usr/bin/env node
// scripts/backup.js - Script de backup manual
import 'dotenv/config';
import { createBackup, listBackups } from '../src/lib/backup.js';

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'create';
  
  console.log('💾 Fernando AI - Sistema de Backup\n');
  
  try {
    if (command === 'create') {
      const description = args[1] || `Backup manual - ${new Date().toLocaleString('pt-BR')}`;
      
      console.log('🔄 Criando backup...');
      const backupId = await createBackup(description);
      
      console.log(`✅ Backup criado com sucesso!`);
      console.log(`📦 ID: ${backupId}`);
      console.log(`📝 Descrição: ${description}`);
      
    } else if (command === 'list') {
      console.log('📋 Listando backups disponíveis...\n');
      
      const backups = await listBackups();
      
      if (backups.length === 0) {
        console.log('📦 Nenhum backup encontrado');
        return;
      }
      
      backups.forEach((backup, index) => {
        console.log(`${index + 1}. 📦 ${backup.id}`);
        console.log(`   📅 Data: ${backup.date}`);
        console.log(`   📝 Descrição: ${backup.description}`);
        console.log(`   📊 ${backup.chats} chats, ${backup.messages} mensagens`);
        console.log(`   💽 Tamanho: ${backup.size}\n`);
      });
      
    } else {
      console.log('❌ Comando inválido!');
      console.log('\nUso:');
      console.log('  npm run backup create [descrição]  - Cria novo backup');
      console.log('  npm run backup list                - Lista backups');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
}

main();
