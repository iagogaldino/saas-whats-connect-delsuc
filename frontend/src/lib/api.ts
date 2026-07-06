import { apiUrl } from './config';
import { clearToken, getToken } from './authStorage';

export type HealthResponse = {
  ok: boolean;
};

export type WhatsAppStatusResponse = {
  whatsappReady: boolean;
  pairingPending: boolean;
};

export type PairingStartResponse = {
  ok: boolean;
  alreadyConnected: boolean;
};

export type WhatsAppLogoutResponse = {
  ok: boolean;
};

export type WhatsAppProfilePhotoUpdateResponse = {
  ok: true;
};

export type WhatsAppProfilePhotoResponse = {
  url: string | null;
};

export type QrResponse = {
  qr: string | null;
};

export type ListeningStatusResponse = {
  enabled: boolean;
  connectedClients: number;
};

export type MessagePersistenceResponse = {
  enabled: boolean;
};

export type WebhookConfigResponse = {
  url: string | null;
  enabled: boolean;
  hasSecret: boolean;
  secretLast4: string | null;
};

export type PutWebhookResponse = {
  ok: true;
  config: WebhookConfigResponse;
  secret?: string;
};

export type WebhookTestResponse = {
  ok: boolean;
  status: number;
};

export type SendCodeBody = {
  phoneNumber?: string;
  chatJid?: string;
  message: string;
};

export type SendMediaBody = {
  phoneNumber: string;
  file: File;
  caption?: string;
};

export type ApiErrorBody = {
  error: string;
  details?: unknown;
};

export type WhatsAppInstance = {
  id: string;
  name: string;
  code: string;
  realtimeListeningEnabled: boolean;
  messagePersistenceEnabled?: boolean;
  createdAt: string;
  updatedAt: string;
};

export type SentMessageItem = {
  id: string;
  phoneNumber: string;
  status: 'success' | 'failed';
  errorMessage: string | null;
  message: string | null;
  createdAt: string;
};

export type MessagesResponse = {
  items: SentMessageItem[];
  total: number;
  page: number;
  limit: number;
};

export type DeleteMessagesResponse = {
  deletedMessages: number;
  deletedMediaFiles: number;
  mediaDeleteErrors: number;
};

export type ApiKeyListItem = {
  id: string;
  name: string | null;
  keyPrefix: string;
  maskedPreview: string;
  createdAt: string;
  lastUsedAt: string | null;
};

export type CreateApiKeyResponse = {
  id: string;
  name: string | null;
  key: string;
  createdAt: string;
};

export type BillingSummary = {
  plan: 'free' | 'paid';
  freeDailyLimit: number;
  usedToday: number;
  remaining: number | null;
  dayTimezoneNote: 'UTC';
  planExpiresAt: string | null;
};

export type MockCheckoutResponse = BillingSummary & {
  ok: true;
  message: string;
};

export type PlanPaymentItem = {
  id: string;
  source: 'mercadopago' | 'mock';
  status: 'approved';
  amount: number;
  currency: string;
  approvedAt: string;
  planExpiresAt: string;
  createdAt: string;
};

export type PlanPaymentsResponse = {
  items: PlanPaymentItem[];
  total: number;
  page: number;
  limit: number;
};

export type ApiRequestLogItem = {
  id: string;
  instanceId: string | null;
  apiKeyId: string;
  method: string;
  path: string;
  statusCode: number;
  ip: string | null;
  userAgent: string | null;
  requestHeaders: Record<string, string>;
  durationMs: number | null;
  createdAt: string;
};

export type ApiRequestLogsResponse = {
  items: ApiRequestLogItem[];
  total: number;
  page: number;
  limit: number;
};

function authHeaders(json = false): Record<string, string> {
  const h: Record<string, string> = {};
  if (json) h['Content-Type'] = 'application/json';
  const t = getToken();
  if (t) h['Authorization'] = `Bearer ${t}`;
  return h;
}

export async function fetchBillingSummary(): Promise<BillingSummary> {
  const res = await fetch(apiUrl('/api/v1/auth/billing'), {
    headers: authHeaders(),
    cache: 'no-store',
  });
  redirectLoginIfUnauthorized(res);
  const data = (await res.json().catch(() => ({}))) as BillingSummary | ApiErrorBody;
  if (!res.ok) {
    const err = data as ApiErrorBody;
    const msg = err.error ?? `Erro HTTP ${res.status}`;
    const e = new Error(msg) as Error & { status: number; details?: unknown };
    e.status = res.status;
    e.details = err.details;
    throw e;
  }
  return data as BillingSummary;
}

export async function fetchPlanPayments(
  page = 1,
  limit = 20
): Promise<PlanPaymentsResponse> {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  const res = await fetch(apiUrl(`/api/v1/auth/billing/payments?${params.toString()}`), {
    headers: authHeaders(),
    cache: 'no-store',
  });
  redirectLoginIfUnauthorized(res);
  const data = (await res.json().catch(() => ({}))) as PlanPaymentsResponse | ApiErrorBody;
  if (!res.ok) {
    const err = data as ApiErrorBody;
    const msg = err.error ?? `Erro HTTP ${res.status}`;
    const e = new Error(msg) as Error & { status: number; details?: unknown };
    e.status = res.status;
    e.details = err.details;
    throw e;
  }
  return data as PlanPaymentsResponse;
}

export async function postMockCheckout(): Promise<MockCheckoutResponse> {
  const res = await fetch(apiUrl('/api/v1/auth/billing/mock-checkout'), {
    method: 'POST',
    headers: authHeaders(),
  });
  redirectLoginIfUnauthorized(res);
  const data = (await res.json().catch(() => ({}))) as MockCheckoutResponse | ApiErrorBody;
  if (!res.ok) {
    const err = data as ApiErrorBody;
    const msg = err.error ?? `Erro HTTP ${res.status}`;
    const e = new Error(msg) as Error & { status: number; details?: unknown };
    e.status = res.status;
    e.details = err.details;
    throw e;
  }
  return data as MockCheckoutResponse;
}

export type MercadopagoCardPaymentPayload = {
  token: string;
  payment_method_id: string;
  issuer_id?: string;
  transaction_amount: number;
  installments: number;
  payer: {
    email?: string;
    identification?: { type: string; number: string };
  };
};

export type MercadopagoCardPaymentResponse = MockCheckoutResponse & {
  activated: true;
  paymentId: string;
  status: string;
};

export async function postMercadopagoCardPayment(
  body: MercadopagoCardPaymentPayload
): Promise<MercadopagoCardPaymentResponse> {
  const res = await fetch(apiUrl('/api/v1/auth/billing/mercadopago/card-payment'), {
    method: 'POST',
    headers: authHeaders(true),
    body: JSON.stringify(body),
  });
  redirectLoginIfUnauthorized(res);
  const data = (await res.json().catch(() => ({}))) as MercadopagoCardPaymentResponse | ApiErrorBody;
  if (!res.ok) {
    const err = data as ApiErrorBody;
    const msg = err.error ?? `Erro HTTP ${res.status}`;
    const e = new Error(msg) as Error & { status: number; details?: unknown };
    e.status = res.status;
    e.details = err.details;
    throw e;
  }
  return data as MercadopagoCardPaymentResponse;
}

export type MercadopagoPixCreatePayload = {
  payer?: { identification?: { type: string; number: string } };
};

export type MercadopagoPixCreateResponse = BillingSummary & {
  ok: true;
  paymentId: string;
  status: string;
} & (
  | { phase: 'activated'; planActivated: true; activated?: boolean }
  | {
      phase: 'pending';
      planActivated: false;
      qrCode: string;
      qrCodeBase64: string | null;
      ticketUrl: string | null;
      dateOfExpiration: string | null;
    }
);

export async function postMercadopagoPix(
  body: MercadopagoPixCreatePayload = {}
): Promise<MercadopagoPixCreateResponse> {
  const res = await fetch(apiUrl('/api/v1/auth/billing/mercadopago/pix-payment'), {
    method: 'POST',
    headers: authHeaders(true),
    body: JSON.stringify(body),
  });
  redirectLoginIfUnauthorized(res);
  const data = (await res.json().catch(() => ({}))) as MercadopagoPixCreateResponse | ApiErrorBody;
  if (!res.ok) {
    const err = data as ApiErrorBody;
    const msg = err.error ?? `Erro HTTP ${res.status}`;
    const e = new Error(msg) as Error & { status: number; details?: unknown };
    e.status = res.status;
    e.details = err.details;
    throw e;
  }
  return data as MercadopagoPixCreateResponse;
}

export type MercadopagoSyncPaymentResponse =
  | (BillingSummary & { ok: true; activated: true; status: string })
  | { ok: true; activated: false; status: string; reason?: string };

export async function postMercadopagoSyncPayment(
  paymentId: string
): Promise<MercadopagoSyncPaymentResponse> {
  const res = await fetch(apiUrl('/api/v1/auth/billing/mercadopago/sync-payment'), {
    method: 'POST',
    headers: authHeaders(true),
    body: JSON.stringify({ paymentId }),
  });
  redirectLoginIfUnauthorized(res);
  const data = (await res.json().catch(() => ({}))) as MercadopagoSyncPaymentResponse | ApiErrorBody;
  if (!res.ok) {
    const err = data as ApiErrorBody;
    const msg = err.error ?? `Erro HTTP ${res.status}`;
    const e = new Error(msg) as Error & { status: number; details?: unknown };
    e.status = res.status;
    e.details = err.details;
    throw e;
  }
  return data as MercadopagoSyncPaymentResponse;
}

function redirectLoginIfUnauthorized(res: Response): void {
  if (res.status === 401 && typeof window !== 'undefined') {
    clearToken();
    if (!window.location.pathname.startsWith('/login')) {
      window.location.assign('/login');
    }
  }
}

export async function fetchHealth(): Promise<HealthResponse> {
  async function tryJsonHealth(path: string): Promise<HealthResponse | null> {
    try {
      const res = await fetch(apiUrl(path), { cache: 'no-store' });
      if (!res.ok) return null;
      const contentType = res.headers.get('content-type') ?? '';
      if (!contentType.includes('application/json')) return null;
      const data = (await res.json()) as Partial<HealthResponse>;
      if (data.ok === true) return { ok: true };
      return null;
    } catch {
      return null;
    }
  }

  const v1 = await tryJsonHealth('/api/v1/health');
  if (v1) return v1;

  // Compatibilidade com ambiente de desenvolvimento/proxy antigo.
  const root = await tryJsonHealth('/health');
  if (root) return root;

  // Fallback para deployments antigos sem /api/v1/health:
  // se /api estiver roteando para o backend, OPTIONS costuma responder 2xx via CORS.
  try {
    const probe = await fetch(apiUrl('/api/v1/auth/login'), { method: 'OPTIONS', cache: 'no-store' });
    if (probe.ok) return { ok: true };
    throw new Error(`HTTP ${probe.status}`);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Falha na rede';
    throw new Error(message);
  }
}

export async function fetchWhatsAppStatus(): Promise<WhatsAppStatusResponse> {
  throw new Error('fetchWhatsAppStatus requer instanceId');
}

export async function fetchWhatsAppStatusForInstance(
  instanceId: string
): Promise<WhatsAppStatusResponse> {
  const res = await fetch(apiUrl(`/api/v1/instances/${encodeURIComponent(instanceId)}/whatsapp/status`), {
    headers: authHeaders(),
    cache: 'no-store',
  });
  redirectLoginIfUnauthorized(res);
  const data = (await res.json()) as WhatsAppStatusResponse;
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return data;
}

export async function startWhatsAppPairing(): Promise<PairingStartResponse> {
  throw new Error('startWhatsAppPairing requer instanceId');
}

export async function startWhatsAppPairingForInstance(
  instanceId: string
): Promise<PairingStartResponse> {
  const res = await fetch(
    apiUrl(`/api/v1/instances/${encodeURIComponent(instanceId)}/whatsapp/pairing/start`),
    {
    method: 'POST',
    headers: authHeaders(),
    }
  );
  redirectLoginIfUnauthorized(res);
  const data = (await res.json().catch(() => ({}))) as PairingStartResponse;
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return data;
}

export async function fetchWhatsAppQr(): Promise<QrResponse> {
  throw new Error('fetchWhatsAppQr requer instanceId');
}

export async function fetchWhatsAppQrForInstance(instanceId: string): Promise<QrResponse> {
  const res = await fetch(apiUrl(`/api/v1/instances/${encodeURIComponent(instanceId)}/whatsapp/qr`), {
    headers: authHeaders(),
  });
  redirectLoginIfUnauthorized(res);
  const data = (await res.json()) as QrResponse;
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return data;
}

export type WhatsAppContact = {
  jid: string;
  name: string;
  phone: string;
  notify?: string;
};

type WhatsAppContactsResponse = { items: WhatsAppContact[] };

export type ContactsListFilter = 'named' | 'all';

export async function fetchWhatsAppContactsForInstance(
  instanceId: string,
  options?: { filter?: ContactsListFilter }
): Promise<WhatsAppContact[]> {
  const qs =
    options?.filter && options.filter !== 'named'
      ? `?filter=${encodeURIComponent(options.filter)}`
      : '';
  const res = await fetch(
    apiUrl(`/api/v1/instances/${encodeURIComponent(instanceId)}/whatsapp/contacts${qs}`),
    {
      headers: authHeaders(),
      cache: 'no-store',
    }
  );
  redirectLoginIfUnauthorized(res);
  const data = (await res.json().catch(() => ({}))) as WhatsAppContactsResponse | ApiErrorBody;
  if (!res.ok) {
    const err = data as ApiErrorBody;
    const msg = err.error ?? `Erro HTTP ${res.status}`;
    const e = new Error(msg) as Error & { status: number; details?: unknown };
    e.status = res.status;
    e.details = err.details;
    throw e;
  }
  return (data as WhatsAppContactsResponse).items ?? [];
}

/** Foto de perfil de um contacto/grupo (URL temporária do WhatsApp). `jid` = telefone ou JID completo. */
export async function fetchWhatsAppContactProfilePhotoForInstance(
  instanceId: string,
  jid: string
): Promise<WhatsAppProfilePhotoResponse> {
  const encodedJid = encodeURIComponent(jid.trim());
  const res = await fetch(
    apiUrl(
      `/api/v1/instances/${encodeURIComponent(instanceId)}/whatsapp/contacts/${encodedJid}/profile-photo`
    ),
    {
      headers: authHeaders(),
      cache: 'no-store',
    }
  );
  redirectLoginIfUnauthorized(res);
  const data = (await res.json().catch(() => ({}))) as WhatsAppProfilePhotoResponse | ApiErrorBody;
  if (!res.ok) {
    const err = data as ApiErrorBody;
    const msg = err.error ?? `Erro HTTP ${res.status}`;
    const e = new Error(msg) as Error & { status: number; details?: unknown };
    e.status = res.status;
    e.details = err.details;
    throw e;
  }
  return data as WhatsAppProfilePhotoResponse;
}

export async function logoutWhatsApp(): Promise<WhatsAppLogoutResponse> {
  throw new Error('logoutWhatsApp requer instanceId');
}

export async function logoutWhatsAppForInstance(instanceId: string): Promise<WhatsAppLogoutResponse> {
  const res = await fetch(apiUrl(`/api/v1/instances/${encodeURIComponent(instanceId)}/whatsapp/logout`), {
    method: 'POST',
    headers: authHeaders(),
  });
  redirectLoginIfUnauthorized(res);
  const data = (await res.json().catch(() => ({}))) as WhatsAppLogoutResponse | ApiErrorBody;
  if (!res.ok) {
    const err = data as ApiErrorBody;
    const msg = err.error ?? `Erro HTTP ${res.status}`;
    const e = new Error(msg) as Error & { status: number; details?: unknown };
    e.status = res.status;
    e.details = err.details;
    throw e;
  }
  return data as WhatsAppLogoutResponse;
}

export async function updateWhatsAppProfilePhotoForInstance(
  instanceId: string,
  photo: File
): Promise<WhatsAppProfilePhotoUpdateResponse> {
  const form = new FormData();
  form.append('photo', photo);
  const res = await fetch(apiUrl(`/api/v1/instances/${encodeURIComponent(instanceId)}/whatsapp/profile-photo`), {
    method: 'PUT',
    headers: authHeaders(),
    body: form,
  });
  redirectLoginIfUnauthorized(res);
  const data = (await res.json().catch(() => ({}))) as WhatsAppProfilePhotoUpdateResponse | ApiErrorBody;
  if (!res.ok) {
    const err = data as ApiErrorBody;
    const msg = err.error ?? `Erro HTTP ${res.status}`;
    const e = new Error(msg) as Error & { status: number; details?: unknown };
    e.status = res.status;
    e.details = err.details;
    throw e;
  }
  return data as WhatsAppProfilePhotoUpdateResponse;
}

export async function fetchWhatsAppProfilePhotoForInstance(
  instanceId: string
): Promise<WhatsAppProfilePhotoResponse> {
  const res = await fetch(apiUrl(`/api/v1/instances/${encodeURIComponent(instanceId)}/whatsapp/profile-photo`), {
    headers: authHeaders(),
    cache: 'no-store',
  });
  redirectLoginIfUnauthorized(res);
  const data = (await res.json().catch(() => ({}))) as WhatsAppProfilePhotoResponse | ApiErrorBody;
  if (!res.ok) {
    const err = data as ApiErrorBody;
    const msg = err.error ?? `Erro HTTP ${res.status}`;
    const e = new Error(msg) as Error & { status: number; details?: unknown };
    e.status = res.status;
    e.details = err.details;
    throw e;
  }
  return data as WhatsAppProfilePhotoResponse;
}

export async function fetchListeningStatus(): Promise<ListeningStatusResponse> {
  throw new Error('fetchListeningStatus requer instanceId');
}

export async function fetchListeningStatusForInstance(
  instanceId: string
): Promise<ListeningStatusResponse> {
  const res = await fetch(apiUrl(`/api/v1/instances/${encodeURIComponent(instanceId)}/whatsapp/listening/status`), {
    headers: authHeaders(),
    cache: 'no-store',
  });
  redirectLoginIfUnauthorized(res);
  const data = (await res.json().catch(() => ({}))) as ListeningStatusResponse | ApiErrorBody;
  if (!res.ok) {
    const err = data as ApiErrorBody;
    const msg = err.error ?? `Erro HTTP ${res.status}`;
    const e = new Error(msg) as Error & { status: number; details?: unknown };
    e.status = res.status;
    e.details = err.details;
    throw e;
  }
  return data as ListeningStatusResponse;
}

export async function startListeningMessages(): Promise<ListeningStatusResponse> {
  throw new Error('startListeningMessages requer instanceId');
}

export async function startListeningMessagesForInstance(
  instanceId: string
): Promise<ListeningStatusResponse> {
  const res = await fetch(apiUrl(`/api/v1/instances/${encodeURIComponent(instanceId)}/whatsapp/listening/start`), {
    method: 'POST',
    headers: authHeaders(),
  });
  redirectLoginIfUnauthorized(res);
  const data = (await res.json().catch(() => ({}))) as ListeningStatusResponse | ApiErrorBody;
  if (!res.ok) {
    const err = data as ApiErrorBody;
    const msg = err.error ?? `Erro HTTP ${res.status}`;
    const e = new Error(msg) as Error & { status: number; details?: unknown };
    e.status = res.status;
    e.details = err.details;
    throw e;
  }
  return data as ListeningStatusResponse;
}

export async function stopListeningMessages(): Promise<ListeningStatusResponse> {
  throw new Error('stopListeningMessages requer instanceId');
}

export async function stopListeningMessagesForInstance(
  instanceId: string
): Promise<ListeningStatusResponse> {
  const res = await fetch(apiUrl(`/api/v1/instances/${encodeURIComponent(instanceId)}/whatsapp/listening/stop`), {
    method: 'POST',
    headers: authHeaders(),
  });
  redirectLoginIfUnauthorized(res);
  const data = (await res.json().catch(() => ({}))) as ListeningStatusResponse | ApiErrorBody;
  if (!res.ok) {
    const err = data as ApiErrorBody;
    const msg = err.error ?? `Erro HTTP ${res.status}`;
    const e = new Error(msg) as Error & { status: number; details?: unknown };
    e.status = res.status;
    e.details = err.details;
    throw e;
  }
  return data as ListeningStatusResponse;
}

export async function fetchMessagePersistenceForInstance(
  instanceId: string
): Promise<MessagePersistenceResponse> {
  const res = await fetch(
    apiUrl(`/api/v1/instances/${encodeURIComponent(instanceId)}/whatsapp/message-persistence`),
    {
      headers: authHeaders(),
      cache: 'no-store',
    }
  );
  redirectLoginIfUnauthorized(res);
  const data = (await res.json().catch(() => ({}))) as MessagePersistenceResponse | ApiErrorBody;
  if (!res.ok) {
    const err = data as ApiErrorBody;
    const msg = err.error ?? `Erro HTTP ${res.status}`;
    const e = new Error(msg) as Error & { status: number; details?: unknown };
    e.status = res.status;
    e.details = err.details;
    throw e;
  }
  return data as MessagePersistenceResponse;
}

export async function updateMessagePersistenceForInstance(
  instanceId: string,
  enabled: boolean
): Promise<MessagePersistenceResponse> {
  const res = await fetch(
    apiUrl(`/api/v1/instances/${encodeURIComponent(instanceId)}/whatsapp/message-persistence`),
    {
      method: 'PUT',
      headers: authHeaders(true),
      body: JSON.stringify({ enabled }),
    }
  );
  redirectLoginIfUnauthorized(res);
  const data = (await res.json().catch(() => ({}))) as MessagePersistenceResponse | ApiErrorBody;
  if (!res.ok) {
    const err = data as ApiErrorBody;
    const msg = err.error ?? `Erro HTTP ${res.status}`;
    const e = new Error(msg) as Error & { status: number; details?: unknown };
    e.status = res.status;
    e.details = err.details;
    throw e;
  }
  return data as MessagePersistenceResponse;
}

export async function fetchWebhookConfigForInstance(
  instanceId: string
): Promise<WebhookConfigResponse> {
  const res = await fetch(apiUrl(`/api/v1/instances/${encodeURIComponent(instanceId)}/whatsapp/webhook`), {
    headers: authHeaders(),
    cache: 'no-store',
  });
  redirectLoginIfUnauthorized(res);
  const data = (await res.json().catch(() => ({}))) as WebhookConfigResponse | ApiErrorBody;
  if (!res.ok) {
    const err = data as ApiErrorBody;
    const msg = err.error ?? `Erro HTTP ${res.status}`;
    const e = new Error(msg) as Error & { status: number; details?: unknown };
    e.status = res.status;
    e.details = err.details;
    throw e;
  }
  return data as WebhookConfigResponse;
}

export async function putWebhookConfigForInstance(
  instanceId: string,
  body: { url: string; enabled: boolean; regenerateSecret?: boolean }
): Promise<PutWebhookResponse> {
  const res = await fetch(apiUrl(`/api/v1/instances/${encodeURIComponent(instanceId)}/whatsapp/webhook`), {
    method: 'PUT',
    headers: authHeaders(true),
    body: JSON.stringify(body),
  });
  redirectLoginIfUnauthorized(res);
  const data = (await res.json().catch(() => ({}))) as PutWebhookResponse | ApiErrorBody;
  if (!res.ok) {
    const err = data as ApiErrorBody;
    const msg = err.error ?? `Erro HTTP ${res.status}`;
    const e = new Error(msg) as Error & { status: number; details?: unknown };
    e.status = res.status;
    e.details = err.details;
    throw e;
  }
  return data as PutWebhookResponse;
}

export async function postWebhookTestForInstance(instanceId: string): Promise<WebhookTestResponse> {
  const res = await fetch(apiUrl(`/api/v1/instances/${encodeURIComponent(instanceId)}/whatsapp/webhook/test`), {
    method: 'POST',
    headers: authHeaders(),
  });
  redirectLoginIfUnauthorized(res);
  const data = (await res.json().catch(() => ({}))) as WebhookTestResponse | ApiErrorBody;
  if (!res.ok) {
    const err = data as ApiErrorBody;
    const msg = err.error ?? `Erro HTTP ${res.status}`;
    const e = new Error(msg) as Error & { status: number; details?: unknown };
    e.status = res.status;
    e.details = err.details;
    throw e;
  }
  return data as WebhookTestResponse;
}

export async function sendCode(
  instanceId: string,
  body: SendCodeBody
): Promise<{ ok: boolean; message?: string }> {
  const res = await fetch(apiUrl(`/api/v1/auth/instances/${encodeURIComponent(instanceId)}/send-code`), {
    method: 'POST',
    headers: authHeaders(true),
    body: JSON.stringify(body),
  });
  redirectLoginIfUnauthorized(res);
  const data = (await res.json().catch(() => ({}))) as
    | ApiErrorBody
    | { ok?: boolean; message?: string };

  if (!res.ok) {
    const err = data as ApiErrorBody;
    const msg = err.error ?? `Erro HTTP ${res.status}`;
    const e = new Error(msg) as Error & { status: number; details?: unknown };
    e.status = res.status;
    e.details = err.details;
    throw e;
  }

  return data as { ok: boolean; message?: string };
}

export async function sendMedia(
  instanceId: string,
  body: SendMediaBody
): Promise<{ ok: boolean; message?: string }> {
  const form = new FormData();
  form.append('phoneNumber', body.phoneNumber);
  form.append('file', body.file);
  if (body.caption?.trim()) {
    form.append('caption', body.caption.trim());
  }

  const res = await fetch(apiUrl(`/api/v1/auth/instances/${encodeURIComponent(instanceId)}/send-media`), {
    method: 'POST',
    headers: authHeaders(),
    body: form,
  });
  redirectLoginIfUnauthorized(res);
  const data = (await res.json().catch(() => ({}))) as
    | ApiErrorBody
    | { ok?: boolean; message?: string };

  if (!res.ok) {
    const err = data as ApiErrorBody;
    const msg = err.error ?? `Erro HTTP ${res.status}`;
    const e = new Error(msg) as Error & { status: number; details?: unknown };
    e.status = res.status;
    e.details = err.details;
    throw e;
  }

  return data as { ok: boolean; message?: string };
}

export async function fetchMessages(instanceId: string, page = 1, limit = 20): Promise<MessagesResponse> {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  const res = await fetch(
    apiUrl(`/api/v1/instances/${encodeURIComponent(instanceId)}/messages?${params.toString()}`),
    {
    headers: authHeaders(),
    }
  );
  redirectLoginIfUnauthorized(res);
  const data = (await res.json().catch(() => ({}))) as MessagesResponse | ApiErrorBody;

  if (!res.ok) {
    const err = data as ApiErrorBody;
    const msg = err.error ?? `Erro HTTP ${res.status}`;
    const e = new Error(msg) as Error & { status: number; details?: unknown };
    e.status = res.status;
    e.details = err.details;
    throw e;
  }

  return data as MessagesResponse;
}

export async function deleteConversationMessagesForInstance(
  instanceId: string,
  jidOrPhone: string
): Promise<DeleteMessagesResponse> {
  const res = await fetch(
    apiUrl(
      `/api/v1/instances/${encodeURIComponent(instanceId)}/whatsapp/conversations/${encodeURIComponent(jidOrPhone)}/messages`
    ),
    {
      method: 'DELETE',
      headers: authHeaders(),
    }
  );
  redirectLoginIfUnauthorized(res);
  const data = (await res.json().catch(() => ({}))) as DeleteMessagesResponse | ApiErrorBody;
  if (!res.ok) {
    const err = data as ApiErrorBody;
    const msg = err.error ?? `Erro HTTP ${res.status}`;
    const e = new Error(msg) as Error & { status: number; details?: unknown };
    e.status = res.status;
    e.details = err.details;
    throw e;
  }
  return data as DeleteMessagesResponse;
}

export async function deleteAllMessagesForInstance(instanceId: string): Promise<DeleteMessagesResponse> {
  const res = await fetch(apiUrl(`/api/v1/instances/${encodeURIComponent(instanceId)}/messages`), {
    method: 'DELETE',
    headers: authHeaders(),
  });
  redirectLoginIfUnauthorized(res);
  const data = (await res.json().catch(() => ({}))) as DeleteMessagesResponse | ApiErrorBody;
  if (!res.ok) {
    const err = data as ApiErrorBody;
    const msg = err.error ?? `Erro HTTP ${res.status}`;
    const e = new Error(msg) as Error & { status: number; details?: unknown };
    e.status = res.status;
    e.details = err.details;
    throw e;
  }
  return data as DeleteMessagesResponse;
}

export async function listApiKeys(): Promise<ApiKeyListItem[]> {
  const res = await fetch(apiUrl('/api/v1/auth/api-keys'), { headers: authHeaders() });
  redirectLoginIfUnauthorized(res);
  const data = (await res.json().catch(() => ({}))) as { items?: ApiKeyListItem[] } | ApiErrorBody;
  if (!res.ok) {
    const err = data as ApiErrorBody;
    const msg = err.error ?? `Erro HTTP ${res.status}`;
    const e = new Error(msg) as Error & { status: number; details?: unknown };
    e.status = res.status;
    e.details = err.details;
    throw e;
  }
  return (data as { items: ApiKeyListItem[] }).items ?? [];
}

export async function createApiKey(name?: string): Promise<CreateApiKeyResponse> {
  const res = await fetch(apiUrl('/api/v1/auth/api-keys'), {
    method: 'POST',
    headers: authHeaders(true),
    body: JSON.stringify(name?.trim() ? { name: name.trim() } : {}),
  });
  redirectLoginIfUnauthorized(res);
  const data = (await res.json().catch(() => ({}))) as CreateApiKeyResponse | ApiErrorBody;
  if (!res.ok) {
    const err = data as ApiErrorBody;
    const msg = err.error ?? `Erro HTTP ${res.status}`;
    const e = new Error(msg) as Error & { status: number; details?: unknown };
    e.status = res.status;
    e.details = err.details;
    throw e;
  }
  return data as CreateApiKeyResponse;
}

export async function revokeApiKey(id: string): Promise<void> {
  const res = await fetch(apiUrl(`/api/v1/auth/api-keys/${encodeURIComponent(id)}`), {
    method: 'DELETE',
    headers: authHeaders(),
  });
  redirectLoginIfUnauthorized(res);
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as ApiErrorBody;
    const msg = data.error ?? `Erro HTTP ${res.status}`;
    const e = new Error(msg) as Error & { status: number; details?: unknown };
    e.status = res.status;
    e.details = data.details;
    throw e;
  }
}

export async function fetchApiRequestLogs(
  instanceId: string,
  page = 1,
  limit = 20
): Promise<ApiRequestLogsResponse> {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  const res = await fetch(
    apiUrl(`/api/v1/auth/instances/${encodeURIComponent(instanceId)}/api-request-logs?${params.toString()}`),
    {
    headers: authHeaders(),
    }
  );
  redirectLoginIfUnauthorized(res);
  const data = (await res.json().catch(() => ({}))) as ApiRequestLogsResponse | ApiErrorBody;

  if (!res.ok) {
    const err = data as ApiErrorBody;
    const msg = err.error ?? `Erro HTTP ${res.status}`;
    const e = new Error(msg) as Error & { status: number; details?: unknown };
    e.status = res.status;
    e.details = err.details;
    throw e;
  }

  return data as ApiRequestLogsResponse;
}

export async function listInstances(): Promise<WhatsAppInstance[]> {
  const res = await fetch(apiUrl('/api/v1/instances'), { headers: authHeaders() });
  redirectLoginIfUnauthorized(res);
  const data = (await res.json().catch(() => ({}))) as { items?: WhatsAppInstance[] } | ApiErrorBody;
  if (!res.ok) {
    const err = data as ApiErrorBody;
    const msg = err.error ?? `Erro HTTP ${res.status}`;
    const e = new Error(msg) as Error & { status: number; details?: unknown };
    e.status = res.status;
    e.details = err.details;
    throw e;
  }
  return (data as { items: WhatsAppInstance[] }).items ?? [];
}

export async function createInstance(name?: string): Promise<WhatsAppInstance> {
  const res = await fetch(apiUrl('/api/v1/instances'), {
    method: 'POST',
    headers: authHeaders(true),
    body: JSON.stringify(name?.trim() ? { name: name.trim() } : {}),
  });
  redirectLoginIfUnauthorized(res);
  const data = (await res.json().catch(() => ({}))) as WhatsAppInstance | ApiErrorBody;
  if (!res.ok) {
    const err = data as ApiErrorBody;
    const msg = err.error ?? `Erro HTTP ${res.status}`;
    const e = new Error(msg) as Error & { status: number; details?: unknown };
    e.status = res.status;
    e.details = err.details;
    throw e;
  }
  return data as WhatsAppInstance;
}

export async function deleteInstance(instanceId: string): Promise<{ ok: true }> {
  const res = await fetch(apiUrl(`/api/v1/instances/${encodeURIComponent(instanceId)}`), {
    method: 'DELETE',
    headers: authHeaders(),
  });
  redirectLoginIfUnauthorized(res);
  const data = (await res.json().catch(() => ({}))) as { ok?: true } | ApiErrorBody;
  if (!res.ok) {
    const err = data as ApiErrorBody;
    const msg = err.error ?? `Erro HTTP ${res.status}`;
    const e = new Error(msg) as Error & { status: number; details?: unknown };
    e.status = res.status;
    e.details = err.details;
    throw e;
  }
  return { ok: true };
}

export type ForgotPasswordResponse = {
  ok: true;
  message: string;
};

export async function requestPasswordReset(email: string): Promise<ForgotPasswordResponse> {
  const res = await fetch(apiUrl('/api/v1/auth/forgot-password'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim() }),
  });
  const data = (await res.json().catch(() => ({}))) as ForgotPasswordResponse | ApiErrorBody;
  if (!res.ok) {
    const err = data as ApiErrorBody;
    const e = new Error(err.error ?? `Erro HTTP ${res.status}`) as Error & {
      status: number;
      details?: unknown;
    };
    e.status = res.status;
    e.details = err.details;
    throw e;
  }
  return data as ForgotPasswordResponse;
}

export type ResetPasswordResponse = { ok: true; message: string };

export async function resetPasswordWithToken(
  token: string,
  password: string
): Promise<ResetPasswordResponse> {
  const res = await fetch(apiUrl('/api/v1/auth/reset-password'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, password }),
  });
  const data = (await res.json().catch(() => ({}))) as ResetPasswordResponse | ApiErrorBody;
  if (!res.ok) {
    const err = data as ApiErrorBody;
    const e = new Error(err.error ?? `Erro HTTP ${res.status}`) as Error & {
      status: number;
      details?: unknown;
    };
    e.status = res.status;
    e.details = err.details;
    throw e;
  }
  return data as ResetPasswordResponse;
}
