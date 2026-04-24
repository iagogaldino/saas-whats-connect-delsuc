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

export type QrResponse = {
  qr: string | null;
};

export type ListeningStatusResponse = {
  enabled: boolean;
  connectedClients: number;
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
  phoneNumber: string;
  message: string;
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

function redirectLoginIfUnauthorized(res: Response): void {
  if (res.status === 401 && typeof window !== 'undefined') {
    clearToken();
    if (!window.location.pathname.startsWith('/login')) {
      window.location.assign('/login');
    }
  }
}

export async function fetchHealth(): Promise<HealthResponse> {
  const res = await fetch(apiUrl('/health'), { cache: 'no-store' });
  const data = (await res.json()) as HealthResponse;
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return data;
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
