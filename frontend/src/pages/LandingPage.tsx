const featureCols = [
  {
    title: 'Backend Infrastructure',
    icon: 'storage',
    border: 'border-primary',
    points: [
      {
        t: 'Session Management',
        d: 'Persistência de estado de conexão e múltiplas instâncias simultâneas.',
      },
      {
        t: 'QR Pairing em Tempo Real',
        d: 'Geração de QR dinâmico para conectar e reconectar sessões com rapidez.',
      },
      {
        t: 'Envio de Mensagens Livres',
        d: 'Envie qualquer texto via API, sem limitação ao fluxo de OTP.',
      },
    ],
  },
  {
    title: 'Frontend & Control',
    icon: 'dashboard',
    border: 'border-tertiary-fixed',
    points: [
      {
        t: 'Monitoring Dashboard',
        d: 'Visão completa da saúde das instâncias e volume de tráfego.',
      },
      {
        t: 'Controles em Tempo Real',
        d: 'Ligue ou desligue instâncias e controle o canal de escuta em segundos.',
      },
      {
        t: 'Advanced Logs',
        d: 'Rastreabilidade total para auditoria e debugging técnico.',
      },
    ],
  },
];

const steps = [
  ['01', 'Login Seguro', 'Acesse o painel administrativo usando suas credenciais criptografadas.'],
  ['02', 'QR Pairing', 'Escaneie o código dinâmico para conectar sua instância do WhatsApp.'],
  ['03', 'Envio de Mensagens', 'Dispare qualquer mensagem via API para clientes, suporte e operações.'],
  ['04', 'Listener em Tempo Real', 'Escute eventos de mensagens recebidas e status para integrações externas.'],
] as const;

export function LandingPage() {
  return (
    <div className="bg-background text-on-background font-body">
      <nav className="bg-surface/80 fixed top-0 z-50 w-full border-b border-outline-variant/30 backdrop-blur-md">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6">
          <a href="/" className="font-headline text-xl font-black tracking-tighter text-primary">
            ConnectAPI
          </a>
          <div className="hidden items-center gap-8 md:flex">
            <a className="font-headline text-sm font-semibold text-on-surface-variant hover:text-primary" href="#features">
              Features
            </a>
            <a className="font-headline text-sm font-semibold text-on-surface-variant hover:text-primary" href="#how-it-works">
              How it Works
            </a>
            <a className="font-headline text-sm font-semibold text-on-surface-variant hover:text-primary" href="#api">
              API
            </a>
            <a className="font-headline text-sm font-semibold text-on-surface-variant hover:text-primary" href="#security">
              Security
            </a>
            <a href="/login" className="rounded-xl bg-primary px-6 py-2.5 font-semibold text-on-primary">
              Get Started
            </a>
          </div>
        </div>
      </nav>

      <header className="relative overflow-hidden px-6 pb-20 pt-32">
        <div className="mx-auto grid max-w-7xl items-center gap-16 lg:grid-cols-2">
          <div>
            <h1 className="font-headline mb-6 text-5xl font-extrabold leading-[1.1] tracking-tight md:text-6xl">
              Transforme seu WhatsApp em um Hub de{' '}
              <span className="text-primary-container">Comunicação Programável</span>
            </h1>
            <p className="mb-10 max-w-xl text-lg leading-relaxed text-on-surface-variant md:text-xl">
              Plataforma para operar múltiplas instâncias, enviar qualquer mensagem via REST API e receber eventos em
              tempo real com Socket.IO, com segurança e isolamento por usuário.
            </p>
            <div className="flex flex-wrap gap-4">
              <a href="/login" className="flex items-center gap-2 rounded-xl bg-primary px-8 py-4 font-bold text-on-primary">
                Get Started
                <span className="material-symbols-outlined">arrow_forward</span>
              </a>
              <a href="/docs" className="rounded-xl border border-outline-variant/30 px-8 py-4 font-bold text-primary">
                View Docs
              </a>
            </div>
          </div>
          <div className="relative">
            <div className="absolute -right-12 -top-14 h-72 w-72 rounded-full bg-primary-container/20 blur-3xl" />
            <div className="relative overflow-hidden rounded-xl bg-surface-container-lowest p-6 shadow-[0_20px_40px_rgba(16,29,37,0.08)]">
              <div className="mb-4 flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-red-400" />
                <div className="h-3 w-3 rounded-full bg-amber-400" />
                <div className="h-3 w-3 rounded-full bg-green-400" />
              </div>
              <pre className="rounded-lg bg-surface-container-high p-6 font-mono text-sm leading-relaxed text-primary">
{`# Sending message via API
POST /api/v1/auth/instances/<instanceId>/send-code
{
  "phoneNumber": "5511999999999",
  "message": "Olá! Esta é uma mensagem livre enviada pela API."
}

// Response 200 OK
{ "ok": true, "message": "Código enviado" }`}
              </pre>
              <div className="mt-4 flex items-center justify-between px-2">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-3 w-3">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-tertiary-fixed opacity-75" />
                    <span className="relative inline-flex h-3 w-3 rounded-full bg-tertiary-fixed" />
                  </span>
                  <span className="text-xs font-bold text-tertiary">Real-time Connected</span>
                </div>
                <span className="text-xs italic text-outline">API V2.4.0</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <section id="features" className="bg-surface-container-low py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-16 text-center">
            <h2 className="font-headline mb-4 text-4xl font-extrabold">Arquitetura de Duas Camadas</h2>
            <p className="mx-auto max-w-2xl text-on-surface-variant">
              Construído para operação contínua, controle por instância e integração simples para qualquer tipo de
              mensagem.
            </p>
          </div>
          <div className="grid gap-8 md:grid-cols-2">
            {featureCols.map((col) => (
              <div key={col.title} className={`rounded-xl border-l-4 bg-surface-container-lowest p-10 shadow-sm ${col.border}`}>
                <div className="mb-6 flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-on-primary">
                    <span className="material-symbols-outlined">{col.icon}</span>
                  </div>
                  <h3 className="font-headline text-2xl font-bold">{col.title}</h3>
                </div>
                <ul className="space-y-6">
                  {col.points.map((item) => (
                    <li key={item.t} className="flex gap-4">
                      <span className="material-symbols-outlined mt-1 text-tertiary-container">check_circle</span>
                      <div>
                        <p className="font-bold">{item.t}</p>
                        <p className="text-sm text-on-surface-variant">{item.d}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-16">
            <h2 className="font-headline mb-4 text-4xl font-extrabold">Fluxo de Integração</h2>
            <p className="text-on-surface-variant">Do login ao envio da primeira mensagem livre em minutos.</p>
          </div>
          <div className="grid gap-6 md:grid-cols-4">
            {steps.map(([n, title, desc], i) => (
              <div key={title} className="group relative">
                <div className="h-full rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-8">
                  <div className="font-headline mb-4 text-5xl font-black text-primary-container/30">{n}</div>
                  <h4 className="mb-2 text-lg font-bold">{title}</h4>
                  <p className="text-sm text-on-surface-variant">{desc}</p>
                </div>
                {i < steps.length - 1 && (
                  <div className="absolute -right-4 top-1/2 z-20 hidden -translate-y-1/2 md:block">
                    <span className="material-symbols-outlined text-outline-variant">chevron_right</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="api" className="relative overflow-hidden bg-on-primary-fixed py-24 text-on-primary">
        <div className="mx-auto grid max-w-7xl items-center gap-16 px-6 lg:grid-cols-2">
          <div>
            <span className="mb-6 inline-block rounded-full bg-tertiary px-4 py-1 text-xs font-bold text-tertiary-fixed">
              SOCKET.IO & REST
            </span>
            <h2 className="font-headline mb-6 text-4xl font-extrabold">Interatividade em Milissegundos</h2>
            <p className="mb-8 text-lg leading-relaxed text-primary-fixed-dim">
              Esqueça o polling. Envie mensagens via REST, acompanhe estados de entrega e consuma eventos instantâneos
              com Socket.IO na sua aplicação.
            </p>
            <div className="space-y-4">
              <div className="flex items-center gap-4 rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-500/20 text-teal-400">
                  <span className="material-symbols-outlined">key</span>
                </div>
                <span className="font-mono text-sm">Auth via Header: X-API-KEY</span>
              </div>
              <div className="flex items-center gap-4 rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-500/20 text-teal-400">
                  <span className="material-symbols-outlined">lan</span>
                </div>
                <span className="font-mono text-sm">Event: whatsapp.message.received</span>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900 p-8 shadow-2xl">
            <div className="mb-6 flex items-center justify-between border-b border-white/5 pb-4">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Live Event Stream</span>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-green-500" />
                <span className="text-[10px] font-bold text-green-400">STREAMING</span>
              </div>
            </div>
            <div className="space-y-4 font-mono text-xs">
              <div className="rounded-lg border-l-2 border-tertiary-fixed bg-white/5 p-3">
                <span className="text-slate-500">[14:02:11]</span> <span className="text-tertiary-fixed">RECEIVED:</span>{' '}
                {'{ from: "5511...", text: "Hello API!" }'}
              </div>
              <div className="rounded-lg border-l-2 border-primary-fixed bg-white/5 p-3">
                <span className="text-slate-500">[14:02:45]</span> <span className="text-primary-fixed">SENT:</span>{' '}
                {'{ to: "5511...", text: "Mensagem enviada via API" }'}
              </div>
              <div className="rounded-lg border-l-2 border-amber-400 bg-white/5 p-3">
                <span className="text-slate-500">[14:03:02]</span> <span className="text-amber-400">STATUS:</span>{' '}
                {'{ msgId: "xyz", state: "delivered" }'}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="security" className="bg-surface py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-16 max-w-2xl">
            <h2 className="font-headline mb-4 text-4xl font-extrabold">Segurança & Isolamento de Dados</h2>
            <p className="text-on-surface-variant">
              Cada conexão é um silo independente. Suas chaves de API garantem que apenas sua aplicação acesse seus
              dados.
            </p>
          </div>
          <div className="grid gap-8 md:grid-cols-3">
            <div className="rounded-xl bg-surface-container-lowest p-8 shadow-sm">
              <span className="material-symbols-outlined mb-6 text-4xl text-primary">vpn_lock</span>
              <h4 className="mb-3 text-xl font-bold">Isolated Channels</h4>
              <p className="text-sm leading-relaxed text-on-surface-variant">
                Implementação de namespace via socket <code className="rounded bg-surface-container-high px-1">user:{'{'}userId{'}'}</code>,
                prevenindo qualquer vazamento de dados entre clientes.
              </p>
            </div>
            <div className="rounded-xl bg-surface-container-lowest p-8 shadow-sm">
              <span className="material-symbols-outlined mb-6 text-4xl text-primary">encrypted</span>
              <h4 className="mb-3 text-xl font-bold">API Key Auth</h4>
              <p className="text-sm leading-relaxed text-on-surface-variant">
                Autenticação obrigatória em cada requisição REST. Revogue e regenere suas chaves instantaneamente via
                painel.
              </p>
            </div>
            <div className="rounded-xl bg-surface-container-lowest p-8 shadow-sm">
              <span className="material-symbols-outlined mb-6 text-4xl text-primary">database</span>
              <h4 className="mb-3 text-xl font-bold">Persistent State</h4>
              <p className="text-sm leading-relaxed text-on-surface-variant">
                Sessões e estado de escuta persistidos em banco, permitindo reconexão automática após quedas de rede.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="px-6 py-20">
        <div className="mx-auto max-w-7xl overflow-hidden rounded-3xl bg-primary p-12 text-center text-on-primary">
          <h2 className="font-headline mb-6 text-3xl font-extrabold md:text-5xl">Domine sua comunicação em escala global</h2>
          <p className="mx-auto mb-10 max-w-3xl text-lg text-primary-fixed">
            Centralize instâncias, envie qualquer mensagem e tenha rastreabilidade ponta a ponta em cada envio.
          </p>
          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <a href="/login" className="rounded-xl bg-tertiary-fixed px-10 py-4 font-bold text-on-tertiary-fixed">
              Começar Agora
            </a>
            <a href="/docs" className="rounded-xl border border-white/20 bg-white/10 px-10 py-4 font-bold text-white">
              Ver Documentação
            </a>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-slate-50 py-16">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-12 px-6 md:flex-row">
          <div className="max-w-sm">
            <div className="mb-4 text-lg font-bold text-primary">ConnectAPI</div>
            <p className="mb-6 text-sm leading-relaxed text-slate-500">
              © 2026 ConnectAPI Technologies. High-performance messaging infrastructure.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-8 md:grid-cols-3 md:gap-16">
            <div>
              <h5 className="mb-4 font-bold text-primary">Platform</h5>
              <ul className="space-y-2 text-sm text-slate-500">
                <li><a href="/docs">Documentation</a></li>
                <li><a href="/app">API Status</a></li>
                <li><a href="/app/logs">Release Notes</a></li>
              </ul>
            </div>
            <div>
              <h5 className="mb-4 font-bold text-primary">Company</h5>
              <ul className="space-y-2 text-sm text-slate-500">
                <li><a href="#security">Security</a></li>
                <li><a href="/login">Login</a></li>
                <li><a href="/register">Register</a></li>
              </ul>
            </div>
            <div>
              <h5 className="mb-4 font-bold text-primary">Integrations</h5>
              <ul className="space-y-2 text-sm text-slate-500">
                <li><a href="#api">Socket.IO</a></li>
                <li><a href="#api">REST API</a></li>
                <li><a href="/docs">Examples</a></li>
              </ul>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
