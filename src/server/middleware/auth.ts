import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { serverEnv } from '../config/env.ts';
import { store } from '../db/store.ts';
import type { InboxRecord, PublicUser, RoleType } from '../db/types.ts';

export const SESSION_COOKIE_NAME = 'cardmail_session';
export const CSRF_COOKIE_NAME = 'cardmail_csrf';

export interface AuthenticatedRequest extends Request {
  authUser?: PublicUser;
  authInbox?: InboxRecord;
  rawSessionToken?: string;
}

export function rateLimit(opts: { windowMs: number; max: number; keyPrefix: string }) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    // Compteur partagé en base : fiable même avec plusieurs instances serverless
    const count = await store.hitRateLimit(`${opts.keyPrefix}:${ip}`, opts.windowMs);
    if (count > opts.max) {
      await store.addAuditLog({
        action: 'AUTH_RATE_LIMITED',
        status: 'BLOCKED',
        ipAddress: ip,
        details: `Trop de tentatives sur ${opts.keyPrefix}`,
      });
      return res.status(429).json({ error: 'Trop de tentatives. Veuillez réessayer dans quelques minutes.' });
    }
    return next();
  };
}

export function issueSessionCookies(res: Response, rawSessionToken: string): string {
  const csrfToken = crypto.randomBytes(24).toString('hex');
  const cookieOpts = {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: serverEnv.isProd,
    path: '/',
    maxAge: 1000 * 60 * 60 * 24 * 7,
  };

  res.cookie(SESSION_COOKIE_NAME, rawSessionToken, cookieOpts);
  res.cookie(CSRF_COOKIE_NAME, csrfToken, {
    ...cookieOpts,
    httpOnly: false, // Lu par le client pour l'en-tête X-CSRF-Token (double-submit)
  });
  return csrfToken;
}

export function clearSessionCookies(res: Response): void {
  res.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
  res.clearCookie(CSRF_COOKIE_NAME, { path: '/' });
}

export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const token = req.cookies?.[SESSION_COOKIE_NAME];
  if (!token || typeof token !== 'string') {
    return res.status(401).json({ error: 'Authentification requise.' });
  }

  const verified = await store.verifySessionToken(token);
  if (!verified) {
    clearSessionCookies(res);
    return res.status(401).json({ error: 'Session expirée ou révoquée.' });
  }

  req.authUser = store.toPublicUser(verified.user);
  req.rawSessionToken = token;
  return next();
}

export function verifyCsrf(req: Request, res: Response, next: NextFunction) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }
  const cookieToken = req.cookies?.[CSRF_COOKIE_NAME];
  const headerToken = req.headers['x-csrf-token'];
  if (!cookieToken || !headerToken || typeof headerToken !== 'string') {
    return res.status(403).json({ error: 'Jeton CSRF manquant ou invalide.' });
  }
  const a = Buffer.from(cookieToken);
  const b = Buffer.from(headerToken);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res.status(403).json({ error: 'Validation CSRF échouée.' });
  }
  return next();
}

export function requireRole(allowedRoles: RoleType[]) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.authUser) {
      return res.status(401).json({ error: 'Authentification requise.' });
    }
    if (!allowedRoles.includes(req.authUser.role)) {
      await store.addAuditLog({
        actorUserId: req.authUser.id,
        actorEmail: req.authUser.email,
        action: 'RBAC_DENIED',
        status: 'BLOCKED',
        ipAddress: req.ip || null,
        details: `Accès refusé vers ${req.originalUrl} pour rôle ${req.authUser.role}`,
      });
      return res.status(403).json({ error: 'Permissions insuffisantes pour cette opération.' });
    }
    return next();
  };
}

/**
 * Contrôle strict d'isolation des boîtes :
 * Ne jamais faire confiance à un inboxId fourni par le navigateur sans vérifier
 * son association explicite dans UserInbox pour l'utilisateur authentifié.
 */
export async function requireInboxAccess(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.authUser) {
    return res.status(401).json({ error: 'Authentification requise.' });
  }
  const requestedInboxId =
    (req.params.inboxId as string | undefined) ||
    (req.query.inboxId as string | undefined) ||
    (req.body?.inboxId as string | undefined);

  if (!requestedInboxId) {
    const userInboxes = await store.getUserInboxes(req.authUser.id);
    const defaultInbox = userInboxes.find((i) => i.isDefault) || userInboxes[0];
    if (!defaultInbox) {
      return res.status(403).json({ error: 'Aucune boîte professionnelle n\'est associée à votre compte.' });
    }
    req.authInbox = defaultInbox;
    return next();
  }

  const authorizedInbox = await store.userHasInboxAccess(req.authUser.id, requestedInboxId);
  if (!authorizedInbox) {
    await store.addAuditLog({
      actorUserId: req.authUser.id,
      actorEmail: req.authUser.email,
      action: 'INBOX_ISOLATION_VIOLATION_ATTEMPT',
      targetType: 'Inbox',
      targetId: requestedInboxId,
      status: 'BLOCKED',
      ipAddress: req.ip || null,
      details: `Tentative d'accès non autorisée à la boîte ${requestedInboxId}`,
    });
    return res.status(403).json({ error: 'Accès interdit : cette boîte ne vous est pas attribuée.' });
  }

  req.authInbox = authorizedInbox;
  return next();
}
