import {
  Archive,
  FileEdit,
  Inbox,
  PenSquare,
  Send,
  Settings,
  Shield,
  Star,
  Trash2,
  Users,
} from 'lucide-react';
import React from 'react';
import { cn } from '../../lib/utils.ts';
import type { MailView, RoleType, UserInbox } from '../../types/cardmail.ts';
import { Button } from '../ui/primitives.tsx';

interface SidebarProps {
  activeView: MailView;
  onSelectView: (view: MailView) => void;
  onCompose: () => void;
  role: RoleType;
  unreadCount: number;
  draftCount: number;
  inboxes: UserInbox[];
  activeInboxId: string;
  onChangeInbox: (inboxId: string) => void;
  className?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  onSelectView,
  onCompose,
  role,
  unreadCount,
  draftCount,
  inboxes,
  activeInboxId,
  onChangeInbox,
  className,
}) => {
  const mailFolders: Array<{ id: MailView; label: string; icon: React.ComponentType<{ className?: string }>; count?: number }> = [
    { id: 'inbox', label: 'Boîte de réception', icon: Inbox, count: unreadCount },
    { id: 'sent', label: 'Messages envoyés', icon: Send },
    { id: 'drafts', label: 'Brouillons', icon: FileEdit, count: draftCount },
    { id: 'starred', label: 'Favoris', icon: Star },
    { id: 'archive', label: 'Archives', icon: Archive },
    { id: 'trash', label: 'Corbeille', icon: Trash2 },
  ];

  const workspaceViews: Array<{ id: MailView; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'contacts', label: 'Contacts', icon: Users },
    { id: 'settings', label: 'Paramètres', icon: Settings },
  ];

  if (role === 'ADMIN' || role === 'SUPER_ADMIN') {
    workspaceViews.push({ id: 'admin', label: 'Administration', icon: Shield });
  }

  return (
    <aside
      className={cn(
        'flex h-full w-64 shrink-0 flex-col border-r border-slate-200/70 bg-white/60 px-3 py-4 backdrop-blur-md dark:border-slate-700/50 dark:bg-slate-900/50',
        className
      )}
    >
      <div className="mb-4 px-1">
        <Button onClick={onCompose} className="w-full justify-center gap-2 h-11">
          <PenSquare className="h-4 w-4" />
          <span>Nouveau message</span>
        </Button>
      </div>

      {inboxes.length > 1 && (
        <div className="mb-4 px-1">
          <label htmlFor="inbox-switcher" className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
            Boîte active
          </label>
          <select
            id="inbox-switcher"
            value={activeInboxId}
            onChange={(e) => onChangeInbox(e.target.value)}
            className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs font-medium text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          >
            {inboxes.map((inb) => (
              <option key={inb.id} value={inb.id}>
                {inb.emailAddress}
              </option>
            ))}
          </select>
        </div>
      )}

      <nav aria-label="Dossiers de messagerie" className="flex-1 space-y-0.5 overflow-y-auto">
        {mailFolders.map((item) => {
          const Icon = item.icon;
          const active = activeView === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectView(item.id)}
              className={cn(
                'relative flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition-colors cursor-pointer whitespace-nowrap',
                active
                  ? 'bg-white text-teal-800 shadow-[0_1px_2px_rgba(17,26,51,0.06),0_0_0_1px_rgba(21,86,214,0.12)] before:absolute before:left-0 before:top-2 before:bottom-2 before:w-[3px] before:rounded-full before:bg-accent-500 dark:bg-teal-950/70 dark:text-teal-200 dark:shadow-[0_0_0_1px_rgba(91,144,251,0.2)]'
                  : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800/70'
              )}
            >
              <span className="flex items-center gap-2.5 truncate">
                <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-teal-600 dark:text-teal-400' : 'text-slate-500 dark:text-slate-400')} />
                <span className="truncate">{item.label}</span>
              </span>
              {typeof item.count === 'number' && item.count > 0 && (
                <span className="ml-2 min-w-5 rounded-full bg-accent-500 px-1.5 py-0.5 text-center text-[11px] font-bold tabular-nums leading-none text-white">
                  {item.count}
                </span>
              )}
            </button>
          );
        })}

        <div className="my-3 border-t border-slate-200 dark:border-slate-800" />

        {workspaceViews.map((item) => {
          const Icon = item.icon;
          const active = activeView === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectView(item.id)}
              className={cn(
                'relative flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors cursor-pointer whitespace-nowrap',
                active
                  ? 'bg-white text-teal-800 shadow-[0_1px_2px_rgba(17,26,51,0.06),0_0_0_1px_rgba(21,86,214,0.12)] before:absolute before:left-0 before:top-2 before:bottom-2 before:w-[3px] before:rounded-full before:bg-accent-500 dark:bg-teal-950/70 dark:text-teal-200 dark:shadow-[0_0_0_1px_rgba(91,144,251,0.2)]'
                  : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800/70'
              )}
            >
              <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-teal-600 dark:text-teal-400' : 'text-slate-500 dark:text-slate-400')} />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
};
