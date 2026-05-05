import path from 'path';
import { createServer } from 'http';
import 'dotenv/config';
import './types/express-augment';
import { connectDatabase } from './config/database';
import { createLogger } from './config/logger';
import { createApp } from './app';
import { SocketGateway } from './realtime/socketGateway';
import { WebhookDispatcher } from './realtime/webhookDispatcher';
import {
  getRealtimeListeningEnabled,
  listAutoStartInstances,
  markAutoStartAttempt,
  markAutoStartError,
  setRealtimeListeningEnabled,
} from './services/instance.service';
import {
  WhatsAppSessionService,
  createWhatsAppProvider,
  loadWhatsappRuntimeConfig,
  resolveBaseDataPathAbsolute,
} from './whatsapp';
import { startPlanExpirationSweep } from './jobs/planExpirationSweep.schedule';
import { drainPremiumActivationBacklog } from './services/premiumActivationQueue.service';

const log = createLogger();

let stopPlanExpirationSweep: () => void = () => {};

const port = Number(process.env.PORT) || 3001;
const backendRoot = path.resolve(__dirname, '..');
const waRuntime = loadWhatsappRuntimeConfig();
const baseDataPath = resolveBaseDataPathAbsolute(backendRoot, waRuntime.baseDataPath);

log.info(
  { baseDataPath, connectTimeoutMs: waRuntime.connectTimeoutMs },
  'WhatsApp: estado em disco (Baileys); sem Puppeteer/Chrome'
);

const isProd = process.env.NODE_ENV === 'production';
const socketGateway = new SocketGateway();
const webhookDispatcher = new WebhookDispatcher(log);
const whatsappProvider = createWhatsAppProvider(log);

const mongoUri =
  process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/whatsapp_otp';
if (!process.env.MONGODB_URI) {
  log.warn(
    { mongoUri },
    'MONGODB_URI not set; using default (local MongoDB). Set MONGODB_URI in .env for other hosts.'
  );
}

if (!process.env.JWT_SECRET) {
  if (isProd) {
    log.error('JWT_SECRET is required in production');
    process.exit(1);
  }
  process.env.JWT_SECRET = 'dev-only-change-me-set-JWT_SECRET-in-env';
  log.warn('JWT_SECRET not set; using insecure dev default. Set JWT_SECRET in .env.');
}

const whatsappSessions = new WhatsAppSessionService(
  log,
  {
    baseDataPath,
    connectTimeoutMs: waRuntime.connectTimeoutMs,
  },
  whatsappProvider,
  socketGateway,
  webhookDispatcher
);
socketGateway.setListeningPersistenceHandlers(
  async (userId, instanceId) => getRealtimeListeningEnabled(userId, instanceId),
  async (userId, instanceId, enabled) => {
    await setRealtimeListeningEnabled(userId, instanceId, enabled);
  }
);
socketGateway.setSendMessageHandler((userId, instanceId, phoneNumber, text) =>
  whatsappSessions.sendOtp(userId, instanceId, phoneNumber, text)
);

const app = createApp(log, whatsappSessions, webhookDispatcher);

async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>
): Promise<void> {
  if (items.length === 0) return;
  const limit = Math.max(1, concurrency);
  let index = 0;

  async function consume(): Promise<void> {
    while (index < items.length) {
      const current = items[index];
      index += 1;
      await worker(current);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => consume()));
}

async function bootstrap() {
  await connectDatabase(mongoUri, log);
  const autoStartInstances = await listAutoStartInstances();
  const autoStartConcurrency = Number(process.env.WHATSAPP_AUTOSTART_CONCURRENCY) || 5;
  let autoStartScheduled = 0;
  let autoStartFailed = 0;

  await runWithConcurrency(autoStartInstances, autoStartConcurrency, async (item) => {
    try {
      await markAutoStartAttempt(item.instanceId);
      whatsappSessions.startPairing(item.userId, item.instanceId);
      autoStartScheduled += 1;
    } catch (err) {
      autoStartFailed += 1;
      const message = err instanceof Error ? err.message : String(err);
      await markAutoStartError(item.instanceId, message).catch(() => {});
      log.warn(
        {
          err,
          userId: item.userId,
          instanceId: item.instanceId,
        },
        'WhatsApp auto-start: failed to schedule instance'
      );
    }
  });
  log.info(
    {
      total: autoStartInstances.length,
      scheduled: autoStartScheduled,
      failed: autoStartFailed,
      concurrency: autoStartConcurrency,
    },
    'WhatsApp auto-start: bootstrap scheduling finished'
  );

  await drainPremiumActivationBacklog(log);

  const planSweep = startPlanExpirationSweep(log);
  stopPlanExpirationSweep = planSweep.stop;

  const server = createServer(app);
  socketGateway.attach(server, log);

  server.listen(port, () => {
    log.info({ port }, 'HTTP server escutando');
  });

  function shutdown(signal: string) {
    log.info({ signal }, 'Encerrando');
    stopPlanExpirationSweep();
    server.close(() => {
      process.exit(0);
    });
  }

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

void bootstrap().catch((err: unknown) => {
  log.error({ err }, 'Falha ao iniciar');
  process.exit(1);
});
