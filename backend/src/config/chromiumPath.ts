import fs from 'fs';
import path from 'path';

/** Caminhos típicos do Google Chrome no Windows. */
const WINDOWS_CHROME_CANDIDATES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
] as const;

function windowsChromeFromEnv(): string[] {
  const out: string[] = [];
  const pf = process.env.PROGRAMFILES;
  const pf86 = process.env['PROGRAMFILES(X86)'];
  if (pf) {
    out.push(path.join(pf, 'Google', 'Chrome', 'Application', 'chrome.exe'));
  }
  if (pf86) {
    out.push(path.join(pf86, 'Google', 'Chrome', 'Application', 'chrome.exe'));
  }
  return out;
}

const LINUX_CHROME_CANDIDATES = [
  '/usr/bin/google-chrome-stable',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
] as const;

const DARWIN_CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

function resolveSystemChrome(): string | undefined {
  if (process.platform === 'win32') {
    for (const p of [...WINDOWS_CHROME_CANDIDATES, ...windowsChromeFromEnv()]) {
      if (fs.existsSync(p)) {
        return p;
      }
    }
  }

  if (process.platform === 'linux') {
    for (const p of LINUX_CHROME_CANDIDATES) {
      if (fs.existsSync(p)) {
        return p;
      }
    }
  }

  if (process.platform === 'darwin' && fs.existsSync(DARWIN_CHROME)) {
    return DARWIN_CHROME;
  }

  return undefined;
}

/** Chrome baixado pelo pacote `puppeteer` (versão alinhada ao puppeteer-core — evita erros de CDP com Chrome do sistema). */
function tryPuppeteerBundledExecutable(): string | undefined {
  try {
    const { executablePath } = require('puppeteer') as { executablePath: () => string };
    const p = executablePath();
    if (typeof p === 'string' && p.length > 0 && fs.existsSync(p)) {
      return p;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

/**
 * Ordem: `PUPPETEER_EXECUTABLE_PATH` → Chrome do Puppeteer (`.puppeteer-cache`) → Chrome/Chromium do sistema.
 * Recomendado: rodar `node scripts/install-chrome.cjs` após `npm install` para o binário do Puppeteer existir.
 */
export function resolveBrowserExecutable(explicitFromEnv?: string): string | undefined {
  const trimmed = explicitFromEnv?.trim();
  if (trimmed) {
    if (fs.existsSync(trimmed)) {
      return trimmed;
    }
    return undefined;
  }

  const bundled = tryPuppeteerBundledExecutable();
  if (bundled) {
    return bundled;
  }

  return resolveSystemChrome();
}
