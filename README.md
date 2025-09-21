# 🤖 CerosAI - Bot WhatsApp Inteligente com Control Panel

Um bot avançado para WhatsApp que integra com modelos de IA local, oferecendo conversas inteligentes com sistema robusto de memória, backup automático, Control Panel desktop e gerenciamento via PM2.

![Status](https://img.shields.io/badge/Status-Estável-success)
![Node](https://img.shields.io/badge/Node.js-18+-green)
![License](https://img.shields.io/badge/License-MIT-blue)
![Windows](https://img.shields.io/badge/Windows-Compatible-blue)

## 🌟 Características Principais

- 🧠 **IA Local**: Integração com LM Studio, Ollama, OpenAI
- ⚡ **Sincronização Automática**: Configurações `.env` aplicadas em tempo real
- 💾 **Memória Persistente**: Sistema robusto de armazenamento de conversas
- 🖥️ **Control Panel Desktop**: Interface gráfica completa com Electron
- 🔒 **Rate Limiting**: Proteção contra spam e uso abusivo
- 📦 **Backup Automático**: Sistema completo de backup e restauração
- 🛠️ **Comandos Admin**: Controle total via WhatsApp ou Control Panel
- 📊 **Monitoramento**: Logs detalhados, estatísticas e health checks
- 🔄 **PM2 Management**: Gerenciamento profissional de processos
- 🎛️ **Hot Reload**: Alterações de configuração sem reiniciar
- 🪟 **Windows Optimized**: Totalmente compatível com Windows

## 🚀 Instalação e Configuração

### Pré-requisitos
- Node.js 18+ 
- PM2 (`npm install -g pm2`)
- Modelo de IA local (LM Studio, Ollama, etc.)
- Windows 10/11 (recomendado)

### 1. Clone e Instale
```bash
git clone https://github.com/ynkjohn/CerosBOT-for-whatsapp.git
cd CerosBOT-for-whatsapp
npm install
```

### 2. Configuração do Control Panel
```bash
cd control-panel
npm install
```

### 3. Configuração Inicial
```bash
# Copie e configure o arquivo de ambiente
cp .env.example .env

# Configure seu número admin (OBRIGATÓRIO)
# Edite .env e coloque seu número em ADMIN_NUMBERS
```

⚠️ **IMPORTANTE**: Configure seu número admin:
```env
ADMIN_NUMBERS=5511999887766  # SEU NÚMERO (só números)
```

### 4. Inicie o Sistema

**� Método Principal (Otimizado):**
```
Clique duplo em: start-bot.bat
```

**O que acontece:**
- ✅ Para processos antigos automaticamente
- ✅ Inicia bot via PM2 (1 processo limpo)
- ✅ Abre Control Panel automaticamente
- ✅ Mostra status e comandos úteis
- ✅ Fecha janela (bot continua rodando)

**Alternativas via terminal:**
```bash
npm run start-bot          # Mesmo que o .bat
npm run pm2:start          # Só o bot
cd control-panel && npm start  # Só o Control Panel
```

> ✅ **Problema resolvido**: O `start-bot.bat` agora é otimizado e não abre múltiplas janelas CMD

## 🖥️ Control Panel - Interface Desktop

O Control Panel oferece controle completo via interface gráfica:

### 📊 **Dashboard**
- Status do bot em tempo real
- Estatísticas de uso e memória
- Conexão com LLM/IA
- Uptime e performance

### 📋 **Logs**
- Visualização de logs em tempo real
- Filtros por tipo e data
- Exportação de logs
- Limpeza automática

### 📦 **Backups**
- Lista todos os backups disponíveis
- Criação manual de backups
- Restauração com um clique
- Limpeza de backups antigos

### 👥 **Sistema de Usuários (Implementado)**
- **Gerenciamento completo** via Control Panel e API
- **Criação/remoção** de usuários autorizados
- **Autenticação segura** com senhas criptografadas
- **Controle de sessões** ativas
- **Estatísticas detalhadas** por usuário
- **Rate limiting individual** configurável
- **Logs de atividade** por usuário
- **Interface amigável** para administração

### 🔧 **Ações**
- **Reiniciar Bot**: Restart completo via PM2
- **Limpar Memória**: Reset do sistema de memória
- **Reset Rate Limit**: Limpar limites de uso
- **Testar IA**: Verificar conexão com LLM
- **Backup Manual**: Criar backup instantâneo

### 📈 **Atividades**
- Log de todas as mensagens processadas
- Histórico de interações
- Estatísticas de uso
- Monitoramento em tempo real

## ⚙️ Configuração Detalhada (.env)

```env
# ===== CONFIGURAÇÕES OBRIGATÓRIAS =====

# Configurações do LLM/IA
API_ENDPOINT=http://localhost:1234/v1/chat/completions
MODEL_NAME=llama-3.1-8b-lexi-uncensored-v2

# Administradores (IMPORTANTE!)
ADMIN_NUMBERS=seu_numero_aqui   # Exemplo: 5511999999999

# ===== CONFIGURAÇÕES OPCIONAIS =====

# Bot Behavior
GROUP_RANDOM_CHANCE=0.25        # 25% chance de responder em grupos
DUPLICATE_TIMEOUT=5000          # Timeout para mensagens duplicadas

# Memória
MAX_HISTORY_MESSAGES=50         # Máximo por conversa
MEMORY_FILE=memoria.json

# Rate Limiting
MAX_REQUESTS_PER_MINUTE=10
MAX_REQUESTS_PER_HOUR=50

# Backup
MAX_BACKUPS=10
BACKUP_DIR=./backups

# LLM Settings
MAX_TOKENS=800
TEMPERATURE=0.75
REQUEST_TIMEOUT=30000
MAX_RETRIES=3

# API Control Panel
PORT=3001                   # Porta da API
```

## ⚡ Sincronização Automática (.env)

### 🔄 **Como Funciona**
O CerosAI agora monitora o arquivo `.env` em tempo real e aplica mudanças automaticamente:

1. **Edite qualquer configuração** no arquivo `.env`
2. **Salve o arquivo** - o bot detecta a mudança automaticamente  
3. **Configurações são aplicadas** sem reiniciar o bot
4. **Logs confirmam** a atualização no terminal

### ⚙️ **Configurações Sincronizadas**
- `MODEL_NAME` - Troca de modelo instantânea
- `API_ENDPOINT` - Novo servidor LLM  
- `MAX_TOKENS` - Limite de tokens
- `TEMPERATURE` - Criatividade da IA
- `TOP_P` - Parâmetro de sampling
- `REQUEST_TIMEOUT` - Timeout de requisições
- `MAX_RETRIES` - Tentativas de retry

### 📝 **Exemplo Prático**
```bash
# 1. Altere no .env
MODEL_NAME=nova-llama-3.1-70b

# 2. Salve o arquivo (Ctrl+S)

# 3. Veja no terminal:
[INFO] 🔄 Configurações do LLM atualizadas automaticamente  
[INFO] 📝 Novo modelo: nova-llama-3.1-70b
[INFO] 🌐 Endpoint: http://192.168.1.100:1234
```

**💡 Vantagem**: Teste diferentes modelos e configurações sem interromper conversas!

## 🧠 Sistema Multi-LLM (Implementado)

### 🎯 **Suporte Completo a Múltiplos Modelos**
O CerosAI já possui suporte completo para múltiplos modelos de IA, permitindo troca dinâmica sem interrupção:

#### ⚡ **Troca Dinâmica de Modelos**
- **Configuração em tempo real** via arquivo `.env`
- **Sem reinicialização** do bot necessária
- **Failover automático** entre servidores
- **Configurações específicas** por modelo

#### 🔧 **Como Usar**
```env
# Servidor Principal
API_ENDPOINT=http://192.168.1.100:1234/v1/chat/completions
MODEL_NAME=llama-3.1-70b-instruct

# Troque o modelo instantaneamente:
MODEL_NAME=phi-3.5-mini-instruct

# Ou mude o servidor:
API_ENDPOINT=http://localhost:11434/v1/chat/completions
MODEL_NAME=qwen2.5:14b
```

#### 📊 **Modelos Testados e Compatíveis**
- **LM Studio**: Llama 3.1, Phi-3, Qwen, Gemma
- **Ollama**: Todos os modelos com endpoint OpenAI
- **OpenAI API**: GPT-3.5, GPT-4, GPT-4o
- **LocalAI**: Modelos locais customizados
- **Text Generation WebUI**: Com modo OpenAI

#### 🎛️ **Configurações Avançadas por Modelo**
```env
# Configuração específica para cada modelo
MAX_TOKENS=2048          # Llama modelos maiores
TEMPERATURE=0.7          # Criatividade
TOP_P=0.9               # Sampling
REQUEST_TIMEOUT=45000    # Timeout para modelos lentos
```

#### 🔄 **Monitoramento e Teste**
- **Via WhatsApp**: `/testllm` verifica conexão atual
- **Via Control Panel**: Botão "Testar IA" na interface
- **Logs automáticos**: Confirmação de troca de modelo
- **Health check**: Script automático de verificação

## � API REST Avançada (Implementada)

### 🎯 **Endpoints Completos**
O CerosAI possui uma API REST robusta com endpoints para controle total:

#### 📊 **Status e Monitoramento**
- `GET /api/status` - Status geral do sistema
- `GET /api/stats` - Estatísticas detalhadas
- `GET /api/logs` - Logs recentes com filtros

#### ⚙️ **Configurações**
- `GET /api/config` - Obter configurações atuais
- `POST /api/config` - Salvar configurações
- `POST /api/test-llm` - Testar conexão LLM

#### 💾 **Backup e Restauração**
- `GET /api/backups` - Listar backups disponíveis
- `POST /api/backups` - Criar backup manual
- `POST /api/backups/restore/:id` - Restaurar backup
- `DELETE /api/backups/:filename` - Deletar backup

#### 👥 **Gerenciamento de Usuários**
- `GET /api/users` - Listar usuários
- `POST /api/users` - Criar usuário
- `DELETE /api/users/:username` - Remover usuário

#### 🎛️ **Ações do Sistema**
- `POST /api/actions` - Executar ações (cleanup, reset rate limit, etc.)
- Suporte a múltiplas ações via parâmetro `action`

### 🔒 **Recursos da API**
- **CORS habilitado** para acesso do Control Panel
- **Validação de entrada** em todos os endpoints
- **Tratamento de erros** padronizado
- **Logs estruturados** de todas as requisições
- **Respostas JSON** consistentes

## �🎮 Comandos do Bot

### 👤 **Comandos de Usuário**
| Comando | Descrição |
|---------|-----------|
| `/help` | Lista de comandos disponíveis |
| `/ping` | Teste de conexão |  
| `/status` | Status do bot |
| `/limits` | Seus limites de uso |

### 🔧 **Comandos de Admin**

#### Informações
- `/status` - Status geral do sistema
- `/stats` - Estatísticas detalhadas  
- `/memory` - Informações da memória
- `/ratelimit` - Stats de rate limiting
- `/testllm` - Testa conexão com IA

#### Manutenção
- `/limparmemoria` - Limpa toda a memória
- `/cleanup [dias]` - Remove chats inativos
- `/resetrate [numero]` - Reseta rate limit
- `/backup` - Cria backup manual
- `/backups` - Lista backups disponíveis
- `/restore [id]` - Restaura backup

#### Sistema
- `/reiniciar` - Reinicia o bot via PM2

## 🔧 Scripts Disponíveis

### 🚀 Controle Principal
```bash
# Arquivos .bat (duplo clique)
start-bot.bat             # Iniciar sistema (OTIMIZADO)
stop-system.bat           # Parar sistema

# Via NPM  
npm run start-bot         # Mesmo que start-bot.bat
npm run stop-bot          # Parar sistema
```

### PM2 (Produção)
```bash
npm run pm2:start         # Inicia com PM2
npm run pm2:stop          # Para o bot
npm run pm2:restart       # Reinicia o bot
npm run pm2:logs          # Visualiza logs
npm run pm2:monit         # Monitor PM2
```

### Desenvolvimento
```bash
npm start                 # Inicia em modo normal
npm run dev              # Modo desenvolvimento (watch)
```

### Utilitários
```bash
npm run setup            # Configuração inicial
npm run health           # Teste de saúde completo
npm run backup           # Gerenciar backups
npm run cleanup          # Limpeza de arquivos
npm run analyze-errors   # Análise de erros
```

## ⚡ **start-bot.bat Otimizado**

**Problema resolvido**: Múltiplos terminais CMD  
**Solução**: `start-bot.bat` agora é limpo e otimizado

### Antes vs Agora:
| Antes | Agora |
|-------|-------|
| 3+ janelas CMD abertas | 1 janela (fecha automaticamente) |
| Múltiplos processos node.js | 1 processo PM2 |
| Difícil gerenciar | Interface limpa |
| Processos órfãos | Controle total |

**Uso:** Simplesmente clique duplo em `start-bot.bat` ✅

## 🏗️ Estrutura do Projeto

```
CerosAI/
├── src/
│   ├── bot.js                    # Arquivo principal do bot
│   ├── api/
│   │   └── server.js            # Servidor da API Control Panel
│   └── lib/
│       ├── memory.js            # Sistema de memória (reformulado)
│       ├── llm.js               # Integração com IA
│       ├── commands.js          # Comandos do bot
│       ├── rateLimit.js         # Controle de rate limiting
│       ├── backup.js            # Sistema de backup
│       ├── auth.js              # Sistema de autenticação
│       ├── logger.js            # Sistema de logs
│       ├── performance.js       # Monitor de performance
│       ├── errorHandler.js      # Tratamento de erros
│       └── activityLogger.js    # Log de atividades
├── control-panel/
│   ├── src/
│   │   ├── main.js              # Electron main process
│   │   ├── app.js               # Interface do Control Panel
│   │   └── index.html           # Interface HTML
│   └── package.json             # Dependências do Control Panel
├── scripts/
│   ├── setup.js                 # Configuração inicial
│   ├── health.js                # Health check completo
│   ├── backup.js                # Gerenciador de backups
│   ├── cleanup.js               # Limpeza automática
│   ├── analyze-errors.js        # Análise de erros
│   └── optimize.js              # Otimizações
├── backups/                     # Backups automáticos
├── logs/                        # Logs do sistema
├── wwebjs_auth/                 # Sessão do WhatsApp
├── ecosystem.config.cjs         # Configuração PM2
├── .env                         # Configurações principais
├── memoria.json                 # Memória das conversas
└── README.md                    # Esta documentação
```

## 🔍 Monitoramento e Logs

### Health Check Automático
```bash
npm run health
```
**Verifica:**
- ✅ Conexão com LLM
- ✅ Sistema de memória
- ✅ Sistema de backup
- ✅ Configurações do .env
- ✅ Dependências instaladas

### Logs Detalhados
- **PM2 Logs**: `npm run pm2:logs`
- **Error Logs**: `logs/errors/`
- **Activity Logs**: `logs/activity.json`
- **Control Panel**: Interface gráfica de logs

### Estatísticas em Tempo Real
- **Via WhatsApp**: `/stats` (admin)
- **Via Control Panel**: Dashboard completo
- **Via API**: `http://localhost:3001/api/status`

## 🛡️ Segurança e Backup

### Controle de Acesso
- Apenas números em `ADMIN_NUMBERS` podem usar comandos admin
- Rate limiting automático por usuário
- Sessão do WhatsApp protegida

### Sistema de Backup
- **Automático**: A cada 6 horas
- **Manual**: Via comando ou Control Panel
- **Antes de operações destrutivas**
- **Limpeza automática** de backups antigos

### Rate Limiting Inteligente
- Limites por minuto e por hora
- Reset automático
- Bypass para admins
- Logs de tentativas bloqueadas

## 🚨 Solução de Problemas

### Bot não conecta ao WhatsApp
```bash
# 1. Verificar health
npm run health

# 2. Limpar sessão
rm -rf wwebjs_auth/

# 3. Reiniciar
npm run pm2:restart
```

### IA não responde
```bash
# 1. Testar conexão LLM
curl http://localhost:1234/v1/chat/completions

# 2. Verificar no Control Panel
# Ações > Testar IA

# 3. Verificar configurações
grep API_ENDPOINT .env
```

### Control Panel não abre
```bash
# 1. Verificar se API está rodando
curl http://localhost:3001/api/status

# 2. Reinstalar dependências
cd control-panel && npm install

# 3. Verificar porta
netstat -an | grep 3001
```

### Memória corrompida
```bash
# 1. Backup atual
npm run backup

# 2. Reset memória
rm memoria.json
echo '{}' > memoria.json

# 3. Reiniciar
npm run pm2:restart
```

### Problemas com PM2
```bash
# 1. Status do PM2
pm2 status

# 2. Reiniciar daemon
pm2 kill && pm2 resurrect

# 3. Logs detalhados
pm2 logs cerosai-bot
```

## 🔄 Histórico de Versões

### 🎉 **v1.0 - Versão Estável Completa** (Atual)

#### ✨ **Sistema Completo Implementado**
- **🔄 Sincronização Automática**: Monitoramento do arquivo `.env` em tempo real
- **⚡ Configuração Dinâmica**: Suporte multi-LLM com troca automática de modelos
- **🖥️ Control Panel Desktop**: Interface gráfica completa com Electron
- **📊 API REST Avançada**: Endpoints completos para gerenciamento total
- **👥 Sistema de Usuários**: Gerenciamento completo de usuários e permissões
- **💾 Backup Automático**: Sistema robusto de backup e restauração
- **🛡️ Rate Limiting**: Proteção inteligente contra spam
- **� Logs Estruturados**: Sistema completo de logging e monitoramento
- **🔧 PM2 Integration**: Gerenciamento profissional de processos
- **🖥️ Windows Optimization**: Compatibilidade total com Windows

#### 🛠️ **Funcionalidades Técnicas**
- Sistema `fs.watchFile()` para monitoramento contínuo do .env
- Configuração dinâmica de LLM sem reinicialização
- Control Panel com dashboard completo e estatísticas em tempo real
- API REST com endpoints para backup, usuários, configurações e monitoramento
- Sistema de health check automático
- Validação automática de configurações

#### 📋 **Multi-LLM Implementado**
- Troca dinâmica entre modelos via configuração
- Suporte para múltiplos endpoints simultaneamente
- Configurações específicas por modelo
- Failover automático entre servidores

---

### 📚 **Versões Anteriores (Histórico)**

### **v0.2 - Melhorias e Otimizações** (20/09/2025)

#### ✅ **Correções Importantes**
- **🔧 Botão Reiniciar**: Funcionalidade via PM2
- **🖥️ Control Panel**: Correções de interface
- **📋 Logs**: Melhorias na exibição
- **📈 Atividades**: Implementação do monitoramento
- **🪟 Windows**: Compatibilidade aprimorada
- **💾 Sistema de Memória**: Reformulação inicial

#### 🆕 **Funcionalidades Básicas**
- **🔄 PM2 Integration**: Integração inicial
- **🖥️ Desktop Control Panel**: Desenvolvimento da interface
- **📊 Basic Monitoring**: Estatísticas básicas
- **🔍 Health Check**: Verificações iniciais

### **v0.1 - Rebrand para CerosAI** (18/09/2025)
- 🆕 **BREAKING**: Renomeação de "Fernando AI" para "CerosAI"
- 📄 Licença MIT adicionada
- 🔄 Identidade visual renovada
- 📚 Documentação inicial

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está licenciado sob a **Licença MIT**. Veja o arquivo [LICENSE](LICENSE) para detalhes.

**O que isso significa:**
- ✅ **Uso livre**: Para qualquer propósito
- ✅ **Modificações**: Altere como quiser
- ✅ **Distribuição**: Compartilhe à vontade
- ✅ **Uso comercial**: Permitido
- ⚠️ **Sem garantias**: Use por sua conta e risco

## 🎯 Roadmap

### ✅ **Funcionalidades Implementadas**
- [x] **Sincronização Automática do .env**: Configurações atualizadas em tempo real
- [x] **Suporte Multi-LLM**: Troca dinâmica entre diferentes modelos via configuração
- [x] **Control Panel Desktop**: Interface gráfica completa com Electron
- [x] **PM2 Integration**: Gerenciamento profissional de processos
- [x] **API REST Avançada**: Endpoints completos para gerenciamento total
- [x] **Sistema de Backup**: Backup automático e manual completo
- [x] **Rate Limiting**: Proteção inteligente contra spam
- [x] **Sistema de Memória**: Armazenamento persistente de conversas
- [x] **Health Monitoring**: Verificações automáticas do sistema
- [x] **Windows Optimization**: Compatibilidade total com Windows
- [x] **Sistema de Usuários**: Gerenciamento completo de usuários e permissões
- [x] **Logs Estruturados**: Sistema completo de logging e monitoramento
- [x] **Dashboard Analytics**: Métricas em tempo real e estatísticas detalhadas
- [x] **Configuração Dinâmica**: Recarregamento automático de configurações

### 🔮 **Próximas Versões (v1.1+)**
- [ ] **Interface Web**: Dashboard web responsivo para acesso remoto  
- [ ] **Sistema de Plugins**: Arquitetura extensível para funcionalidades
- [ ] **Integração Discord**: Expansão para outras plataformas
- [ ] **Containerização**: Suporte completo a Docker
- [ ] **Auto-Update**: Sistema de atualizações automáticas
- [ ] **Multi-Admin**: Suporte a múltiplos níveis de administração
- [ ] **Scheduler**: Tarefas programadas e automações
- [ ] **Database Support**: Integração com PostgreSQL/MySQL
- [ ] **Cluster Support**: Suporte a múltiplas instâncias
- [ ] **WebHooks**: Sistema de notificações externas

## 📞 Suporte

- 📧 **Issues**: [GitHub Issues](https://github.com/ynkjohn/CerosBOT-for-whatsapp/issues)
- 💬 **Discussões**: [GitHub Discussions](https://github.com/ynkjohn/CerosBOT-for-whatsapp/discussions)
- 📚 **Wiki**: [Documentação Detalhada](https://github.com/ynkjohn/CerosBOT-for-whatsapp/wiki)
- 📋 **Changelog**: [CHANGELOG.md](CHANGELOG.md) - Histórico detalhado de mudanças

---

<div align="center">

**CerosAI** - Tornando conversas mais inteligentes! 🤖✨

[![GitHub stars](https://img.shields.io/github/stars/ynkjohn/CerosBOT-for-whatsapp?style=social)](https://github.com/ynkjohn/CerosBOT-for-whatsapp/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/ynkjohn/CerosBOT-for-whatsapp?style=social)](https://github.com/ynkjohn/CerosBOT-for-whatsapp/network/members)

</div>
