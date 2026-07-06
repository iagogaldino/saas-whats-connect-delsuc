import type { ReactNode } from 'react';
import { Icon } from '../components/dashboard/Icon';
import { getApiBaseDisplay } from '../lib/config';

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="border-white/5 overflow-x-auto rounded-lg border bg-[#1a1c1e] p-4 font-mono text-[11px] leading-relaxed text-emerald-200/90">
      {children}
    </pre>
  );
}

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="text-on-surface mb-4 flex items-center gap-2 text-lg font-bold tracking-tight">
        <Icon name="article" className="text-primary text-xl" />
        {title}
      </h2>
      <div className="space-y-4 text-sm leading-relaxed text-slate-700">{children}</div>
    </section>
  );
}

export function ApiDocsPage() {
  const base = getApiBaseDisplay();

  return (
    <div className="min-h-screen bg-surface">
      <header className="border-b border-outline-variant/20 bg-surface-container-lowest/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-4">
          <h1 className="text-on-surface text-lg font-bold tracking-tight">API Docs</h1>
          <div className="flex items-center">
            <a
              href="/"
              className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-on-primary transition-opacity hover:opacity-90"
            >
              Inicio
            </a>
          </div>
        </div>
      </header>

      <div className="mx-auto mt-8 max-w-3xl space-y-10 pb-12">
        <div className="border-b border-outline-variant/10 pb-6">
          <h2 className="text-on-surface text-2xl font-bold tracking-tight">Documentação da API</h2>
          <p className="text-outline mt-2 text-sm">
            Referência oficial da plataforma de mensagens WhatsApp com múltiplas instâncias por usuário.
          </p>
          <p className="text-outline mt-2 text-sm">
            Fluxo recomendado: criar/listar instâncias, conectar com QR, enviar mensagens e consumir eventos em tempo real.
          </p>
          <p className="text-outline mt-2 text-sm">
            <strong className="text-on-surface font-semibold">Pareamento por QR (REST):</strong> integrações podem listar ou
            criar instâncias, iniciar o pareamento e obter o QR via HTTP (Bearer com JWT ou chave <code className="font-mono text-xs">otp_…</code>) —{' '}
            <a href="#pairing-qr" className="text-primary font-medium underline-offset-2 hover:underline">
              ver secção dedicada
            </a>
            .
          </p>
          <nav className="border-outline-variant/15 bg-surface-container-low/50 mt-6 rounded-xl border p-4" aria-label="Índice">
            <p className="text-on-surface mb-2 text-xs font-bold uppercase tracking-widest">Nesta página</p>
            <ul className="list-inside list-disc space-y-1.5 text-sm text-slate-600">
              <li>
                <a href="#auth-jwt" className="text-primary hover:underline">
                  Autenticação (JWT)
                </a>
              </li>
              <li>
                <a href="#api-tokens" className="text-primary hover:underline">
                  Tokens de API
                </a>
              </li>
              <li>
                <a href="#instances" className="text-primary hover:underline">
                  Instâncias e conexão
                </a>
              </li>
              <li>
                <a href="#pairing-qr" className="text-primary font-medium hover:underline">
                  Pareamento por QR (REST)
                </a>
              </li>
              <li>
                <a href="#contacts" className="text-primary hover:underline">
                  Contatos da agenda (REST)
                </a>
              </li>
              <li>
                <a href="#profile-photos" className="text-primary hover:underline">
                  Fotos de perfil (REST)
                </a>
              </li>
              <li>
                <a href="#conversation-messages" className="text-primary hover:underline">
                  Mensagens por conversa (REST)
                </a>
              </li>
              <li>
                <a href="#message-media" className="text-primary hover:underline">
                  Download de mídia (REST)
                </a>
              </li>
              <li>
                <a href="#send-code" className="text-primary hover:underline">
                  Envio de mensagem
                </a>
              </li>
              <li>
                <a href="#send-media" className="text-primary hover:underline">
                  Envio de arquivo
                </a>
              </li>
              <li>
                <a href="#incoming-payload" className="text-primary hover:underline">
                  Payload: mensagem recebida
                </a>
              </li>
              <li>
                <a href="#webhook-incoming" className="text-primary hover:underline">
                  Webhook (mensagens recebidas)
                </a>
              </li>
              <li>
                <a href="#socket" className="text-primary hover:underline">
                  Socket.IO em tempo real
                </a>
              </li>
            </ul>
          </nav>
        </div>

        <Section id="auth-jwt" title="Autenticação (JWT)">
          <p>
            Para obter o <strong>JWT de sessão</strong>, use os endpoints de autenticação em{' '}
            <code className="font-mono text-xs">/api/v1/auth</code>. O token retornado no campo{' '}
            <code className="font-mono text-xs">token</code> deve ser enviado como{' '}
            <code className="font-mono text-xs">Authorization: Bearer &lt;jwt&gt;</code>.
          </p>
          <CodeBlock>{`# Login (obter JWT de sessão)
POST ${base}/api/v1/auth/login
Content-Type: application/json

{
  "email": "usuario@exemplo.com",
  "password": "Senha@123456"
}

# Resposta 200:
# {
#   "user": {
#     "id": "<userId>",
#     "email": "usuario@exemplo.com"
#   },
#   "token": "<jwt-de-sessao>"
# }`}</CodeBlock>
          <CodeBlock>{`# Registro (também retorna JWT de sessão)
POST ${base}/api/v1/auth/register
Content-Type: application/json

{
  "email": "novo@exemplo.com",
  "password": "Senha@123456"
}

# Resposta 201:
# {
#   "user": {
#     "id": "<userId>",
#     "email": "novo@exemplo.com"
#   },
#   "token": "<jwt-de-sessao>"
# }`}</CodeBlock>
        </Section>

        <Section id="api-tokens" title="Tokens de API">
          <p>
            Use <strong>JWT de sessão</strong> para administrar os seus tokens e, depois, use o token gerado (
            <code className="font-mono text-xs">otp_...</code>) como Bearer nas demais rotas da API.
          </p>
          <p>
            Endpoints de gerenciamento de token (somente usuário autenticado):{' '}
            <code className="font-mono text-xs">POST /api/v1/tokens</code>,{' '}
            <code className="font-mono text-xs">GET /api/v1/tokens</code> e{' '}
            <code className="font-mono text-xs">DELETE /api/v1/tokens/:id</code>.
          </p>
          <CodeBlock>{`# 1) Criar token (JWT obrigatório)
POST ${base}/api/v1/tokens
Authorization: Bearer <jwt-sessao>
Content-Type: application/json

{
  "name": "Integracao CRM"
}

# Resposta 201:
# {
#   "id": "<tokenId>",
#   "name": "Integracao CRM",
#   "key": "otp_xxxxxxxxxxxx_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
#   "createdAt": "2026-04-30T12:00:00.000Z"
# }

# 2) Listar tokens do usuário (JWT obrigatório)
GET ${base}/api/v1/tokens
Authorization: Bearer <jwt-sessao>

# Resposta 200:
# {
#   "items": [
#     {
#       "id": "<tokenId>",
#       "name": "Integracao CRM",
#       "keyPrefix": "a1b2c3d4e5f6",
#       "maskedPreview": "otp_a1b2c3d4e5f6...",
#       "createdAt": "2026-04-30T12:00:00.000Z",
#       "lastUsedAt": null
#     }
#   ]
# }

# 3) Revogar token (JWT obrigatório)
DELETE ${base}/api/v1/tokens/<tokenId>
Authorization: Bearer <jwt-sessao>
# Resposta 204 (sem corpo)

# 4) Usar o token gerado nas outras rotas
GET ${base}/api/v1/instances
Authorization: Bearer <otp_...>`}</CodeBlock>
          <p className="text-outline text-xs">
            Atenção: o valor completo do token (<code className="font-mono text-xs">key</code>) é retornado apenas na criação.
            Guarde esse valor em local seguro.
          </p>
        </Section>

        <Section id="instances" title="Instâncias e conexão">
          <p>
            A chave de API é global da conta. O escopo da operação é definido por{' '}
            <code className="font-mono text-xs">instanceId</code> (ObjectId ou código da instância).
          </p>
          <CodeBlock>{`# Listar instâncias
GET ${base}/api/v1/instances
Authorization: Bearer <token-ou-api-key>

# Criar instância
POST ${base}/api/v1/instances
Authorization: Bearer <jwt-ou-api-key>
Content-Type: application/json
{ "name": "Atendimento Comercial" }

# Endpoints WhatsApp (pareamento e agenda; detalhes em Pareamento por QR e Contatos)
POST ${base}/api/v1/instances/<instanceId>/whatsapp/pairing/start
GET  ${base}/api/v1/instances/<instanceId>/whatsapp/status
GET  ${base}/api/v1/instances/<instanceId>/whatsapp/qr
GET  ${base}/api/v1/instances/<instanceId>/whatsapp/contacts[?filter=named|all]
GET  ${base}/api/v1/instances/<instanceId>/whatsapp/contacts/<jid>/profile-photo

# Foto da conta conectada (JWT apenas)
GET  ${base}/api/v1/instances/<instanceId>/whatsapp/profile-photo
PUT  ${base}/api/v1/instances/<instanceId>/whatsapp/profile-photo
Content-Type: multipart/form-data (campo: photo)`}</CodeBlock>
        </Section>

        <Section id="pairing-qr" title="Pareamento por QR (REST)">
          <p>
            Autenticação: <code className="font-mono text-xs">Authorization: Bearer &lt;JWT de sessão ou chave de API otp_…&gt;</code>
            . O segmento <code className="font-mono text-xs">instanceId</code> no path pode ser o{' '}
            <strong>ObjectId</strong> da instância <strong>ou</strong> o <strong>código</strong> (ex.{' '}
            <code className="font-mono text-xs">inst-a1b2c3d4</code>).
          </p>
          <p>
            <strong>Passos:</strong> (1) <code className="font-mono text-xs">GET /api/v1/instances</code> ou{' '}
            <code className="font-mono text-xs">POST /api/v1/instances</code> para obter o id/código. (2){' '}
            <code className="font-mono text-xs">POST …/whatsapp/pairing/start</code> para iniciar o pareamento. (3) Em
            loop a cada cerca de 1–2s, chamar <code className="font-mono text-xs">GET …/whatsapp/status</code> e{' '}
            <code className="font-mono text-xs">GET …/whatsapp/qr</code> até{' '}
            <code className="font-mono text-xs">whatsappReady: true</code>, ou interromper após timeout. Enquanto o QR
            ainda não existir, <code className="font-mono text-xs">qr</code> será <code className="font-mono text-xs">null</code>
            ; o payload pode ser renovado (novo escaneamento se expirar).
          </p>
          <p>
            <code className="font-mono text-xs">POST …/pairing/start</code>: responde <strong>200</strong> com{' '}
            <code className="font-mono text-xs">alreadyConnected: true</code> se a sessão já estiver conectada, ou{' '}
            <strong>202</strong> com <code className="font-mono text-xs">alreadyConnected: false</code> ao iniciar
            pareamento.             <code className="font-mono text-xs">GET …/qr</code> devolve{' '}
            <code className="font-mono text-xs">&#123; &quot;qr&quot;: string | null &#125;</code> — a string é o
            conteúdo bruto do QR; no cliente, gere a imagem com uma biblioteca de QR (não é URL nem PNG da API). Para
            desconectar: <code className="font-mono text-xs">POST …/whatsapp/logout</code> (também com Bearer).
          </p>
          <p>
            Depois de <code className="font-mono text-xs">whatsappReady: true</code>, a sessão pode sincronizar contatos na
            agenda WhatsApp; para listá-los via REST use{' '}
            <code className="font-mono text-xs">GET …/whatsapp/contacts</code> — mesma autenticação Bearer (
            <a href="#contacts" className="text-primary font-medium underline-offset-2 hover:underline">
              Contatos da agenda (REST)
            </a>
            ).
          </p>
          <p>
            Para fotos de perfil (conta conectada ou contactos), ver{' '}
            <a href="#profile-photos" className="text-primary font-medium underline-offset-2 hover:underline">
              Fotos de perfil (REST)
            </a>
            .
          </p>
          <CodeBlock>{`# Exemplo: iniciar e acompanhar (ajuste <instanceId> e o token)
export API_BASE='${base}'
export TOKEN='sua_chave_ou_jwt'
export INST='<instanceId-ou-codigo-inst-xxx>'

curl -sS -H "Authorization: Bearer $TOKEN" \\
  -X POST "$API_BASE/api/v1/instances/$INST/whatsapp/pairing/start"

# Em seguida, em loop até whatsappReady ou até obter "qr" não nulo:
curl -sS -H "Authorization: Bearer $TOKEN" \\
  "$API_BASE/api/v1/instances/$INST/whatsapp/status"
curl -sS -H "Authorization: Bearer $TOKEN" \\
  "$API_BASE/api/v1/instances/$INST/whatsapp/qr"
`}</CodeBlock>
        </Section>

        <Section id="contacts" title="Contatos da agenda (REST)">
          <p>
            <strong>Endpoint:</strong>{' '}
            <code className="font-mono text-xs">GET /api/v1/instances/&lt;instanceId&gt;/whatsapp/contacts</code>.
            Autenticação:{' '}
            <code className="font-mono text-xs">Authorization: Bearer &lt;JWT de sessão ou chave de API otp_…&gt;</code>; o{' '}
            <code className="font-mono text-xs">instanceId</code> segue as mesmas regras das outras rotas (ObjectId ou
            código da instância).
          </p>
          <p>
            <strong>Query:</strong> <code className="font-mono text-xs">filter</code> opcional —{' '}
            <code className="font-mono text-xs">named</code> (omissão, igual à rota já existente): só contactos com{' '}
            <strong>nome de agenda</strong> gravado não vazio, ordenados por nome ascendente.{' '}
            <code className="font-mono text-xs">filter=all</code>: todos os contactos de utilizador (
            <code className="font-mono text-xs">@s.whatsapp.net</code>) já persistidos para a instância (inclui sem nome na
            agenda), ordenação por nome e JID. Pode responder{' '}
            <code className="font-mono text-xs">&#123; &quot;items&quot;: [] &#125;</code> até existir dados na base.
          </p>
          <p>
            O tipo <code className="font-mono text-xs">TypeScript</code> de cada elemento é:
          </p>
          <CodeBlock>{`type WhatsAppContact = {
  jid: string;     // JID do contacto em @s.whatsapp.net
  name: string;
  phone: string;   // dígitos inferidos do JID do utilizador
  notify?: string;  // opcional
};

type WhatsAppContactsBody = {
  items: WhatsAppContact[];
};`}</CodeBlock>
          <CodeBlock>{`# Listar agenda (JWT ou api key — mesmo padrão do pareamento)
export API_BASE='${base}'
export TOKEN='sua_chave_ou_jwt'
export INST='<instanceId-ou-codigo-inst-xxx>'

curl -sS -H "Authorization: Bearer $TOKEN" \\
  "$API_BASE/api/v1/instances/$INST/whatsapp/contacts"

# Todos os contactos sincronizados (não só com nome de agenda):
curl -sS -H "Authorization: Bearer $TOKEN" \\
  "$API_BASE/api/v1/instances/$INST/whatsapp/contacts?filter=all"

# Resposta exemplo: { "items": [ { "jid": "...", "name": "...", "phone": "...", "notify": "..." } ] }`}</CodeBlock>
          <p className="text-outline text-xs">
            A listagem <strong>não inclui</strong> foto de perfil. Para obter a URL da foto de um contacto ou grupo, use{' '}
            <a href="#profile-photos" className="text-primary font-medium underline-offset-2 hover:underline">
              Fotos de perfil (REST)
            </a>
            .
          </p>
        </Section>

        <Section id="profile-photos" title="Fotos de perfil (REST)">
          <p>
            O servidor consulta o WhatsApp em tempo real via Baileys e devolve uma <strong>URL temporária</strong> (
            <code className="font-mono text-xs">pps.whatsapp.net</code>). A imagem <strong>não é gravada</strong> no
            disco nem no MongoDB — use a URL logo no seu cliente (ex.: <code className="font-mono text-xs">&lt;img src=&#123;url&#125; /&gt;</code>
            ). Em todos os casos a sessão da instância tem de estar conectada (
            <code className="font-mono text-xs">whatsappReady: true</code>).
          </p>
          <p>
            Tipo de resposta comum ao consultar foto:
          </p>
          <CodeBlock>{`type WhatsAppProfilePhotoBody = {
  url: string | null; // null = sem foto ou privacidade impede a consulta
};`}</CodeBlock>

          <p className="text-on-surface text-xs font-semibold">Conta conectada (própria instância)</p>
          <p>
            Consultar ou alterar a foto da <strong>conta WhatsApp ligada</strong> à instância. Autenticação:{' '}
            <strong>JWT de sessão apenas</strong> (não aceita chave de API).
          </p>
          <CodeBlock>{`# Consultar foto atual
GET ${base}/api/v1/instances/<instanceId>/whatsapp/profile-photo
Authorization: Bearer <jwt-sessao>

# Resposta 200: { "url": "https://pps.whatsapp.net/v/..." }

# Atualizar foto (JPG, PNG ou WEBP até 2MB)
PUT ${base}/api/v1/instances/<instanceId>/whatsapp/profile-photo
Authorization: Bearer <jwt-sessao>
Content-Type: multipart/form-data

# campo multipart: photo=<arquivo>

# Resposta 200: { "ok": true }`}</CodeBlock>

          <p className="text-on-surface mt-4 text-xs font-semibold">Contacto ou grupo</p>
          <p>
            <strong>Endpoint:</strong>{' '}
            <code className="font-mono text-xs">
              GET /api/v1/instances/&lt;instanceId&gt;/whatsapp/contacts/&lt;jid&gt;/profile-photo
            </code>
            . Autenticação: <code className="font-mono text-xs">Authorization: Bearer &lt;JWT ou chave de API otp_…&gt;</code>.
          </p>
          <p>
            No parâmetro <code className="font-mono text-xs">:jid</code>, use o telefone (ex.{' '}
            <code className="font-mono text-xs">5511999999999</code>), JID de utilizador (
            <code className="font-mono text-xs">5511999999999@s.whatsapp.net</code>) ou JID de grupo (
            <code className="font-mono text-xs">123456789-123345@g.us</code>).
          </p>
          <p className="text-outline text-xs">
            Erros: <strong>400</strong> (JID inválido), <strong>503</strong> (sessão não conectada ou falha na consulta
            ao WhatsApp).
          </p>
          <CodeBlock>{`# Foto de perfil de um contacto pelo telefone
GET ${base}/api/v1/instances/<instanceId>/whatsapp/contacts/5511999999999/profile-photo
Authorization: Bearer <token>

# Foto de um grupo
GET ${base}/api/v1/instances/<instanceId>/whatsapp/contacts/123456789-123345@g.us/profile-photo
Authorization: Bearer <token>

# Resposta 200 (exemplo)
# { "url": "https://pps.whatsapp.net/v/..." }

# Sem foto ou privacidade restrita
# { "url": null }`}</CodeBlock>
          <p className="text-outline text-xs">
            Fluxo típico: (1) <code className="font-mono text-xs">GET …/contacts</code> para obter o{' '}
            <code className="font-mono text-xs">jid</code> ou <code className="font-mono text-xs">phone</code>; (2) chamar
            este endpoint por contacto quando precisar exibir o avatar. Não há batch — uma chamada por JID.
          </p>
        </Section>

        <Section id="conversation-messages" title="Mensagens por conversa (REST)">
          <p>
            <strong>Endpoint:</strong>{' '}
            <code className="font-mono text-xs">
              GET /api/v1/instances/&lt;instanceId&gt;/whatsapp/conversations/&lt;jid&gt;/messages
            </code>
            . Autenticação:{' '}
            <code className="font-mono text-xs">Authorization: Bearer &lt;JWT de sessão ou chave de API otp_…&gt;</code>.
          </p>
          <p>
            <strong>Path params:</strong> <code className="font-mono text-xs">instanceId</code> (ObjectId ou código da
            instância) e <code className="font-mono text-xs">jid</code> da conversa. Você pode enviar só o número (ex.:{' '}
            <code className="font-mono text-xs">5511999999999</code>) que a API converte para JID automaticamente, ou
            informar o JID completo (ex.: <code className="font-mono text-xs">5511999999999@s.whatsapp.net</code> ou{' '}
            <code className="font-mono text-xs">120363163341782618@g.us</code> para grupos).
          </p>
          <p>
            <strong>Query params:</strong> <code className="font-mono text-xs">limit</code> opcional (1..100, padrão 20) e{' '}
            <code className="font-mono text-xs">beforeMessageId</code> opcional (cursor para a próxima página).
          </p>
          <CodeBlock>{`# Exemplo: primeira página
GET ${base}/api/v1/instances/<instanceId>/whatsapp/conversations/5511999999999/messages?limit=20
Authorization: Bearer <token>

# Exemplo de paginação (usar o nextCursor da resposta anterior)
GET ${base}/api/v1/instances/<instanceId>/whatsapp/conversations/5511999999999/messages?limit=20&beforeMessageId=<nextCursor>
Authorization: Bearer <token>

# Resposta 200 (exemplo)
# {
#   "items": [
#     {
#       "id": "3EB0C767F26B1C0A0F8C",
#       "jid": "5511999999999@s.whatsapp.net",
#       "fromMe": false,
#       "timestamp": "2026-05-05T10:12:00.000Z",
#       "text": "Olá, tudo bem?",
#       "type": "conversation",
#       "isGroup": false,
#       "chatJid": "5511999999999@s.whatsapp.net",
#       "senderJid": "5511999999999@s.whatsapp.net",
#       "reply": {
#         "quotedMessageId": "85C8BECF03530712764F03497688DD22",
#         "quotedParticipant": "5511888888888@s.whatsapp.net",
#         "quotedText": "Tudo certo?",
#         "quotedType": "conversation"
#       }
#     }
#   ],
#   "nextCursor": "3EB0C767F26B1C0A0F8B"
# }`}</CodeBlock>
          <p className="text-outline text-xs">
            Erros comuns: 400 para parâmetros inválidos/JID ausente e 503 quando a sessão WhatsApp da instância não está
            conectada.
          </p>
          <p className="text-outline mt-2 text-xs">
            Para mensagens com arquivo <strong>persistidas</strong> (histórico salvo no servidor), cada item pode incluir{' '}
            <code className="font-mono text-xs">mediaUrl</code> (caminho relativo à API — use com o mesmo Bearer),{' '}
            <code className="font-mono text-xs">mediaMimeType</code>,{' '}
            <code className="font-mono text-xs">mediaFileName</code> e{' '}
            <code className="font-mono text-xs">mediaSize</code>. Detalhes em{' '}
            <a href="#message-media" className="text-primary font-medium underline-offset-2 hover:underline">
              Download de mídia (REST)
            </a>
            .
          </p>
          <CodeBlock>{`# Exemplo de item com mídia na listagem
# {
#   "id": "3EB0C767F26B1C0A0F8C",
#   "jid": "5511999999999@s.whatsapp.net",
#   "fromMe": false,
#   "timestamp": "2026-05-05T10:12:00.000Z",
#   "text": "Segue o contrato.",
#   "type": "media",
#   "mediaUrl": "/api/v1/instances/<instanceId>/whatsapp/messages/<mongoId>/media",
#   "mediaMimeType": "application/pdf",
#   "mediaFileName": "contrato.pdf",
#   "mediaSize": 245760
# }`}</CodeBlock>
          <p className="text-outline text-xs">
            O campo <code className="font-mono text-xs">id</code> pode ser o identificador do WhatsApp (Baileys) ou o
            id interno, conforme o registo. Itens podem incluir <code className="font-mono text-xs">isGroup</code>,{' '}
            <code className="font-mono text-xs">chatJid</code>, <code className="font-mono text-xs">senderJid</code> e{' '}
            <code className="font-mono text-xs">reply</code> (mesma forma do webhook). Para baixar o ficheiro, use sempre o URL completo em{' '}
            <code className="font-mono text-xs">mediaUrl</code> (contém o id MongoDB da mensagem persistida).
          </p>
        </Section>

        <Section id="message-media" title="Download de mídia (REST)">
          <p>
            <strong>Endpoint:</strong>{' '}
            <code className="font-mono text-xs">
              GET /api/v1/instances/&lt;instanceId&gt;/whatsapp/messages/&lt;messageId&gt;/media
            </code>
            . Autenticação:{' '}
            <code className="font-mono text-xs">Authorization: Bearer &lt;JWT de sessão ou chave de API otp_…&gt;</code>.
          </p>
          <p>
            O <code className="font-mono text-xs">messageId</code> no path é o <strong>ObjectId MongoDB</strong> do
            registo persistido (não confundir com <code className="font-mono text-xs">messageId</code> do WhatsApp no
            webhook). O caminho mais simples é concatenar a base da API com o valor de{' '}
            <code className="font-mono text-xs">mediaUrl</code> devolvido na{' '}
            <a href="#conversation-messages" className="text-primary font-medium underline-offset-2 hover:underline">
              listagem de mensagens
            </a>
            .
          </p>
          <p>
            Resposta <strong>200</strong>: corpo binário do arquivo com{' '}
            <code className="font-mono text-xs">Content-Type</code> e{' '}
            <code className="font-mono text-xs">Content-Disposition: inline</code> conforme o tipo/nome gravados.
            Erros: <strong>400</strong> (id inválido), <strong>404</strong> (sem mídia ou arquivo ausente no disco).
          </p>
          <CodeBlock>{`GET ${base}/api/v1/instances/<instanceId>/whatsapp/messages/<mongoId>/media
Authorization: Bearer <token>

# Resposta 200: bytes do arquivo (ex.: application/pdf, image/jpeg)`}</CodeBlock>
          <p className="text-outline text-xs">
            Só existem ficheiros para mensagens recebidas/enviadas com mídia e com{' '}
            <strong>persistência de mensagens</strong> activa na instância. Mensagens em tempo real via webhook/socket
            trazem o binário inline no payload (ver{' '}
            <a href="#incoming-payload" className="text-primary font-medium underline-offset-2 hover:underline">
              Payload: mensagem recebida
            </a>
            ); este endpoint serve para recuperar ficheiros já gravados no histórico.
          </p>
        </Section>

        <Section id="conversation-delete" title="Remover histórico persistido">
          <p>
            <strong>Remover por contato:</strong>{' '}
            <code className="font-mono text-xs">
              DELETE /api/v1/instances/&lt;instanceId&gt;/whatsapp/conversations/&lt;jid&gt;/messages
            </code>
          </p>
          <p>
            No parâmetro <code className="font-mono text-xs">:jid</code>, você pode usar apenas o telefone (ex.:{' '}
            <code className="font-mono text-xs">5511999999999</code>) ou o JID completo (ex.:{' '}
            <code className="font-mono text-xs">5511999999999@s.whatsapp.net</code>).
          </p>
          <p>
            <strong>Remover tudo da instância:</strong>{' '}
            <code className="font-mono text-xs">DELETE /api/v1/instances/&lt;instanceId&gt;/messages</code>
          </p>
          <p>
            Ambos exigem <code className="font-mono text-xs">Authorization: Bearer &lt;JWT de sessão&gt;</code> (API key
            não autorizada), e removem registros do banco + arquivos persistidos.
          </p>
          <CodeBlock>{`# Limpar histórico de um contato específico
DELETE ${base}/api/v1/instances/<instanceId>/whatsapp/conversations/5511999999999/messages
Authorization: Bearer <jwt>

# Limpar todo histórico da instância
DELETE ${base}/api/v1/instances/<instanceId>/messages
Authorization: Bearer <jwt>

# Resposta 200 (exemplo)
# {
#   "deletedMessages": 12,
#   "deletedMediaFiles": 3,
#   "mediaDeleteErrors": 0
# }`}</CodeBlock>
        </Section>

        <Section id="send-code" title="Envio de mensagem">
          <p>
            Endpoint de envio de mensagem por instância:
            <code className="font-mono text-xs"> POST /api/v1/auth/instances/:instanceId/send-code</code>.
          </p>
          <p>
            Informe <strong>um</strong> destino: <code className="font-mono text-xs">phoneNumber</code>{' '}
            <strong>ou</strong> <code className="font-mono text-xs">chatJid</code> (não ambos).{' '}
            <code className="font-mono text-xs">message</code>: conteúdo da mensagem (1 a 200 caracteres).
          </p>
          <p className="text-outline text-xs">
            <strong>phoneNumber</strong> — 10 a 15 dígitos (DDI + número). Use quando o payload recebido tiver{' '}
            <code className="font-mono text-xs">from</code> preenchido.
          </p>
          <p className="text-outline text-xs">
            <strong>chatJid</strong> — JID completo da conversa. Obrigatório quando{' '}
            <code className="font-mono text-xs">from</code> vem vazio (ex. contas com privacidade{' '}
            <code className="font-mono text-xs">@lid</code>) ou para responder em grupo (
            <code className="font-mono text-xs">@g.us</code>). Sufixos aceites:{' '}
            <code className="font-mono text-xs">@s.whatsapp.net</code>,{' '}
            <code className="font-mono text-xs">@lid</code>, <code className="font-mono text-xs">@g.us</code>.
            Copie o valor de <code className="font-mono text-xs">chatJid</code> (ou{' '}
            <code className="font-mono text-xs">senderJid</code> em DM) do evento{' '}
            <code className="font-mono text-xs">whatsapp.message.received</code> —{' '}
            <strong>não envie só os dígitos</strong> sem o sufixo{' '}
            <code className="font-mono text-xs">@lid</code>/<code className="font-mono text-xs">@g.us</code>.
          </p>
          <p className="text-on-surface text-xs font-semibold">Exemplo — telefone</p>
          <CodeBlock>{`POST ${base}/api/v1/auth/instances/<instanceId>/send-code
Authorization: Bearer <token>
Content-Type: application/json

{
  "phoneNumber": "5511999999999",
  "message": "Olá! Sua solicitação foi recebida e já está em atendimento."
}`}</CodeBlock>
          <p className="text-on-surface text-xs font-semibold">Exemplo — conta @lid (sem telefone no recebimento)</p>
          <CodeBlock>{`POST ${base}/api/v1/auth/instances/<instanceId>/send-code
Authorization: Bearer <token>
Content-Type: application/json

{
  "chatJid": "123093813043447@lid",
  "message": "Olá, Marizuc! Recebemos sua mensagem."
}`}</CodeBlock>
          <p className="text-on-surface text-xs font-semibold">Exemplo — grupo</p>
          <CodeBlock>{`{
  "chatJid": "120363163341782618@g.us",
  "message": "Combinado no grupo!"
}`}</CodeBlock>
          <p className="text-outline text-xs">
            200: mensagem enviada. 400: validação, destino inválido ou sem WhatsApp. 403: limite diário do plano
            grátis atingido (envios com sucesso, janela UTC; configurável com{' '}
            <code className="font-mono">FREE_DAILY_SEND_LIMIT</code>). 503: sessão não conectada.
          </p>
          <p className="text-outline mt-2 text-xs">
            Para testar upgrade sem gateway, o endpoint{' '}
            <code className="font-mono">POST /api/v1/auth/billing/mock-checkout</code> (sessão JWT) promove
            o plano a pago; em produção use o fluxo de pagamento real.
          </p>
        </Section>

        <Section id="send-media" title="Envio de arquivo">
          <p>
            Endpoint para envio de arquivo/documento por instância:
            <code className="font-mono text-xs"> POST /api/v1/auth/instances/:instanceId/send-media</code>.
          </p>
          <p>
            Content-Type obrigatório: <code className="font-mono text-xs">multipart/form-data</code>. Campos esperados:
            <code className="font-mono text-xs"> phoneNumber</code> (10 a 15 dígitos),
            <code className="font-mono text-xs"> file</code> (arquivo obrigatório) e
            <code className="font-mono text-xs"> caption</code> opcional (até 200 caracteres).
          </p>
          <p className="text-outline text-xs">
            Limite atual de tamanho: 16MB por arquivo. O envio usa a mesma autenticação Bearer (JWT ou chave
            <code className="font-mono"> otp_…</code>) e a mesma verificação de sessão conectada. O arquivo é enviado
            como <strong>documento</strong> no WhatsApp (não como nota de voz nativa). Não há evento socket de confirmação
            de envio — apenas a resposta HTTP.
          </p>
          <CodeBlock>{`curl -X POST "${base}/api/v1/auth/instances/<instanceId>/send-media" \\
  -H "Authorization: Bearer <token>" \\
  -F "phoneNumber=5511999999999" \\
  -F "caption=Segue o arquivo solicitado." \\
  -F "file=@/caminho/para/contrato.pdf"

# Resposta 200:
# { "ok": true, "message": "Arquivo enviado" }`}</CodeBlock>
          <p className="text-outline text-xs">
            400: validação, arquivo ausente/vazio ou número sem WhatsApp. 403: limite diário do plano grátis
            atingido. 503: sessão não conectada ou indisponível.
          </p>
        </Section>

        <Section id="incoming-payload" title="Payload: mensagem recebida">
          <p>
            O corpo <code className="font-mono text-xs">JSON</code> de uma mensagem <strong>recebida</strong> (não
            confundir com o envio via <code className="font-mono text-xs">send-code</code>) tem sempre a <strong>mesma
            forma</strong> no <strong>webhook</strong> (<code className="font-mono text-xs">POST</code>) e no evento
            Socket <code className="font-mono text-xs">whatsapp.message.received</code>. O tipo
            <code className="font-mono text-xs"> TypeScript</code> é:
          </p>
          <CodeBlock>{`type WhatsAppIncomingMessageReply = {
  quotedMessageId: string;   // id da mensagem citada no WhatsApp
  quotedParticipant: string | null; // JID de quem enviou a citada (pode ser @lid)
  quotedText: string;      // texto/legenda da mensagem citada, quando existir
  quotedType: string;      // tipo proto (ex. conversation, imageMessage)
};

type WhatsAppIncomingMessageEvent = {
  messageId: string;   // id da mensagem no WhatsApp (Baileys)
  from: string;        // telefone do remetente (só dígitos); vazio se não resolvível
  to: string | null;   // pushName do contacto, se existir; senão null
  timestamp: string;   // data/hora em ISO 8601 (UTC)
  text: string;        // texto ou legenda (caption), quando existir
  userId: string;      // id do utilizador (conta) no painel
  instanceId: string;  // id da instância WhatsApp desta ligação
  isGroup: boolean;    // true quando a conversa é um grupo (@g.us)
  chatJid: string;     // JID da conversa (grupo ou contacto)
  senderJid: string;   // JID de quem enviou (em grupo: participant)
  reply?: WhatsAppIncomingMessageReply; // presente quando é resposta a outra mensagem
  media?: {            // opcional — presente quando o servidor baixou a mídia com sucesso
    fileBuffer?: Buffer | { type: 'Buffer'; data: number[] };
    mimeType?: string;
    fileName?: string;
    size?: number;
  };
};`}</CodeBlock>
          <p className="text-outline text-xs">
            Só entram na fila de receção mensagens de conversa (não enviadas por si; o fluxo de envio usa outros
            endpoints). Com <strong>persistência activa</strong>, o servidor também grava a mensagem e o ficheiro em
            disco para consulta posterior via REST (
            <a href="#message-media" className="text-primary font-medium underline-offset-2 hover:underline">
              Download de mídia
            </a>
            ).
          </p>
          <p className="text-outline text-xs">
            <strong>Grupos:</strong> <code className="font-mono text-xs">isGroup</code> é{' '}
            <code className="font-mono text-xs">true</code> e <code className="font-mono text-xs">chatJid</code> termina
            em <code className="font-mono text-xs">@g.us</code>. O remetente real fica em{' '}
            <code className="font-mono text-xs">senderJid</code> e, quando resolvível, em{' '}
            <code className="font-mono text-xs">from</code> (telefone).
          </p>
          <p className="text-outline text-xs">
            <strong>Respostas:</strong> quando o utilizador responde a outra mensagem no WhatsApp, o objeto{' '}
            <code className="font-mono text-xs">reply</code> inclui o id e o conteúdo citado. Em contactos com
            privacidade/LID, <code className="font-mono text-xs">quotedParticipant</code> pode vir como{' '}
            <code className="font-mono text-xs">@lid</code> em vez de telefone.
          </p>
          <p className="text-outline text-xs">
            Observação: quando o WhatsApp não expõe o telefone real do remetente, o campo{' '}
            <code className="font-mono text-xs">from</code> é enviado como string vazia — use{' '}
            <code className="font-mono text-xs">chatJid</code> no envio (
            <a href="#send-code" className="text-primary font-medium underline-offset-2 hover:underline">
              Envio de mensagem
            </a>
            ) ou <code className="font-mono text-xs">senderJid</code> como identificador opaco.
          </p>
          <p className="text-outline text-xs">
            <strong>Responder automaticamente:</strong> se <code className="font-mono text-xs">from</code> tiver
            dígitos, envie com <code className="font-mono text-xs">phoneNumber</code>; caso contrário, envie com{' '}
            <code className="font-mono text-xs">chatJid</code> igual ao recebido (ex.{' '}
            <code className="font-mono text-xs">123093813043447@lid</code> ou{' '}
            <code className="font-mono text-xs">120363…@g.us</code> para grupo).
          </p>
          <p className="text-on-surface text-xs font-semibold">Exemplo — DM com @lid (conta empresarial / privacidade)</p>
          <CodeBlock>{`{
  "messageId": "3EB05A3E243FFBE25B02E5",
  "from": "",
  "to": "Marizuc Loja",
  "timestamp": "2026-07-06T18:21:36.000Z",
  "text": "Olá",
  "userId": "69f9d4e99df08c3073dd4d05",
  "instanceId": "69f9d4f19df08c3073dd4d0e",
  "isGroup": false,
  "chatJid": "123093813043447@lid",
  "senderJid": "123093813043447@lid"
}`}</CodeBlock>
          <p className="text-on-surface text-xs font-semibold">Mídia recebida (webhook e socket)</p>
          <p className="text-outline text-xs">
            Imagem, vídeo, documento (PDF, DOC, etc.) e <strong>áudio/notas de voz</strong> (
            <code className="font-mono text-xs">audioMessage</code>) são descarregados pelo servidor e incluídos em{' '}
            <code className="font-mono text-xs">media</code> no <strong>mesmo payload</strong> enviado pelo webhook e
            pelo evento socket <code className="font-mono text-xs">whatsapp.message.received</code>. Notas de voz
            costumam vir com <code className="font-mono text-xs">text</code> vazio,{' '}
            <code className="font-mono text-xs">mimeType</code> em Ogg/Opus e{' '}
            <code className="font-mono text-xs">fileName</code> como <code className="font-mono text-xs">voice-note.ogg</code>.
            Se o download falhar, o evento pode chegar sem <code className="font-mono text-xs">media.fileBuffer</code>.
          </p>
          <p className="text-outline text-xs">
            No <strong>webhook</strong>, <code className="font-mono text-xs">fileBuffer</code> serializa em JSON como{' '}
            <code className="font-mono text-xs">&#123; &quot;type&quot;: &quot;Buffer&quot;, &quot;data&quot;: [ …bytes ] &#125;</code>.
            No <strong>Socket.IO</strong>, o cliente pode receber <code className="font-mono text-xs">Uint8Array</code>{' '}
            ou estrutura equivalente — reconstrua o buffer antes de gravar o ficheiro. Este payload{' '}
            <strong>não inclui</strong> <code className="font-mono text-xs">mediaUrl</code>; use o binário inline ou,
            depois de persistido, o endpoint REST de download.
          </p>
          <p className="text-on-surface text-xs font-semibold">Exemplo — mensagem de texto</p>
          <CodeBlock>{`{
  "messageId": "3EB0C767F26B1C0A0F8C",
  "from": "5511999999999",
  "to": "Nome do contacto",
  "timestamp": "2025-04-24T18:32:11.000Z",
  "text": "Olá, preciso de ajuda.",
  "userId": "65a1b2c3d4e5f6789abcdef0",
  "instanceId": "65a1b2c3d4e5f6789abcdef1",
  "isGroup": false,
  "chatJid": "5511999999999@s.whatsapp.net",
  "senderJid": "5511999999999@s.whatsapp.net"
}`}</CodeBlock>
          <p className="text-on-surface text-xs font-semibold">Exemplo — resposta em conversa 1:1</p>
          <CodeBlock>{`{
  "messageId": "3EB0C767F26B1C0A0F8F",
  "from": "5511999999999",
  "to": "Nome do contacto",
  "timestamp": "2025-04-24T18:33:00.000Z",
  "text": "Sim, pode ser às 15h.",
  "userId": "65a1b2c3d4e5f6789abcdef0",
  "instanceId": "65a1b2c3d4e5f6789abcdef1",
  "isGroup": false,
  "chatJid": "5511999999999@s.whatsapp.net",
  "senderJid": "5511999999999@s.whatsapp.net",
  "reply": {
    "quotedMessageId": "85C8BECF03530712764F03497688DD22",
    "quotedParticipant": "5511888888888@s.whatsapp.net",
    "quotedText": "Qual horário funciona para você?",
    "quotedType": "conversation"
  }
}`}</CodeBlock>
          <p className="text-on-surface text-xs font-semibold">Exemplo — mensagem em grupo</p>
          <CodeBlock>{`{
  "messageId": "3EB0C767F26B1C0A0F90",
  "from": "5511777777777",
  "to": "Maria",
  "timestamp": "2025-04-24T18:34:00.000Z",
  "text": "Combinado no grupo!",
  "userId": "65a1b2c3d4e5f6789abcdef0",
  "instanceId": "65a1b2c3d4e5f6789abcdef1",
  "isGroup": true,
  "chatJid": "120363163341782618@g.us",
  "senderJid": "5511777777777@s.whatsapp.net"
}`}</CodeBlock>
          <p className="text-on-surface text-xs font-semibold">Exemplo — documento recebido (webhook; socket usa a mesma forma, buffer pode variar)</p>
          <CodeBlock>{`{
  "messageId": "3EB0C767F26B1C0A0F8D",
  "from": "5511999999999",
  "to": "Nome do contacto",
  "timestamp": "2025-04-24T18:35:00.000Z",
  "text": "Segue o contrato assinado.",
  "userId": "65a1b2c3d4e5f6789abcdef0",
  "instanceId": "65a1b2c3d4e5f6789abcdef1",
  "isGroup": false,
  "chatJid": "5511999999999@s.whatsapp.net",
  "senderJid": "5511999999999@s.whatsapp.net",
  "media": {
    "fileBuffer": { "type": "Buffer", "data": [37, 80, 68, 70, 45, 49, 46, 52] },
    "mimeType": "application/pdf",
    "fileName": "contrato.pdf",
    "size": 245760
  }
}`}</CodeBlock>
          <p className="text-on-surface text-xs font-semibold">Exemplo — nota de voz recebida (webhook; socket usa a mesma forma)</p>
          <CodeBlock>{`{
  "messageId": "3EB0C767F26B1C0A0F8E",
  "from": "5511999999999",
  "to": "Nome do contacto",
  "timestamp": "2025-04-24T18:40:00.000Z",
  "text": "",
  "userId": "65a1b2c3d4e5f6789abcdef0",
  "instanceId": "65a1b2c3d4e5f6789abcdef1",
  "isGroup": false,
  "chatJid": "5511999999999@s.whatsapp.net",
  "senderJid": "5511999999999@s.whatsapp.net",
  "media": {
    "fileBuffer": { "type": "Buffer", "data": [79, 103, 103, 83] },
    "mimeType": "audio/ogg; codecs=opus",
    "fileName": "voice-note.ogg",
    "size": 18432
  }
}`}</CodeBlock>
        </Section>

        <Section id="webhook-incoming" title="Webhook (mensagens recebidas)">
          <p>
            O servidor envia um <code className="font-mono text-xs">POST</code> para a sua URL quando chega uma
            mensagem. <strong>Exclusão mútua com o Socket:</strong> ao ativar o webhook
            ( <code className="font-mono text-xs">enabled: true</code> após o PUT), o Message Listener
            (Socket) é desativado nessa instância. A configuração exige <strong>JWT de sessão</strong>, não chave de API.
          </p>
          <CodeBlock>{`# Consultar configuração
GET ${base}/api/v1/instances/<instanceId>/whatsapp/webhook
Authorization: Bearer <jwt-sessao>

# Resposta: { "url": string | null, "enabled": boolean, "hasSecret": boolean, "secretLast4": string | null }

# Definir URL, ativar e (opcional) regenerar segredo
PUT ${base}/api/v1/instances/<instanceId>/whatsapp/webhook
Authorization: Bearer <jwt-sessao>
Content-Type: application/json

{
  "url": "https://seu-servidor.com/webhooks/wa",
  "enabled": true,
  "regenerateSecret": false
}

# Resposta 200: { "ok": true, "config": { ... }, "secret": "..." } — o campo "secret" só vem ao criar/regenerar

# Enviar pedido de teste (mesmo corpo e assinatura que uma mensagem real)
POST ${base}/api/v1/instances/<instanceId>/whatsapp/webhook/test
Authorization: Bearer <jwt-sessao>
`}</CodeBlock>
          <p>
            <strong>Entrega:</strong> <code className="font-mono text-xs">POST</code> com{' '}
            <code className="font-mono text-xs">Content-Type: application/json</code> e corpo com a interface{' '}
            <a href="#incoming-payload" className="text-primary font-medium underline-offset-2 hover:underline">
              Payload: mensagem recebida
            </a>
            . O cabeçalho <code className="font-mono text-xs">X-Webhook-Signature: sha256=&lt;hex&gt;</code> contém
            HMAC-SHA256 do corpo <strong>em UTF-8 exatamente como enviado</strong>, com o segredo da instância. Mensagens
            com ficheiro incluem <code className="font-mono text-xs">media.fileBuffer</code> no JSON (array de bytes) — o
            corpo pode ser grande; valide a assinatura antes de processar. Em
            produção a URL deve ser <code className="font-mono text-xs">https://</code>; <code className="font-mono text-xs">http://</code> em
            produção só com <code className="font-mono text-xs">WEBHOOK_INSECURE_HTTP=1</code> no servidor.
          </p>
        </Section>

        <Section id="socket" title="Socket.IO em tempo real">
          <p>
            O “listening” tem de estar <strong>ligado no painel</strong> (JWT). <strong>Exclusão mútua:</strong> ao
            ativar a escuta Socket, o <strong>webhook</strong> deixa de enviar (fica <code className="font-mono text-xs">enabled: false</code> na
            instância; URL e segredo mantêm-se). Autentique com chave de API e informe a instância no handshake:
            <code className="rounded bg-slate-100 px-1 font-mono text-xs">auth.apiKey</code> e{' '}
            <code className="rounded bg-slate-100 px-1 font-mono text-xs">auth.instanceId</code>.
          </p>
          <CodeBlock>{`import { io } from 'socket.io-client';

const socket = io('${base}', {
  path: '/socket.io',
  transports: ['websocket'],
  auth: { apiKey: 'sua_api_key', instanceId: '<instanceId>' },
  timeout: 10000,
});

socket.emit(
  'whatsapp.message.send',
  { phoneNumber: '5511999999999', text: 'Mensagem para telefone conhecido.' },
  (ack) => console.log(ack)
);

// Sem telefone no recebimento (@lid) ou resposta em grupo — use chatJid completo:
socket.emit(
  'whatsapp.message.send',
  { chatJid: '123093813043447@lid', text: 'Resposta para conta @lid.' },
  (ack) => console.log(ack)
);

socket.on('whatsapp.message.received', (payload) => {
  const dest = payload.from
    ? { phoneNumber: payload.from, text: 'Sua resposta aqui' }
    : { chatJid: payload.chatJid, text: 'Sua resposta aqui' };
  socket.emit('whatsapp.message.send', dest, (ack) => console.log(ack));

  // payload: WhatsAppIncomingMessageEvent — ver secção "Payload: mensagem recebida"
  // Com mídia (imagem/vídeo/documento/áudio), payload.media traz fileBuffer + mimeType + fileName
  if (payload.media?.fileBuffer) {
    const bytes =
      payload.media.fileBuffer instanceof Uint8Array
        ? payload.media.fileBuffer
        : Buffer.from(payload.media.fileBuffer.data ?? []);
    console.log('Mídia recebida:', payload.media.fileName, bytes.length, 'bytes');
  }
  console.log(payload);
});`}</CodeBlock>
          <p>
            Eventos principais: <code className="font-mono text-xs">whatsapp.message.send</code> (texto; destino via{' '}
            <code className="font-mono text-xs">phoneNumber</code> ou <code className="font-mono text-xs">chatJid</code>)
            e{' '}
            <code className="font-mono text-xs">whatsapp.message.received</code> (texto e mídia recebida, incluindo notas de voz). A forma de{' '}
            <code className="font-mono text-xs">whatsapp.message.received</code> é a descrita em{' '}
            <a href="#incoming-payload" className="text-primary font-medium underline-offset-2 hover:underline">
              Payload: mensagem recebida
            </a>
            , incluindo o campo opcional <code className="font-mono text-xs">media</code> com o binário inline. Para
            ficheiros já persistidos no histórico, prefira <code className="font-mono text-xs">mediaUrl</code> via REST (
            <a href="#message-media" className="text-primary font-medium underline-offset-2 hover:underline">
              Download de mídia
            </a>
            ).
          </p>
        </Section>

      </div>
    </div>
  );
}
