import { Router } from 'express';
import { z } from 'zod';
import { store } from '../db/store.ts';
import { type AuthenticatedRequest, requireAuth, verifyCsrf } from '../middleware/auth.ts';
import { pushService } from '../services/push.service.ts';

const router = Router();
router.use(requireAuth);

router.get('/', async (req: AuthenticatedRequest, res) => {
  const notifications = await store.listNotifications(req.authUser!.id);
  return res.json({ data: notifications });
});

// Scrutation légère (remplace le WebSocket, incompatible avec les fonctions serverless)
router.get('/poll', async (req: AuthenticatedRequest, res) => {
  const since = typeof req.query.since === 'string' && !Number.isNaN(Date.parse(req.query.since)) ? req.query.since : new Date(Date.now() - 60_000).toISOString();
  const data = await store.listNotificationsSince(req.authUser!.id, since);
  res.setHeader('Cache-Control', 'no-store');
  return res.json({ data, now: new Date().toISOString() });
});

router.post('/read', verifyCsrf, async (req: AuthenticatedRequest, res) => {
  const notificationId = typeof req.body?.notificationId === 'string' ? req.body.notificationId : undefined;
  await store.markNotificationRead(req.authUser!.id, notificationId);
  return res.json({ success: true });
});

router.get('/push/vapid-key', async (_req, res) => {
  return res.json({ publicKey: pushService.getPublicKey() });
});

const subSchema = z.object({
  endpoint: z.string().url().max(1024),
  keys: z.object({
    p256dh: z.string().min(10),
    auth: z.string().min(8),
  }),
});

router.post('/push/subscribe', verifyCsrf, async (req: AuthenticatedRequest, res) => {
  const parsed = subSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Abonnement Web Push invalide.' });
  }
  const saved = await store.savePushSubscription(req.authUser!.id, {
    ...parsed.data,
    userAgent: req.headers['user-agent'] || null,
  });
  await store.updatePreference(req.authUser!.id, { pushEnabled: true });
  return res.json({ data: saved });
});

router.post('/push/unsubscribe', verifyCsrf, async (req: AuthenticatedRequest, res) => {
  const endpoint = typeof req.body?.endpoint === 'string' ? req.body.endpoint : '';
  if (endpoint) {
    await store.removePushSubscription(req.authUser!.id, endpoint);
  }
  await store.updatePreference(req.authUser!.id, { pushEnabled: false });
  return res.json({ success: true });
});

export default router;
