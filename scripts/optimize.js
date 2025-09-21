#!/usr/bin/env node
// scripts/optimize.js - Script de otimização automática
import 'dotenv/config';
import { promises as fs } from 'fs';
import { testLLMConnection } from '../src/lib/llm.js';

async function measureModelSpeed() {
  console.log('🔍 Testando velocidade do modelo...\n');
  
  const testMessages = [
    { role: 'system', content: 'Responda de forma concisa.' },
    { role: 'user', content: 'Olá, como você está?' }
  ];
  
  const startTime = Date.now();
  
  try {
    const result = await testLLMConnection();
    const duration = Date.now() - startTime;
    
    console.log(`⏱️ Tempo de resposta: ${Math.round(duration / 1000)}s`);
    
    if (!result.success) {
      console.log('❌ Erro na conexão:', result.error);
      return null;
    }
    
    return duration;
    
  } catch (error) {
    console.log('❌ Erro no teste:', error.message);
    return null;
  }
}

async function generateOptimizedConfig(responseTime) {
  const isVerySlow = responseTime > 60000; // Mais de 1 minuto
  const isSlow = responseTime > 30000; // Mais de 30 segundos
  
  console.log(`\n🎯 Modelo detectado como: ${isVerySlow ? 'MUITO LENTO' : isSlow ? 'LENTO' : 'NORMAL'}\n`);
  
  let config;
  
  if (isVerySlow) {
    config = {
      MAX_HISTORY_MESSAGES: 5,
      MAX_TOKENS: 200,
      TEMPERATURE: 0.6,
      REQUEST_TIMEOUT: 180000, // 3 minutos
      MAX_RETRIES: 2,
      MAX_REQUESTS_PER_MINUTE: 3,
      MAX_REQUESTS_PER_HOUR: 15,
      GROUP_RANDOM_CHANCE: 0.01
    };
    console.log('⚡ Aplicando otimizações EXTREMAS...');
  } else if (isSlow) {
    config = {
      MAX_HISTORY_MESSAGES: 10,
      MAX_TOKENS: 400,
      TEMPERATURE: 0.7,
      REQUEST_TIMEOUT: 120000, // 2 minutos
      MAX_RETRIES: 2,
      MAX_REQUESTS_PER_MINUTE: 5,
      MAX_REQUESTS_PER_HOUR: 25,
      GROUP_RANDOM_CHANCE: 0.02
    };
    console.log('⚡ Aplicando otimizações MODERADAS...');
  } else {
    config = {
      MAX_HISTORY_MESSAGES: 20,
      MAX_TOKENS: 800,
      TEMPERATURE: 0.75,
      REQUEST_TIMEOUT: 60000, // 1 minuto
      MAX_RETRIES: 3,
      MAX_REQUESTS_PER_MINUTE: 10,
      MAX_REQUESTS_PER_HOUR: 50,
      GROUP_RANDOM_CHANCE: 0.25
    };
    console.log('✅ Modelo rápido - mantendo configuração padrão...');
  }
  
  return config;
}

async function updateEnvFile(optimizations) {
  try {
    // Lê .env atual
    let envContent = await fs.readFile('.env', 'utf-8').catch(() => '');
    
    // Aplica otimizações
    for (const [key, value] of Object.entries(optimizations)) {
      const regex = new RegExp(`^${key}=.*$`, 'm');
      
      if (envContent.match(regex)) {
        envContent = envContent.replace(regex, `${key}=${value}`);
        console.log(`  ✅ ${key}: ${value}`);
      } else {
        envContent += `\n${key}=${value}`;
        console.log(`  ➕ ${key}: ${value}`);
      }
    }
    
    // Salva .env otimizado
    await fs.writeFile('.env', envContent);
    console.log('\n💾 Arquivo .env atualizado com otimizações');
    
    // Cria backup da configuração original
    await fs.writeFile(`.env.backup.${Date.now()}`, envContent);
    console.log('📦 Backup da configuração anterior criado');
    
  } catch (error) {
    console.error('❌ Erro ao atualizar .env:', error.message);
  }
}

async function main() {
  console.log('🚀 Fernando AI - Otimizador Automático\n');
  
  try {
    const responseTime = await measureModelSpeed();
    
    if (responseTime === null) {
      console.log('\n❌ Não foi possível medir a velocidade do modelo.');
      console.log('Verifique se o LM Studio está rodando e tente novamente.');
      process.exit(1);
    }
    
    const optimizations = await generateOptimizedConfig(responseTime);
    await updateEnvFile(optimizations);
    
    console.log('\n🎉 Otimização concluída!');
    console.log('\n📋 Próximos passos:');
    console.log('1. Reinicie o bot: npm start');
    console.log('2. Teste as melhorias com algumas mensagens');
    console.log('3. Use /performance para monitorar o desempenho');
    
    if (responseTime > 60000) {
      console.log('\n💡 Dicas adicionais para modelos muito lentos:');
      console.log('• No LM Studio, reduza o Context Length para 2048');
      console.log('• Use GPU se disponível');
      console.log('• Considere um modelo menor (3B ou 7B)');
      console.log('• Feche outros programas pesados');
    }
    
  } catch (error) {
    console.error('❌ Erro na otimização:', error.message);
    process.exit(1);
  }
}

main();
