import { Paperclip, RefreshCw, Search, Star } from 'lucide-react';
import React from 'react';
import { cn, extractSenderName, formatRelativeDate } from '../../lib/utils.ts';
import type { MailDraft, MailThread, MailView } from '../../types/cardmail.ts';
import { SenderAvatar } from '../ui/Avatar.tsx';
import { Button, Input } from '../ui/primitives.tsx';

interface ThreadListProps {
  view: MailView;
  threads: MailThread[];
  drafts: MailDraft[];
  selectedThreadId: string | null;
  loading: boolean;
  hasMore: boolean;
  searchQuery: string;
  filterMode: 'all' | 'unread' | 'attachments';
  onSearchChange: (val: string) => void;
  onFilterChange: (mode: 'all' | 'unread' | 'attachments') => void;
  onRefresh: () => void;
  onLoadMore: () => void;
  onSelectThread: (thread: MailThread) => void;
  onToggleStar: (thread: MailThread, e: React.MouseEvent) => void;
  onOpenDraft: (draft: MailDraft) => void;
  onDeleteDraft: (draftId: string, e: React.MouseEvent) => void;
  compactDensity?: boolean;
}

const VIEW_TITLES: Record<string, string> = {
  inbox: 'Boîte de réception',
  sent: 'Messages envoyés',
  drafts: 'Brouillons',
  starred: 'Favoris',
  archive: 'Archives',
  trash: 'Corbeille',
};

export const ThreadList: React.FC<ThreadListProps> = ({
  view,
  threads,
  drafts,
  selectedThreadId,
  loading,
  hasMore,
  searchQuery,
  filterMode,
  onSearchChange,
  onFilterChange,
  onRefresh,
  onLoadMore,
  onSelectThread,
  onToggleStar,
  onOpenDraft,
  onDeleteDraft,
  compactDensity = false,
}) => {
  return (
    <section
      aria-label="Liste des conversations"
      className="flex h-full w-full flex-col border-r border-slate-200/70 bg-white/55 backdrop-blur-sm md:w-88 lg:w-96 shrink-0 dark:border-slate-700/50 dark:bg-slate-900/40"
    >
      {/* Barre de recherche & filtres */}
      <div className="border-b border-slate-200/70 p-3.5 space-y-3 dark:border-slate-700/50">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white truncate">
            {VIEW_TITLES[view] || 'Conversations'}
          </h2>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            disabled={loading}
            aria-label="Actualiser la boîte"
            className="h-9 w-9 p-0"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </Button>
        </div>

        {view !== 'drafts' && (
          <>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                type="search"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Rechercher expéditeur, objet…"
                className="h-10 pl-9 text-[13px]"
              />
            </div>

            <div className="flex items-center gap-1 rounded-xl bg-slate-200/50 p-1 dark:bg-slate-800/80">
              {(
                [
                  { id: 'all', label: 'Tous' },
                  { id: 'unread', label: 'Non lus' },
                  { id: 'attachments', label: 'Pièces jointes' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => onFilterChange(tab.id)}
                  className={cn(
                    'flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer',
                    filterMode === tab.id
                      ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Corps de liste */}
      <div className="flex-1 space-y-1 overflow-y-auto p-2">
        {loading && threads.length === 0 && drafts.length === 0 ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3, 4, 5].map((n) => (
              <div key={n} className="animate-pulse space-y-2 py-2">
                <div className="flex justify-between">
                  <div className="h-3.5 w-32 rounded bg-slate-200 dark:bg-slate-800" />
                  <div className="h-3 w-12 rounded bg-slate-200 dark:bg-slate-800" />
                </div>
                <div className="h-3.5 w-48 rounded bg-slate-200 dark:bg-slate-800" />
                <div className="h-3 w-full rounded bg-slate-100 dark:bg-slate-800/60" />
              </div>
            ))}
          </div>
        ) : view === 'drafts' ? (
          drafts.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Aucun brouillon enregistré</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Vos messages en cours de rédaction apparaîtront ici.
              </p>
            </div>
          ) : (
            drafts.map((draft) => (
              <div
                key={draft.id}
                onClick={() => onOpenDraft(draft)}
                className="flex items-start justify-between gap-3 px-4 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs font-medium text-amber-700 dark:text-amber-400">
                      Brouillon {draft.to.length > 0 ? `· ${draft.to.join(', ')}` : ''}
                    </span>
                    <span className="shrink-0 text-[11px] font-medium tabular-nums text-slate-500 dark:text-slate-400">
                      {formatRelativeDate(draft.updatedAt)}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                    {draft.subject || '(Sans objet)'}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                    {draft.snippet || 'Message vide'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={(e) => onDeleteDraft(draft.id, e)}
                  className="shrink-0 text-xs text-slate-400 hover:text-red-600 dark:hover:text-red-400 cursor-pointer"
                >
                  Supprimer
                </button>
              </div>
            ))
          )
        ) : threads.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-8 py-14 text-center">
            <img src="/brand/mark.png" alt="" className="mb-4 h-14 w-auto opacity-90" />
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              Aucune conversation trouvée
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {searchQuery ? 'Essayez un autre terme de recherche.' : 'Votre dossier est actuellement vide.'}
            </p>
          </div>
        ) : (
          <>
            {threads.map((thread) => {
              const selected = selectedThreadId === thread.id;
              const sender = view === 'sent'
                ? { name: thread.to.join(', ') || 'Destinataire', email: thread.to[0] || '' }
                : extractSenderName(thread.from);

              return (
                <div
                  key={thread.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelectThread(thread)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelectThread(thread);
                    }
                  }}
                  className={cn(
                    'group relative flex items-start gap-3 rounded-2xl px-3 transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500',
                    compactDensity ? 'py-2.5' : 'py-3.5',
                    selected
                      ? 'bg-white shadow-[0_8px_24px_-12px_rgba(21,86,214,0.5),0_0_0_1px_rgba(21,86,214,0.18)] dark:bg-teal-950/60 dark:shadow-[0_0_0_1px_rgba(91,144,251,0.3)]'
                      : !thread.read
                      ? 'bg-white/70 hover:bg-white hover:shadow-[0_6px_18px_-12px_rgba(17,26,51,0.4)] dark:bg-slate-800/40 dark:hover:bg-slate-800/70'
                      : 'hover:bg-white/60 dark:hover:bg-slate-800/40'
                  )}
                >
                  <div className="relative mt-0.5 shrink-0">
                    <SenderAvatar name={sender.name} size="md" />
                    {!thread.read && (
                      <span
                        aria-label="Non lu"
                        className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full bg-accent-500 ring-2 ring-white dark:ring-slate-900"
                      />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={cn(
                          'truncate text-sm',
                          !thread.read
                            ? 'font-semibold text-slate-900 dark:text-white'
                            : 'font-medium text-slate-700 dark:text-slate-300'
                        )}
                      >
                        {sender.name}
                      </span>
                      <span className="shrink-0 text-[11px] font-medium tabular-nums text-slate-500 dark:text-slate-400">
                        {formatRelativeDate(thread.receivedAt)}
                      </span>
                    </div>

                    <div className="mt-0.5 flex items-center gap-1.5">
                      <p
                        className={cn(
                          'truncate text-xs',
                          !thread.read
                            ? 'font-semibold text-slate-900 dark:text-slate-100'
                            : 'font-normal text-slate-700 dark:text-slate-300'
                        )}
                      >
                        {thread.subject}
                      </p>
                      {thread.emailCount > 1 && (
                        <span className="shrink-0 font-mono text-[11px] tabular-nums text-slate-400 dark:text-slate-500">
                          ({thread.emailCount})
                        </span>
                      )}
                    </div>

                    <div className="mt-0.5 flex items-center justify-between gap-2">
                      <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                        {thread.snippet}
                      </p>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {thread.hasAttachment && (
                          <Paperclip className="h-3.5 w-3.5 text-slate-400" aria-label="Contient une pièce jointe" />
                        )}
                        <button
                          type="button"
                          aria-label={thread.starred ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                          onClick={(e) => onToggleStar(thread, e)}
                          className="rounded p-1 text-slate-400 hover:text-amber-500 cursor-pointer"
                        >
                          <Star
                            className={cn(
                              'h-3.5 w-3.5',
                              thread.starred && 'fill-amber-400 text-amber-500'
                            )}
                          />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {hasMore && (
              <div className="p-3 text-center">
                <Button variant="outline" size="sm" onClick={onLoadMore} disabled={loading} className="w-full">
                  {loading ? 'Chargement…' : 'Charger plus de conversations'}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
};
