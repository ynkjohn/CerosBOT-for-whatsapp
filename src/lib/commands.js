// src/lib/commands.js
import { logger } from './logger.js';
import { getMemoryStats, clearMemory, clearChatMemory, cleanupInactiveChats } from './memory.js';
import { getRateLimitStats, rateLimiter } from './rateLimit.js';
import { testLLMConnection, getModelInfo } from './llm.js';
import { performanceMonitor } from './performance.js';
import { errorLogger } from './errorHandler.js';
import { authManager } from './auth.js';
import { createBackup, listBackups, restoreBackup } from './backup.js';

/**
 * Comandos disponíveis para administradores
 */
const adminCommands = {
  '/help': {
    description: 'Lista todos os comandos disponíveis',
    handler: async (msg) => {
      const help = `🤖 **Ceros AI - Comandos Admin**

**📊 Informações:**
• \`/status\` - Status geral do sistema
• \`/stats\` - Estatísticas detalhadas
• \`/memory\` - Informações da memória
• \`/ratelimit\` - Stats de rate limiting
• \`/testllm\` - Testa conexão com LLM
• \`/performance\` - Estatísticas de performance
• \`/errors\` - Logs de erros recentes
• \`/admins\` - Lista administradores
• \`/errorstats\` - Estatísticas de erros
• \`/users\` - Lista usuários logados
• \`/sessions\` - Sessões ativas

**🔧 Manutenção:**
• \`/limparmemoria\` - Limpa toda a memória
• \`/cleanup [dias]\` - Remove chats inativos
• \`/resetrate [numero]\` - Reseta rate limit
• \`/backup\` - Cria backup manual
• \`/backups\` - Lista backups disponíveis
• \`/restore [id]\` - Restaura backup

**⚡ Sistema:**
• \`/logs\` - Informações sobre logs
• \`/reiniciar\` - Reinicia o bot
• \`/confirmar [ação]\` - Confirma operações`;

      await msg.reply(help);
    }
  },

  '/status': {
    description: 'Mostra status geral do sistema',
    handler: async (msg) => {
      const memStats = getMemoryStats();
      const rateStats = getRateLimitStats();
      const modelInfo = getModelInfo();
      const uptime = Math.floor(process.uptime());
      const uptimeFormatted = `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`;
      
      const status = `🤖 **Ceros AI - Status**

**⚡ Sistema:**
• Uptime: ${uptimeFormatted}
• Memória Node.js: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB
• Modelo: ${modelInfo.model}

**💾 Memória Conversas:**
• ${memStats.chatCount} chats ativos
• ${memStats.totalMessages} mensagens totais
• ${memStats.memorySizeKB}KB em memória

**📊 Rate Limiting:**
• ${rateStats.activeUsersMinute} usuários ativos (1min)
• ${rateStats.totalRequestsMinute} requests (1min)
• ${rateStats.totalUsers} usuários cadastrados`;

      await msg.reply(status);
    }
  },

  '/stats': {
    description: 'Estatísticas detalhadas do sistema',
    handler: async (msg) => {
      const memStats = getMemoryStats();
      const rateStats = getRateLimitStats();
      
      const stats = `📊 **Estatísticas Detalhadas**

**💾 Memória:**
• Total de chats: ${memStats.chatCount}
• Total de mensagens: ${memStats.totalMessages}
• Média msgs/chat: ${memStats.avgMessagesPerChat}
• Chat mais ativo: ${memStats.mostActiveChat || 'N/A'}
• Máx. mensagens/chat: ${memStats.maxMessages}
• Tamanho em memória: ${memStats.memorySizeKB}KB

**⚡ Rate Limiting:**
• Usuários únicos: ${rateStats.totalUsers}
• Ativos (1min): ${rateStats.activeUsersMinute}
• Ativos (1h): ${rateStats.activeUsersHour}
• Requests (1min): ${rateStats.totalRequestsMinute}
• Requests (1h): ${rateStats.totalRequestsHour}
• Média req/user (1min): ${rateStats.avgRequestsPerUserMinute}
• Média req/user (1h): ${rateStats.avgRequestsPerUserHour}

**🖥️ Sistema Node.js:**
• Heap usada: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB
• Heap total: ${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB
• RSS: ${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB
• External: ${Math.round(process.memoryUsage().external / 1024 / 1024)}MB`;

      await msg.reply(stats);
    }
  },

  '/memory': {
    description: 'Informações detalhadas da memória',
    handler: async (msg) => {
      const stats = getMemoryStats();
      
      const memoryInfo = `💾 **Informações da Memória**

• **Chats ativos:** ${stats.chatCount}
• **Total de mensagens:** ${stats.totalMessages}
• **Média por chat:** ${stats.avgMessagesPerChat} mensagens
• **Tamanho em disco:** ${stats.memorySizeKB}KB
• **Chat mais ativo:** ${stats.mostActiveChat || 'Nenhum'}
• **Máx. mensagens:** ${stats.maxMessages}

*Use /cleanup para limpar chats inativos*
*Use /limparmemoria para reset completo*`;

      await msg.reply(memoryInfo);
    }
  },

  '/ratelimit': {
    description: 'Estatísticas de rate limiting',
    handler: async (msg) => {
      const stats = getRateLimitStats();
      
      const rateLimitInfo = `📊 **Rate Limiting**

• **Usuários únicos:** ${stats.totalUsers}
• **Ativos (última hora):** ${stats.activeUsersHour}
• **Ativos (último minuto):** ${stats.activeUsersMinute}

• **Requests (última hora):** ${stats.totalRequestsHour}
• **Requests (último minuto):** ${stats.totalRequestsMinute}

• **Média req/usuário (1h):** ${stats.avgRequestsPerUserHour}
• **Média req/usuário (1min):** ${stats.avgRequestsPerUserMinute}

*Limites: 10/min, 50/hora por usuário*`;

      await msg.reply(rateLimitInfo);
    }
  },

  '/testllm': {
    description: 'Testa conexão com o modelo LLM',
    handler: async (msg) => {
      await msg.reply('🔄 Testando conexão com LLM...');
      
      const result = await testLLMConnection();
      
      if (result.success) {
        await msg.reply(`✅ **LLM Conectado!**
        
• **Status:** ${result.working ? 'Funcionando' : 'Resposta inesperada'}
• **Resposta:** "${result.response}"
• **Modelo:** ${getModelInfo().model}`);
      } else {
        await msg.reply(`❌ **Erro na conexão com LLM:**

\`${result.error}\`

Verifique se o servidor está rodando em: ${getModelInfo().endpoint}`);
      }
    }
  },

  '/limparmemoria': {
    description: 'Limpa toda a memória do bot',
    handler: async (msg) => {
      await msg.reply('⚠️ **ATENÇÃO!** Isso vai apagar TODA a memória. Confirme digitando: `/confirmar limpar`');
    }
  },

  '/confirmar': {
    description: 'Confirma operações perigosas',
    handler: async (msg, chat, client, args) => {
      if (args[0] === 'limpar') {
        const result = clearMemory();
        await msg.reply(`🧹 **Memória limpa!**

• **Chats removidos:** ${result.chatCount}
• **Mensagens apagadas:** ${result.totalMessages}

Todas as conversas foram resetadas.`);
        
        logger.info('🗑️ Memória limpa por admin');
      } else {
        await msg.reply('❌ Comando de confirmação inválido');
      }
    }
  },

  '/cleanup': {
    description: 'Remove chats inativos (padrão: 30 dias)',
    handler: async (msg, chat, client, args) => {
      const days = parseInt(args[0]) || 30;
      
      if (days < 1 || days > 365) {
        await msg.reply('❌ Número de dias deve ser entre 1 e 365');
        return;
      }
      
      const result = cleanupInactiveChats(days);
      
      if (result.removedChats > 0) {
        await msg.reply(`🧹 **Limpeza concluída!**

• **Chats removidos:** ${result.removedChats}
• **Mensagens apagadas:** ${result.removedMessages}
• **Critério:** ${days} dias de inatividade`);
      } else {
        await msg.reply(`✅ Nenhum chat inativo encontrado (critério: ${days} dias)`);
      }
    }
  },

  '/resetrate': {
    description: 'Reseta rate limit de um usuário ou todos',
    handler: async (msg, chat, client, args) => {
      if (args[0] === 'all') {
        const count = rateLimiter.resetAll();
        await msg.reply(`🔄 Rate limit resetado para ${count} usuários`);
      } else if (args[0]) {
        const phone = args[0].replace(/[^0-9]/g, '');
        const success = rateLimiter.resetUser(phone);
        
        if (success) {
          await msg.reply(`🔄 Rate limit resetado para ${phone.slice(-4)}`);
        } else {
          await msg.reply(`❌ Usuário ${phone.slice(-4)} não encontrado`);
        }
      } else {
        await msg.reply('❌ Use: `/resetrate [numero]` ou `/resetrate all`');
      }
    }
  },

  '/backup': {
    description: 'Cria backup manual',
    handler: async (msg) => {
      try {
        await msg.reply('💾 Criando backup...');
        const backupId = await createBackup();
        await msg.reply(`✅ Backup criado: \`${backupId}\``);
      } catch (error) {
        await msg.reply(`❌ Erro no backup: ${error.message}`);
      }
    }
  },

  '/backups': {
    description: 'Lista backups disponíveis',
    handler: async (msg) => {
      try {
        const backups = await listBackups();
        
        if (backups.length === 0) {
          await msg.reply('📦 Nenhum backup encontrado');
          return;
        }
        
        const list = backups.slice(0, 10).map((backup, i) => 
          `${i + 1}. \`${backup.id}\` - ${backup.date} (${backup.size})`
        ).join('\n');
        
        await msg.reply(`📦 **Backups disponíveis:**\n\n${list}\n\n*Use /restore [id] para restaurar*`);
      } catch (error) {
        await msg.reply(`❌ Erro ao listar backups: ${error.message}`);
      }
    }
  },

  '/restore': {
    description: 'Restaura backup por ID',
    handler: async (msg, chat, client, args) => {
      if (!args[0]) {
        await msg.reply('❌ Use: `/restore [backup-id]`');
        return;
      }
      
      try {
        await msg.reply('🔄 Restaurando backup...');
        const result = await restoreBackup(args[0]);
        
        await msg.reply(`✅ **Backup restaurado!**

• **De:** ${result.oldStats.chatCount} → ${result.newStats.chatCount} chats
• **Mensagens:** ${result.oldStats.totalMessages} → ${result.newStats.totalMessages}`);
        
      } catch (error) {
        await msg.reply(`❌ Erro na restauração: ${error.message}`);
      }
    }
  },

  '/errors': {
    description: 'Mostra logs de erros recentes',
    handler: async (msg, chat, client, args) => {
      const limit = parseInt(args[0]) || 5;
      const recentErrors = errorLogger.getRecentErrors(limit);
      
      if (recentErrors.length === 0) {
        await msg.reply('✅ Nenhum erro recente encontrado!');
        return;
      }
      
      let errorReport = `📄 **Últimos ${recentErrors.length} Erros:**\n\n`;
      
      recentErrors.forEach((error, index) => {
        const emoji = {
          connection: '🔌',
          timeout: '⏰',
          whatsapp_auth: '📱',
          memory: '💾',
          filesystem: '📁',
          rate_limit: '🚦',
          api_error: '🌐',
          parsing: '📄',
          unknown: '❓'
        }[error.category] || '❌';
        
        const timeAgo = Math.round((Date.now() - new Date(error.timestamp)) / 1000 / 60);
        
        errorReport += `${index + 1}. ${emoji} **[${error.category.toUpperCase()}]**\n`;
        errorReport += `   • **Erro:** ${error.message.slice(0, 100)}${error.message.length > 100 ? '...' : ''}\n`;
        errorReport += `   • **Quando:** ${timeAgo} min atrás\n`;
        errorReport += `   • **Gravidade:** ${error.severity}\n`;
        
        if (error.possibleCauses.length > 0) {
          errorReport += `   • **Causa provável:** ${error.possibleCauses[0]}\n`;
        }
        
        errorReport += '\n';
      });
      
      errorReport += '*Use /errorstats para ver estatísticas gerais*';
      
      await msg.reply(errorReport);
    }
  },

  '/admins': {
    description: 'Lista os administradores do bot',
    handler: async (msg) => {
      const adminNumbers = (process.env.ADMIN_NUMBERS || '').split(',').map(n => n.trim()).filter(n => n);
      
      let adminInfo = `👥 **Administradores do Bot:**\n\n`;
      
      if (adminNumbers.length === 0) {
        adminInfo += '⚠️ Nenhum administrador configurado';
      } else {
        adminNumbers.forEach((admin, index) => {
          const maskedNumber = admin.slice(0, 4) + '****' + admin.slice(-4);
          adminInfo += `${index + 1}. ${maskedNumber}\n`;
        });
        
        adminInfo += `\n📝 **Total:** ${adminNumbers.length} administrador${adminNumbers.length > 1 ? 'es' : ''}`;
        adminInfo += `\n\n*Para adicionar mais admins, edite ADMIN_NUMBERS no .env*`;
      }
      
      await msg.reply(adminInfo);
    }
  },

  '/errorstats': {
    description: 'Estatísticas gerais de erros',
    handler: async (msg) => {
      const stats = errorLogger.getErrorStats();
      
      let statsReport = `📈 **Estatísticas de Erros**\n\n`;
      
      statsReport += `• **Total de erros:** ${stats.totalErrors}\n`;
      statsReport += `• **Erros recentes:** ${stats.recentErrorsCount}\n`;
      statsReport += `• **Erros críticos:** ${stats.criticalErrorsCount}\n\n`;
      
      if (stats.mostCommonError) {
        statsReport += `🔴 **Erro mais comum:** ${stats.mostCommonError.error} (${stats.mostCommonError.count}x)\n\n`;
      }
      
      if (Object.keys(stats.errorsByCategory).length > 0) {
        statsReport += `📉 **Por categoria:**\n`;
        Object.entries(stats.errorsByCategory).forEach(([category, count]) => {
          const emoji = {
            connection: '🔌',
            timeout: '⏰',
            whatsapp_auth: '📱',
            memory: '💾',
            filesystem: '📁',
            rate_limit: '🚦',
            api_error: '🌐',
            parsing: '📄',
            unknown: '❓'
          }[category] || '❌';
          
          statsReport += `   ${emoji} ${category}: ${count}\n`;
        });
      }
      
      statsReport += '\n*Use /errors [número] para ver erros detalhados*';
      
      await msg.reply(statsReport);
    }
  },

  '/performance': {
    description: 'Estatísticas de performance do LLM',
    handler: async (msg) => {
      const stats = performanceMonitor.getStats();
      const suggestions = performanceMonitor.getSuggestions();
      
      let perfInfo = `🚀 **Performance do LLM**

`;
      
      if (stats.totalRequests === 0) {
        perfInfo += '📋 Nenhum request processado ainda';
      } else {
        perfInfo += `• **Tempo médio:** ${stats.avgTime}s
`;
        perfInfo += `• **Tempo mínimo:** ${stats.minTime}s
`;
        perfInfo += `• **Tempo máximo:** ${stats.maxTime}s
`;
        perfInfo += `• **Total requests:** ${stats.totalRequests}
`;
        perfInfo += `• **Status:** ${stats.isSlow ? '⚠️ Lento' : '✅ Normal'}
`;
        
        if (suggestions.length > 0) {
          perfInfo += `\n💡 **Sugestões:**\n`;
          suggestions.forEach(suggestion => {
            perfInfo += `• ${suggestion}\n`;
          });
        }
      }
      
      await msg.reply(perfInfo);
    }
  },

  '/users': {
    description: 'Gerencia usuários admin',
    handler: async (msg, chat, client, args) => {
      const subCommand = args[0] || 'list';
      
      if (subCommand === 'list') {
        const users = authManager.listUsers();
        
        if (users.length === 0) {
          await msg.reply('👤 **Usuários Admin**\n\n⚠️ Nenhum usuário cadastrado\n\n*Use `/users create [usuario] [senha]` para criar*');
          return;
        }
        
        let usersList = `👤 **Usuários Admin (${users.length}):**\n\n`;
        
        users.forEach((user, index) => {
          usersList += `${index + 1}. **${user.username}**\n`;
          usersList += `   📅 Criado: ${user.createdAt}\n`;
          usersList += `   👤 Por: ${user.createdBy}\n`;
          usersList += `   🔑 Último login: ${user.lastLogin}\n\n`;
        });
        
        usersList += '*Use `/users create [usuario] [senha]` para adicionar*';
        
        await msg.reply(usersList);
        
      } else if (subCommand === 'create') {
        if (args.length < 3) {
          await msg.reply('❌ Use: `/users create [usuario] [senha]`\n\nExemplo: `/users create admin minhasenha123`');
          return;
        }
        
        const username = args[1].toLowerCase();
        const password = args[2];
        const sender = (msg.author || msg.from).replace(/[^0-9]/g, '');
        
        try {
          await authManager.createUser(username, password, sender);
          await msg.reply(`✅ **Usuário criado!**\n\n👤 **Nome:** ${username}\n🔑 **Senha:** ||${password}||\n\nO usuário pode usar `/login` para acessar comandos admin.`);
        } catch (error) {
          await msg.reply(`❌ **Erro:** ${error.message}`);
        }
        
      } else if (subCommand === 'remove') {
        if (args.length < 2) {
          await msg.reply('❌ Use: `/users remove [usuario]`');
          return;
        }
        
        const username = args[1].toLowerCase();
        
        try {
          await authManager.removeUser(username);
          await msg.reply(`✅ **Usuário removido:** ${username}\n\nTodas as sessões ativas foram encerradas.`);
        } catch (error) {
          await msg.reply(`❌ **Erro:** ${error.message}`);
        }
        
      } else {
        await msg.reply('❌ **Subcomandos disponíveis:**\n\n• `/users list` - Lista usuários\n• `/users create [usuario] [senha]` - Cria usuário\n• `/users remove [usuario]` - Remove usuário');
      }
    }
  },

  '/sessions': {
    description: 'Lista sessões ativas de login',
    handler: async (msg) => {
      const sessions = authManager.listSessions();
      const authStats = authManager.getStats();
      
      let sessionsList = `🔐 **Sessões de Login**\n\n`;
      sessionsList += `📊 **Resumo:** ${authStats.totalUsers} usuários, ${authStats.activeSessions} sessões ativas\n\n`;
      
      if (sessions.length === 0) {
        sessionsList += '⚠️ Nenhuma sessão ativa no momento';
      } else {
        sessionsList += `**Sessões ativas (${sessions.length}):**\n\n`;
        
        sessions.forEach((session, index) => {
          sessionsList += `${index + 1}. **${session.username}**\n`;
          sessionsList += `   📱 ${session.phone}\n`;
          sessionsList += `   🔑 Login: ${session.loginTime}\n`;
          sessionsList += `   ⏰ Expira em: ${session.expiresIn}\n\n`;
        });
      }
      
      sessionsList += '*Sessões expiram automaticamente em 24h*';
      
      await msg.reply(sessionsList);
    }
  },

  '/logs': {
    description: 'Últimos logs do sistema',
    handler: async (msg) => {
      const logs = `📝 **Logs do Sistema**

Para logs detalhados, use:
• \`/errors\` - Ver erros recentes
• \`/performance\` - Stats de performance
• \`/errorstats\` - Análise de erros

Logs completos estão disponíveis no Control Panel.`;

      await msg.reply(logs);
    }
  },

  '/reiniciar': {
    description: 'Reinicia o bot',
    handler: async (msg) => {
      await msg.reply('🔁 Reiniciando Ceros AI... aguarde!');
      logger.info('🔄 Reiniciando por comando admin');
      
      // Graceful shutdown
      setTimeout(() => process.exit(0), 1000);
    }
  }
};

/**
 * Comandos disponíveis para usuários
 */
const userCommands = {
  '/help': {
    description: 'Ajuda para usuários',
    handler: async (msg) => {
      const help = `🤖 **Ceros AI - Comandos**

• \`/help\` - Esta mensagem
• \`/ping\` - Testa se estou online
• \`/status\` - Meu status atual
• \`/limits\` - Seus limites de uso
• \`/login\` - Login para acesso admin temporário
• \`/logout\` - Sair da sessão admin

Você também pode simplesmente conversar comigo! 😊`;

      await msg.reply(help);
    }
  },

  '/ping': {
    description: 'Testa se o bot está respondendo',
    handler: async (msg) => {
      const responses = [
        '🏓 Pong!',
        '✅ Estou aqui!',
        '🤖 Online e operante!',
        '⚡ Rapidinho como sempre!',
        '🚀 Funcional e pronto!'
      ];
      
      const response = responses[Math.floor(Math.random() * responses.length)];
      await msg.reply(response);
    }
  },

  '/status': {
    description: 'Status básico para usuários',
    handler: async (msg) => {
      const uptime = Math.floor(process.uptime());
      const uptimeFormatted = `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`;
      
      await msg.reply(`🤖 **Status do Ceros AI**

✅ Online e funcionando
⏰ Rodando há ${uptimeFormatted}
🧠 Pronto para conversar!

Use /help para ver os comandos disponíveis.`);
    }
  },

  '/limits': {
    description: 'Mostra limites de uso do usuário',
    handler: async (msg, chat, sender) => {
      const stats = rateLimiter.getUserStats(sender);
      
      const limitsInfo = `📊 **Seus Limites de Uso**

**Por minuto:** ${stats.requestsThisMinute}/${stats.limitPerMinute}
**Por hora:** ${stats.requestsThisHour}/${stats.limitPerHour}

${stats.isLimited ? '❌ **Você está temporariamente limitado**\nAguarde alguns minutos antes de enviar mais mensagens.' : '✅ **Dentro dos limites normais**'}

*Limites existem para garantir que todos possam usar o bot de forma justa.*`;

      await msg.reply(limitsInfo);
    }
  },

  '/login': {
    description: 'Login para acesso admin temporário',
    handler: async (msg, chat, sender) => {
      // Verifica se já está logado
      if (authManager.isLoggedIn(sender)) {
        const session = authManager.getSession(sender);
        const timeLeft = Math.round((session.expiresAt - Date.now()) / 1000 / 60);
        await msg.reply(`✅ **Você já está logado!**\n\n👤 Usuário: ${session.username}\n⏰ Sessão expira em: ${Math.floor(timeLeft / 60)}h ${timeLeft % 60}m\n\nUse \`/logout\` para sair.`);
        return;
      }
      
      // Inicia processo de login
      authManager.startLogin(sender);
      await msg.reply(`🔐 **Login de Administrador**\n\n👤 Digite seu nome de usuário:\n\n*Processo expira em 5 minutos*`);
    }
  },

  '/logout': {
    description: 'Logout da sessão admin',
    handler: async (msg, chat, sender) => {
      const username = await authManager.logout(sender);
      
      if (username) {
        await msg.reply(`🚪 **Logout realizado!**\n\n👋 Até logo, ${username}!\n\nVocê não tem mais acesso aos comandos de administrador.`);
      } else {
        await msg.reply('❌ Você não estava logado como administrador.');
      }
    }
  }
};

/**
 * Handler principal de comandos
 */
export const commands = {
  async handleAdmin(command, msg, chat, client) {
    const [cmd, ...args] = command.split(' ');
    const handler = adminCommands[cmd];
    
    if (handler) {
      try {
        logger.info('🔧 Comando admin: %s por %s', cmd, (msg.author || msg.from).slice(-4));
        await handler.handler(msg, chat, client, args);
      } catch (error) {
        logger.error('Erro no comando admin %s:', cmd, error);
        await msg.reply('❌ Erro interno no comando. Verifique os logs.');
      }
    } else {
      await msg.reply(`❌ Comando \`${cmd}\` não encontrado. Use \`/help\` para ver comandos disponíveis.`);
    }
  },

  async handleUser(command, msg, chat, sender) {
    const [cmd, ...args] = command.split(' ');
    const handler = userCommands[cmd];
    
    if (handler) {
      try {
        logger.debug('👤 Comando usuário: %s por %s', cmd, sender.slice(-4));
        await handler.handler(msg, chat, sender, args);
      } catch (error) {
        logger.error('Erro no comando usuário %s:', cmd, error);
        await msg.reply('❌ Erro interno. Tente novamente em alguns segundos.');
      }
    } else {
      await msg.reply(`❌ Comando \`${cmd}\` não encontrado. Use \`/help\` para ver comandos disponíveis.`);
    }
  }
};
