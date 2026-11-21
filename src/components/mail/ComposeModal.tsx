import {
  Bold,
  Italic,
  List,
  Paperclip,
  Save,
  Send,
  Trash2,
  Underline,
  X,
} from 'lucide-react';
import { upload } from '@vercel/blob/client';
import React, { useEffect, useRef, useState } from 'react';
import { apiFetch } from '../../lib/api.ts';
import { formatFileSize } from '../../lib/utils.ts';
import type { ContactItem, EmailMessage, MailDraft } from '../../types/cardmail.ts';
import { Button, Dialog, DialogContent, Input } from '../ui/primitives.tsx';

export type ComposeContext =
  | { mode: 'new'; initialTo?: string }
  | { mode: 'draft'; draft: MailDraft }
  | { mode: 'reply'; threadId: string; message: EmailMessage; replyAll: boolean }
  | { mode: 'forward'; threadId: string; message: EmailMessage };

interface ComposeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  context: ComposeContext;
  userId: string;
  inboxId: string;
  inboxEmail: string;
  signatureHtml: string;
  contacts: ContactItem[];
  onSent: () => void;
}

export const ComposeModal: React.FC<ComposeModalProps> = ({
  open,
  onOpenChange,
  context,
  userId,
  inboxId,
  inboxEmail,
  signatureHtml,
  contacts,
  onSent,
}) => {
  const [to, setTo] = useState('');
  const [cc, setCc] = useState('');
  const [bcc, setBcc] = useState('');
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [subject, setSubject] = useState('');
  const [draftId, setDraftId] = useState<string | undefined>(undefined);
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<ContactItem[]>([]);

  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setFiles([]);
    setSuggestions([]);

    const sigBlock = signatureHtml ? `<br/><br/><div data-cardmail-sig="true">${signatureHtml}</div>` : '';

    if (context.mode === 'new') {
      setTo(context.initialTo || '');
      setCc('');
      setBcc('');
      setShowCcBcc(false);
      setSubject('');
      setDraftId(undefined);
      requestAnimationFrame(() => {
        if (editorRef.current) editorRef.current.innerHTML = `<p></p>${sigBlock}`;
      });
    } else if (context.mode === 'draft') {
      setTo(context.draft.to.join(', '));
      setCc(context.draft.cc.join(', '));
      setBcc(context.draft.bcc.join(', '));
      setShowCcBcc(context.draft.cc.length > 0 || context.draft.bcc.length > 0);
      setSubject(context.draft.subject === '(Sans objet)' ? '' : context.draft.subject);
      setDraftId(context.draft.id);
      requestAnimationFrame(() => {
        if (editorRef.current) {
          editorRef.current.innerHTML = context.draft.html || `<p>${context.draft.text || ''}</p>${sigBlock}`;
        }
      });
    } else if (context.mode === 'reply') {
      const m = context.message;
      const recipient = m.direction === 'inbound' ? m.from : m.to.join(', ');
      setTo(recipient);
      const ccList = context.replyAll
        ? [...m.to, ...m.cc].filter((addr) => !addr.toLowerCase().includes(inboxEmail.toLowerCase()))
        : [];
      setCc(ccList.join(', '));
      setBcc('');
      setShowCcBcc(ccList.length > 0);
      setSubject(m.subject.startsWith('Re:') ? m.subject : `Re: ${m.subject}`);
      setDraftId(undefined);
      requestAnimationFrame(() => {
        if (editorRef.current) editorRef.current.innerHTML = `<p></p>${sigBlock}`;
      });
    } else if (context.mode === 'forward') {
      const m = context.message;
      setTo('');
      setCc('');
      setBcc('');
      setShowCcBcc(false);
      setSubject(m.subject.startsWith('Fwd:') ? m.subject : `Fwd: ${m.subject}`);
      setDraftId(undefined);
      requestAnimationFrame(() => {
        if (editorRef.current) {
          editorRef.current.innerHTML = `<p></p>${sigBlock}<hr/><p><strong>Message transféré de ${m.from}</strong></p>${m.html || m.text || ''}`;
        }
      });
    }
  }, [open, context, inboxEmail, signatureHtml]);

  const handleToChange = (val: string) => {
    setTo(val);
    const parts = val.split(',');
    const lastToken = parts[parts.length - 1].trim().toLowerCase();
    if (lastToken.length >= 1) {
      setSuggestions(
        contacts
          .filter((c) => c.name.toLowerCase().includes(lastToken) || c.email.toLowerCase().includes(lastToken))
          .slice(0, 5)
      );
    } else {
      setSuggestions([]);
    }
  };

  const applySuggestion = (contact: ContactItem) => {
    const parts = to.split(',');
    parts[parts.length - 1] = ` ${contact.email}`;
    const next = parts.map((p) => p.trim()).filter(Boolean).join(', ') + ', ';
    setTo(next);
    setSuggestions([]);
  };

  const execFormat = (cmd: string) => {
    document.execCommand(cmd, false);
    editorRef.current?.focus();
  };

  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    const next = [...files, ...selected].slice(0, 8);
    const total = next.reduce((acc, f) => acc + f.size, 0);
    if (total > 24 * 1024 * 1024) {
      setError('Le total des pièces jointes ne peut pas dépasser 24 Mo.');
      return;
    }
    setFiles(next);
    e.target.value = '';
  };

  const handleSaveDraft = async () => {
    setSavingDraft(true);
    setError(null);
    try {
      const html = editorRef.current?.innerHTML || '';
      const text = editorRef.current?.innerText || '';
      const res = await apiFetch<{ id: string }>('/api/mail/drafts', {
        method: 'POST',
        body: JSON.stringify({
          inboxId,
          draftId,
          to,
          cc,
          bcc,
          subject: subject || '(Sans objet)',
          html,
          text,
        }),
      });
      setDraftId(res.id);
      onSent();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde du brouillon.');
    } finally {
      setSavingDraft(false);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSending(true);
    try {
      const html = editorRef.current?.innerHTML || '';
      const text = editorRef.current?.innerText || '';

      // Les fichiers partent directement du navigateur vers Vercel Blob (stockage privé) :
      // aucune limite de taille côté fonction, le serveur ne reçoit que des références.
      const attachments: Array<{ pathname: string; filename: string; contentType: string }> = [];
      for (const f of files) {
        const blob = await upload(`mail-uploads/${userId}/${f.name}`, f, {
          access: 'private',
          handleUploadUrl: '/api/mail/upload',
        });
        attachments.push({ pathname: blob.pathname, filename: f.name, contentType: f.type });
      }

      const payload: Record<string, unknown> = { inboxId, to, cc, bcc, subject, html, text, draftId, attachments };

      if (context.mode === 'reply') {
        await apiFetch(`/api/mail/threads/${encodeURIComponent(context.threadId)}/reply`, {
          method: 'POST',
          body: JSON.stringify({ ...payload, emailId: context.message.id, replyAll: context.replyAll }),
        });
      } else if (context.mode === 'forward') {
        await apiFetch(`/api/mail/threads/${encodeURIComponent(context.threadId)}/forward`, {
          method: 'POST',
          body: JSON.stringify({ ...payload, emailId: context.message.id }),
        });
      } else {
        await apiFetch('/api/mail/send', { method: 'POST', body: JSON.stringify(payload) });
      }

      onOpenChange(false);
      onSent();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Échec de l\'envoi.');
    } finally {
      setSending(false);
    }
  };

  const modalTitle =
    context.mode === 'reply'
      ? context.replyAll
        ? 'Répondre à tous'
        : 'Répondre'
      : context.mode === 'forward'
      ? 'Transférer le message'
      : context.mode === 'draft'
      ? 'Modifier le brouillon'
      : 'Nouveau message';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={modalTitle}
        description={`Expéditeur : ${inboxEmail}`}
        className="max-w-3xl max-h-[90vh] flex flex-col overflow-hidden"
      >
        {error && (
          <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-900 dark:bg-red-950/60 dark:text-red-200">
            {error}
          </div>
        )}

        <form onSubmit={handleSend} className="flex flex-1 flex-col gap-3 overflow-y-auto pr-1">
          {context.mode !== 'reply' && (
            <div className="relative">
              <div className="flex items-center gap-2">
                <label className="w-12 text-xs font-medium text-slate-500 dark:text-slate-400">À</label>
                <Input
                  value={to}
                  onChange={(e) => handleToChange(e.target.value)}
                  placeholder="destinataire@exemple.com"
                  required
                />
                {!showCcBcc && (
                  <button
                    type="button"
                    onClick={() => setShowCcBcc(true)}
                    className="shrink-0 text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 cursor-pointer"
                  >
                    Cc / Cci
                  </button>
                )}
              </div>

              {suggestions.length > 0 && (
                <div className="absolute left-14 right-0 top-11 z-20 rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-800">
                  {suggestions.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => applySuggestion(c)}
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-xs hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
                    >
                      <span className="font-medium text-slate-900 dark:text-white">{c.name}</span>
                      <span className="font-mono text-slate-500 dark:text-slate-400">{c.email}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {showCcBcc && (
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="flex items-center gap-2">
                <label className="w-12 text-xs font-medium text-slate-500 dark:text-slate-400">Cc</label>
                <Input value={cc} onChange={(e) => setCc(e.target.value)} placeholder="copie@cardit.cm" />
              </div>
              <div className="flex items-center gap-2">
                <label className="w-12 text-xs font-medium text-slate-500 dark:text-slate-400">Cci</label>
                <Input value={bcc} onChange={(e) => setBcc(e.target.value)} placeholder="copie.cachee@cardit.cm" />
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <label className="w-12 text-xs font-medium text-slate-500 dark:text-slate-400">Objet</label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Objet du courrier professionnel"
              required
            />
          </div>

          {/* Barre d'outils éditeur riche */}
          <div className="flex items-center justify-between border-y border-slate-200 py-1.5 dark:border-slate-800">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => execFormat('bold')}
                aria-label="Gras"
                className="rounded p-1.5 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
              >
                <Bold className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => execFormat('italic')}
                aria-label="Italique"
                className="rounded p-1.5 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
              >
                <Italic className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => execFormat('underline')}
                aria-label="Souligné"
                className="rounded p-1.5 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
              >
                <Underline className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => execFormat('insertUnorderedList')}
                aria-label="Liste à puces"
                className="rounded p-1.5 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
              >
                <List className="h-4 w-4" />
              </button>
            </div>

            <div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.txt,.csv,.doc,.docx,.xls,.xlsx,.pptx,.png,.jpg,.jpeg,.webp,.zip"
                className="hidden"
                onChange={handleFilesSelected}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                <Paperclip className="h-4 w-4" />
                <span>Joindre</span>
              </Button>
            </div>
          </div>

          {/* Zone d'édition riche */}
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            className="min-h-52 max-h-72 overflow-y-auto rounded-lg border border-slate-200 bg-white p-3.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />

          {files.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {files.map((f, idx) => (
                <div
                  key={`${f.name}-${idx}`}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                >
                  <span className="max-w-40 truncate font-medium text-slate-800 dark:text-slate-100">{f.name}</span>
                  <span className="font-mono text-[11px] text-slate-500">{formatFileSize(f.size)}</span>
                  <button
                    type="button"
                    aria-label="Retirer la pièce jointe"
                    onClick={() => setFiles((prev) => prev.filter((_, i) => i !== idx))}
                    className="text-slate-400 hover:text-red-500 cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-3 dark:border-slate-800">
            <div className="flex items-center gap-2">
              {(context.mode === 'new' || context.mode === 'draft') && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={savingDraft}
                  onClick={() => void handleSaveDraft()}
                >
                  <Save className="h-3.5 w-3.5" />
                  <span>{savingDraft ? 'Enregistrement…' : 'Brouillon'}</span>
                </Button>
              )}
              {draftId && (
                <span className="text-xs text-slate-500 dark:text-slate-400">Brouillon enregistré</span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
                <Trash2 className="h-3.5 w-3.5" />
                <span>Fermer</span>
              </Button>
              <Button type="submit" disabled={sending}>
                <Send className="h-4 w-4" />
                <span>{sending ? 'Envoi en cours…' : 'Envoyer'}</span>
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
