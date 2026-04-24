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
                <a href="#send-code" className="text-primary hover:underline">
                  Envio de mensagem
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

# Endpoints WhatsApp (pareamento; detalhes na secção Pareamento por QR)
POST ${base}/api/v1/instances/<instanceId>/whatsapp/pairing/start
GET  ${base}/api/v1/instances/<instanceId>/whatsapp/status
GET  ${base}/api/v1/instances/<instanceId>/whatsapp/qr`}</CodeBlock>
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
            pareamento. <code className="font-mono text-xs">GET …/qr</code> devolve{' '}
            <code className="font-mono text-xs">&#123; &quot;qr&quot;: string | null &#125;</code> — a string é o
            conteúdo bruto do QR; no cliente, gere a imagem com uma biblioteca de QR (não é URL nem PNG da API). Para
            desconectar: <code className="font-mono text-xs">POST …/whatsapp/logout</code> (também com Bearer).
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

        <Section id="send-code" title="Envio de mensagem">
          <p>
            Endpoint de envio de mensagem por instância:
            <code className="font-mono text-xs"> POST /api/v1/auth/instances/:instanceId/send-code</code>.
          </p>
          <p>
            <code className="font-mono text-xs">phoneNumber</code>: 10 a 15 dígitos.{' '}
            <code className="font-mono text-xs">message</code>: conteúdo da mensagem (1 a 200 caracteres).
          </p>
          <CodeBlock>{`POST ${base}/api/v1/auth/instances/<instanceId>/send-code
Authorization: Bearer <token>
Content-Type: application/json

{
  "phoneNumber": "5511999999999",
  "message": "Olá! Sua solicitação foi recebida e já está em atendimento."
}`}</CodeBlock>
          <p className="text-outline text-xs">
            200: mensagem enviada. 400: validação/número sem WhatsApp. 403: limite diário do plano
            grátis atingido (envios com sucesso, janela UTC; configurável com{' '}
            <code className="font-mono">FREE_DAILY_SEND_LIMIT</code>). 503: sessão não conectada.
          </p>
          <p className="text-outline mt-2 text-xs">
            Para testar upgrade sem gateway, o servidor pode expor{' '}
            <code className="font-mono">POST /api/v1/auth/billing/mock-checkout</code> com{' '}
            <code className="font-mono">ENABLE_MOCK_BILLING=1</code> (não usar em produção real).
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
          <CodeBlock>{`type WhatsAppIncomingMessageEvent = {
  messageId: string;   // id da mensagem (Baileys)
  from: string;        // JID do remetente, ex. "5511999999999@s.whatsapp.net"
  to: string | null;  // pushName do contacto, se existir; senão null
  timestamp: string;   // data/hora em ISO 8601 (UTC)
  text: string;        // texto extraído (mensagem de texto)
  userId: string;      // id do utilizador (conta) no painel
  instanceId: string;  // id da instância WhatsApp desta ligação
};`}</CodeBlock>
          <p className="text-outline text-xs">
            Só entram na fila de receção mensagens de conversa (não enviadas por si; o fluxo de envio de OTP usa outro
            endpoint).
          </p>
          <p className="text-on-surface text-xs font-semibold">Exemplo (corpo exatamente enviado no webhook; idêntico no Socket)</p>
          <CodeBlock>{`{
  "messageId": "3EB0C767F26B1C0A0F8C",
  "from": "5511999999999@s.whatsapp.net",
  "to": "Nome do contacto",
  "timestamp": "2025-04-24T18:32:11.000Z",
  "text": "Olá, preciso de ajuda.",
  "userId": "65a1b2c3d4e5f6789abcdef0",
  "instanceId": "65a1b2c3d4e5f6789abcdef1"
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
            HMAC-SHA256 do corpo <strong>em UTF-8 exatamente como enviado</strong>, com o segredo da instância. Em
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
  { phoneNumber: '5511999999999', text: 'Mensagem enviada pelo canal em tempo real.' },
  (ack) => console.log(ack)
);

socket.on('whatsapp.message.received', (payload) => {
  // payload: WhatsAppIncomingMessageEvent — ver secção "Payload: mensagem recebida"
  console.log(payload);
});`}</CodeBlock>
          <p>
            Eventos principais: <code className="font-mono text-xs">whatsapp.message.send</code> e{' '}
            <code className="font-mono text-xs">whatsapp.message.received</code> — a forma de{' '}
            <code className="font-mono text-xs">whatsapp.message.received</code> é a descrita em{' '}
            <a href="#incoming-payload" className="text-primary font-medium underline-offset-2 hover:underline">
              Payload: mensagem recebida
            </a>
            .
          </p>
        </Section>

      </div>
    </div>
  );
}
