import { Router } from 'express';
import { del, get } from '@vercel/blob';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { z } from 'zod';
import { store } from '../db/store.ts';
import {
  type AuthenticatedRequest,
  requireAuth,
  requireInboxAccess,
  verifyCsrf,
} from '../middleware/auth.ts';
import { type MailFolder, type ResendAttachmentInput, resendService } from '../services/resend.service.ts';
import { sanitizeServerHtml } from '../utils/sanitize.ts';

const router = Router();

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/zip',
]);


function parseEmailList(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((v) => String(v).trim()).filter(Boolean);
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith('[')) {
      try {
        const arr = JSON.parse(trimmed);
        if (Array.isArray(arr)) return arr.map((v) => String(v).trim()).filter(Boolean);
      } catch {
        // fallback comma split
      }
    }
    return trimmed
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

const MAX_FILE = 10 * 1024 * 1024;
const MAX_TOTAL = 24 * 1024 * 1024;

interface BlobRef { pathname: string; filename: string; contentType: string }

function parseBlobRefs(raw: unknown, userId: string): BlobRef[] {
  if (!Array.isArray(raw)) return [];
  if (raw.length > 8) throw new Error('Maximum 8 pièces jointes par message.');
  return raw.map((r) => {
    const pathname = String((r as BlobRef)?.pathname || '');
    // Isolation : un utilisateur ne peut référencer que ses propres fichiers téléversés
    if (!pathname.startsWith(`mail-uploads/${userId}/`) || pathname.includes('..')) {
      throw new Error('Pièce jointe non autorisée.');
    }
    const filename = String((r as BlobRef).filename || 'fichier').replace(/[/\<>:"|?*]/g, '_').slice(0, 180);
    const contentType = ALLOWED_MIME_TYPES.has(String((r as BlobRef).contentType)) ? String((r as BlobRef).contentType) : 'application/octet-stream';
    return { pathname, filename, contentType };
  });
}

async function loadAttachments(refs: BlobRef[]): Promise<ResendAttachmentInput[]> {
  let total = 0;
  const out: ResendAttachmentInput[] = [];
  for (const ref of refs) {
    const result = await get(ref.pathname, { access: 'private', useCache: false });
    if (!result || result.statusCode !== 200) throw new Error(`Fichier introuvable : ${ref.filename}`);
    const buf = Buffer.from(await new Response(result.stream).arrayBuffer());
    total += buf.length;
    if (buf.length > MAX_FILE || total > MAX_TOTAL) throw new Error('Pièces jointes trop volumineuses (10 Mo par fichier, 24 Mo au total).');
    out.push({ filename: ref.filename, content: buf.toString('base64'), contentType: ref.contentType });
  }
  return out;
}

async function cleanupBlobs(refs: BlobRef[]): Promise<void> {
  await Promise.all(refs.map((r) => del(r.pathname).catch(() => {})));
}

router.use(requireAuth);

// Jeton d'upload direct navigateur → Vercel Blob (contourne la limite de 4,5 Mo des fonctions)
router.post('/upload', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.authUser!.id;
    const json = await handleUpload({
      request: req as unknown as Request,
      body: req.body as HandleUploadBody,
      onBeforeGenerateToken: async (pathname) => {
        if (!pathname.startsWith(`mail-uploads/${userId}/`) || pathname.includes('..')) {
          throw new Error('Chemin de téléversement invalide.');
        }
        return {
          allowedContentTypes: [...ALLOWED_MIME_TYPES],
          maximumSizeInBytes: MAX_FILE,
          addRandomSuffix: true,
        };
      },
    });
    return res.json(json);
  } catch (err: unknown) {
    return res.status(400).json({ error: err instanceof Error ? err.message : 'Téléversement refusé.' });
  }
});

// Liste des conversations (boîte isolée par requireInboxAccess)
router.get('/threads', requireInboxAccess, async (req: AuthenticatedRequest, res) => {
  try {
    const inbox = req.authInbox!;
    const view = String(req.query.view || 'inbox');
    const query = typeof req.query.q === 'string' ? req.query.q : undefined;
    const unreadOnly = req.query.unreadOnly === 'true';
    const hasAttachment = req.query.hasAttachment === 'true';
    const limit = Number(req.query.limit || 25);
    const after = typeof req.query.after === 'string' ? req.query.after : undefined;
    const offset = Number(req.query.offset || 0);

    const starredIds = new Set(await store.listStarredThreadIds(req.authUser!.id, inbox.id));

    if (view === 'starred') {
      const result = await resendService.listThreads(inbox.resendInboxId, inbox.emailAddress, {
        query,
        unreadOnly,
        hasAttachment,
        limit: 100,
      });
      const filtered = result.data
        .filter((t) => starredIds.has(t.id))
        .map((t) => ({ ...t, starred: true }));
      return res.json({ data: filtered, hasMore: false, nextCursor: null, inboxId: inbox.id });
    }

    const folderMap: Record<string, MailFolder> = {
      inbox: 'inbox',
      sent: 'sent',
      archive: 'archive',
      trash: 'trash',
      spam: 'spam',
    };

    const result = await resendService.listThreads(inbox.resendInboxId, inbox.emailAddress, {
      folder: folderMap[view] || 'inbox',
      query,
      unreadOnly,
      hasAttachment,
      limit,
      after,
      offset,
    });

    return res.json({
      data: result.data.map((t) => ({ ...t, starred: starredIds.has(t.id) })),
      hasMore: result.hasMore,
      nextCursor: result.nextCursor,
      inboxId: inbox.id,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erreur chargement conversations.';
    return res.status(500).json({ error: msg });
  }
});

// Détail d'une conversation et ses messages
router.get('/threads/:threadId', requireInboxAccess, async (req: AuthenticatedRequest, res) => {
  try {
    const inbox = req.authInbox!;
    const threadId = String(req.params.threadId);
    const result = await resendService.getThreadWithMessages(inbox.resendInboxId, inbox.emailAddress, threadId);
    const starredIds = await store.listStarredThreadIds(req.authUser!.id, inbox.id);
    return res.json({
      thread: { ...result.thread, starred: starredIds.includes(threadId) },
      messages: result.messages,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Conversation introuvable.';
    return res.status(404).json({ error: msg });
  }
});

// Mettre à jour lu/non-lu, dossier (archive/trash/inbox/spam) ou favori
const updateThreadSchema = z.object({
  inboxId: z.string().optional(),
  read: z.boolean().optional(),
  folder: z.enum(['inbox', 'archive', 'spam', 'trash']).optional(),
  starred: z.boolean().optional(),
});

router.patch('/threads/:threadId', verifyCsrf, requireInboxAccess, async (req: AuthenticatedRequest, res) => {
  const parsed = updateThreadSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Paramètres de mise à jour invalides.' });
  }
  try {
    const inbox = req.authInbox!;
    const threadId = String(req.params.threadId);
    if (parsed.data.read !== undefined || parsed.data.folder !== undefined) {
      await resendService.updateThread(inbox.resendInboxId, inbox.emailAddress, threadId, {
        read: parsed.data.read,
        folder: parsed.data.folder,
      });
    }
    if (parsed.data.starred !== undefined) {
      await store.toggleStarredThread(req.authUser!.id, inbox.id, threadId, parsed.data.starred);
    }
    return res.json({ success: true });
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Erreur mise à jour.' });
  }
});

// Suppression définitive d'une conversation
router.delete('/threads/:threadId', verifyCsrf, requireInboxAccess, async (req: AuthenticatedRequest, res) => {
  try {
    const inbox = req.authInbox!;
    const threadId = String(req.params.threadId);
    await resendService.deleteThread(inbox.resendInboxId, inbox.emailAddress, threadId);
    await store.toggleStarredThread(req.authUser!.id, inbox.id, threadId, false);
    return res.json({ success: true });
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Erreur suppression.' });
  }
});

// Envoi d'un nouveau message
router.post('/send', verifyCsrf, requireInboxAccess, async (req: AuthenticatedRequest, res) => {
  try {
    const inbox = req.authInbox!;
    const to = parseEmailList(req.body.to);
    const cc = parseEmailList(req.body.cc);
    const bcc = parseEmailList(req.body.bcc);
    const subject = String(req.body.subject || '').trim();
    const html = typeof req.body.html === 'string' ? sanitizeServerHtml(req.body.html) : undefined;
    const text = typeof req.body.text === 'string' ? req.body.text : undefined;
    const draftId = typeof req.body.draftId === 'string' ? req.body.draftId : undefined;

    if (to.length === 0) {
      return res.status(400).json({ error: 'Au moins un destinataire est requis.' });
    }
    if (!subject) {
      return res.status(400).json({ error: 'L\'objet du message est requis.' });
    }
    if (!html && !text) {
      return res.status(400).json({ error: 'Le corps du message ne peut pas être vide.' });
    }

    const refs = parseBlobRefs(req.body.attachments, req.authUser!.id);
    const attachments = await loadAttachments(refs);
    const result = await resendService.sendNewMessage(
      inbox.resendInboxId,
      inbox.emailAddress,
      inbox.fromName || `${req.authUser!.firstName} ${req.authUser!.lastName}`,
      { to, cc, bcc, subject, html, text, attachments }
    );
    await cleanupBlobs(refs);

    if (draftId) {
      await resendService.deleteDraft(inbox.resendInboxId, inbox.emailAddress, draftId).catch(() => {});
    }


    // Si en mode dev sandbox vers une autre adresse @cardit.cm, notifier aussi sa boîte
    for (const rcpt of to) {
      const targetInbox = await store.getInboxByResendOrEmail(rcpt);
      if (targetInbox && targetInbox.id !== inbox.id && !resendService.isLiveConfigured()) {
        const targetUsers = await store.getUsersForInbox(targetInbox.id);
        for (const uid of targetUsers) {
          await store.createNotification({
            userId: uid,
            inboxId: targetInbox.id,
            title: `Nouveau message de ${inbox.emailAddress}`,
            body: subject,
          });
        }
      }
    }

    return res.json({ success: true, id: result.id });
  } catch (err: unknown) {
    return res.status(400).json({ error: err instanceof Error ? err.message : 'Erreur d\'envoi.' });
  }
});

// Réponse / Répondre à tous
router.post('/threads/:threadId/reply', verifyCsrf, requireInboxAccess, async (req: AuthenticatedRequest, res) => {
  try {
    const inbox = req.authInbox!;
    const threadId = String(req.params.threadId);
    const emailId = String(req.body.emailId || '');
    if (!emailId) {
      return res.status(400).json({ error: 'Identifiant du message cible manquant.' });
    }
    const html = typeof req.body.html === 'string' ? sanitizeServerHtml(req.body.html) : undefined;
    const text = typeof req.body.text === 'string' ? req.body.text : undefined;
    if (!html && !text) {
      return res.status(400).json({ error: 'Le message de réponse est vide.' });
    }
    const cc = parseEmailList(req.body.cc);
    const bcc = parseEmailList(req.body.bcc);
    const replyAll = req.body.replyAll === 'true' || req.body.replyAll === true;
    const refs = parseBlobRefs(req.body.attachments, req.authUser!.id);
    const attachments = await loadAttachments(refs);

    const result = await resendService.replyToMessage(inbox.resendInboxId, inbox.emailAddress, threadId, emailId, {
      html,
      text,
      cc,
      bcc,
      replyAll,
      attachments,
    });
    await cleanupBlobs(refs);


    return res.json({ success: true, id: result.id });
  } catch (err: unknown) {
    return res.status(400).json({ error: err instanceof Error ? err.message : 'Échec de réponse.' });
  }
});

// Transférer un message
router.post('/threads/:threadId/forward', verifyCsrf, requireInboxAccess, async (req: AuthenticatedRequest, res) => {
  try {
    const inbox = req.authInbox!;
    const threadId = String(req.params.threadId);
    const emailId = String(req.body.emailId || '');
    const to = parseEmailList(req.body.to);
    if (!emailId || to.length === 0) {
      return res.status(400).json({ error: 'Message source et destinataire requis.' });
    }
    const cc = parseEmailList(req.body.cc);
    const bcc = parseEmailList(req.body.bcc);
    const html = typeof req.body.html === 'string' ? sanitizeServerHtml(req.body.html) : undefined;
    const text = typeof req.body.text === 'string' ? req.body.text : undefined;
    const subject = typeof req.body.subject === 'string' ? req.body.subject : undefined;
    const refs = parseBlobRefs(req.body.attachments, req.authUser!.id);
    const attachments = await loadAttachments(refs);

    const result = await resendService.forwardMessage(inbox.resendInboxId, inbox.emailAddress, threadId, emailId, {
      to,
      cc,
      bcc,
      html,
      text,
      subject,
      attachments,
    });
    await cleanupBlobs(refs);

    return res.json({ success: true, id: result.id });
  } catch (err: unknown) {
    return res.status(400).json({ error: err instanceof Error ? err.message : 'Échec du transfert.' });
  }
});

// Brouillons
router.get('/drafts', requireInboxAccess, async (req: AuthenticatedRequest, res) => {
  try {
    const inbox = req.authInbox!;
    const drafts = await resendService.listDrafts(inbox.resendInboxId, inbox.emailAddress);
    return res.json({ data: drafts });
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Erreur chargement brouillons.' });
  }
});

router.get('/drafts/:draftId', requireInboxAccess, async (req: AuthenticatedRequest, res) => {
  try {
    const inbox = req.authInbox!;
    const draft = await resendService.getDraft(inbox.resendInboxId, inbox.emailAddress, String(req.params.draftId));
    if (!draft) return res.status(404).json({ error: 'Brouillon introuvable.' });
    return res.json({ data: draft });
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Erreur chargement brouillon.' });
  }
});

router.post('/drafts', verifyCsrf, requireInboxAccess, async (req: AuthenticatedRequest, res) => {
  try {
    const inbox = req.authInbox!;
    const result = await resendService.saveDraft(inbox.resendInboxId, inbox.emailAddress, {
      draftId: typeof req.body.draftId === 'string' ? req.body.draftId : undefined,
      to: parseEmailList(req.body.to),
      cc: parseEmailList(req.body.cc),
      bcc: parseEmailList(req.body.bcc),
      subject: typeof req.body.subject === 'string' ? req.body.subject : undefined,
      html: typeof req.body.html === 'string' ? sanitizeServerHtml(req.body.html) : undefined,
      text: typeof req.body.text === 'string' ? req.body.text : undefined,
    });
    return res.json({ success: true, id: result.id });
  } catch (err: unknown) {
    return res.status(400).json({ error: err instanceof Error ? err.message : 'Erreur enregistrement brouillon.' });
  }
});

router.post('/drafts/:draftId/send', verifyCsrf, requireInboxAccess, async (req: AuthenticatedRequest, res) => {
  try {
    const inbox = req.authInbox!;
    const result = await resendService.sendSavedDraft(inbox.resendInboxId, inbox.emailAddress, String(req.params.draftId));
    return res.json({ success: true, id: result.id });
  } catch (err: unknown) {
    return res.status(400).json({ error: err instanceof Error ? err.message : 'Erreur envoi brouillon.' });
  }
});

router.delete('/drafts/:draftId', verifyCsrf, requireInboxAccess, async (req: AuthenticatedRequest, res) => {
  try {
    const inbox = req.authInbox!;
    await resendService.deleteDraft(inbox.resendInboxId, inbox.emailAddress, String(req.params.draftId));
    return res.json({ success: true });
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Erreur suppression brouillon.' });
  }
});

// Téléchargement sécurisé de pièce jointe (vérifie l'appartenance du thread à la boîte de l'utilisateur)
router.get('/attachments/:threadId/:emailId/:attachmentId', requireInboxAccess, async (req: AuthenticatedRequest, res) => {
  try {
    const inbox = req.authInbox!;
    const threadId = String(req.params.threadId);
    const emailId = String(req.params.emailId);
    const attachmentId = String(req.params.attachmentId);

    // Vérification stricte : le thread appartient-il à cette boîte ?
    const { messages } = await resendService.getThreadWithMessages(inbox.resendInboxId, inbox.emailAddress, threadId);
    const msg = messages.find((m) => m.id === emailId);
    if (!msg || !msg.attachments.some((a) => a.id === attachmentId)) {
      return res.status(403).json({ error: 'Accès refusé à cette pièce jointe.' });
    }

    const fileInfo = await resendService.getAttachmentDownload(inbox.emailAddress, emailId, attachmentId);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileInfo.filename)}"`);
    res.setHeader('Content-Type', fileInfo.contentType);
    res.setHeader('X-Content-Type-Options', 'nosniff');

    if (fileInfo.buffer) {
      return res.send(fileInfo.buffer);
    }
    if (fileInfo.downloadUrl) {
      // URL temporaire signée par Resend : redirection directe (évite la limite de taille des fonctions)
      res.removeHeader('Content-Type');
      res.setHeader('Cache-Control', 'private, no-store');
      return res.redirect(302, fileInfo.downloadUrl);
    }
    return res.status(404).json({ error: 'Contenu introuvable.' });
  } catch (err: unknown) {
    return res.status(404).json({ error: err instanceof Error ? err.message : 'Pièce jointe introuvable.' });
  }
});

export default router;
