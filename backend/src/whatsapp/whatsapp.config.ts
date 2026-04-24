import path from 'path';

export type ResolvedWhatsappEnv = {
  baseDataPath: string;
  /** Timeout de ligação Baileys / rede (`WWEBJS_AUTH_TIMEOUT_MS`, default 120s). */
  connectTimeoutMs: number;
};

const DEFAULT_CONNECT_TIMEOUT_MS = 120_000;

function parseConnectTimeout(): number {
  const raw = process.env.WWEBJS_AUTH_TIMEOUT_MS?.trim();
  if (!raw) return DEFAULT_CONNECT_TIMEOUT_MS;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_CONNECT_TIMEOUT_MS;
}

/**
 * Pasta base para estado Baileys (`WWEBJS_DATA_PATH`, default `./.wwebjs_auth`).
 */
export function resolveWhatsappPaths(): { baseDataPath: string } {
  const raw = process.env.WWEBJS_DATA_PATH?.trim();
  const baseDataPath = raw && raw.length > 0 ? raw : './.wwebjs_auth';
  return { baseDataPath };
}

export function loadWhatsappRuntimeConfig(): ResolvedWhatsappEnv {
  return {
    baseDataPath: resolveWhatsappPaths().baseDataPath,
    connectTimeoutMs: parseConnectTimeout(),
  };
}

/** Resolve `baseDataPath` relativo à raiz do backend. */
export function resolveBaseDataPathAbsolute(backendRoot: string, relativeOrAbsolute: string): string {
  return path.isAbsolute(relativeOrAbsolute)
    ? relativeOrAbsolute
    : path.resolve(backendRoot, relativeOrAbsolute);
}
