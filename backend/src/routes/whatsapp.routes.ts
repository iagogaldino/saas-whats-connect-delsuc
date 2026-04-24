import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth';
import { requireJwt } from '../middleware/requireJwt';
import { requireInstanceAccess } from '../middleware/requireInstanceAccess';
import type { IWhatsAppSessionService } from '../whatsapp';

export function createWhatsAppRouter(manager: IWhatsAppSessionService): Router {
  const router = Router({ mergeParams: true });
  router.use(requireAuth, requireInstanceAccess);

  router.post('/pairing/start', (req, res) => {
    const userId = req.user!.id;
    const instanceId = req.instance!.id;
    if (manager.isReady(userId, instanceId)) {
      res.status(200).json({ ok: true, alreadyConnected: true });
      return;
    }
    manager.startPairing(userId, instanceId);
    res.status(202).json({ ok: true, alreadyConnected: false });
  });

  router.get('/status', (req, res) => {
    const userId = req.user!.id;
    const instanceId = req.instance!.id;
    // Após restart do servidor, reidrata a sessão do usuário em background
    // usando as credenciais persistidas em disco (quando válidas).
    manager.startPairing(userId, instanceId);
    res.json({
      whatsappReady: manager.isReady(userId, instanceId),
      pairingPending: manager.isPairingPending(userId, instanceId),
    });
  });

  router.get('/qr', (req, res) => {
    const userId = req.user!.id;
    const instanceId = req.instance!.id;
    res.json({ qr: manager.getQr(userId, instanceId) });
  });

  router.post('/logout', async (req, res, next) => {
    try {
      const userId = req.user!.id;
      const instanceId = req.instance!.id;
      await manager.destroySession(userId, instanceId);
      res.status(200).json({ ok: true });
    } catch (e) {
      next(e);
    }
  });

  router.get('/listening/status', requireJwt, async (req, res, next) => {
    try {
      const userId = req.user!.id;
      const instanceId = req.instance!.id;
      res.json(await manager.getListeningStatus(userId, instanceId));
    } catch (e) {
      next(e);
    }
  });

  router.post('/listening/start', requireJwt, async (req, res, next) => {
    try {
      const userId = req.user!.id;
      const instanceId = req.instance!.id;
      res.status(200).json(await manager.setListeningEnabled(userId, instanceId, true));
    } catch (e) {
      next(e);
    }
  });

  router.post('/listening/stop', requireJwt, async (req, res, next) => {
    try {
      const userId = req.user!.id;
      const instanceId = req.instance!.id;
      res.status(200).json(await manager.setListeningEnabled(userId, instanceId, false));
    } catch (e) {
      next(e);
    }
  });

  return router;
}
