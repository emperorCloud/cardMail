import {
  Archive,
  ArrowLeft,
  Download,
  Forward,
  Inbox,
  Mail,
  MailOpen,
  Paperclip,
  Reply,
  ReplyAll,
  Star,
  Trash2,
} from 'lucide-react';
import { SenderAvatar } from '../ui/Avatar.tsx';
import React from 'react';
import { sanitizeEmailHtml } from '../../lib/sanitize.ts';
import { cn, extractSenderName, formatFileSize, formatFullDateTime } from '../../lib/utils.ts';
import type { EmailMessage, MailThread } from '../../types/cardmail.ts';
import { Button } from '../ui/primitives.tsx';

interface ConversationPaneProps {
  thread: MailThread | null;
  messages: EmailMessage[];
  loading: boolean;
  inboxId: string;
  onBackMobile?: () => void;
  onReply: (message: EmailMessage, replyAll: boolean) => void;
  onForward: (message: EmailMessage) => void;
  onToggleRead: (thread: MailThread) => void;
  onToggleStar: (thread: MailThread) => void;
  onMoveFolder: (thread: MailThread, folder: 'inbox' | 'archive' | 'trash') => void;
  onDeletePermanent: (thread: MailThread) => void;
}

export const ConversationPane: React.FC<ConversationPaneProps> = ({
  thread,
  messages,
  loading,
  inboxId,
  onBackMobile,
  onReply,
  onForward,
  onToggleRead,
  onToggleStar,
  onMoveFolder,
  onDeletePermanent,
}) => {
  if (!thread) {
    return (
      <div className="hidden md:flex flex-1 flex-col items-center justify-center p-10 text-center">
        <div className="relative">
          <div className="absolute inset-0 -z-10 scale-150 rounded-full bg-teal-500/20 blur-3xl" aria-hidden="true" />
          <img src="/brand/mark.png" alt="" className="h-24 w-auto drop-shadow-[0_18px_30px_rgba(21,86,214,0.35)]" />
        </div>
        <h3 className="mt-6 font-display text-lg font-semibold text-slate-900 dark:text-white">
          Choisissez une conversation
        </h3>
        <p className="mt-1.5 max-w-xs text-sm leading-relaxed text-slate-500 dark:text-slate-400">
          Ses messages et ses pièces jointes s'afficheront ici.
        </p>
      </div>
    );
  }

  const latestMessage = messages[messages.length - 1];

  return (
    <section
      aria-label="Panneau de lecture"
      className="flex h-full flex-1 flex-col overflow-hidden bg-slate-50/60 dark:bg-[#070C1C]"
    >
      {/* Barre d'actions conversation */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-200/70 glass px-4 py-2.5 dark:border-slate-700/50">
        <div className="flex items-center gap-1.5">
          {onBackMobile && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onBackMobile}
              aria-label="Retour à la liste"
              className="md:hidden h-10 w-10"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onToggleRead(thread)}
            title={thread.read ? 'Marquer comme non lu' : 'Marquer comme lu'}
          >
            {thread.read ? <Mail className="h-4 w-4" /> : <MailOpen className="h-4 w-4" />}
            <span className="hidden sm:inline">{thread.read ? 'Non lu' : 'Lu'}</span>
          </Button>

          {thread.folder !== 'archive' ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onMoveFolder(thread, 'archive')}
              title="Archiver"
            >
              <Archive className="h-4 w-4" />
              <span className="hidden sm:inline">Archiver</span>
            </Button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onMoveFolder(thread, 'inbox')}
              title="Déplacer en boîte de réception"
            >
              <Inbox className="h-4 w-4" />
              <span className="hidden sm:inline">Boîte de réception</span>
            </Button>
          )}

          {thread.folder !== 'trash' ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onMoveFolder(thread, 'trash')}
              title="Mettre à la corbeille"
            >
              <Trash2 className="h-4 w-4" />
              <span className="hidden sm:inline">Corbeille</span>
            </Button>
          ) : (
            <>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onMoveFolder(thread, 'inbox')}
              >
                <Inbox className="h-4 w-4" />
                <span className="hidden sm:inline">Restaurer</span>
              </Button>
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={() => onDeletePermanent(thread)}
              >
                <Trash2 className="h-4 w-4" />
                <span className="hidden sm:inline">Supprimer</span>
              </Button>
            </>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onToggleStar(thread)}
            aria-label={thread.starred ? 'Retirer des favoris' : 'Ajouter aux favoris'}
          >
            <Star className={cn('h-4 w-4', thread.starred && 'fill-amber-400 text-amber-500')} />
          </Button>
          {latestMessage && (
            <Button type="button" size="sm" onClick={() => onReply(latestMessage, false)}>
              <Reply className="h-4 w-4" />
              <span>Répondre</span>
            </Button>
          )}
        </div>
      </div>

      {/* Corps scrollable de la conversation */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-4xl space-y-5">
          {/* En-tête objet & métadonnées propres (zero-pill) */}
          <div className="border-b border-slate-200 pb-4 dark:border-slate-800">
            <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900 dark:text-white [text-wrap:balance]">
              {thread.subject}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span className="capitalize">{thread.folder === 'inbox' ? 'Boîte de réception' : thread.folder}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">{messages.length} message{messages.length > 1 ? 's' : ''}</span>
              {thread.labels.map((lbl) => (
                <React.Fragment key={lbl.id}>
                  <span aria-hidden="true">·</span>
                  <span className="font-medium text-teal-700 dark:text-teal-400">{lbl.name}</span>
                </React.Fragment>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="space-y-4">
              {[1, 2].map((i) => (
                <div key={i} className="animate-pulse rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
                  <div className="h-4 w-48 rounded bg-slate-200 dark:bg-slate-800" />
                  <div className="mt-4 space-y-2">
                    <div className="h-3 w-full rounded bg-slate-100 dark:bg-slate-800" />
                    <div className="h-3 w-5/6 rounded bg-slate-100 dark:bg-slate-800" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            messages.map((msg) => {
              const sender = extractSenderName(msg.from);
              const safeHtml = msg.html ? sanitizeEmailHtml(msg.html) : null;

              return (
                <article
                  key={msg.id}
                  className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-[0_12px_40px_-26px_rgba(17,26,51,0.4)] sm:p-6 dark:border-slate-700/50 dark:bg-slate-900/80 dark:shadow-none"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4 dark:border-slate-800">
                    <div className="flex items-start gap-3 min-w-0">
                      <SenderAvatar name={sender.name} size="lg" />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-baseline gap-2">
                          <span className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                            {sender.name}
                          </span>
                          <span className="font-mono text-xs text-slate-500 dark:text-slate-400 truncate">
                            {sender.email}
                          </span>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                          <span>À : {msg.to.join(', ')}</span>
                          {msg.cc.length > 0 && <span>Cc : {msg.cc.join(', ')}</span>}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <time
                        dateTime={msg.receivedAt}
                        className="text-xs font-medium tabular-nums text-slate-500 dark:text-slate-400"
                      >
                        {formatFullDateTime(msg.receivedAt)}
                      </time>
                    </div>
                  </div>

                  {/* Contenu e-mail assaini contre XSS */}
                  <div className="mt-4 text-sm text-slate-800 dark:text-slate-200">
                    {safeHtml ? (
                      <div
                        className="cardmail-email-body"
                        dangerouslySetInnerHTML={{ __html: safeHtml }}
                      />
                    ) : (
                      <pre className="whitespace-pre-wrap font-sans leading-relaxed">
                        {msg.text || '(Message sans contenu texte)'}
                      </pre>
                    )}
                  </div>

                  {/* Pièces jointes sécurisées */}
                  {msg.attachments.length > 0 && (
                    <div className="mt-5 border-t border-slate-100 pt-4 dark:border-slate-800">
                      <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-400">
                        <Paperclip className="h-3.5 w-3.5" />
                        <span>Pièces jointes ({msg.attachments.length})</span>
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {msg.attachments.map((att) => (
                          <a
                            key={att.id}
                            href={`/api/mail/attachments/${encodeURIComponent(thread.id)}/${encodeURIComponent(msg.id)}/${encodeURIComponent(att.id)}?inboxId=${encodeURIComponent(inboxId)}`}
                            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-800 transition-colors hover:border-teal-500 hover:bg-teal-50/40 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-100 dark:hover:border-teal-500"
                          >
                            <Download className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                            <span className="max-w-44 truncate">{att.filename}</span>
                            {att.size > 0 && (
                              <span className="font-mono text-[11px] tabular-nums text-slate-500 dark:text-slate-400">
                                {formatFileSize(att.size)}
                              </span>
                            )}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Actions sur le message */}
                  <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
                    <Button type="button" variant="outline" size="sm" onClick={() => onReply(msg, false)}>
                      <Reply className="h-3.5 w-3.5" />
                      <span>Répondre</span>
                    </Button>
                    {(msg.cc.length > 0 || msg.to.length > 1) && (
                      <Button type="button" variant="outline" size="sm" onClick={() => onReply(msg, true)}>
                        <ReplyAll className="h-3.5 w-3.5" />
                        <span>Répondre à tous</span>
                      </Button>
                    )}
                    <Button type="button" variant="outline" size="sm" onClick={() => onForward(msg)}>
                      <Forward className="h-3.5 w-3.5" />
                      <span>Transférer</span>
                    </Button>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
};
