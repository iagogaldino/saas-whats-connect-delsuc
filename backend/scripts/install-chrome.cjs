/**
 * Instala o Chrome do Puppeteer em ./.puppeteer-cache (dentro do pacote).
 * Assim o binário entra no deploy (ex.: Render); o cache global /opt/render/.cache/puppeteer não.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.join(__dirname, '..');
const cacheDir = path.join(root, '.puppeteer-cache');
fs.mkdirSync(cacheDir, { recursive: true });

const env = { ...process.env, PUPPETEER_CACHE_DIR: cacheDir };
execSync('npx puppeteer browsers install chrome', {
  stdio: 'inherit',
  cwd: root,
  env,
});
