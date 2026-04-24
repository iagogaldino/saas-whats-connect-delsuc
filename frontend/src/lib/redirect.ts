/**
 * Caminho relativo interno pós-login (evita open redirect).
 */
export function getSafeRedirectPath(redirect: string | null, fallback = '/app'): string {
  if (!redirect) return fallback;
  const decoded = redirect.trim();
  if (!decoded.startsWith('/') || decoded.startsWith('//')) return fallback;
  return decoded;
}
