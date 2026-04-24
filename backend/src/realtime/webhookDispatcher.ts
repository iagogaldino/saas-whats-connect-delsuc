import crypto from 'crypto';
import type { Logger } from 'pino';
import type { WhatsAppIncomingMessageEvent } from '../whatsapp/whatsapp.types';
import { getWebhookDispatchConfig } from '../services/instance.service';

const TIMEOUT_MS = 10_000;
const MAX_ATTEMPTS = 3;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function signWebhookBody(bodyUtf8: string, secret: string): string {
  const h = crypto.createHmac('sha256', secret).update(bodyUtf8, 'utf8').digest('hex');
  return `sha256=${h}`;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: c.signal });
  } finally {
    clearTimeout(t);
  }
}

export class WebhookDispatcher {
  constructor(private readonly log: Logger) {}

  /** Não bloqueia a thread do Baileys; erros só em log. */
  deliver(userId: string, instanceId: string, payload: WhatsAppIncomingMessageEvent): void {
    void this.deliverAsync(userId, instanceId, payload);
  }

  /** Entrega explícita (ex.: teste manual) com o mesmo corpo e assinatura. */
  async deliverTest(url: string, secret: string, payload: WhatsAppIncomingMessageEvent): Promise<Response> {
    const body = JSON.stringify(payload);
    const signature = signWebhookBody(body, secret);
    return fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
        },
        body,
      },
      TIMEOUT_MS
    );
  }

  private async deliverAsync(
    userId: string,
    instanceId: string,
    payload: WhatsAppIncomingMessageEvent
  ): Promise<void> {
    let config: { url: string; secret: string } | null;
    try {
      config = await getWebhookDispatchConfig(userId, instanceId);
    } catch (e) {
      this.log.warn({ err: e, userId, instanceId }, 'webhook: falha ao ler config');
      return;
    }
    if (!config) return;

    const body = JSON.stringify(payload);
    const signature = signWebhookBody(body, config.secret);
    const headers = {
      'Content-Type': 'application/json',
      'X-Webhook-Signature': signature,
    };

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      try {
        const res = await fetchWithTimeout(
          config.url,
          { method: 'POST', headers, body },
          TIMEOUT_MS
        );
        if (res.status >= 400 && res.status < 500) {
          this.log.info(
            { userId, instanceId, status: res.status, attempt: attempt + 1 },
            'webhook: destino respondeu 4xx; sem reenvio'
          );
          return;
        }
        if (res.ok) {
          return;
        }
        this.log.warn(
          { userId, instanceId, status: res.status, attempt: attempt + 1 },
          'webhook: resposta não OK'
        );
      } catch (e) {
        this.log.warn(
          { err: e, userId, instanceId, attempt: attempt + 1 },
          'webhook: falha de rede ou timeout'
        );
      }
      if (attempt < MAX_ATTEMPTS - 1) {
        await delay(500 * 2 ** attempt);
      }
    }
  }
}
