#!/usr/bin/env node
// scripts/setup.js - Script de configuração inicial
import { promises as fs } from 'fs';
import { join } from 'path';
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
  console.log('🚀 Ceros AI - Configuração Inicial\n');

  try {
    // Verifica se .env existe
    const envPath = '.env';
    let existingEnv = {};
    
    try {
      const envContent = await fs.readFile(envPath, 'utf-8');
      envContent.split('\n').forEach(line => {
        const [key, value] = line.split('=');
        if (key && value) existingEnv[key] = value;
      });
    } catch (e) {
      console.log('📝 Arquivo .env não encontrado, criando novo...');
    }

    // Coleta configurações
    console.log('Por favor, forneça as seguintes informações:\n');

    const apiEndpoint = await question(`API Endpoint LLM [${existingEnv.API_ENDPOINT || 'http://localhost:1234/v1/chat/completions'}]: `) || existingEnv.API_ENDPOINT || 'http://localhost:1234/v1/chat/completions';
    
    const modelName = await question(`Nome do Modelo [${existingEnv.MODEL_NAME || 'gpt-3.5-turbo'}]: `) || existingEnv.MODEL_NAME || 'gpt-3.5-turbo';
    
    const adminNumber = await question(`Número do Admin (só números) [${existingEnv.ADMIN_NUMBER || ''}]: `) || existingEnv.ADMIN_NUMBER || '';

    // Cria arquivo .env
    const envConfig = `# Configurações do LLM
API_ENDPOINT=${apiEndpoint}
MODEL_NAME=${modelName}

# Configurações do bot
ADMIN_NUMBER=${adminNumber}
DUPLICATE_TIMEOUT=5000
GROUP_RANDOM_CHANCE=0.02

# Configurações de memória
MAX_HISTORY_MESSAGES=50
MEMORY_FILE=memoria.json
MEMORY_BACKUP_PATH=./backups

# Configurações do LLM
MAX_TOKENS=800
TEMPERATURE=0.75
TOP_P=0.9
REQUEST_TIMEOUT=30000
MAX_RETRIES=3

# Rate limiting
MAX_REQUESTS_PER_MINUTE=10
MAX_REQUESTS_PER_HOUR=50

# Backup automático
BACKUP_DIR=./backups
MAX_BACKUPS=10

# Logs
LOG_LEVEL=info
`;

    await fs.writeFile(envPath, envConfig);
    console.log('✅ Arquivo .env criado/atualizado');

    // Cria diretórios necessários
    const dirs = ['backups', 'logs'];
    for (const dir of dirs) {
      try {
        await fs.mkdir(dir, { recursive: true });
        console.log(`✅ Diretório ${dir} criado`);
      } catch (e) {
        if (e.code !== 'EEXIST') throw e;
      }
    }

    // Cria arquivo de memória vazio se não existir
    try {
      await fs.access('memoria.json');
    } catch (e) {
      await fs.writeFile('memoria.json', '{}');
      console.log('✅ Arquivo memoria.json criado');
    }

    console.log('\n🎉 Configuração concluída!');
    console.log('\nPróximos passos:');
    console.log('1. npm install (se ainda não fez)');
    console.log('2. npm start (para iniciar o bot)');
    console.log('3. Escaneie o QR code no seu WhatsApp');
    console.log('\n💡 Use npm run health para testar a conexão com a IA');

  } catch (error) {
    console.error('❌ Erro na configuração:', error.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

main();
