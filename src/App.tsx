import React, { useCallback, useEffect, useState } from 'react';
import { Toaster, toast } from 'sonner';
import { AdminView } from './components/admin/AdminView.tsx';
import { LoginView } from './components/auth/LoginView.tsx';
import { ContactsView } from './components/contacts/ContactsView.tsx';
import { AppShell } from './components/layout/AppShell.tsx';
import { ComposeModal, type ComposeContext } from './components/mail/ComposeModal.tsx';
import { ConversationPane } from './components/mail/ConversationPane.tsx';
import { Sidebar } from './components/mail/Sidebar.tsx';
import { ThreadList } from './components/mail/ThreadList.tsx';
import { SettingsView } from './components/settings/SettingsView.tsx';
import { useMailPolling } from './hooks/useMailPolling.ts';
import { apiFetch } from './lib/api.ts';
import type {
  ContactItem,
  EmailMessage,
  MailDraft,
  MailThread,
  MailView,
  NotificationItem,
  UserInbox,
  UserPreferences,
  UserProfile,
} from './types/cardmail.ts';

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error.message };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="app-bg flex min-h-screen items-center justify-center p-6">
          <div className="max-w-md rounded-xl border border-slate-200 bg-white p-6 text-center dark:border-slate-800 dark:bg-slate-900">
            <h1 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
              Une erreur inattendue est survenue
            </h1>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{this.state.message}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 rounded-lg bg-teal-600 px-4 py-2 text-xs font-medium text-white"
            >
              Recharger CARDMail
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [booting, setBooting] = useState(true);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [inboxes, setInboxes] = useState<UserInbox[]>([]);
  const [activeInboxId, setActiveInboxId] = useState<string>('');
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [resolvedDark, setResolvedDark] = useState(false);

  const [activeView, setActiveView] = useState<MailView>('inbox');
  const [threads, setThreads] = useState<MailThread[]>([]);
  const [drafts, setDrafts] = useState<MailDraft[]>([]);
  const [hasMoreThreads, setHasMoreThreads] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [threadsLoading, setThreadsLoading] = useState(false);

  const [selectedThread, setSelectedThread] = useState<MailThread | null>(null);
  const [messages, setMessages] = useState<EmailMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'unread' | 'attachments'>('all');

  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const [composeOpen, setComposeOpen] = useState(false);
  const [composeContext, setComposeContext] = useState<ComposeContext>({ mode: 'new' });

  // Application du thème clair/sombre sur <html>
  useEffect(() => {
    const theme = preferences?.theme || 'system';
    const apply = () => {
      const dark =
        theme === 'dark' ||
        (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      setResolvedDark(dark);
      document.documentElement.classList.toggle('dark', dark);
    };
    apply();
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [preferences?.theme]);

  // Vérification de session au chargement
  useEffect(() => {
    const boot = async () => {
      try {
        const res = await apiFetch<{
          user: UserProfile;
          inboxes: UserInbox[];
          preferences: UserPreferences;
        }>('/api/auth/me');
        setUser(res.user);
        setInboxes(res.inboxes);
        setPreferences(res.preferences);
        const def = res.inboxes.find((i) => i.isDefault) || res.inboxes[0];
        if (def) setActiveInboxId(def.id);
      } catch {
        setUser(null);
      } finally {
        setBooting(false);
      }
    };
    void boot();
  }, []);

  const activeInbox = inboxes.find((i) => i.id === activeInboxId) || inboxes[0] || null;

  const loadContacts = useCallback(async () => {
    if (!user) return;
    try {
      const res = await apiFetch<{ data: ContactItem[] }>('/api/contacts');
      setContacts(res.data);
    } catch {
      // ignore
    }
  }, [user]);

  const loadNotifications = useCallback(async () => {
    if (!user) return;
    try {
      const res = await apiFetch<{ data: NotificationItem[] }>('/api/notifications');
      setNotifications(res.data);
    } catch {
      // ignore
    }
  }, [user]);

  const loadDrafts = useCallback(async () => {
    if (!user || !activeInboxId) return;
    try {
      const res = await apiFetch<{ data: MailDraft[] }>(
        `/api/mail/drafts?inboxId=${encodeURIComponent(activeInboxId)}`
      );
      setDrafts(res.data);
    } catch {
      // ignore
    }
  }, [user, activeInboxId]);

  const loadThreads = useCallback(
    async (append = false) => {
      if (!user || !activeInboxId) return;
      if (['contacts', 'settings', 'admin'].includes(activeView)) return;

      if (activeView === 'drafts') {
        setThreadsLoading(true);
        await loadDrafts();
        setThreadsLoading(false);
        return;
      }

      setThreadsLoading(true);
      try {
        const params = new URLSearchParams({
          inboxId: activeInboxId,
          view: activeView,
          limit: '25',
        });
        if (searchQuery.trim()) params.set('q', searchQuery.trim());
        if (filterMode === 'unread') params.set('unreadOnly', 'true');
        if (filterMode === 'attachments') params.set('hasAttachment', 'true');
        if (append && nextCursor) params.set('after', nextCursor);
        if (append && !nextCursor) params.set('offset', String(threads.length));

        const res = await apiFetch<{
          data: MailThread[];
          hasMore: boolean;
          nextCursor: string | null;
        }>(`/api/mail/threads?${params.toString()}`);

        setThreads((prev) => (append ? [...prev, ...res.data] : res.data));
        setHasMoreThreads(res.hasMore);
        setNextCursor(res.nextCursor);
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'Erreur chargement conversations.');
      } finally {
        setThreadsLoading(false);
      }
    },
    [user, activeInboxId, activeView, searchQuery, filterMode, nextCursor, threads.length, loadDrafts]
  );

  useEffect(() => {
    if (user) {
      void loadContacts();
      void loadNotifications();
    }
  }, [user, loadContacts, loadNotifications]);

  useEffect(() => {
    if (user && activeInboxId) {
      void loadThreads(false);
      void loadDrafts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, activeInboxId, activeView, searchQuery, filterMode]);

  const openThread = async (thread: MailThread) => {
    setSelectedThread(thread);
    setMessagesLoading(true);
    try {
      const res = await apiFetch<{ thread: MailThread; messages: EmailMessage[] }>(
        `/api/mail/threads/${encodeURIComponent(thread.id)}?inboxId=${encodeURIComponent(activeInboxId)}`
      );
      setSelectedThread(res.thread);
      setMessages(res.messages);

      if (!res.thread.read) {
        await apiFetch(`/api/mail/threads/${encodeURIComponent(thread.id)}`, {
          method: 'PATCH',
          body: JSON.stringify({ inboxId: activeInboxId, read: true }),
        });
        setThreads((prev) => prev.map((t) => (t.id === thread.id ? { ...t, read: true } : t)));
        setSelectedThread((prev) => (prev ? { ...prev, read: true } : prev));
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Impossible de charger la conversation.');
    } finally {
      setMessagesLoading(false);
    }
  };

  // Synchronisation quasi temps réel par scrutation (compatible serverless)
  useMailPolling(Boolean(user), (evt) => {
    if (evt.type === 'notification:new') {
      void loadNotifications();
      if (evt.inboxId === activeInboxId || evt.inboxId === '*') {
        void loadThreads(false);
      }
      const subject = typeof evt.data?.subject === 'string' ? evt.data.subject : 'Nouveau courrier';
      toast.info(`Nouveau message : ${subject}`);
    } else if (evt.type === 'mail:synced' || evt.type === 'thread:updated') {
      if (evt.inboxId === activeInboxId || evt.inboxId === '*') {
        void loadThreads(false);
        if (evt.threadId && selectedThread?.id === evt.threadId) {
          void openThread(selectedThread);
        }
      }
    }
  });

  const handleToggleStar = async (thread: MailThread, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const nextStar = !thread.starred;
    setThreads((prev) => prev.map((t) => (t.id === thread.id ? { ...t, starred: nextStar } : t)));
    if (selectedThread?.id === thread.id) {
      setSelectedThread({ ...selectedThread, starred: nextStar });
    }
    try {
      await apiFetch(`/api/mail/threads/${encodeURIComponent(thread.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ inboxId: activeInboxId, starred: nextStar }),
      });
    } catch {
      void loadThreads(false);
    }
  };

  const handleToggleRead = async (thread: MailThread) => {
    const nextRead = !thread.read;
    try {
      await apiFetch(`/api/mail/threads/${encodeURIComponent(thread.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ inboxId: activeInboxId, read: nextRead }),
      });
      setThreads((prev) => prev.map((t) => (t.id === thread.id ? { ...t, read: nextRead } : t)));
      if (selectedThread?.id === thread.id) {
        setSelectedThread({ ...selectedThread, read: nextRead });
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erreur mise à jour.');
    }
  };

  const handleMoveFolder = async (thread: MailThread, folder: 'inbox' | 'archive' | 'trash') => {
    try {
      await apiFetch(`/api/mail/threads/${encodeURIComponent(thread.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ inboxId: activeInboxId, folder }),
      });
      setThreads((prev) => prev.filter((t) => t.id !== thread.id));
      if (selectedThread?.id === thread.id) {
        setSelectedThread(null);
        setMessages([]);
      }
      toast.success(
        folder === 'archive'
          ? 'Conversation archivée.'
          : folder === 'trash'
          ? 'Conversation déplacée dans la corbeille.'
          : 'Conversation restaurée.'
      );
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erreur déplacement.');
    }
  };

  const handleDeletePermanent = async (thread: MailThread) => {
    try {
      await apiFetch(
        `/api/mail/threads/${encodeURIComponent(thread.id)}?inboxId=${encodeURIComponent(activeInboxId)}`,
        { method: 'DELETE' }
      );
      setThreads((prev) => prev.filter((t) => t.id !== thread.id));
      setSelectedThread(null);
      setMessages([]);
      toast.success('Conversation supprimée définitivement.');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erreur suppression.');
    }
  };

  const handleDeleteDraft = async (draftId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await apiFetch(
        `/api/mail/drafts/${encodeURIComponent(draftId)}?inboxId=${encodeURIComponent(activeInboxId)}`,
        { method: 'DELETE' }
      );
      setDrafts((prev) => prev.filter((d) => d.id !== draftId));
      toast.success('Brouillon supprimé.');
    } catch {
      toast.error('Impossible de supprimer le brouillon.');
    }
  };

  const handleToggleTheme = async () => {
    if (!preferences) return;
    const nextTheme = resolvedDark ? 'light' : 'dark';
    setPreferences({ ...preferences, theme: nextTheme });
    try {
      await apiFetch('/api/preferences', {
        method: 'PATCH',
        body: JSON.stringify({ theme: nextTheme }),
      });
    } catch {
      // ignore
    }
  };

  const handleLogout = async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    setUser(null);
    setInboxes([]);
    setThreads([]);
    setSelectedThread(null);
  };

  if (booting) {
    return (
      <div className="app-bg flex min-h-screen items-center justify-center">
        <div role="status" aria-label="Chargement de CARDMail" className="flex flex-col items-center gap-4">
          <img src="/brand/mark.png" alt="" className="h-16 w-auto motion-safe:animate-pulse" />
          <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Chargement de votre messagerie…</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <AppErrorBoundary>
        <Toaster position="top-right" richColors />
        <LoginView
          onSuccess={(data) => {
            setUser(data.user);
            setInboxes(data.inboxes);
            setPreferences(data.preferences);
            const def = data.inboxes.find((i) => i.isDefault) || data.inboxes[0];
            if (def) setActiveInboxId(def.id);
          }}
        />
      </AppErrorBoundary>
    );
  }

  const unreadCount = activeView === 'inbox' ? threads.filter((t) => !t.read).length : 0;
  const isMailWorkspace = !['contacts', 'settings', 'admin'].includes(activeView);

  return (
    <AppErrorBoundary>
      <Toaster position="top-right" richColors />
      <AppShell
        user={user}
        activeInbox={activeInbox}
        notifications={notifications}
        resolvedDark={resolvedDark}
        onToggleTheme={() => void handleToggleTheme()}
        onMarkNotificationsRead={() => {
          void apiFetch('/api/notifications/read', { method: 'POST', body: JSON.stringify({}) });
          setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        }}
        onLogout={() => void handleLogout()}
        activeView={activeView}
        onSelectView={(v) => {
          setActiveView(v);
          setSelectedThread(null);
          setMessages([]);
        }}
        onCompose={() => {
          setComposeContext({ mode: 'new' });
          setComposeOpen(true);
        }}
        sidebar={
          <Sidebar
            activeView={activeView}
            onSelectView={(v) => {
              setActiveView(v);
              setSelectedThread(null);
              setMessages([]);
            }}
            onCompose={() => {
              setComposeContext({ mode: 'new' });
              setComposeOpen(true);
            }}
            role={user.role}
            unreadCount={unreadCount}
            draftCount={drafts.length}
            inboxes={inboxes}
            activeInboxId={activeInboxId}
            onChangeInbox={(id) => {
              setActiveInboxId(id);
              setSelectedThread(null);
              setMessages([]);
            }}
          />
        }
      >
        {activeView === 'contacts' ? (
          <ContactsView
            contacts={contacts}
            onRefresh={loadContacts}
            onComposeTo={(email) => {
              setComposeContext({ mode: 'new', initialTo: email });
              setComposeOpen(true);
            }}
          />
        ) : activeView === 'settings' && preferences ? (
          <SettingsView
            user={user}
            preferences={preferences}
            onUpdated={(u, p) => {
              setUser(u);
              setPreferences(p);
            }}
          />
        ) : activeView === 'admin' && (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') ? (
          <AdminView currentUser={user} />
        ) : !activeInbox ? (
          <div className="flex flex-1 items-center justify-center p-8 text-center">
            <div className="max-w-md rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
                Aucune boîte attribuée
              </h2>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                Votre compte est actif mais aucune boîte professionnelle @cardit.cm ne lui est encore associée. Contactez votre administrateur.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-1 overflow-hidden">
            {/* Sur mobile, masque la liste quand une conversation est ouverte */}
            <div className={selectedThread && isMailWorkspace ? 'hidden md:flex h-full' : 'flex h-full w-full md:w-auto'}>
              <ThreadList
                view={activeView}
                threads={threads}
                drafts={drafts}
                selectedThreadId={selectedThread?.id || null}
                loading={threadsLoading}
                hasMore={hasMoreThreads}
                searchQuery={searchQuery}
                filterMode={filterMode}
                onSearchChange={setSearchQuery}
                onFilterChange={setFilterMode}
                onRefresh={() => void loadThreads(false)}
                onLoadMore={() => void loadThreads(true)}
                onSelectThread={(t) => void openThread(t)}
                onToggleStar={(t, e) => void handleToggleStar(t, e)}
                onOpenDraft={(d) => {
                  setComposeContext({ mode: 'draft', draft: d });
                  setComposeOpen(true);
                }}
                onDeleteDraft={(id, e) => void handleDeleteDraft(id, e)}
                compactDensity={preferences?.compactDensity}
              />
            </div>

            <div className={selectedThread ? 'flex flex-1 h-full overflow-hidden' : 'hidden md:flex flex-1 h-full overflow-hidden'}>
              <ConversationPane
                thread={selectedThread}
                messages={messages}
                loading={messagesLoading}
                inboxId={activeInbox.id}
                onBackMobile={() => setSelectedThread(null)}
                onReply={(msg, replyAll) => {
                  if (!selectedThread) return;
                  setComposeContext({ mode: 'reply', threadId: selectedThread.id, message: msg, replyAll });
                  setComposeOpen(true);
                }}
                onForward={(msg) => {
                  if (!selectedThread) return;
                  setComposeContext({ mode: 'forward', threadId: selectedThread.id, message: msg });
                  setComposeOpen(true);
                }}
                onToggleRead={(t) => void handleToggleRead(t)}
                onToggleStar={(t) => void handleToggleStar(t)}
                onMoveFolder={(t, f) => void handleMoveFolder(t, f)}
                onDeletePermanent={(t) => void handleDeletePermanent(t)}
              />
            </div>
          </div>
        )}
      </AppShell>

      {activeInbox && (
        <ComposeModal
          open={composeOpen}
          onOpenChange={setComposeOpen}
          context={composeContext}
          userId={user!.id}
          inboxId={activeInbox.id}
          inboxEmail={activeInbox.emailAddress}
          signatureHtml={preferences?.signatureHtml || ''}
          contacts={contacts}
          onSent={() => {
            void loadThreads(false);
            void loadDrafts();
            if (selectedThread) {
              void openThread(selectedThread);
            }
          }}
        />
      )}
    </AppErrorBoundary>
  );
}
