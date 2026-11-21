import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { neon } from '@neondatabase/serverless';
import { serverEnv } from '../config/env.ts';
import { schemaSql } from './schema.ts';
import type {
  AuditLogRecord, AuditStatus, ContactRecord, InboxRecord, NotificationRecord, PublicUser,
  PushSubscriptionRecord, RoleType, SessionRecord, UserInboxRecord, UserPreferenceRecord, UserRecord, WebhookEventRecord,
} from './types.ts';

type Row = Record<string, any>;
const iso = (v: unknown): string => (v instanceof Date ? v.toISOString() : v ? new Date(String(v)).toISOString() : '');
const isoOrNull = (v: unknown): string | null => (v ? iso(v) : null);
const rid = (prefix: string, n = 16) => `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, n)}`;
const hmac = (raw: string) => crypto.createHmac('sha256', serverEnv.authSecret).update(raw).digest('hex');

const toUser = (r: Row): UserRecord => ({
  id: r.id, email: r.email, firstName: r.first_name, lastName: r.last_name, passwordHash: r.password_hash,
  avatarUrl: r.avatar_url ?? null, role: r.role as RoleType, isActive: r.is_active, createdAt: iso(r.created_at), updatedAt: iso(r.updated_at),
});
const toInbox = (r: Row): InboxRecord => ({
  id: r.id, resendInboxId: r.resend_inbox_id, emailAddress: r.email_address, displayName: r.display_name, fromName: r.from_name,
  syncStatus: r.sync_status, lastSyncAt: isoOrNull(r.last_sync_at), lastError: r.last_error ?? null, createdAt: iso(r.created_at), updatedAt: iso(r.updated_at),
});
const toLink = (r: Row): UserInboxRecord => ({ id: r.id, userId: r.user_id, inboxId: r.inbox_id, isDefault: r.is_default, assignedAt: iso(r.assigned_at) });
const toContact = (r: Row): ContactRecord => ({
  id: r.id, userId: r.user_id, name: r.name, email: r.email, organization: r.organization ?? null, phone: r.phone ?? null,
  notes: r.notes ?? null, createdAt: iso(r.created_at), updatedAt: iso(r.updated_at),
});
const toPref = (r: Row): UserPreferenceRecord => ({
  userId: r.user_id, theme: r.theme, signatureHtml: r.signature_html, pushEnabled: r.push_enabled, compactDensity: r.compact_density, updatedAt: iso(r.updated_at),
});
const toNotif = (r: Row): NotificationRecord => ({
  id: r.id, userId: r.user_id, inboxId: r.inbox_id, threadId: r.thread_id ?? null, title: r.title, body: r.body, read: r.read, createdAt: iso(r.created_at),
});
const toAudit = (r: Row): AuditLogRecord => ({
  id: r.id, actorUserId: r.actor_user_id ?? null, actorEmail: r.actor_email ?? null, action: r.action, targetType: r.target_type ?? null,
  targetId: r.target_id ?? null, status: r.status as AuditStatus, ipAddress: r.ip_address ?? null, details: r.details ?? null, createdAt: iso(r.created_at),
});

const defaultSignature = (u: { firstName: string; lastName: string; email: string }) =>
  `<p><strong>${u.firstName} ${u.lastName}</strong><br/>CARDIT — Centre Africain de Recherche, Développement et Innovation Technologique<br/><span style="color:#1d4ed8;">${u.email}</span></p>`;

class CardMailStore {
  private sql: ReturnType<typeof neon> | null = null;
  private ready: Promise<void> | null = null;

  /** Garde de compatibilité : le schéma s'applique à la première requête. */
  public async init(): Promise<void> {
    if (!this.ready) this.ready = this.bootstrap().catch((e) => { this.ready = null; throw e; });
    return this.ready;
  }

  private client() {
    if (!this.sql) {
      if (!serverEnv.databaseUrl) throw new Error('DATABASE_URL manquante : connectez une base Neon au projet.');
      this.sql = neon(serverEnv.databaseUrl);
    }
    return this.sql;
  }

  private async q(text: string, params: unknown[] = []): Promise<Row[]> {
    await this.init();
    return (await this.client().query(text, params)) as Row[];
  }

  private async bootstrap(): Promise<void> {
    const sql = this.client();
    const statements = schemaSql.split(';').map((s: string) => s.trim()).filter(Boolean);
    await sql.transaction(statements.map((s: string) => sql.query(s)));
    const [{ n }] = (await sql.query('SELECT count(*)::int AS n FROM users')) as Row[];
    if (n === 0) {
      if (serverEnv.bootstrapAdminEmail && serverEnv.bootstrapAdminPassword) {
        await this.insertUser({ email: serverEnv.bootstrapAdminEmail, firstName: 'Administrateur', lastName: 'CARDIT', password: serverEnv.bootstrapAdminPassword, role: 'SUPER_ADMIN' }, sql);
      }
      if (serverEnv.seedDemo && !serverEnv.isProd) await this.seedDemo();
    }
  }

  private async seedDemo(): Promise<void> {
    const demo: Array<[string, string, string, string, string, RoleType, string, string, string]> = [
      ['usr_admin_cardit', 'admin@cardit.cm', 'Samuel', 'Admin', 'CarditAdmin!2026', 'SUPER_ADMIN', 'inb_admin', 'Administration Systèmes', 'Administration CARDIT'],
      ['usr_direction_cardit', 'direction@cardit.cm', 'Direction', 'Générale', 'CarditDir!2026', 'ADMIN', 'inb_direction', 'Direction Générale', 'Direction CARDIT'],
      ['usr_support_cardit', 'support@cardit.cm', 'Support', 'Technique', 'CarditSup!2026', 'USER', 'inb_support', 'Support Technique', 'Support CARDIT'],
      ['usr_contact_cardit', 'contact@cardit.cm', 'Relations', 'Accueil', 'CarditCon!2026', 'USER', 'inb_contact', 'Relations & Accueil', 'Contact CARDIT'],
    ];
    for (const [id, email, fn, ln, pw, role, inb, dn, from] of demo) {
      await this.client().query(
        `INSERT INTO users (id,email,first_name,last_name,password_hash,role) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING`,
        [id, email, fn, ln, bcrypt.hashSync(pw, 10), role]);
      await this.client().query(
        `INSERT INTO inboxes (id,resend_inbox_id,email_address,display_name,from_name) VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`, [inb, email, email, dn, from]);
      await this.client().query(
        `INSERT INTO user_inboxes (id,user_id,inbox_id,is_default) VALUES ($1,$2,$3,true) ON CONFLICT DO NOTHING`, [`ui_${inb}`, id, inb]);
    }
  }

  public toPublicUser(user: UserRecord): PublicUser { const { passwordHash: _pw, ...rest } = user; return rest; }

  // --- Utilisateurs ---
  public async findUserByEmail(email: string): Promise<UserRecord | undefined> {
    const r = await this.q('SELECT * FROM users WHERE email=$1', [email.trim().toLowerCase()]);
    return r[0] ? toUser(r[0]) : undefined;
  }
  public async findUserById(id: string): Promise<UserRecord | undefined> {
    const r = await this.q('SELECT * FROM users WHERE id=$1', [id]);
    return r[0] ? toUser(r[0]) : undefined;
  }
  public async listUsers(): Promise<PublicUser[]> {
    return (await this.q('SELECT * FROM users ORDER BY created_at')).map((r) => this.toPublicUser(toUser(r)));
  }
  private async insertUser(input: { email: string; firstName: string; lastName: string; password: string; role: RoleType; avatarUrl?: string | null }, sql = this.client()): Promise<PublicUser> {
    const email = input.email.trim().toLowerCase();
    const id = rid('usr');
    const rows = (await sql.query(
      `INSERT INTO users (id,email,first_name,last_name,password_hash,avatar_url,role) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (email) DO NOTHING RETURNING *`,
      [id, email, input.firstName.trim(), input.lastName.trim(), bcrypt.hashSync(input.password, 10), input.avatarUrl ?? null, input.role])) as Row[];
    if (!rows[0]) throw new Error('Un utilisateur avec cette adresse e-mail existe déjà.');
    const user = toUser(rows[0]);
    await sql.query('INSERT INTO preferences (user_id, signature_html) VALUES ($1,$2) ON CONFLICT DO NOTHING', [id, defaultSignature(user)]);
    return this.toPublicUser(user);
  }
  public async createUser(input: { email: string; firstName: string; lastName: string; password: string; role: RoleType; avatarUrl?: string | null }): Promise<PublicUser> {
    await this.init();
    return this.insertUser(input);
  }
  public async updateUser(id: string, patch: Partial<Pick<UserRecord, 'firstName' | 'lastName' | 'role' | 'isActive' | 'avatarUrl'>>): Promise<PublicUser | null> {
    const r = await this.q(
      `UPDATE users SET first_name=COALESCE($2,first_name), last_name=COALESCE($3,last_name), role=COALESCE($4,role),
       is_active=COALESCE($5,is_active), avatar_url=CASE WHEN $6 THEN $7 ELSE avatar_url END, updated_at=now() WHERE id=$1 RETURNING *`,
      [id, patch.firstName ?? null, patch.lastName ?? null, patch.role ?? null, patch.isActive ?? null, patch.avatarUrl !== undefined, patch.avatarUrl ?? null]);
    return r[0] ? this.toPublicUser(toUser(r[0])) : null;
  }
  public async updateUserPassword(id: string, newPassword: string): Promise<boolean> {
    const r = await this.q('UPDATE users SET password_hash=$2, updated_at=now() WHERE id=$1 RETURNING id', [id, bcrypt.hashSync(newPassword, 10)]);
    if (!r[0]) return false;
    await this.q('DELETE FROM sessions WHERE user_id=$1', [id]);
    return true;
  }

  // --- Sessions ---
  public async createSession(userId: string, ipAddress: string | null, userAgent: string | null): Promise<{ rawToken: string; session: SessionRecord }> {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const id = rid('ses');
    const r = await this.q(
      `INSERT INTO sessions (id,token_hash,user_id,ip_address,user_agent,expires_at) VALUES ($1,$2,$3,$4,$5, now() + interval '7 days') RETURNING *`,
      [id, hmac(rawToken), userId, ipAddress, userAgent]);
    void this.q('DELETE FROM sessions WHERE expires_at < now()').catch(() => {});
    const s = r[0];
    return { rawToken, session: { id, tokenHash: s.token_hash, userId, ipAddress, userAgent, expiresAt: iso(s.expires_at), createdAt: iso(s.created_at) } };
  }
  public async verifySessionToken(rawToken: string): Promise<{ session: SessionRecord; user: UserRecord } | null> {
    const r = await this.q(
      `SELECT s.id AS sid, s.token_hash, s.ip_address, s.user_agent, s.expires_at AS s_exp, s.created_at AS s_created, u.*
       FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at > now() AND u.is_active`, [hmac(rawToken)]);
    if (!r[0]) return null;
    const x = r[0];
    return {
      session: { id: x.sid, tokenHash: x.token_hash, userId: x.id, ipAddress: x.ip_address ?? null, userAgent: x.user_agent ?? null, expiresAt: iso(x.s_exp), createdAt: iso(x.s_created) },
      user: toUser(x),
    };
  }
  public async revokeSessionByToken(rawToken: string): Promise<void> { await this.q('DELETE FROM sessions WHERE token_hash=$1', [hmac(rawToken)]); }

  // --- Réinitialisation de mot de passe ---
  public async createPasswordReset(userId: string): Promise<string> {
    const raw = crypto.randomBytes(24).toString('hex');
    await this.q(`INSERT INTO password_resets (id,user_id,token_hash,expires_at) VALUES ($1,$2,$3, now() + interval '30 minutes')`, [rid('rst'), userId, hmac(raw)]);
    return raw;
  }
  public async consumePasswordReset(rawToken: string, newPassword: string): Promise<PublicUser | null> {
    const r = await this.q(
      `UPDATE password_resets SET used_at=now() WHERE token_hash=$1 AND used_at IS NULL AND expires_at > now() RETURNING user_id`, [hmac(rawToken)]);
    if (!r[0]) return null;
    await this.updateUserPassword(r[0].user_id, newPassword);
    const u = await this.findUserById(r[0].user_id);
    return u ? this.toPublicUser(u) : null;
  }

  // --- Boîtes ---
  public async listInboxes(): Promise<InboxRecord[]> { return (await this.q('SELECT * FROM inboxes ORDER BY created_at')).map(toInbox); }
  public async getInboxById(id: string): Promise<InboxRecord | undefined> {
    const r = await this.q('SELECT * FROM inboxes WHERE id=$1', [id]); return r[0] ? toInbox(r[0]) : undefined;
  }
  public async getInboxByResendOrEmail(idOrEmail: string): Promise<InboxRecord | undefined> {
    const r = await this.q('SELECT * FROM inboxes WHERE resend_inbox_id=$1 OR lower(email_address)=lower($1) OR id=$1 LIMIT 1', [idOrEmail]);
    return r[0] ? toInbox(r[0]) : undefined;
  }
  public async upsertInbox(input: { resendInboxId: string; emailAddress: string; displayName: string; fromName: string }): Promise<InboxRecord> {
    const email = input.emailAddress.trim().toLowerCase();
    const upd = await this.q(
      `UPDATE inboxes SET resend_inbox_id=$1, email_address=$2, display_name=$3, from_name=$4, updated_at=now()
       WHERE resend_inbox_id=$1 OR lower(email_address)=$2 RETURNING *`, [input.resendInboxId, email, input.displayName, input.fromName]);
    if (upd[0]) return toInbox(upd[0]);
    const r = await this.q(
      `INSERT INTO inboxes (id,resend_inbox_id,email_address,display_name,from_name,last_sync_at) VALUES ($1,$2,$3,$4,$5,now()) RETURNING *`,
      [rid('inb', 14), input.resendInboxId, email, input.displayName, input.fromName]);
    return toInbox(r[0]);
  }
  public async updateInboxSyncStatus(inboxId: string, status: 'ACTIVE' | 'ERROR' | 'PAUSED', errorMessage: string | null): Promise<void> {
    await this.q('UPDATE inboxes SET sync_status=$2, last_sync_at=now(), last_error=$3, updated_at=now() WHERE id=$1', [inboxId, status, errorMessage]);
  }
  public async getUserInboxes(userId: string): Promise<Array<InboxRecord & { isDefault: boolean; assignmentId: string }>> {
    const r = await this.q(
      `SELECT i.*, ui.is_default, ui.id AS assignment_id FROM user_inboxes ui JOIN inboxes i ON i.id=ui.inbox_id WHERE ui.user_id=$1 ORDER BY ui.assigned_at`, [userId]);
    return r.map((x) => ({ ...toInbox(x), isDefault: x.is_default, assignmentId: x.assignment_id }));
  }
  public async userHasInboxAccess(userId: string, inboxId: string): Promise<InboxRecord | null> {
    const r = await this.q('SELECT i.* FROM user_inboxes ui JOIN inboxes i ON i.id=ui.inbox_id WHERE ui.user_id=$1 AND ui.inbox_id=$2', [userId, inboxId]);
    return r[0] ? toInbox(r[0]) : null;
  }
  public async getUsersForInbox(inboxId: string): Promise<string[]> {
    return (await this.q('SELECT user_id FROM user_inboxes WHERE inbox_id=$1', [inboxId])).map((r) => r.user_id);
  }
  public async listAllAssignments(): Promise<UserInboxRecord[]> { return (await this.q('SELECT * FROM user_inboxes')).map(toLink); }
  public async assignInboxToUser(userId: string, inboxId: string, isDefault = false): Promise<UserInboxRecord> {
    const [{ n }] = await this.q('SELECT count(*)::int AS n FROM user_inboxes WHERE user_id=$1', [userId]);
    const makeDefault = isDefault || n === 0;
    if (makeDefault) await this.q('UPDATE user_inboxes SET is_default=false WHERE user_id=$1', [userId]);
    const r = await this.q(
      `INSERT INTO user_inboxes (id,user_id,inbox_id,is_default) VALUES ($1,$2,$3,$4)
       ON CONFLICT (user_id,inbox_id) DO UPDATE SET is_default = user_inboxes.is_default OR EXCLUDED.is_default RETURNING *`,
      [rid('ui', 14), userId, inboxId, makeDefault]);
    return toLink(r[0]);
  }
  public async unassignInboxFromUser(userId: string, inboxId: string): Promise<boolean> {
    return (await this.q('DELETE FROM user_inboxes WHERE user_id=$1 AND inbox_id=$2 RETURNING id', [userId, inboxId])).length > 0;
  }

  // --- Favoris ---
  public async listStarredThreadIds(userId: string, inboxId: string): Promise<string[]> {
    return (await this.q('SELECT thread_id FROM starred_threads WHERE user_id=$1 AND inbox_id=$2', [userId, inboxId])).map((r) => r.thread_id);
  }
  public async toggleStarredThread(userId: string, inboxId: string, threadId: string, starred: boolean): Promise<boolean> {
    if (starred) await this.q('INSERT INTO starred_threads (id,user_id,inbox_id,thread_id) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING', [rid('str', 12), userId, inboxId, threadId]);
    else await this.q('DELETE FROM starred_threads WHERE user_id=$1 AND inbox_id=$2 AND thread_id=$3', [userId, inboxId, threadId]);
    return starred;
  }

  // --- Contacts ---
  public async listContacts(userId: string): Promise<ContactRecord[]> {
    return (await this.q('SELECT * FROM contacts WHERE user_id=$1 ORDER BY lower(name)', [userId])).map(toContact);
  }
  public async createContact(userId: string, input: { name: string; email: string; organization?: string | null; phone?: string | null; notes?: string | null }): Promise<ContactRecord> {
    const r = await this.q(
      `INSERT INTO contacts (id,user_id,name,email,organization,phone,notes) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (user_id,email) DO NOTHING RETURNING *`,
      [rid('cnt', 14), userId, input.name.trim(), input.email.trim().toLowerCase(), input.organization?.trim() || null, input.phone?.trim() || null, input.notes?.trim() || null]);
    if (!r[0]) throw new Error("Ce contact existe déjà dans votre carnet d'adresses.");
    return toContact(r[0]);
  }
  public async updateContact(userId: string, contactId: string, patch: { name?: string; email?: string; organization?: string | null; phone?: string | null; notes?: string | null }): Promise<ContactRecord | null> {
    const cur = (await this.q('SELECT * FROM contacts WHERE id=$1 AND user_id=$2', [contactId, userId]))[0];
    if (!cur) return null;
    const c = toContact(cur);
    const r = await this.q(
      `UPDATE contacts SET name=$3,email=$4,organization=$5,phone=$6,notes=$7,updated_at=now() WHERE id=$1 AND user_id=$2 RETURNING *`,
      [contactId, userId, patch.name !== undefined ? patch.name.trim() : c.name, patch.email !== undefined ? patch.email.trim().toLowerCase() : c.email,
        patch.organization !== undefined ? patch.organization?.trim() || null : c.organization, patch.phone !== undefined ? patch.phone?.trim() || null : c.phone,
        patch.notes !== undefined ? patch.notes?.trim() || null : c.notes]);
    return toContact(r[0]);
  }
  public async deleteContact(userId: string, contactId: string): Promise<boolean> {
    return (await this.q('DELETE FROM contacts WHERE id=$1 AND user_id=$2 RETURNING id', [contactId, userId])).length > 0;
  }

  // --- Préférences ---
  public async getPreference(userId: string): Promise<UserPreferenceRecord> {
    const r = await this.q('SELECT * FROM preferences WHERE user_id=$1', [userId]);
    if (r[0]) return toPref(r[0]);
    const u = await this.findUserById(userId);
    const ins = await this.q('INSERT INTO preferences (user_id, signature_html) VALUES ($1,$2) ON CONFLICT (user_id) DO UPDATE SET user_id=EXCLUDED.user_id RETURNING *', [userId, u ? defaultSignature(u) : '']);
    return toPref(ins[0]);
  }
  public async updatePreference(userId: string, patch: Partial<Pick<UserPreferenceRecord, 'theme' | 'signatureHtml' | 'pushEnabled' | 'compactDensity'>>): Promise<UserPreferenceRecord> {
    const cur = await this.getPreference(userId);
    const n = { ...cur, ...patch };
    const r = await this.q(
      'UPDATE preferences SET theme=$2, signature_html=$3, push_enabled=$4, compact_density=$5, updated_at=now() WHERE user_id=$1 RETURNING *',
      [userId, n.theme, n.signatureHtml, n.pushEnabled, n.compactDensity]);
    return toPref(r[0]);
  }

  // --- Notifications ---
  public async listNotifications(userId: string): Promise<NotificationRecord[]> {
    return (await this.q('SELECT * FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50', [userId])).map(toNotif);
  }
  public async listNotificationsSince(userId: string, since: string): Promise<NotificationRecord[]> {
    return (await this.q('SELECT * FROM notifications WHERE user_id=$1 AND created_at > $2 ORDER BY created_at DESC LIMIT 50', [userId, since])).map(toNotif);
  }
  public async createNotification(input: { userId: string; inboxId: string; threadId?: string | null; title: string; body: string }): Promise<NotificationRecord> {
    const r = await this.q('INSERT INTO notifications (id,user_id,inbox_id,thread_id,title,body) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
      [rid('ntf', 14), input.userId, input.inboxId, input.threadId ?? null, input.title, input.body]);
    void this.q(`DELETE FROM notifications WHERE user_id=$1 AND created_at < now() - interval '60 days'`, [input.userId]).catch(() => {});
    return toNotif(r[0]);
  }
  public async markNotificationRead(userId: string, notificationId?: string): Promise<void> {
    await this.q('UPDATE notifications SET read=true WHERE user_id=$1 AND ($2::text IS NULL OR id=$2)', [userId, notificationId ?? null]);
  }

  // --- Web Push ---
  public async listPushSubscriptions(userId: string): Promise<PushSubscriptionRecord[]> {
    return (await this.q('SELECT * FROM push_subscriptions WHERE user_id=$1', [userId])).map((r) => ({
      id: r.id, userId: r.user_id, endpoint: r.endpoint, keys: { p256dh: r.p256dh, auth: r.auth }, userAgent: r.user_agent ?? null, createdAt: iso(r.created_at) }));
  }
  public async savePushSubscription(userId: string, sub: { endpoint: string; keys: { p256dh: string; auth: string }; userAgent?: string | null }): Promise<PushSubscriptionRecord> {
    const r = await this.q(
      `INSERT INTO push_subscriptions (id,user_id,endpoint,p256dh,auth,user_agent) VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (endpoint) DO UPDATE SET user_id=EXCLUDED.user_id, p256dh=EXCLUDED.p256dh, auth=EXCLUDED.auth RETURNING *`,
      [rid('psh', 14), userId, sub.endpoint, sub.keys.p256dh, sub.keys.auth, sub.userAgent ?? null]);
    const x = r[0];
    return { id: x.id, userId: x.user_id, endpoint: x.endpoint, keys: { p256dh: x.p256dh, auth: x.auth }, userAgent: x.user_agent ?? null, createdAt: iso(x.created_at) };
  }
  public async removePushSubscription(userId: string, endpoint: string): Promise<void> {
    await this.q('DELETE FROM push_subscriptions WHERE user_id=$1 AND endpoint=$2', [userId, endpoint]);
  }

  // --- Audit & webhooks ---
  public async addAuditLog(input: { actorUserId?: string | null; actorEmail?: string | null; action: string; targetType?: string | null; targetId?: string | null; status: AuditStatus; ipAddress?: string | null; details?: string | null }): Promise<void> {
    try {
      await this.q('INSERT INTO audit_logs (id,actor_user_id,actor_email,action,target_type,target_id,status,ip_address,details) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
        [rid('aud', 14), input.actorUserId ?? null, input.actorEmail ?? null, input.action, input.targetType ?? null, input.targetId ?? null, input.status, input.ipAddress ?? null, input.details ?? null]);
    } catch (e) { console.error('[CARDMail] audit log non écrit:', e); }
  }
  public async listAuditLogs(limit = 100): Promise<AuditLogRecord[]> {
    return (await this.q('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT $1', [limit])).map(toAudit);
  }
  public async hasWebhookEvent(svixId: string): Promise<boolean> {
    return (await this.q('SELECT 1 FROM webhook_events WHERE svix_id=$1', [svixId])).length > 0;
  }
  public async recordWebhookEvent(e: WebhookEventRecord): Promise<void> {
    await this.q('INSERT INTO webhook_events (svix_id,event_type,inbox_id,status,error_message,received_at) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING',
      [e.svixId, e.eventType, e.inboxId, e.status, e.errorMessage, e.receivedAt]);
  }
  public async listWebhookEvents(limit = 50): Promise<WebhookEventRecord[]> {
    return (await this.q('SELECT * FROM webhook_events ORDER BY received_at DESC LIMIT $1', [limit])).map((r) => ({
      svixId: r.svix_id, eventType: r.event_type, inboxId: r.inbox_id ?? null, status: r.status, errorMessage: r.error_message ?? null, receivedAt: iso(r.received_at) }));
  }

  // --- Limitation de débit (partagée entre instances serverless) ---
  public async hitRateLimit(key: string, windowMs: number): Promise<number> {
    const r = await this.q(
      `INSERT INTO rate_limits (key,count,reset_at) VALUES ($1,1, now() + ($2 || ' milliseconds')::interval)
       ON CONFLICT (key) DO UPDATE SET count = CASE WHEN rate_limits.reset_at <= now() THEN 1 ELSE rate_limits.count + 1 END,
         reset_at = CASE WHEN rate_limits.reset_at <= now() THEN now() + ($2 || ' milliseconds')::interval ELSE rate_limits.reset_at END
       RETURNING count`, [key, String(windowMs)]);
    return r[0].count as number;
  }
}

export const store = new CardMailStore();
