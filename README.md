# Bot WhatsApp - IPUBI OS

## Configuração

1. **Instalar dependências:**
```bash
npm install
```

2. **Iniciar o bot:**
```bash
node webbot.js
```

3. **Escanear QR Code:**
- Acesse http://localhost:3002 no navegador
- Escaneie o QR Code com seu WhatsApp

## Funcionalidades

### Endpoints HTTP

- **POST /send** - Enviar mensagem
  ```json
  {
    "numero": "558792535877",
    "mensagem": "Sua nova senha é: 12345678"
  }
  ```

- **GET /status** - Verificar status do bot
  ```json
  {
    "conectado": true,
    "status": "Conectado"
  }
  ```

### WebSocket (Porta 3001)

- Recebe atualizações em tempo real do status do bot
- QR Code para conexão
- Status de conexão

## Integração com Sistema de Recuperação

O bot está integrado com o sistema de recuperação de senha do IPUBI OS:

1. Usuário solicita recuperação de senha
2. Sistema busca por similaridade de contato
3. Gera nova senha temporária
4. Envia mensagem via WhatsApp automaticamente
5. Usuário recebe a senha no celular

## Logs

O bot registra todas as mensagens enviadas no console para auditoria. 