# Microserviço WhatsApp OTP

API REST para envio de códigos de verificação (OTP) via [whatsapp-web.js](https://github.com/pedroslopez/whatsapp-web.js), com sessão persistida em disco (`LocalAuth`).

## Pré-requisitos

- Node.js 18 LTS ou superior
- npm

## Instalação

```bash
cd services
npm install
```

Na primeira execução, o Puppeteer costuma baixar o Chromium automaticamente. Se isso falhar (rede, permissões ou proxy), instale o Google Chrome no sistema e defina `PUPPETEER_EXECUTABLE_PATH` no `.env` apontando para `chrome.exe` (veja `.env.example`).

## Variáveis de ambiente

Copie `.env.example` para `.env` e ajuste:

| Variável | Descrição |
|----------|-----------|
| `PORT` | Porta HTTP (padrão: `3001`) |
| `WWEBJS_DATA_PATH` | Pasta onde a sessão WhatsApp é salva (padrão: `./.wwebjs_auth`) |
| `WWEBJS_CLIENT_ID` | Identificador da sessão para `LocalAuth` (padrão: `otp-service`) |
| `WWEBJS_SHOW_BROWSER` | `1` / `true`: abre janela do Chrome ao parear (útil em dev) |
| `WWEBJS_AUTH_TIMEOUT_MS` | Timeout do inject no WhatsApp Web (padrão: `120000`) |
| `PUPPETEER_EXECUTABLE_PATH` | Opcional: caminho absoluto do Chrome/Chromium |

Para **limpar** sessão e perfil Chromium (ex.: erro de base de dados no WA Web), pare o servidor e o Chrome do Puppeteer, depois: `npm run clean:wwebjs`.

**Patch em `whatsapp-web.js`:** no `postinstall`, o `patch-package` aplica [`patches/whatsapp-web.js+1.34.6.patch`](patches/whatsapp-web.js+1.34.6.patch) (retries no inject, espera por `Conn.ref` antes do QR, etc.). Sem isso, o WhatsApp Web pode abrir mas ficar eternamente a carregar o QR. Ao atualizar a dependência `whatsapp-web.js`, regenere o patch ou remova-o e valide o pareamento.

## Executar

**Desenvolvimento (TypeScript com reload):**

```bash
npm run dev
```

**Produção:**

```bash
npm run build
npm start
```

Na primeira vez, escaneie o QR code exibido no terminal com o WhatsApp no celular. A sessão fica em `WWEBJS_DATA_PATH` e não será necessário escanear de novo enquanto os arquivos forem preservados.

## Endpoints (por instância)

- `GET /api/v1/instances` (listar instâncias do usuário)
- `POST /api/v1/instances` (criar instância)
- `POST /api/v1/instances/:instanceId/whatsapp/pairing/start`
- `GET /api/v1/instances/:instanceId/whatsapp/status`
- `GET /api/v1/instances/:instanceId/whatsapp/qr`
- `GET /api/v1/instances/:instanceId/whatsapp/conversations/:jid/messages?limit=20&beforeMessageId=<cursor>` (`:jid` pode ser só número)
- `DELETE /api/v1/instances/:instanceId/whatsapp/conversations/:jid/messages` (JWT; remove histórico de um contato + mídias)
- `GET /api/v1/instances/:instanceId/whatsapp/contacts[?filter=named|all]`
- `GET /api/v1/instances/:instanceId/whatsapp/contacts/:jid/profile-photo` (URL temporária; `:jid` = telefone ou JID)
- `GET /api/v1/instances/:instanceId/whatsapp/profile-photo` (JWT; foto da conta conectada)
- `PUT /api/v1/instances/:instanceId/whatsapp/profile-photo` (JWT + multipart `photo`)
- `POST /api/v1/instances/:instanceId/whatsapp/logout`
- `POST /api/v1/auth/instances/:instanceId/send-code`
- `GET /api/v1/instances/:instanceId/messages`
- `DELETE /api/v1/instances/:instanceId/messages` (JWT; remove todo histórico da instância + mídias)

Corpo JSON — informe **phoneNumber** ou **chatJid** (não ambos):

```json
{
  "phoneNumber": "5511999999999",
  "message": "Sua solicitação foi recebida"
}
```

```json
{
  "chatJid": "123093813043447@lid",
  "message": "Resposta para conta sem telefone exposto"
}
```

- `phoneNumber`: 10 a 15 dígitos, quando o remetente expõe telefone (`from` no evento recebido).
- `chatJid`: JID completo (`@s.whatsapp.net`, `@lid`, `@g.us`) — obrigatório quando `from` vem vazio ou para grupos.

- Respostas **400**: payload inválido, destino inválido ou sem WhatsApp.
- Respostas **503**: cliente WhatsApp não inicializado ou não conectado (aguarde o QR ou reconexão).

### Listar mensagens de uma conversa

Endpoint para listar mensagens (recebidas e enviadas) de um chat específico da instância:

- `GET /api/v1/instances/:instanceId/whatsapp/conversations/:jid/messages`
- Auth: `Authorization: Bearer <jwt ou api key otp_...>`
- `:jid` pode ser:
  - apenas número (ex.: `5511999999999`) — recomendado
  - JID completo (ex.: `5511999999999@s.whatsapp.net`)
- Query opcional:
  - `limit`: `1..100` (padrão `20`)
  - `beforeMessageId`: cursor da página anterior para paginação

Exemplo:

```bash
curl -sS \
  -H "Authorization: Bearer <token>" \
  "http://localhost:3001/api/v1/instances/<instanceId>/whatsapp/conversations/5511999999999/messages?limit=20"
```

Resposta (exemplo):

```json
{
  "items": [
    {
      "id": "3EB0C767F26B1C0A0F8C",
      "jid": "5511999999999@s.whatsapp.net",
      "fromMe": false,
      "timestamp": "2026-05-05T10:12:00.000Z",
      "text": "Olá, tudo bem?",
      "type": "conversation"
    }
  ],
  "nextCursor": "3EB0C767F26B1C0A0F8B"
}
```

Para buscar a próxima página, repita a mesma chamada incluindo `beforeMessageId=<nextCursor>`.

### Remover mensagens persistidas

Você pode limpar histórico salvo no Mongo e arquivos de mídia em disco (`.message_media`):

- `DELETE /api/v1/instances/:instanceId/whatsapp/conversations/:jid/messages`
  - Remove mensagens de um contato específico da instância.
  - `:jid` pode ser só telefone (ex.: `5511999999999`) ou JID completo (ex.: `5511999999999@s.whatsapp.net`).
  - Auth: `Authorization: Bearer <jwt>` (somente sessão do painel).
- `DELETE /api/v1/instances/:instanceId/messages`
  - Remove todo o histórico persistido da instância.
  - Auth: `Authorization: Bearer <jwt>`.

Resposta de ambos (exemplo):

```json
{
  "deletedMessages": 12,
  "deletedMediaFiles": 3,
  "mediaDeleteErrors": 0
}
```

## Aviso

O uso de automação no WhatsApp Web pode conflitar com os termos de serviço do WhatsApp. Use com responsabilidade e prefira ambientes de desenvolvimento ou homologação.
