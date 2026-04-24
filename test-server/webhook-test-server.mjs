/**
 * Servidor mínimo para testar webhooks de mensagens.
 *
 * Uso:
 *   cd test-server && npm start
 *   (opcional) WEBHOOK_SECRET=... PORT=3847 npm start
 *
 * No painel, URL: http://localhost:3847/webhook
 * (em produção o backend exige HTTPS; em dev use http ou defina WEBHOOK_INSECURE_HTTP=1 no API.)
 */
import crypto from 'crypto';
import http from 'http';

const PORT = Number(process.env.PORT) || 3847;
const SECRET = (process.env.WEBHOOK_SECRET ?? '').trim();

function verifySignature(bodyUtf8, headerValue) {
  if (!SECRET) return { ok: true, reason: 'WEBHOOK_SECRET não definido — assinatura não verificada' };
  if (!headerValue || typeof headerValue !== 'string') {
    return { ok: false, reason: 'Cabeçalho X-Webhook-Signature em falta' };
  }
  const match = headerValue.match(/^sha256=([0-9a-f]+)$/i);
  if (!match) {
    return { ok: false, reason: 'Formato de assinatura inválido (esperado: sha256=<hex>)' };
  }
  const expected = crypto.createHmac('sha256', SECRET).update(bodyUtf8, 'utf8').digest('hex');
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(match[1], 'hex');
  if (a.length !== b.length) {
    return { ok: false, reason: 'Assinatura com comprimento inválido' };
  }
  const ok = crypto.timingSafeEqual(a, b);
  return { ok, reason: ok ? 'HMAC OK' : 'Assinatura não confere' };
}

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('ok');
    return;
  }

  if (req.method === 'GET' && (req.url === '/' || req.url === '')) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(
      `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Webhook test</title></head><body>
       <h1>WhatsAppConnect — servidor de teste</h1>
       <p>POST <code>/webhook</code> — recebe o JSON e valida <code>X-Webhook-Signature</code> se <code>WEBHOOK_SECRET</code> estiver definido.</p>
       <p>Health: <a href="/health">/health</a></p>
       </body></html>`
    );
    return;
  }

  if (req.method === 'POST' && req.url === '/webhook') {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const bodyBuf = Buffer.concat(chunks);
      const bodyUtf8 = bodyBuf.toString('utf8');
      const sig = req.headers['x-webhook-signature'];
      const { ok, reason } = verifySignature(bodyUtf8, sig);

      const ts = new Date().toISOString();
      console.log(`[${ts}] POST /webhook — ${reason}`);
      try {
        const json = JSON.parse(bodyUtf8);
        console.log(JSON.stringify(json, null, 2));
      } catch {
        console.log('(corpo não-JSON):', bodyUtf8.slice(0, 500));
      }

      res.writeHead(ok ? 200 : 401, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(
        JSON.stringify(
          { ok, message: reason, ts },
          null,
          0
        )
      );
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('not found');
});

server.listen(PORT, () => {
  const base = `http://localhost:${PORT}`;
  console.log(`Webhook test server em ${base}`);
  console.log(`  POST ${base}/webhook  (defina a mesma URL + segredo no painel ou aponte com ngrok se precisar de HTTPS)`);
  if (SECRET) {
    console.log('  WEBHOOK_SECRET: definido (HMAC ativo no receptor)');
  } else {
    console.log('  WEBHOOK_SECRET: vazio (só regista o corpo; defina o segredo do painel para validar HMAC)');
  }
});
