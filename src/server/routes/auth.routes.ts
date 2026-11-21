import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { z } from 'zod';
import { serverEnv } from '../config/env.ts';
import { store } from '../db/store.ts';
import {
  type AuthenticatedRequest,
  clearSessionCookies,
  issueSessionCookies,
  rateLimit,
  requireAuth,
  verifyCsrf,
} from '../middleware/auth.ts';
import { resendService } from '../services/resend.service.ts';

const router = Router();

const loginSchema = z.object({
  email: z.string().email('Adresse e-mail invalide'),
  password: z.string().min(1, 'Mot de passe requis'),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(10, 'Le nouveau mot de passe doit contenir au moins 10 caractères'),
});

const resetRequestSchema = z.object({
  email: z.string().email(),
});

const resetConfirmSchema = z.object({
  token: z.string().min(16),
  newPassword: z.string().min(10),
});

router.post(
  '/login',
  rateLimit({ windowMs: 15 * 60 * 1000, max: 10, keyPrefix: 'login' }),
  async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Données invalides.' });
    }

    const email = parsed.data.email.trim().toLowerCase();
    const user = await store.findUserByEmail(email);
    const ip = req.ip || null;

    if (!user || !bcrypt.compareSync(parsed.data.password, user.passwordHash)) {
      await store.addAuditLog({
        actorEmail: email,
        action: 'AUTH_LOGIN_FAILED',
        status: 'FAILURE',
        ipAddress: ip,
        details: 'Identifiants incorrects',
      });
      return res.status(401).json({ error: 'Identifiants professionnels invalides.' });
    }

    if (!user.isActive) {
      await store.addAuditLog({
        actorUserId: user.id,
        actorEmail: user.email,
        action: 'AUTH_LOGIN_DISABLED',
        status: 'BLOCKED',
        ipAddress: ip,
        details: 'Tentative de connexion sur compte désactivé',
      });
      return res.status(403).json({ error: 'Ce compte collaborateur est désactivé. Contactez un administrateur.' });
    }

    const { rawToken } = await store.createSession(user.id, ip, req.headers['user-agent'] || null);
    const csrfToken = issueSessionCookies(res, rawToken);

    await store.addAuditLog({
      actorUserId: user.id,
      actorEmail: user.email,
      action: 'AUTH_LOGIN_SUCCESS',
      status: 'SUCCESS',
      ipAddress: ip,
      details: 'Connexion réussie',
    });

    const inboxes = await store.getUserInboxes(user.id);
    const preferences = await store.getPreference(user.id);

    return res.json({
      user: store.toPublicUser(user),
      inboxes,
      preferences,
      csrfToken,
      mailMode: resendService.getModeLabel(),
    });
  }
);

router.post('/logout', requireAuth, verifyCsrf, async (req: AuthenticatedRequest, res) => {
  if (req.rawSessionToken) {
    await store.revokeSessionByToken(req.rawSessionToken);
  }
  await store.addAuditLog({
    actorUserId: req.authUser!.id,
    actorEmail: req.authUser!.email,
    action: 'AUTH_LOGOUT',
    status: 'SUCCESS',
    ipAddress: req.ip || null,
  });
  clearSessionCookies(res);
  return res.json({ success: true });
});

router.get('/me', requireAuth, async (req: AuthenticatedRequest, res) => {
  const user = req.authUser!;
  const inboxes = await store.getUserInboxes(user.id);
  const preferences = await store.getPreference(user.id);
  return res.json({
    user,
    inboxes,
    preferences,
    mailMode: resendService.getModeLabel(),
    isProd: serverEnv.isProd,
  });
});

router.post('/change-password', requireAuth, verifyCsrf, async (req: AuthenticatedRequest, res) => {
  const parsed = changePasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Mot de passe invalide.' });
  }
  const fullUser = await store.findUserById(req.authUser!.id);
  if (!fullUser || !bcrypt.compareSync(parsed.data.currentPassword, fullUser.passwordHash)) {
    return res.status(400).json({ error: 'Mot de passe actuel incorrect.' });
  }
  await store.updateUserPassword(fullUser.id, parsed.data.newPassword);
  const { rawToken } = await store.createSession(fullUser.id, req.ip || null, req.headers['user-agent'] || null);
  issueSessionCookies(res, rawToken);
  await store.addAuditLog({
    actorUserId: fullUser.id,
    actorEmail: fullUser.email,
    action: 'AUTH_PASSWORD_CHANGED',
    status: 'SUCCESS',
    ipAddress: req.ip || null,
  });
  return res.json({ success: true });
});

router.post(
  '/reset-request',
  rateLimit({ windowMs: 15 * 60 * 1000, max: 5, keyPrefix: 'reset' }),
  async (req, res) => {
    const parsed = resetRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Adresse e-mail invalide.' });
    }
    const user = await store.findUserByEmail(parsed.data.email);
    let devPreviewToken: string | undefined;
    if (user && user.isActive) {
      const token = await store.createPasswordReset(user.id);
      await store.addAuditLog({
        actorUserId: user.id,
        actorEmail: user.email,
        action: 'AUTH_RESET_REQUESTED',
        status: 'SUCCESS',
        ipAddress: req.ip || null,
      });
      if (!serverEnv.isProd) {
        devPreviewToken = token;
      }
    }
    return res.json({
      message: 'Si un compte actif correspond à cette adresse, un jeton de réinitialisation a été émis.',
      ...(devPreviewToken ? { devResetToken: devPreviewToken } : {}),
    });
  }
);

router.post(
  '/reset-confirm',
  rateLimit({ windowMs: 15 * 60 * 1000, max: 8, keyPrefix: 'reset-confirm' }),
  async (req, res) => {
    const parsed = resetConfirmSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Jeton ou mot de passe invalide.' });
    }
    const updatedUser = await store.consumePasswordReset(parsed.data.token, parsed.data.newPassword);
    if (!updatedUser) {
      return res.status(400).json({ error: 'Jeton expiré ou invalide.' });
    }
    await store.addAuditLog({
      actorUserId: updatedUser.id,
      actorEmail: updatedUser.email,
      action: 'AUTH_PASSWORD_RESET_COMPLETED',
      status: 'SUCCESS',
      ipAddress: req.ip || null,
    });
    return res.json({ success: true });
  }
);

export default router;
