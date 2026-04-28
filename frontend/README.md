# WhatsApp OTP — Frontend (React)

Aplicação web para operar o serviço de OTP via WhatsApp com autenticação JWT, dashboard protegido e utilitários de operação (pareamento, envio de código, histórico e documentação da API).

## Requisitos

- Node.js 18+
- Backend do WhatsApp OTP rodando

## Instalação

```bash
cd services/whatsapp/frontend
npm install
```

## Execução

### Desenvolvimento

```bash
npm run dev
```

Abre em `http://localhost:5173`.

### Produção local (preview)

```bash
npm run build
npm run preview
```

Também disponível por `npm run start` e `npm run start:prod`.

### Docker (produção)

```bash
docker compose up -d --build
```

Abre em `http://localhost:4173`.

Comandos úteis:

```bash
docker compose ps
docker compose logs -f web
docker compose down
```

Notas:

- Ajuste `VITE_API_BASE_URL` e outras variáveis no `.env.production` antes do `docker compose up --build`.
- O container final serve apenas arquivos estáticos via Nginx (modo produção), sem `vite preview`.

## Configuração da API

- Em dev, com `Base URL` vazia, o Vite proxy redireciona `/health` e `/api` para `http://localhost:3001`.
- Se informar `Base URL` na interface, ela sobrescreve o proxy.
- A base é persistida no `localStorage` (`whatsapp_otp_api_base`).
- `VITE_API_BASE_URL` define a base inicial no build.
- Em build de produção sem `VITE_API_BASE_URL`, o front usa fallback para `https://whatsapp-service-gvyv.onrender.com`.

## Rotas da aplicação

- `/login`: autenticação de usuário
- `/register`: cadastro de usuário
- `/`: dashboard protegido (status, pareamento, QR e envio de OTP)
- `/history`: histórico de mensagens enviadas
- `/docs`: documentação interativa dos endpoints

## Funcionalidades implementadas

- Login e registro com armazenamento de token JWT
- Proteção de rotas autenticadas
- Health check da API (`GET /health`)
- Status do WhatsApp e fluxo de pareamento (`/api/v1/whatsapp/status`, `/pairing/start`, `/qr`)
- Envio de OTP (`POST /api/v1/auth/send-code`)
- Histórico paginado de mensagens (`GET /api/v1/messages`)
- Gestão de chaves de API (criar/listar/revogar)
- Página de API Docs com exemplos de requisição/resposta

## Estrutura resumida

```
frontend/
  src/
    App.tsx
    context/
      AuthContext.tsx
    components/
      ProtectedRoute.tsx
      dashboard/
        DashboardLayout.tsx
        DashboardHome.tsx
        ApiKeysPanel.tsx
    pages/
      LoginPage.tsx
      RegisterPage.tsx
      HistoryPage.tsx
      ApiDocsPage.tsx
    lib/
      api.ts
      authStorage.ts
      config.ts
      validation.ts
  vite.config.ts
```

## Documentacao adicional

- Guia de integracao da API: `../INTEGRACAO.md`
