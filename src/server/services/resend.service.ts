import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Resend } from 'resend';
import { serverEnv } from '../config/env.ts';

export type MailFolder = 'inbox' | 'archive' | 'spam' | 'sent' | 'trash';
export type MovableFolder = 'inbox' | 'archive' | 'spam' | 'trash';

export interface UnifiedAttachment {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  contentBase64?: string;
}

export interface UnifiedMessage {
  id: string;
  direction: 'inbound' | 'outbound';
  from: string;
  to: string[];
  cc: string[];
  bcc: string[];
  replyTo: string[];
  subject: string;
  html: string | null;
  text: string | null;
  attachments: UnifiedAttachment[];
  read: boolean;
  receivedAt: string;
}

export interface UnifiedThread {
  id: string;
  inboxId: string;
  subject: string;
  snippet: string;
  from: string;
  to: string[];
  cc: string[];
  bcc: string[];
  emailCount: number;
  hasAttachment: boolean;
  hasDraft: boolean;
  read: boolean;
  receivedAt: string;
  folder: MailFolder;
  labels: Array<{ id: string; name: string; color: string }>;
}

export interface UnifiedDraft {
  id: string;
  inboxId: string;
  type: 'standalone' | 'reply';
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  snippet: string;
  html: string | null;
  text: string | null;
  threadId: string | null;
  replyToEmailId: string | null;
  updatedAt: string;
  attachments: UnifiedAttachment[];
}

export interface ResendAttachmentInput {
  filename: string;
  content: string; // base64
  contentType: string;
}

interface DevSandboxData {
  threads: Array<UnifiedThread & { messages: UnifiedMessage[] }>;
  drafts: UnifiedDraft[];
}

const SANDBOX_FILE = path.resolve(process.cwd(), '.data', 'dev-mail-sandbox.json');

function stripHtmlToSnippet(html?: string | null, text?: string | null): string {
  const source = (text && text.trim()) || (html ? html.replace(/<[^>]+>/g, ' ') : '');
  return source.replace(/\s+/g, ' ').trim().slice(0, 140);
}

class DevSandboxMailStore {
  private data: DevSandboxData = { threads: [], drafts: [] };
  private initialized = false;

  private ensureInit(): void {
    if (this.initialized) return;
    this.initialized = true;
    try {
      if (fs.existsSync(SANDBOX_FILE)) {
        this.data = JSON.parse(fs.readFileSync(SANDBOX_FILE, 'utf-8')) as DevSandboxData;
        return;
      }
    } catch {
      // ignore corrupt dev file
    }
    this.seed();
  }

  private persist(): void {
    try {
      fs.mkdirSync(path.dirname(SANDBOX_FILE), { recursive: true });
      fs.writeFileSync(SANDBOX_FILE, JSON.stringify(this.data, null, 2));
    } catch {
      // ignore in read-only env
    }
  }

  private seed(): void {
    const now = Date.now();
    const iso = (minsAgo: number) => new Date(now - minsAgo * 60_000).toISOString();

    this.data = {
      threads: [
        {
          id: 'thr_dir_01',
          inboxId: 'direction@cardit.cm',
          subject: 'Validation du programme Recherche IA & Énergie 2027',
          snippet: 'Bonjour Amélie, veuillez trouver ci-joint la note de cadrage pour le consortium Yaoundé-Dakar.',
          from: 'Pr. Alain Fogue <a.fogue@polytechnique-cm.org>',
          to: ['direction@cardit.cm'],
          cc: ['admin@cardit.cm'],
          bcc: [],
          emailCount: 2,
          hasAttachment: true,
          hasDraft: false,
          read: false,
          receivedAt: iso(22),
          folder: 'inbox',
          labels: [{ id: 'lbl_1', name: 'Conseil Scientifique', color: '#0D9488' }],
          messages: [
            {
              id: 'msg_dir_01a',
              direction: 'inbound',
              from: 'Pr. Alain Fogue <a.fogue@polytechnique-cm.org>',
              to: ['direction@cardit.cm'],
              cc: ['admin@cardit.cm'],
              bcc: [],
              replyTo: [],
              subject: 'Validation du programme Recherche IA & Énergie 2027',
              html: '<p>Bonjour Amélie,</p><p>Le comité scientifique a finalisé la feuille de route pour les laboratoires solaires intelligents de <strong>CARDIT</strong>.</p><p>Pouvez-vous confirmer la disponibilité de l\'équipe technique jeudi à 10h00 ?</p><p>Cordialement,<br/>Pr. Alain Fogue</p>',
              text: 'Bonjour Amélie, Le comité scientifique a finalisé la feuille de route...',
              attachments: [
                {
                  id: 'att_dir_01',
                  filename: 'Note_Cadrage_CARDIT_2027.txt',
                  contentType: 'text/plain',
                  size: 184,
                  contentBase64: Buffer.from('CARDIT — Note de cadrage Programme IA & Énergie 2027\n1. Micro-réseaux intelligents\n2. Capteurs IoT faible consommation\n3. Déploiement pilote Yaoundé & Douala.\n', 'utf-8').toString('base64'),
                },
              ],
              read: false,
              receivedAt: iso(95),
            },
            {
              id: 'msg_dir_01b',
              direction: 'inbound',
              from: 'Pr. Alain Fogue <a.fogue@polytechnique-cm.org>',
              to: ['direction@cardit.cm'],
              cc: [],
              bcc: [],
              replyTo: [],
              subject: 'Validation du programme Recherche IA & Énergie 2027',
              html: '<p>Je précise que les représentants du ministère souhaitent également recevoir le résumé budgétaire avant vendredi.</p>',
              text: 'Je précise que les représentants du ministère souhaitent également recevoir le résumé budgétaire avant vendredi.',
              attachments: [],
              read: false,
              receivedAt: iso(22),
            },
          ],
        },
        {
          id: 'thr_dir_02',
          inboxId: 'direction@cardit.cm',
          subject: 'Partenariat Infrastructure Cloud Souverain — Afrique Centrale',
          snippet: 'Nous confirmons l\'allocation des 4 baies de calcul GPU pour le pôle modélisation CARDIT.',
          from: 'Célestine Nguema <c.nguema@africadata-hub.org>',
          to: ['direction@cardit.cm'],
          cc: [],
          bcc: [],
          emailCount: 1,
          hasAttachment: false,
          hasDraft: false,
          read: true,
          receivedAt: iso(310),
          folder: 'inbox',
          labels: [],
          messages: [
            {
              id: 'msg_dir_02a',
              direction: 'inbound',
              from: 'Célestine Nguema <c.nguema@africadata-hub.org>',
              to: ['direction@cardit.cm'],
              cc: [],
              bcc: [],
              replyTo: [],
              subject: 'Partenariat Infrastructure Cloud Souverain — Afrique Centrale',
              html: '<p>Bonjour Madame la Directrice,</p><p>Nous confirmons l\'allocation des 4 baies de calcul GPU dédiées au pôle recherche de CARDIT à compter du 1er décembre.</p><p>Bien cordialement,<br/>Célestine Nguema</p>',
              text: 'Nous confirmons l\'allocation des 4 baies de calcul GPU...',
              attachments: [],
              read: true,
              receivedAt: iso(310),
            },
          ],
        },
        {
          id: 'thr_dir_03',
          inboxId: 'direction@cardit.cm',
          subject: 'Note interne : Déploiement de CARDMail sur Resend Inboxes',
          snippet: 'Tous les comptes @cardit.cm sont désormais cloisonnés avec signature DKIM et webhooks Svix.',
          from: 'Samuel Nkoulou <admin@cardit.cm>',
          to: ['direction@cardit.cm'],
          cc: [],
          bcc: [],
          emailCount: 1,
          hasAttachment: false,
          hasDraft: false,
          read: true,
          receivedAt: iso(1440),
          folder: 'sent',
          labels: [],
          messages: [
            {
              id: 'msg_dir_03a',
              direction: 'outbound',
              from: 'direction@cardit.cm',
              to: ['admin@cardit.cm'],
              cc: [],
              bcc: [],
              replyTo: [],
              subject: 'Note interne : Déploiement de CARDMail sur Resend Inboxes',
              html: '<p>Bonjour Samuel,</p><p>Merci de finaliser le rattachement des boîtes support@cardit.cm et commercial@cardit.cm avant le comité de lundi.</p>',
              text: 'Bonjour Samuel, Merci de finaliser le rattachement des boîtes...',
              attachments: [],
              read: true,
              receivedAt: iso(1440),
            },
          ],
        },
        {
          id: 'thr_sup_01',
          inboxId: 'support@cardit.cm',
          subject: 'Ticket #4812 — Accès API télémétrie station météo Douala',
          snippet: 'Bonjour l\'équipe support, le certificat TLS du capteur #14 expire demain.',
          from: 'Olivier Kamga <o.kamga@agro-cam.cm>',
          to: ['support@cardit.cm'],
          cc: [],
          bcc: [],
          emailCount: 1,
          hasAttachment: false,
          hasDraft: false,
          read: false,
          receivedAt: iso(15),
          folder: 'inbox',
          labels: [{ id: 'lbl_sup_1', name: 'Prioritaire', color: '#D97706' }],
          messages: [
            {
              id: 'msg_sup_01a',
              direction: 'inbound',
              from: 'Olivier Kamga <o.kamga@agro-cam.cm>',
              to: ['support@cardit.cm'],
              cc: [],
              bcc: [],
              replyTo: [],
              subject: 'Ticket #4812 — Accès API télémétrie station météo Douala',
              html: '<p>Bonjour l\'équipe support CARDIT,</p><p>Le certificat TLS de notre station IoT #14 expire demain matin. Pouvez-vous renouveler le jeton d\'ingestion ?</p>',
              text: 'Le certificat TLS de notre station IoT #14 expire demain matin.',
              attachments: [],
              read: false,
              receivedAt: iso(15),
            },
          ],
        },
        {
          id: 'thr_adm_01',
          inboxId: 'admin@cardit.cm',
          subject: 'Rapport hebdomadaire DMARC & délivrabilité cardit.cm',
          snippet: 'Taux d\'alignement SPF/DKIM : 100 % sur 1 428 messages expédiés.',
          from: 'postmaster@cardit.cm',
          to: ['admin@cardit.cm'],
          cc: [],
          bcc: [],
          emailCount: 1,
          hasAttachment: false,
          hasDraft: false,
          read: false,
          receivedAt: iso(45),
          folder: 'inbox',
          labels: [],
          messages: [
            {
              id: 'msg_adm_01a',
              direction: 'inbound',
              from: 'postmaster@cardit.cm',
              to: ['admin@cardit.cm'],
              cc: [],
              bcc: [],
              replyTo: [],
              subject: 'Rapport hebdomadaire DMARC & délivrabilité cardit.cm',
              html: '<p>Synthèse hebdomadaire du domaine <strong>cardit.cm</strong> :</p><ul><li>Alignement SPF : 100%</li><li>Signature DKIM Resend : 100%</li><li>Rejets : 0</li></ul>',
              text: 'Synthèse hebdomadaire du domaine cardit.cm : Alignement SPF 100%, DKIM 100%.',
              attachments: [],
              read: false,
              receivedAt: iso(45),
            },
          ],
        },
      ],
      drafts: [
        {
          id: 'drf_dir_01',
          inboxId: 'direction@cardit.cm',
          type: 'standalone',
          to: ['a.fogue@polytechnique-cm.org'],
          cc: [],
          bcc: [],
          subject: 'Ordre du jour — Réunion de lancement Programme 2027',
          snippet: 'Bonjour Professeur, voici les 4 points proposés pour notre réunion de jeudi...',
          html: '<p>Bonjour Professeur,</p><p>Voici les 4 points proposés pour notre réunion de jeudi à 10h00.</p>',
          text: 'Bonjour Professeur, voici les 4 points proposés pour notre réunion de jeudi à 10h00.',
          threadId: null,
          replyToEmailId: null,
          updatedAt: iso(180),
          attachments: [],
        },
      ],
    };
    this.persist();
  }

  public listThreads(inboxEmail: string, opts: { folder?: MailFolder; query?: string; unreadOnly?: boolean; hasAttachment?: boolean; limit?: number; offset?: number }) {
    this.ensureInit();
    let list = this.data.threads.filter((t) => t.inboxId.toLowerCase() === inboxEmail.toLowerCase());
    if (opts.folder) {
      list = list.filter((t) => t.folder === opts.folder);
    }
    if (opts.unreadOnly) {
      list = list.filter((t) => !t.read);
    }
    if (opts.hasAttachment) {
      list = list.filter((t) => t.hasAttachment);
    }
    if (opts.query) {
      const q = opts.query.toLowerCase();
      list = list.filter(
        (t) =>
          t.subject.toLowerCase().includes(q) ||
          t.from.toLowerCase().includes(q) ||
          t.snippet.toLowerCase().includes(q) ||
          t.messages.some((m) => (m.text || '').toLowerCase().includes(q))
      );
    }
    list.sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
    const offset = opts.offset || 0;
    const limit = opts.limit || 20;
    const slice = list.slice(offset, offset + limit);
    return {
      data: slice.map(({ messages: _m, ...thread }) => thread),
      hasMore: offset + limit < list.length,
      total: list.length,
    };
  }

  public getThreadWithMessages(inboxEmail: string, threadId: string) {
    this.ensureInit();
    const thr = this.data.threads.find(
      (t) => t.id === threadId && t.inboxId.toLowerCase() === inboxEmail.toLowerCase()
    );
    if (!thr) return null;
    const { messages, ...thread } = thr;
    return { thread, messages };
  }

  public updateThread(inboxEmail: string, threadId: string, patch: { read?: boolean; folder?: MovableFolder }) {
    this.ensureInit();
    const thr = this.data.threads.find(
      (t) => t.id === threadId && t.inboxId.toLowerCase() === inboxEmail.toLowerCase()
    );
    if (!thr) return null;
    if (patch.read !== undefined) {
      thr.read = patch.read;
      for (const m of thr.messages) m.read = patch.read;
    }
    if (patch.folder !== undefined) {
      thr.folder = patch.folder;
    }
    this.persist();
    const { messages: _m, ...thread } = thr;
    return thread;
  }

  public deleteThread(inboxEmail: string, threadId: string): boolean {
    this.ensureInit();
    const before = this.data.threads.length;
    this.data.threads = this.data.threads.filter(
      (t) => !(t.id === threadId && t.inboxId.toLowerCase() === inboxEmail.toLowerCase())
    );
    this.persist();
    return this.data.threads.length < before;
  }

  public reply(inboxEmail: string, threadId: string, emailId: string, payload: { html?: string; text?: string; cc?: string[]; bcc?: string[]; subject?: string; replyAll?: boolean; attachments?: ResendAttachmentInput[] }) {
    this.ensureInit();
    const thr = this.data.threads.find(
      (t) => t.id === threadId && t.inboxId.toLowerCase() === inboxEmail.toLowerCase()
    );
    if (!thr) throw new Error('Conversation introuvable.');
    const target = thr.messages.find((m) => m.id === emailId) || thr.messages[thr.messages.length - 1];
    const now = new Date().toISOString();
    const toList = target?.direction === 'inbound' ? [target.from] : target?.to || [thr.from];
    const msgId = `msg_${crypto.randomUUID().slice(0, 8)}`;
    const msg: UnifiedMessage = {
      id: msgId,
      direction: 'outbound',
      from: inboxEmail,
      to: toList,
      cc: payload.cc || (payload.replyAll ? target?.cc || [] : []),
      bcc: payload.bcc || [],
      replyTo: [],
      subject: payload.subject || (thr.subject.startsWith('Re:') ? thr.subject : `Re: ${thr.subject}`),
      html: payload.html || null,
      text: payload.text || null,
      attachments: (payload.attachments || []).map((a, idx) => ({
        id: `att_${msgId}_${idx}`,
        filename: a.filename,
        contentType: a.contentType,
        size: Buffer.from(a.content, 'base64').byteLength,
        contentBase64: a.content,
      })),
      read: true,
      receivedAt: now,
    };
    thr.messages.push(msg);
    thr.emailCount = thr.messages.length;
    thr.receivedAt = now;
    thr.snippet = stripHtmlToSnippet(payload.html, payload.text);
    if (msg.attachments.length > 0) thr.hasAttachment = true;
    this.persist();
    return { id: msgId };
  }

  public forward(inboxEmail: string, threadId: string, emailId: string, payload: { to: string[]; cc?: string[]; bcc?: string[]; html?: string; text?: string; subject?: string; attachments?: ResendAttachmentInput[] }) {
    this.ensureInit();
    const thr = this.data.threads.find(
      (t) => t.id === threadId && t.inboxId.toLowerCase() === inboxEmail.toLowerCase()
    );
    if (!thr) throw new Error('Conversation introuvable.');
    const orig = thr.messages.find((m) => m.id === emailId) || thr.messages[thr.messages.length - 1];
    const now = new Date().toISOString();
    const newThreadId = `thr_${crypto.randomUUID().slice(0, 8)}`;
    const msgId = `msg_${crypto.randomUUID().slice(0, 8)}`;
    const subject = payload.subject || `Fwd: ${thr.subject}`;
    const bodyHtml = `${payload.html || ''}<hr/><p><strong>Message transféré</strong><br/>De : ${orig?.from || ''}<br/>Objet : ${thr.subject}</p>${orig?.html || orig?.text || ''}`;

    const newThread: UnifiedThread & { messages: UnifiedMessage[] } = {
      id: newThreadId,
      inboxId: inboxEmail,
      subject,
      snippet: stripHtmlToSnippet(bodyHtml, payload.text),
      from: inboxEmail,
      to: payload.to,
      cc: payload.cc || [],
      bcc: payload.bcc || [],
      emailCount: 1,
      hasAttachment: (payload.attachments?.length || 0) > 0,
      hasDraft: false,
      read: true,
      receivedAt: now,
      folder: 'sent',
      labels: [],
      messages: [
        {
          id: msgId,
          direction: 'outbound',
          from: inboxEmail,
          to: payload.to,
          cc: payload.cc || [],
          bcc: payload.bcc || [],
          replyTo: [],
          subject,
          html: bodyHtml,
          text: payload.text || null,
          attachments: (payload.attachments || []).map((a, idx) => ({
            id: `att_${msgId}_${idx}`,
            filename: a.filename,
            contentType: a.contentType,
            size: Buffer.from(a.content, 'base64').byteLength,
            contentBase64: a.content,
          })),
          read: true,
          receivedAt: now,
        },
      ],
    };
    this.data.threads.unshift(newThread);
    this.persist();
    return { id: msgId };
  }

  public sendNew(inboxEmail: string, payload: { to: string[]; cc?: string[]; bcc?: string[]; subject: string; html?: string; text?: string; attachments?: ResendAttachmentInput[] }) {
    this.ensureInit();
    const now = new Date().toISOString();
    const threadId = `thr_${crypto.randomUUID().slice(0, 8)}`;
    const msgId = `msg_${crypto.randomUUID().slice(0, 8)}`;
    const atts: UnifiedAttachment[] = (payload.attachments || []).map((a, idx) => ({
      id: `att_${msgId}_${idx}`,
      filename: a.filename,
      contentType: a.contentType,
      size: Buffer.from(a.content, 'base64').byteLength,
      contentBase64: a.content,
    }));

    const newThread: UnifiedThread & { messages: UnifiedMessage[] } = {
      id: threadId,
      inboxId: inboxEmail,
      subject: payload.subject,
      snippet: stripHtmlToSnippet(payload.html, payload.text),
      from: inboxEmail,
      to: payload.to,
      cc: payload.cc || [],
      bcc: payload.bcc || [],
      emailCount: 1,
      hasAttachment: atts.length > 0,
      hasDraft: false,
      read: true,
      receivedAt: now,
      folder: 'sent',
      labels: [],
      messages: [
        {
          id: msgId,
          direction: 'outbound',
          from: inboxEmail,
          to: payload.to,
          cc: payload.cc || [],
          bcc: payload.bcc || [],
          replyTo: [],
          subject: payload.subject,
          html: payload.html || null,
          text: payload.text || null,
          attachments: atts,
          read: true,
          receivedAt: now,
        },
      ],
    };
    this.data.threads.unshift(newThread);

    // Si le destinataire est aussi une boîte locale @cardit.cm en bac à sable, délivre une copie entrante !
    for (const rcpt of payload.to) {
      const cleanRcpt = rcpt.trim().toLowerCase();
      if (cleanRcpt.endsWith('@cardit.cm') && cleanRcpt !== inboxEmail.toLowerCase()) {
        const inboundThreadId = `thr_${crypto.randomUUID().slice(0, 8)}`;
        const inboundMsgId = `msg_${crypto.randomUUID().slice(0, 8)}`;
        this.data.threads.unshift({
          id: inboundThreadId,
          inboxId: cleanRcpt,
          subject: payload.subject,
          snippet: stripHtmlToSnippet(payload.html, payload.text),
          from: inboxEmail,
          to: payload.to,
          cc: payload.cc || [],
          bcc: [],
          emailCount: 1,
          hasAttachment: atts.length > 0,
          hasDraft: false,
          read: false,
          receivedAt: now,
          folder: 'inbox',
          labels: [],
          messages: [
            {
              id: inboundMsgId,
              direction: 'inbound',
              from: inboxEmail,
              to: payload.to,
              cc: payload.cc || [],
              bcc: [],
              replyTo: [],
              subject: payload.subject,
              html: payload.html || null,
              text: payload.text || null,
              attachments: atts,
              read: false,
              receivedAt: now,
            },
          ],
        });
      }
    }

    this.persist();
    return { id: msgId, threadId };
  }

  public listDrafts(inboxEmail: string): UnifiedDraft[] {
    this.ensureInit();
    return this.data.drafts
      .filter((d) => d.inboxId.toLowerCase() === inboxEmail.toLowerCase())
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  public createDraft(inboxEmail: string, payload: { to?: string[]; cc?: string[]; bcc?: string[]; subject?: string; html?: string; text?: string; attachments?: ResendAttachmentInput[] }): UnifiedDraft {
    this.ensureInit();
    const now = new Date().toISOString();
    const draft: UnifiedDraft = {
      id: `drf_${crypto.randomUUID().slice(0, 8)}`,
      inboxId: inboxEmail,
      type: 'standalone',
      to: payload.to || [],
      cc: payload.cc || [],
      bcc: payload.bcc || [],
      subject: payload.subject || '(Sans objet)',
      snippet: stripHtmlToSnippet(payload.html, payload.text),
      html: payload.html || null,
      text: payload.text || null,
      threadId: null,
      replyToEmailId: null,
      updatedAt: now,
      attachments: (payload.attachments || []).map((a, idx) => ({
        id: `att_drf_${idx}`,
        filename: a.filename,
        contentType: a.contentType,
        size: Buffer.from(a.content, 'base64').byteLength,
        contentBase64: a.content,
      })),
    };
    this.data.drafts.unshift(draft);
    this.persist();
    return draft;
  }

  public updateDraft(inboxEmail: string, draftId: string, payload: { to?: string[]; cc?: string[]; bcc?: string[]; subject?: string; html?: string; text?: string }): UnifiedDraft | null {
    this.ensureInit();
    const d = this.data.drafts.find((dr) => dr.id === draftId && dr.inboxId.toLowerCase() === inboxEmail.toLowerCase());
    if (!d) return null;
    if (payload.to !== undefined) d.to = payload.to;
    if (payload.cc !== undefined) d.cc = payload.cc;
    if (payload.bcc !== undefined) d.bcc = payload.bcc;
    if (payload.subject !== undefined) d.subject = payload.subject;
    if (payload.html !== undefined) d.html = payload.html;
    if (payload.text !== undefined) d.text = payload.text;
    d.snippet = stripHtmlToSnippet(d.html, d.text);
    d.updatedAt = new Date().toISOString();
    this.persist();
    return d;
  }

  public deleteDraft(inboxEmail: string, draftId: string): boolean {
    this.ensureInit();
    const before = this.data.drafts.length;
    this.data.drafts = this.data.drafts.filter((d) => !(d.id === draftId && d.inboxId.toLowerCase() === inboxEmail.toLowerCase()));
    this.persist();
    return this.data.drafts.length < before;
  }

  public sendDraft(inboxEmail: string, draftId: string): { id: string } {
    this.ensureInit();
    const d = this.data.drafts.find((dr) => dr.id === draftId && dr.inboxId.toLowerCase() === inboxEmail.toLowerCase());
    if (!d) throw new Error('Brouillon introuvable.');
    const res = this.sendNew(inboxEmail, {
      to: d.to,
      cc: d.cc,
      bcc: d.bcc,
      subject: d.subject,
      html: d.html || undefined,
      text: d.text || undefined,
    });
    this.deleteDraft(inboxEmail, draftId);
    return { id: res.id };
  }

  public getAttachment(inboxEmail: string, emailId: string, attachmentId: string): UnifiedAttachment | null {
    this.ensureInit();
    for (const thr of this.data.threads) {
      if (thr.inboxId.toLowerCase() !== inboxEmail.toLowerCase()) continue;
      const msg = thr.messages.find((m) => m.id === emailId);
      if (msg) {
        const att = msg.attachments.find((a) => a.id === attachmentId);
        if (att) return att;
      }
    }
    return null;
  }
}

export class ResendInboxService {
  private client: Resend | null = null;
  private sandbox = new DevSandboxMailStore();

  constructor() {
    if (serverEnv.resendApiKey) {
      this.client = new Resend(serverEnv.resendApiKey);
    }
  }

  public isLiveConfigured(): boolean {
    return Boolean(this.client);
  }

  public getModeLabel(): 'resend_live' | 'dev_sandbox' {
    return this.client ? 'resend_live' : 'dev_sandbox';
  }

  private getClient(): Resend {
    if (!this.client) {
      throw new Error('RESEND_API_KEY manquante.');
    }
    return this.client;
  }

  public async listRemoteInboxes(): Promise<Array<{ id: string; emailAddress: string; name: string; fromName: string; unread: number }>> {
    if (!this.client) {
      return [];
    }
    const { data, error } = await this.client.inboxes.list({ limit: 100 });
    if (error || !data) {
      throw new Error(error?.message || 'Erreur Resend list inboxes');
    }
    return data.data.map((i) => ({
      id: i.id,
      emailAddress: i.email_address,
      name: i.name || i.email_address,
      fromName: i.from_name || i.name || 'CARDIT',
      unread: i.unread || 0,
    }));
  }

  public async createRemoteInbox(input: { emailAddress: string; name?: string; fromName?: string }): Promise<{ id: string; emailAddress: string }> {
    if (!this.client) {
      return { id: input.emailAddress.toLowerCase(), emailAddress: input.emailAddress.toLowerCase() };
    }
    const { data, error } = await this.client.inboxes.create({
      emailAddress: input.emailAddress.toLowerCase(),
      name: input.name,
      fromName: input.fromName,
    });
    if (error || !data) {
      throw new Error(error?.message || 'Erreur création Resend Inbox');
    }
    return { id: data.id, emailAddress: input.emailAddress.toLowerCase() };
  }

  public async listThreads(
    resendInboxId: string,
    inboxEmail: string,
    opts: {
      folder?: MailFolder;
      query?: string;
      unreadOnly?: boolean;
      hasAttachment?: boolean;
      limit?: number;
      after?: string;
      offset?: number;
    }
  ): Promise<{ data: UnifiedThread[]; hasMore: boolean; nextCursor: string | null }> {
    if (!this.client) {
      if (serverEnv.isProd) {
        throw new Error('Service Resend non configuré en production (RESEND_API_KEY requise).');
      }
      const res = this.sandbox.listThreads(inboxEmail, opts);
      return { data: res.data, hasMore: res.hasMore, nextCursor: null };
    }

    const client = this.getClient();
    const limit = Math.min(Math.max(opts.limit || 20, 1), 100);
    const hasSearch = Boolean(opts.query?.trim() || opts.hasAttachment);

    const response = hasSearch
      ? await client.inboxes.threads.search({
          inboxId: resendInboxId,
          query: opts.query?.trim() || undefined,
          folders: opts.folder ? [opts.folder] : undefined,
          read: opts.unreadOnly ? false : undefined,
          hasAttachment: opts.hasAttachment || undefined,
          limit,
          after: opts.after,
        })
      : await client.inboxes.threads.list({
          inboxId: resendInboxId,
          folders: opts.folder ? [opts.folder] : undefined,
          read: opts.unreadOnly ? false : undefined,
          limit,
          after: opts.after,
        });

    if (response.error || !response.data) {
      throw new Error(response.error?.message || 'Impossible de récupérer les conversations Resend.');
    }

    const items: UnifiedThread[] = response.data.data.map((t) => ({
      id: t.id,
      inboxId: resendInboxId,
      subject: t.subject || '(Sans objet)',
      snippet: `${t.email_count} message(s)`,
      from: t.from || inboxEmail,
      to: t.to || [],
      cc: t.cc || [],
      bcc: t.bcc || [],
      emailCount: t.email_count || 1,
      hasAttachment: Boolean(t.has_attachment),
      hasDraft: Boolean(t.has_draft),
      read: Boolean(t.read),
      receivedAt: t.received_at,
      folder: t.folder,
      labels: t.labels || [],
    }));

    const nextCursor = response.data.has_more && items.length > 0 ? items[items.length - 1].id : null;
    return { data: items, hasMore: response.data.has_more, nextCursor };
  }

  public async getThreadWithMessages(
    resendInboxId: string,
    inboxEmail: string,
    threadId: string
  ): Promise<{ thread: UnifiedThread; messages: UnifiedMessage[] }> {
    if (!this.client) {
      if (serverEnv.isProd) throw new Error('RESEND_API_KEY requise.');
      const res = this.sandbox.getThreadWithMessages(inboxEmail, threadId);
      if (!res) throw new Error('Conversation introuvable dans cette boîte.');
      return res;
    }

    const client = this.getClient();
    const [threadRes, emailsRes] = await Promise.all([
      client.inboxes.threads.get({ inboxId: resendInboxId, threadId }),
      client.inboxes.threads.emails.list({ inboxId: resendInboxId, threadId, limit: 100 }),
    ]);

    if (threadRes.error || !threadRes.data) {
      throw new Error(threadRes.error?.message || 'Conversation introuvable.');
    }
    if (emailsRes.error || !emailsRes.data) {
      throw new Error(emailsRes.error?.message || 'Impossible de charger les messages.');
    }

    const messages: UnifiedMessage[] = emailsRes.data.data.map((m) => ({
      id: m.id,
      direction: m.direction,
      from: m.from,
      to: m.to || [],
      cc: m.cc || [],
      bcc: m.bcc || [],
      replyTo: m.reply_to || [],
      subject: m.subject || threadRes.data!.subject || '(Sans objet)',
      html: m.html ?? null,
      text: m.text ?? null,
      attachments: (m.attachments || []).map((a) => ({
        id: a.id,
        filename: a.filename || 'piece-jointe',
        contentType: 'application/octet-stream',
        size: a.size || 0,
      })),
      read: Boolean(m.read),
      receivedAt: m.received_at,
    }));

    const latest = messages[messages.length - 1];
    const thread: UnifiedThread = {
      id: threadRes.data.id,
      inboxId: resendInboxId,
      subject: threadRes.data.subject || '(Sans objet)',
      snippet: stripHtmlToSnippet(latest?.html, latest?.text),
      from: latest?.from || inboxEmail,
      to: latest?.to || [],
      cc: latest?.cc || [],
      bcc: latest?.bcc || [],
      emailCount: messages.length,
      hasAttachment: messages.some((m) => m.attachments.length > 0),
      hasDraft: false,
      read: Boolean(threadRes.data.read),
      receivedAt: latest?.receivedAt || new Date().toISOString(),
      folder: threadRes.data.folder,
      labels: threadRes.data.labels || [],
    };

    return { thread, messages };
  }

  public async updateThread(
    resendInboxId: string,
    inboxEmail: string,
    threadId: string,
    patch: { read?: boolean; folder?: MovableFolder }
  ): Promise<void> {
    if (!this.client) {
      if (serverEnv.isProd) throw new Error('RESEND_API_KEY requise.');
      const updated = this.sandbox.updateThread(inboxEmail, threadId, patch);
      if (!updated) throw new Error('Conversation introuvable.');
      return;
    }

    if (patch.read === undefined && patch.folder === undefined) return;
    const client = this.getClient();
    const updateOpts =
      patch.read !== undefined
        ? {
            inboxId: resendInboxId,
            threadId,
            read: patch.read,
            ...(patch.folder !== undefined ? { folder: patch.folder } : {}),
          }
        : {
            inboxId: resendInboxId,
            threadId,
            folder: patch.folder!,
          };
    const { error } = await client.inboxes.threads.update(updateOpts);
    if (error) {
      throw new Error(error.message || 'Échec de mise à jour de la conversation.');
    }
  }

  public async deleteThread(resendInboxId: string, inboxEmail: string, threadId: string): Promise<void> {
    if (!this.client) {
      if (serverEnv.isProd) throw new Error('RESEND_API_KEY requise.');
      this.sandbox.deleteThread(inboxEmail, threadId);
      return;
    }

    const { error } = await this.getClient().inboxes.threads.remove({
      inboxId: resendInboxId,
      threadId,
    });
    if (error) {
      throw new Error(error.message || 'Échec de suppression de la conversation.');
    }
  }

  public async sendNewMessage(
    resendInboxId: string,
    inboxEmail: string,
    fromName: string,
    payload: {
      to: string[];
      cc?: string[];
      bcc?: string[];
      subject: string;
      html?: string;
      text?: string;
      attachments?: ResendAttachmentInput[];
    }
  ): Promise<{ id: string }> {
    if (!this.client) {
      if (serverEnv.isProd) throw new Error('RESEND_API_KEY requise.');
      return this.sandbox.sendNew(inboxEmail, payload);
    }

    const client = this.getClient();
    // Utilisation officielle Resend Inboxes : création d'un brouillon autonome puis envoi pour rattacher le thread à l'Inbox
    const draftRes = await client.inboxes.drafts.create({
      inboxId: resendInboxId,
      to: payload.to,
      cc: payload.cc && payload.cc.length > 0 ? payload.cc : undefined,
      bcc: payload.bcc && payload.bcc.length > 0 ? payload.bcc : undefined,
      subject: payload.subject,
      html: payload.html || undefined,
      text: payload.text || undefined,
      attachments: payload.attachments?.map((a) => ({
        filename: a.filename,
        content: a.content,
        contentType: a.contentType,
      })),
    });

    if (draftRes.error || !draftRes.data) {
      // Solution de repli documentée si l'Inbox n'autorise pas encore drafts.create
      const directRes = await client.emails.send({
        from: `${fromName} <${inboxEmail}>`,
        to: payload.to,
        cc: payload.cc && payload.cc.length > 0 ? payload.cc : undefined,
        bcc: payload.bcc && payload.bcc.length > 0 ? payload.bcc : undefined,
        subject: payload.subject,
        text: payload.text || stripHtmlToSnippet(payload.html, '') || ' ',
        ...(payload.html ? { html: payload.html } : {}),
        attachments: payload.attachments?.map((a) => ({
          filename: a.filename,
          content: Buffer.from(a.content, 'base64'),
          contentType: a.contentType,
        })),
      });
      if (directRes.error || !directRes.data) {
        throw new Error(directRes.error?.message || draftRes.error?.message || 'Échec envoi Resend.');
      }
      return { id: directRes.data.id };
    }

    const sendRes = await client.inboxes.drafts.send({
      inboxId: resendInboxId,
      draftId: draftRes.data.id,
    });
    if (sendRes.error || !sendRes.data) {
      throw new Error(sendRes.error?.message || 'Échec d\'envoi du brouillon Resend.');
    }
    return { id: sendRes.data.id };
  }

  public async replyToMessage(
    resendInboxId: string,
    inboxEmail: string,
    threadId: string,
    emailId: string,
    payload: {
      html?: string;
      text?: string;
      cc?: string[];
      bcc?: string[];
      subject?: string;
      replyAll?: boolean;
      attachments?: ResendAttachmentInput[];
    }
  ): Promise<{ id: string }> {
    if (!this.client) {
      if (serverEnv.isProd) throw new Error('RESEND_API_KEY requise.');
      return this.sandbox.reply(inboxEmail, threadId, emailId, payload);
    }

    const client = this.getClient();
    const commonReplyOpts = {
      inboxId: resendInboxId,
      threadId,
      emailId,
      cc: payload.cc && payload.cc.length > 0 ? payload.cc : undefined,
      bcc: payload.bcc && payload.bcc.length > 0 ? payload.bcc : undefined,
      subject: payload.subject,
      replyAll: payload.replyAll,
      attachments: payload.attachments?.map((a) => ({
        filename: a.filename,
        content: Buffer.from(a.content, 'base64'),
        contentType: a.contentType,
      })),
    };
    const { data, error } = await client.inboxes.threads.emails.reply(
      payload.html
        ? { ...commonReplyOpts, html: payload.html, text: payload.text }
        : { ...commonReplyOpts, text: payload.text || ' ' }
    );

    if (error || !data) {
      throw new Error(error?.message || 'Échec de réponse Resend.');
    }
    return { id: data.id };
  }

  public async forwardMessage(
    resendInboxId: string,
    inboxEmail: string,
    threadId: string,
    emailId: string,
    payload: {
      to: string[];
      cc?: string[];
      bcc?: string[];
      html?: string;
      text?: string;
      subject?: string;
      attachments?: ResendAttachmentInput[];
    }
  ): Promise<{ id: string }> {
    if (!this.client) {
      if (serverEnv.isProd) throw new Error('RESEND_API_KEY requise.');
      return this.sandbox.forward(inboxEmail, threadId, emailId, payload);
    }

    const { data, error } = await this.getClient().inboxes.threads.emails.forward({
      inboxId: resendInboxId,
      threadId,
      emailId,
      to: payload.to,
      cc: payload.cc && payload.cc.length > 0 ? payload.cc : undefined,
      bcc: payload.bcc && payload.bcc.length > 0 ? payload.bcc : undefined,
      html: payload.html,
      text: payload.text,
      subject: payload.subject,
      attachments: payload.attachments?.map((a) => ({
        filename: a.filename,
        content: Buffer.from(a.content, 'base64'),
        contentType: a.contentType,
      })),
    });

    if (error || !data) {
      throw new Error(error?.message || 'Échec du transfert Resend.');
    }
    return { id: data.id };
  }

  public async listDrafts(resendInboxId: string, inboxEmail: string): Promise<UnifiedDraft[]> {
    if (!this.client) {
      if (serverEnv.isProd) throw new Error('RESEND_API_KEY requise.');
      return this.sandbox.listDrafts(inboxEmail);
    }
    const { data, error } = await this.getClient().inboxes.drafts.list({
      inboxId: resendInboxId,
      limit: 50,
    });
    if (error || !data) {
      throw new Error(error?.message || 'Impossible de charger les brouillons.');
    }
    return data.data.map((d) => ({
      id: d.id,
      inboxId: resendInboxId,
      type: d.type,
      to: d.to || [],
      cc: d.cc || [],
      bcc: d.bcc || [],
      subject: d.subject || '(Sans objet)',
      snippet: d.snippet || '',
      html: null,
      text: null,
      threadId: d.thread_id,
      replyToEmailId: d.reply_to_email_id,
      updatedAt: d.updated_at,
      attachments: (d.attachments || []).map((a) => ({
        id: a.id,
        filename: a.filename,
        contentType: a.content_type,
        size: a.size,
      })),
    }));
  }

  public async getDraft(resendInboxId: string, inboxEmail: string, draftId: string): Promise<UnifiedDraft | null> {
    if (!this.client) {
      if (serverEnv.isProd) throw new Error('RESEND_API_KEY requise.');
      return this.sandbox.listDrafts(inboxEmail).find((d) => d.id === draftId) || null;
    }
    const { data, error } = await this.getClient().inboxes.drafts.get({ inboxId: resendInboxId, draftId });
    if (error || !data) return null;
    return {
      id: data.id,
      inboxId: resendInboxId,
      type: data.type,
      to: data.to || [],
      cc: data.cc || [],
      bcc: data.bcc || [],
      subject: data.subject || '',
      snippet: stripHtmlToSnippet(data.html, data.text),
      html: data.html,
      text: data.text,
      threadId: data.thread_id,
      replyToEmailId: data.reply_to_email_id,
      updatedAt: data.updated_at,
      attachments: (data.attachments || []).map((a) => ({
        id: a.id,
        filename: a.filename,
        contentType: a.content_type,
        size: a.size,
      })),
    };
  }

  public async saveDraft(
    resendInboxId: string,
    inboxEmail: string,
    payload: {
      draftId?: string;
      to?: string[];
      cc?: string[];
      bcc?: string[];
      subject?: string;
      html?: string;
      text?: string;
      attachments?: ResendAttachmentInput[];
    }
  ): Promise<{ id: string }> {
    if (!this.client) {
      if (serverEnv.isProd) throw new Error('RESEND_API_KEY requise.');
      if (payload.draftId) {
        const updated = this.sandbox.updateDraft(inboxEmail, payload.draftId, payload);
        if (updated) return { id: updated.id };
      }
      const created = this.sandbox.createDraft(inboxEmail, payload);
      return { id: created.id };
    }

    const client = this.getClient();
    if (payload.draftId) {
      const { data, error } = await client.inboxes.drafts.update({
        inboxId: resendInboxId,
        draftId: payload.draftId,
        to: payload.to ?? null,
        cc: payload.cc ?? null,
        bcc: payload.bcc ?? null,
        subject: payload.subject ?? null,
        html: payload.html ?? null,
        text: payload.text ?? null,
      });
      if (error || !data) {
        throw new Error(error?.message || 'Erreur mise à jour brouillon.');
      }
      return { id: data.id };
    }

    const { data, error } = await client.inboxes.drafts.create({
      inboxId: resendInboxId,
      to: payload.to && payload.to.length > 0 ? payload.to : undefined,
      cc: payload.cc && payload.cc.length > 0 ? payload.cc : undefined,
      bcc: payload.bcc && payload.bcc.length > 0 ? payload.bcc : undefined,
      subject: payload.subject || '(Sans objet)',
      html: payload.html || undefined,
      text: payload.text || undefined,
      attachments: payload.attachments?.map((a) => ({
        filename: a.filename,
        content: a.content,
        contentType: a.contentType,
      })),
    });
    if (error || !data) {
      throw new Error(error?.message || 'Erreur création brouillon.');
    }
    return { id: data.id };
  }

  public async deleteDraft(resendInboxId: string, inboxEmail: string, draftId: string): Promise<void> {
    if (!this.client) {
      if (serverEnv.isProd) throw new Error('RESEND_API_KEY requise.');
      this.sandbox.deleteDraft(inboxEmail, draftId);
      return;
    }
    const { error } = await this.getClient().inboxes.drafts.remove({ inboxId: resendInboxId, draftId });
    if (error) {
      throw new Error(error.message || 'Erreur suppression brouillon.');
    }
  }

  public async sendSavedDraft(resendInboxId: string, inboxEmail: string, draftId: string): Promise<{ id: string }> {
    if (!this.client) {
      if (serverEnv.isProd) throw new Error('RESEND_API_KEY requise.');
      return this.sandbox.sendDraft(inboxEmail, draftId);
    }
    const { data, error } = await this.getClient().inboxes.drafts.send({ inboxId: resendInboxId, draftId });
    if (error || !data) {
      throw new Error(error?.message || 'Erreur envoi du brouillon.');
    }
    return { id: data.id };
  }

  public async getAttachmentDownload(
    inboxEmail: string,
    emailId: string,
    attachmentId: string
  ): Promise<{ filename: string; contentType: string; downloadUrl?: string; buffer?: Buffer }> {
    if (!this.client) {
      if (serverEnv.isProd) throw new Error('RESEND_API_KEY requise.');
      const att = this.sandbox.getAttachment(inboxEmail, emailId, attachmentId);
      if (!att || !att.contentBase64) {
        throw new Error('Pièce jointe introuvable.');
      }
      return {
        filename: att.filename,
        contentType: att.contentType,
        buffer: Buffer.from(att.contentBase64, 'base64'),
      };
    }

    const { data, error } = await this.getClient().emails.receiving.attachments.get({
      emailId,
      id: attachmentId,
    });
    if (error || !data) {
      throw new Error(error?.message || 'Pièce jointe introuvable sur Resend.');
    }
    return {
      filename: data.filename || 'piece-jointe',
      contentType: data.content_type || 'application/octet-stream',
      downloadUrl: data.download_url,
    };
  }

  public verifyWebhook(rawPayload: string, headers: { id: string; timestamp: string; signature: string }) {
    if (!serverEnv.resendWebhookSecret) {
      throw new Error('RESEND_WEBHOOK_SECRET non configuré.');
    }
    const verifier = this.client || new Resend('re_webhook_verify_only');
    return verifier.webhooks.verify({
      payload: rawPayload,
      headers,
      webhookSecret: serverEnv.resendWebhookSecret,
    });
  }
}

export const resendService = new ResendInboxService();
