import { Router } from 'express';
import { serverEnv } from '../config/env.ts';
import { store } from '../db/store.ts';
import { pushService } from '../services/push.service.ts';
import { resendService } from '../services/resend.service.ts';

const router = Router();

/**
 * Récepteur webhook Resend (Svix).
 * Doit recevoir le corps brut (express.raw) pour valider la signature cryptographique.
 */
router.post('/resend', async (req, res) => {
  const rawBody = Buffer.isBuffer(req.body) ? req.body.toString('utf-8') : JSON.stringify(req.body || {});
  const svixId = String(req.headers['svix-id'] || '');
  const svixTimestamp = String(req.headers['svix-timestamp'] || '');
  const svixSignature = String(req.headers['svix-signature'] || '');

  if (!svixId) {
    return res.status(400).json({ error: 'En-tête svix-id manquant.' });
  }

  // Idempotence : ignorer proprement les événements déjà traités
  if (await store.hasWebhookEvent(svixId)) {
    return res.status(200).json({ received: true, deduplicated: true });
  }

  let event: { type: string; created_at?: string; data?: Record<string, unknown> };

  try {
    if (serverEnv.resendWebhookSecret) {
      event = resendService.verifyWebhook(rawBody, {
        id: svixId,
        timestamp: svixTimestamp,
        signature: svixSignature,
      }) as unknown as { type: string; created_at?: string; data?: Record<string, unknown> };
    } else if (!serverEnv.isProd) {
      event = JSON.parse(rawBody) as { type: string; created_at?: string; data?: Record<string, unknown> };
    } else {
      return res.status(401).json({ error: 'Signature webhook non vérifiable : RESEND_WEBHOOK_SECRET manquant.' });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Signature invalide';
    await store.recordWebhookEvent({
      svixId,
      eventType: 'signature_error',
      inboxId: null,
      status: 'FAILED',
      errorMessage: message,
      receivedAt: new Date().toISOString(),
    });
    return res.status(400).json({ error: 'Signature Svix invalide.' });
  }

  try {
    const data = event.data || {};
    const resendInboxId = typeof data.inbox_id === 'string' ? data.inbox_id : null;
    const threadId = typeof data.thread_id === 'string' ? data.thread_id : undefined;

    let localInbox = resendInboxId ? await store.getInboxByResendOrEmail(resendInboxId) : undefined;
    if (!localInbox && Array.isArray(data.to) && typeof data.to[0] === 'string') {
      localInbox = await store.getInboxByResendOrEmail(data.to[0]);
    }

    if (localInbox) {
      await store.updateInboxSyncStatus(localInbox.id, 'ACTIVE', null);

      if (event.type === 'inbox.email.received' || event.type === 'email.received') {
        const emailMeta = (data.email as Record<string, unknown> | undefined) || data;
        const sender = typeof emailMeta.from === 'string' ? emailMeta.from : 'Expéditeur externe';
        const subject = typeof emailMeta.subject === 'string' ? emailMeta.subject : '(Sans objet)';

        const ownerUserIds = await store.getUsersForInbox(localInbox.id);
        for (const uid of ownerUserIds) {
          await store.createNotification({
            userId: uid,
            inboxId: localInbox.id,
            threadId: threadId || null,
            title: `Nouveau courrier · ${sender}`,
            body: subject,
          });
          await pushService.sendToUser(uid, {
            title: `CARDMail (${localInbox.emailAddress})`,
            body: `${sender} — ${subject}`,
            url: '/',
            tag: threadId || svixId,
          });
        }

      }
    }

    await store.recordWebhookEvent({
      svixId,
      eventType: event.type,
      inboxId: localInbox?.id || resendInboxId,
      status: 'PROCESSED',
      errorMessage: null,
      receivedAt: new Date().toISOString(),
    });

    return res.status(200).json({ received: true });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : 'Erreur traitement webhook';
    await store.recordWebhookEvent({
      svixId,
      eventType: event.type || 'unknown',
      inboxId: null,
      status: 'FAILED',
      errorMessage: errMsg,
      receivedAt: new Date().toISOString(),
    });
    return res.status(500).json({ error: errMsg });
  }
});

export default router;
