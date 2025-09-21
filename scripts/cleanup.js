#!/usr/bin/env node
// scripts/cleanup.js - Script de limpeza de dados antigos
import 'dotenv/config';
import { loadMemory, saveMemory, cleanupInactiveChats, getMemoryStats } from '../src/lib/memory.js';

async function main() {
  const args = process.argv.slice(2);
  const days = parseInt(args[0]) || 30;
  
  console.log(`🧹 Fernando AI - Limpeza de Dados Antigos\n`);
  
  if (days < 1 || days > 365) {
    console.log('❌ Número de dias deve ser entre 1 e 365');
    process.exit(1);
  }
  
  try {
    console.log('📚 Carregando memória...');
    await loadMemory();
    
    const statsBefore = getMemoryStats();
    console.log(`📊 Estado atual: ${statsBefore.chatCount} chats, ${statsBefore.totalMessages} mensagens\n`);
    
    console.log(`🔍 Procurando chats inativos há mais de ${days} dias...`);
    const result = cleanupInactiveChats(days);
    
    if (result.removedChats > 0) {
      console.log(`\n🗑️ **Limpeza realizada:**`);
      console.log(`• Chats removidos: ${result.removedChats}`);
      console.log(`• Mensagens apagadas: ${result.removedMessages}`);
      
      console.log('\n💾 Salvando alterações...');
      await saveMemory();
      
      const statsAfter = getMemoryStats();
      console.log(`📊 Estado final: ${statsAfter.chatCount} chats, ${statsAfter.totalMessages} mensagens`);
      console.log('\n✅ Limpeza concluída com sucesso!');
    } else {
      console.log(`\n✅ Nenhum chat inativo encontrado (critério: ${days} dias)`);
    }
    
  } catch (error) {
    console.error('❌ Erro na limpeza:', error.message);
    process.exit(1);
  }
}

main();
