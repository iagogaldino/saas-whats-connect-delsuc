const STORAGE_KEY = 'whatsapp_otp_api_base';

/**
 * URL da API em produção quando não há VITE_API_BASE_URL no build (ex.: esqueceu o .env.production).
 * Sobrescrita por VITE_API_BASE_URL ou pela Base URL salva no painel (localStorage).
 */
const DEFAULT_PROD_API_BASE = 'https://saas-whatsapp-api.onrender.com';

/** localhost / 127.0.0.1 salvos no dev não podem ser usados no bundle de produção (Failed to fetch). */
function isLocalDevHost(url: string): boolean {
  try {
    const normalized = url.includes('://') ? url : `https://${url}`;
    const h = new URL(normalized).hostname;
    return h === 'localhost' || h === '127.0.0.1';
  } catch {
    return false;
  }
}

function normalizeBase(url: string): string {
  return url.trim().replace(/\/$/, '');
}

/** Base URL sem barra final, ou string vazia para usar o proxy do Vite (mesma origem). */
export function getStoredApiBase(): string {
  if (typeof window === 'undefined') return '';
  const raw = window.localStorage.getItem(STORAGE_KEY);
  let fromStorage = raw?.trim() ?? '';

  // Em produção, ignorar Base URL antiga apontando para máquina local (evita "Failed to fetch").
  if (fromStorage !== '' && import.meta.env.PROD && isLocalDevHost(fromStorage)) {
    fromStorage = '';
  }

  // Só sobrescreve o env se o usuário definiu uma base não vazia no painel.
  // Valor vazio no storage não pode mascarar VITE_API_BASE_URL do build de produção.
  if (fromStorage !== '') {
    return normalizeBase(fromStorage);
  }
  const fromEnv = import.meta.env.VITE_API_BASE_URL?.trim();
  if (fromEnv) return normalizeBase(fromEnv);
  // Build de produção / preview: sem env, evita /api relativo no localhost:4173.
  if (import.meta.env.PROD) {
    return normalizeBase(DEFAULT_PROD_API_BASE);
  }
  return '';
}

export function setStoredApiBase(url: string): void {
  window.localStorage.setItem(STORAGE_KEY, url.trim());
}

export function apiUrl(path: string): string {
  const base = getStoredApiBase();
  const p = path.startsWith('/') ? path : `/${path}`;
  if (!base) return p;
  return `${base}${p}`;
}

/** Base URL para textos de ajuda (ex.: docs); fallback local quando não há env nem proxy preenchido. */
export function getApiBaseDisplay(): string {
  const b = getStoredApiBase();
  return b || 'http://localhost:3001';
}
