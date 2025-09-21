#!/usr/bin/env node
// scripts/health.js - Teste de saúde do sistema
import 'dotenv/config';
import { testLLMConnection, getModelInfo } from '../src/lib/llm.js';
import { getMemoryStats } from '../src/lib/memory.js';
import { logger } from '../src/lib/logger.js';

async function checkLLM() {
  console.log('🤖 Testando conexão com LLM...');
  
  const modelInfo = getModelInfo();
  console.log(`   Endpoint: ${modelInfo.endpoint}`);
  console.log(`   Modelo: ${modelInfo.model}`);
  
  try {
    const result = await testLLMConnection();
    if (result.success && result.working) {
      console.log('   ✅ LLM funcionando corretamente');
      console.log(`   Resposta: "${result.response}"`);
      return true;
    } else {
      console.log('   ⚠️  LLM conectou mas resposta inesperada');
      console.log(`   Resposta: "${result.response}"`);
      return false;
    }
  } catch (error) {
    console.log('   ❌ Erro na conexão:', error.message);
    return false;
  }
}

async function checkMemory() {
  console.log('\n💾 Verificando sistema de memória...');
  
  try {
    const { loadMemory, saveMemory } = await import('../src/lib/memory.js');
    
    await loadMemory();
    console.log('   ✅ Memória carregada com sucesso');
    
    const stats = getMemoryStats();
    console.log(`   📊 ${stats.chatCount} chats, ${stats.totalMessages} mensagens`);
    console.log(`   💽 ${stats.memorySizeKB}KB em memória`);
    
    await saveMemory();
    console.log('   ✅ Memória salva com sucesso');
    
    return true;
  } catch (error) {
    console.log('   ❌ Erro no sistema de memória:', error.message);
    return false;
  }
}

async function checkBackups() {
  console.log('\n💾 Verificando sistema de backup...');
  
  try {
    const { listBackups } = await import('../src/lib/backup.js');
    
    const backups = await listBackups();
    console.log(`   📦 ${backups.length} backups disponíveis`);
    
    if (backups.length > 0) {
      const latest = backups[0];
      console.log(`   🕐 Último: ${latest.date} (${latest.size})`);
    }
    
    console.log('   ✅ Sistema de backup funcionando');
    return true;
  } catch (error) {
    console.log('   ❌ Erro no sistema de backup:', error.message);
    return false;
  }
}

async function checkEnvironment() {
  console.log('\n🔧 Verificando variáveis de ambiente...');
  
  const required = ['API_ENDPOINT', 'MODEL_NAME'];
  const missing = [];
  
  for (const env of required) {
    if (!process.env[env]) {
      missing.push(env);
    } else {
      console.log(`   ✅ ${env}: ${process.env[env].slice(0, 50)}${process.env[env].length > 50 ? '...' : ''}`);
    }
  }
  
  if (missing.length > 0) {
    console.log(`   ❌ Variáveis faltando: ${missing.join(', ')}`);
    return false;
  }
  
  return true;
}

async function main() {
  console.log('🏥 Fernando AI - Verificação de Saúde\n');
  
  const checks = [
    { name: 'Ambiente', fn: checkEnvironment },
    { name: 'LLM', fn: checkLLM },
    { name: 'Memória', fn: checkMemory },
    { name: 'Backups', fn: checkBackups }
  ];
  
  let passed = 0;
  let total = checks.length;
  
  for (const check of checks) {
    try {
      const result = await check.fn();
      if (result) passed++;
    } catch (error) {
      console.log(`   💥 Erro fatal em ${check.name}:`, error.message);
    }
  }
  
  console.log('\n' + '='.repeat(50));
  console.log(`📊 Resultado: ${passed}/${total} verificações passaram`);
  
  if (passed === total) {
    console.log('🎉 Sistema totalmente operacional!');
    process.exit(0);
  } else {
    console.log('⚠️  Alguns problemas encontrados. Verifique as configurações.');
    process.exit(1);
  }
}

main().catch(error => {
  console.error('💥 Erro fatal:', error);
  process.exit(1);
});
