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
- `PUT /api/v1/instances/:instanceId/whatsapp/profile-photo` (JWT + multipart `photo`)
- `POST /api/v1/instances/:instanceId/whatsapp/logout`
- `POST /api/v1/auth/instances/:instanceId/send-code`
- `GET /api/v1/instances/:instanceId/messages`

Corpo JSON:

```json
{
  "phoneNumber": "5511999999999",
  "message": "Sua solicitação foi recebida"
}
```

- Respostas **400**: payload inválido ou número sem WhatsApp.
- Respostas **503**: cliente WhatsApp não inicializado ou não conectado (aguarde o QR ou reconexão).

## Aviso

O uso de automação no WhatsApp Web pode conflitar com os termos de serviço do WhatsApp. Use com responsabilidade e prefira ambientes de desenvolvimento ou homologação.
