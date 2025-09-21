# 🔐 Sistema de Autenticação - Ceros AI

Sistema completo de login por usuário/senha para acesso admin temporário via WhatsApp.

## 🎯 Como Funciona

### Para Usuários
1. **Login**: Digite `/login` no WhatsApp
2. **Usuário**: Bot pede o nome de usuário
3. **Senha**: Bot pede a senha (processo seguro)
4. **Acesso**: Ganha acesso aos comandos admin por 24h

### Para Administradores
- **Criar usuários**: `/users create [usuario] [senha]`
- **Listar usuários**: `/users list`
- **Remover usuários**: `/users remove [usuario]`
- **Ver sessões**: `/sessions`

## 📱 Comandos do Sistema

### 👤 Comandos de Usuário
```
/login      - Iniciar processo de login admin
/logout     - Sair da sessão admin
```

### 🔧 Comandos de Admin
```
/users list                    - Lista todos os usuários
/users create [usuario] [senha] - Cria novo usuário admin  
/users remove [usuario]        - Remove usuário
/sessions                      - Lista sessões ativas
/admins                        - Lista admins permanentes
```

## 🚀 Exemplo de Uso Completo

### 1. Admin Permanente Cria Usuário
```
Admin: /users create joao minhasenha123

Bot: ✅ Usuário criado!
👤 Nome: joao
🔑 Senha: ||minhasenha123||
O usuário pode usar /login para acessar comandos admin.
```

### 2. Usuário Faz Login
```
Usuário: /login

Bot: 🔐 Login de Administrador
👤 Digite seu nome de usuário:
*Processo expira em 5 minutos*

Usuário: joao

Bot: 🔑 Agora digite a senha:

Usuário: minhasenha123

Bot: ✅ Login realizado com sucesso!
👤 Usuário: joao  
⏰ Sessão válida por: 24h
Você agora tem acesso aos comandos de administrador.
```

### 3. Usuário Usa Comandos Admin
```
Usuário: /status
Bot: [responde com status admin - funcionando!]

Usuário: /memory  
Bot: [mostra informações da memória - funcionando!]
```

### 4. Ver Sessões Ativas
```
Admin: /sessions

Bot: 🔐 Sessões de Login
📊 Resumo: 2 usuários, 1 sessões ativas

Sessões ativas (1):
1. joao
   📱 5514****3583
   🔑 Login: 17/09/2025 às 22:30
   ⏰ Expira em: 23h 45m

*Sessões expiram automaticamente em 24h*
```

## 🔒 Segurança

### ✅ Recursos de Segurança
- **Senhas hasheadas**: Nunca armazenadas em texto puro
- **Sessões temporárias**: Expiram em 24h automaticamente
- **Timeout de login**: Processo expira em 5 minutos
- **Logs de acesso**: Todos os logins são registrados
- **Limpeza automática**: Sessões expiradas são removidas

### 🛡️ Tipos de Admin
1. **Admin Permanente**: Via ADMIN_NUMBERS no .env (sempre admin)
2. **Admin Logado**: Via sistema de login (temporário, 24h)

## ⚙️ Configurações

### Arquivo .env
```env
# Sistema de autenticação
AUTH_FILE=auth.json                 # Arquivo dos usuários
SESSION_DURATION=86400000           # 24h em millisegundos

# Admins permanentes (não precisam fazer login)
ADMIN_NUMBERS=seu_numero_aqui,outro_numero_admin
```

### Duração da Sessão
- **Padrão**: 24 horas
- **Configurável**: Edite SESSION_DURATION no .env
- **Exemplos**:
  - 1 hora: `3600000`
  - 8 horas: `28800000`
  - 24 horas: `86400000`

## 📁 Arquivos do Sistema

```
cerosAI/
├── auth.json              # Usuários e sessões (criado automaticamente)
├── src/lib/auth.js        # Sistema de autenticação
└── .env                   # Configurações
```

## 🔧 Gerenciamento

### Comandos Úteis para Admins

**Ver status do sistema:**
```
/sessions          # Sessões ativas
/users list        # Todos os usuários
/admins           # Admins permanentes
```

**Gerenciar usuários:**
```
/users create marketing senha123    # Criar usuário
/users create suporte abc456        # Criar outro usuário  
/users remove marketing             # Remover usuário
```

**Emergência - remover todos:**
Se precisar limpar tudo, delete o arquivo `auth.json` e reinicie o bot.

## 💡 Casos de Uso

### 🏢 Empresa
- **Admin permanente**: Dono da empresa
- **Usuários temporários**: Funcionários específicos
- **Sessões 8h**: Apenas durante expediente

### 👥 Grupo de Amigos  
- **Admin permanente**: Criador do grupo
- **Usuários temporários**: Amigos de confiança
- **Sessões 24h**: Para uso ocasional

### 🔄 Rotatividade
- **Admin permanente**: Sempre tem acesso
- **Usuários rotativos**: Cria/remove conforme necessário
- **Sessões temporárias**: Acesso controlado por tempo

## 🚨 Solução de Problemas

### Login não funciona
1. Verifique se o usuário existe: `/users list`
2. Confirme se a senha está correta
3. Tente cancelar e iniciar novo login

### Usuário não consegue usar comandos admin
1. Verifique se está logado: ele deve conseguir usar `/logout`
2. Veja sessões ativas: `/sessions`
3. Sessão pode ter expirado (24h)

### Perda de dados
- Usuários ficam salvos em `auth.json`
- Backup automático incluí dados de auth
- Restaurar backup restaura os usuários

## ✨ Vantagens do Sistema

1. **Flexível**: Admins permanentes + temporários
2. **Seguro**: Senhas hasheadas, sessões temporárias
3. **Prático**: Tudo via WhatsApp, sem apps externos
4. **Automático**: Limpeza e expiração automáticas
5. **Controlado**: Admins podem gerenciar facilmente

---

O sistema está pronto para uso! Basta reiniciar o bot e começar a criar usuários com `/users create`.
