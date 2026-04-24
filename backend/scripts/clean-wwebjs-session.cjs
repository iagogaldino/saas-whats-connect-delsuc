/**
 * Remove sessões LocalAuth (perfil Chromium com IndexedDB do web.whatsapp.com), cache de HTML do WA Web
 * e pasta session-otp-service antiga.
 *
 * IMPORTANTE: pare o backend (npm run dev) e feche a janela do Chrome aberta pelo Puppeteer antes —
 * senão o Windows mantém ficheiros em uso (SingletonLock) e a limpeza fica incompleta → o mesmo
 * erro "A database error occurred on your browser" pode voltar.
 *
 * Respeita WWEBJS_DATA_PATH do .env (caminho relativo ao backend).
 */
const fs = require('fs');
const path = require('path');
const { setTimeout: delay } = require('timers/promises');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const backendRoot = path.join(__dirname, '..');
const raw = process.env.WWEBJS_DATA_PATH?.trim();
const dataPath = raw
  ? path.resolve(backendRoot, raw)
  : path.join(backendRoot, '.wwebjs_auth');

async function rmWithRetry(absPath, attempts = 10, waitMs = 1000) {
  for (let i = 0; i < attempts; i++) {
    try {
      if (!fs.existsSync(absPath)) {
        return;
      }
      fs.rmSync(absPath, { recursive: true, force: true });
      console.log('removido:', absPath);
      return;
    } catch (e) {
      const code = e && (e.code || e.errno);
      const msg = e instanceof Error ? e.message : String(e);
      if (i === attempts - 1) {
        console.error('');
        console.error('Falha ao apagar:', absPath);
        console.error(msg);
        console.error('');
        console.error('Dicas: pare o servidor (npm run dev), feche o Chrome aberto pelo Puppeteer e volte a correr: npm run clean:wwebjs');
        process.exit(1);
      }
      console.warn(`aguardando ${waitMs}ms (tentativa ${i + 1}/${attempts}) — ficheiros em uso?`, code || '');
      await delay(waitMs);
    }
  }
}

(async () => {
  console.log('A limpar dados de sessão WhatsApp (LocalAuth / perfil Chromium)…');
  console.log('pasta de dados:', dataPath);
  await rmWithRetry(dataPath);
  await rmWithRetry(path.join(backendRoot, '.wwebjs_cache'));
  await rmWithRetry(path.join(backendRoot, 'session-otp-service'));

  fs.mkdirSync(dataPath, { recursive: true });
  console.log('pasta vazia recriada:', dataPath);
  console.log('Limpeza concluída. Pode iniciar o backend e gerar o QR de novo.');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
