# 🔒 Segurança e Dados Privados

## ⚠️ ATENÇÃO: Arquivos que NÃO devem ser enviados para repositórios públicos:

### Dados Sensíveis Locais:
- `.env` - Contém números pessoais e IPs da rede local
- `memoria.json` - Histórico de conversas privadas
- `auth.json` - Dados de usuários e senhas
- `wwebjs_auth/` - Sessão ativa do WhatsApp
- `backups/` - Backups com dados pessoais
- `logs/` - Logs podem conter informações sensíveis

## 🛡️ Arquivo .env Contém:
- **ADMIN_NUMBERS**: Seus números de telefone pessoais
- **API_ENDPOINT**: IP da sua rede local (192.168.18.3:1234)
- Configurações específicas do seu ambiente

## ✅ Para Novos Usuários:
1. Copie `.env.example` para `.env`
2. Configure com suas informações pessoais
3. NUNCA faça commit do arquivo `.env`

## 🔍 Verificação antes do Git:
```bash
# Verifique se .env está no .gitignore
cat .gitignore | grep .env

# Verifique arquivos que serão commitados
git status
```

## 📋 Sessão WhatsApp:
Sua sessão do WhatsApp fica em `wwebjs_auth/` - esse diretório contém:
- Cookies de autenticação
- Tokens de sessão
- Dados específicos da sua conta

**NUNCA** compartilhe ou faça upload desses arquivos!
