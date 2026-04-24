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
Authorization: Bearer <jwt>
Content-Type: application/json
{ "name": "Atendimento Comercial" }

# Iniciar pareamento e consultar status
POST ${base}/api/v1/instances/<instanceId>/whatsapp/pairing/start
GET  ${base}/api/v1/instances/<instanceId>/whatsapp/status
GET  ${base}/api/v1/instances/<instanceId>/whatsapp/qr`}</CodeBlock>
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
            200: mensagem enviada. 400: validação/número sem WhatsApp. 503: sessão não conectada.
          </p>
        </Section>

        <Section id="socket" title="Socket.IO em tempo real">
          <p>
            Autentique com chave de API e informe a instância no handshake:
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
  console.log(payload);
});`}</CodeBlock>
          <p>
            Eventos principais: <code className="font-mono text-xs">whatsapp.message.send</code> e{' '}
            <code className="font-mono text-xs">whatsapp.message.received</code>.
          </p>
        </Section>

      </div>
    </div>
  );
}
