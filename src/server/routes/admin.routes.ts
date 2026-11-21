import { Router } from 'express';
import { z } from 'zod';
import { serverEnv } from '../config/env.ts';
import { store } from '../db/store.ts';
import {
  type AuthenticatedRequest,
  requireAuth,
  requireRole,
  verifyCsrf,
} from '../middleware/auth.ts';
import { resendService } from '../services/resend.service.ts';

const router = Router();
router.use(requireAuth);
router.use(requireRole(['ADMIN', 'SUPER_ADMIN']));

const createUserSchema = z.object({
  email: z.string().email('Adresse e-mail invalide'),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  password: z.string().min(10, 'Minimum 10 caractères'),
  role: z.enum(['SUPER_ADMIN', 'ADMIN', 'USER']),
  inboxId: z.string().optional(),
});

const updateUserSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  role: z.enum(['SUPER_ADMIN', 'ADMIN', 'USER']).optional(),
  isActive: z.boolean().optional(),
});

const resetPasswordSchema = z.object({
  newPassword: z.string().min(10, 'Minimum 10 caractères'),
});

const createInboxSchema = z.object({
  emailAddress: z
    .string()
    .email()
    .refine((v) => v.toLowerCase().endsWith('@cardit.cm'), {
      message: 'Seules les adresses du domaine @cardit.cm sont autorisées.',
    }),
  displayName: z.string().min(1).max(120),
  fromName: z.string().min(1).max(120),
});

const assignSchema = z.object({
  userId: z.string().min(1),
  inboxId: z.string().min(1),
  isDefault: z.boolean().optional(),
});

// Liste des utilisateurs et de leurs boîtes attribuées (sans jamais exposer les e-mails privés)
router.get('/users', async (_req, res) => {
  const users = await store.listUsers();
  const assignments = await store.listAllAssignments();
  const inboxes = await store.listInboxes();
  const inboxMap = new Map(inboxes.map((i) => [i.id, i]));

  const enriched = users.map((u) => ({
    ...u,
    inboxes: assignments
      .filter((a) => a.userId === u.id)
      .map((a) => {
        const inbox = inboxMap.get(a.inboxId);
        return inbox ? { id: inbox.id, emailAddress: inbox.emailAddress, displayName: inbox.displayName, isDefault: a.isDefault } : null;
      })
      .filter(Boolean),
  }));

  return res.json({ data: enriched });
});

router.post('/users', verifyCsrf, async (req: AuthenticatedRequest, res) => {
  const parsed = createUserSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Données invalides.' });
  }
  if (parsed.data.role === 'SUPER_ADMIN' && req.authUser!.role !== 'SUPER_ADMIN') {
    return res.status(403).json({ error: 'Seul un Super Administrateur peut créer un Super Administrateur.' });
  }

  try {
    const created = await store.createUser(parsed.data);
    if (parsed.data.inboxId) {
      await store.assignInboxToUser(created.id, parsed.data.inboxId, true);
    }
    await store.addAuditLog({
      actorUserId: req.authUser!.id,
      actorEmail: req.authUser!.email,
      action: 'ADMIN_USER_CREATED',
      targetType: 'User',
      targetId: created.id,
      status: 'SUCCESS',
      ipAddress: req.ip || null,
      details: `Création du compte ${created.email} (${created.role})`,
    });
    return res.status(201).json({ data: created });
  } catch (err: unknown) {
    return res.status(400).json({ error: err instanceof Error ? err.message : 'Erreur création utilisateur.' });
  }
});

router.patch('/users/:userId', verifyCsrf, async (req: AuthenticatedRequest, res) => {
  const parsed = updateUserSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Données invalides.' });
  }
  const targetId = String(req.params.userId);
  const existing = await store.findUserById(targetId);
  if (!existing) {
    return res.status(404).json({ error: 'Utilisateur introuvable.' });
  }
  if (
    (parsed.data.role === 'SUPER_ADMIN' || existing.role === 'SUPER_ADMIN') &&
    req.authUser!.role !== 'SUPER_ADMIN'
  ) {
    return res.status(403).json({ error: 'Action réservée au Super Administrateur.' });
  }
  if (targetId === req.authUser!.id && parsed.data.isActive === false) {
    return res.status(400).json({ error: 'Vous ne pouvez pas désactiver votre propre compte.' });
  }

  const updated = await store.updateUser(targetId, parsed.data);
  await store.addAuditLog({
    actorUserId: req.authUser!.id,
    actorEmail: req.authUser!.email,
    action: 'ADMIN_USER_UPDATED',
    targetType: 'User',
    targetId,
    status: 'SUCCESS',
    ipAddress: req.ip || null,
    details: JSON.stringify(parsed.data),
  });
  return res.json({ data: updated });
});

router.post('/users/:userId/reset-password', verifyCsrf, async (req: AuthenticatedRequest, res) => {
  const parsed = resetPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Mot de passe invalide.' });
  }
  const targetId = String(req.params.userId);
  const ok = await store.updateUserPassword(targetId, parsed.data.newPassword);
  if (!ok) {
    return res.status(404).json({ error: 'Utilisateur introuvable.' });
  }
  await store.addAuditLog({
    actorUserId: req.authUser!.id,
    actorEmail: req.authUser!.email,
    action: 'ADMIN_PASSWORD_RESET',
    targetType: 'User',
    targetId,
    status: 'SUCCESS',
    ipAddress: req.ip || null,
  });
  return res.json({ success: true });
});

// Boîtes Resend Inboxes
router.get('/inboxes', async (_req, res) => {
  return res.json({ data: await store.listInboxes() });
});

router.post('/inboxes', verifyCsrf, async (req: AuthenticatedRequest, res) => {
  const parsed = createInboxSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Données boîte invalides.' });
  }
  try {
    const remote = await resendService.createRemoteInbox({
      emailAddress: parsed.data.emailAddress,
      name: parsed.data.displayName,
      fromName: parsed.data.fromName,
    });
    const inbox = await store.upsertInbox({
      resendInboxId: remote.id,
      emailAddress: remote.emailAddress,
      displayName: parsed.data.displayName,
      fromName: parsed.data.fromName,
    });
    await store.addAuditLog({
      actorUserId: req.authUser!.id,
      actorEmail: req.authUser!.email,
      action: 'ADMIN_INBOX_CREATED',
      targetType: 'Inbox',
      targetId: inbox.id,
      status: 'SUCCESS',
      ipAddress: req.ip || null,
      details: inbox.emailAddress,
    });
    return res.status(201).json({ data: inbox });
  } catch (err: unknown) {
    return res.status(400).json({ error: err instanceof Error ? err.message : 'Échec création Resend Inbox.' });
  }
});

router.post('/inboxes/sync', verifyCsrf, async (req: AuthenticatedRequest, res) => {
  try {
    if (!resendService.isLiveConfigured()) {
      return res.json({
        synced: 0,
        mode: 'dev_sandbox',
        message: 'RESEND_API_KEY non configurée : synchronisation distante ignorée en bac à sable.',
      });
    }
    const remoteList = await resendService.listRemoteInboxes();
    for (const r of remoteList) {
      await store.upsertInbox({
        resendInboxId: r.id,
        emailAddress: r.emailAddress,
        displayName: r.name,
        fromName: r.fromName,
      });
    }
    await store.addAuditLog({
      actorUserId: req.authUser!.id,
      actorEmail: req.authUser!.email,
      action: 'ADMIN_INBOXES_SYNCED',
      status: 'SUCCESS',
      ipAddress: req.ip || null,
      details: `${remoteList.length} boîte(s) synchronisée(s) depuis Resend`,
    });
    return res.json({ synced: remoteList.length, data: await store.listInboxes() });
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Erreur synchronisation Resend.' });
  }
});

router.post('/assignments', verifyCsrf, async (req: AuthenticatedRequest, res) => {
  const parsed = assignSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Paramètres d\'association invalides.' });
  }
  const user = await store.findUserById(parsed.data.userId);
  const inbox = await store.getInboxById(parsed.data.inboxId);
  if (!user || !inbox) {
    return res.status(404).json({ error: 'Utilisateur ou boîte introuvable.' });
  }
  const link = await store.assignInboxToUser(user.id, inbox.id, Boolean(parsed.data.isDefault));
  await store.addAuditLog({
    actorUserId: req.authUser!.id,
    actorEmail: req.authUser!.email,
    action: 'ADMIN_INBOX_ASSIGNED',
    targetType: 'UserInbox',
    targetId: link.id,
    status: 'SUCCESS',
    ipAddress: req.ip || null,
    details: `${inbox.emailAddress} → ${user.email}`,
  });
  return res.json({ data: link });
});

router.delete('/assignments', verifyCsrf, async (req: AuthenticatedRequest, res) => {
  const userId = String(req.body?.userId || '');
  const inboxId = String(req.body?.inboxId || '');
  if (!userId || !inboxId) {
    return res.status(400).json({ error: 'userId et inboxId requis.' });
  }
  const removed = await store.unassignInboxFromUser(userId, inboxId);
  if (removed) {
    await store.addAuditLog({
      actorUserId: req.authUser!.id,
      actorEmail: req.authUser!.email,
      action: 'ADMIN_INBOX_UNASSIGNED',
      targetType: 'UserInbox',
      status: 'SUCCESS',
      ipAddress: req.ip || null,
      details: `Retrait boîte ${inboxId} de ${userId}`,
    });
  }
  return res.json({ success: removed });
});

// Journaux d'audit & état des services
router.get('/audit-logs', async (_req, res) => {
  return res.json({ data: await store.listAuditLogs(150) });
});

router.get('/service-status', async (_req, res) => {
  const inboxes = await store.listInboxes();
  const webhookEvents = await store.listWebhookEvents(50);
  const syncErrors = webhookEvents.filter((w) => w.status === 'FAILED');
  return res.json({
    data: {
      mailMode: resendService.getModeLabel(),
      resendConfigured: resendService.isLiveConfigured(),
      webhookSecretConfigured: Boolean(serverEnv.resendWebhookSecret),
      domain: 'cardit.cm',
      totalInboxes: inboxes.length,
      errorInboxes: inboxes.filter((i) => i.syncStatus === 'ERROR').length,
      recentWebhooks: webhookEvents.slice(0, 20),
      syncErrors,
    },
  });
});

export default router;
