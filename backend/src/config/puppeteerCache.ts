import path from 'path';

/**
 * Mesmo diretório usado em `scripts/install-chrome.cjs` no postinstall.
 * Em produção no Render, o cache global (/opt/render/.cache/puppeteer) não acompanha o deploy.
 */
const defaultCacheDir = path.join(process.cwd(), '.puppeteer-cache');
if (!process.env.PUPPETEER_CACHE_DIR) {
  process.env.PUPPETEER_CACHE_DIR = defaultCacheDir;
}
