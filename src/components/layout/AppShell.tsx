import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import {
  Bell,
  Inbox,
  LogOut,
  Menu,
  Moon,
  PenSquare,
  Send,
  Settings,
  Shield,
  Sun,
  Users,
  X,
} from 'lucide-react';
import React, { useState } from 'react';
import { cn, formatRelativeDate, getInitials } from '../../lib/utils.ts';
import type { MailView, NotificationItem, UserInbox, UserProfile } from '../../types/cardmail.ts';
import { OfflineIndicator, PWAInstallButton } from '../pwa/PWAControls.tsx';
import { Button } from '../ui/primitives.tsx';

interface AppShellProps {
  user: UserProfile;
  activeInbox: UserInbox | null;
  notifications: NotificationItem[];
  resolvedDark: boolean;
  onToggleTheme: () => void;
  onMarkNotificationsRead: () => void;
  onLogout: () => void;
  activeView: MailView;
  onSelectView: (view: MailView) => void;
  onCompose: () => void;
  sidebar: React.ReactNode;
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({
  user,
  activeInbox,
  notifications,
  resolvedDark,
  onToggleTheme,
  onMarkNotificationsRead,
  onLogout,
  activeView,
  onSelectView,
  onCompose,
  sidebar,
  children,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const unreadNotifs = notifications.filter((n) => !n.read).length;

  return (
    <div className="app-bg flex h-dvh flex-col overflow-hidden text-slate-900 dark:text-slate-100">
      {/* En-tête compacte (respecte le cap mobile <= 15% combiné avec la barre basse) */}
      <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-slate-200/70 glass px-3 sm:px-5 dark:border-slate-700/50">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            aria-label="Ouvrir le menu des dossiers"
            onClick={() => setMobileMenuOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 lg:hidden dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
          >
            <Menu className="h-5 w-5" />
          </button>

          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              onSelectView('inbox');
            }}
            className="flex items-center gap-2.5 whitespace-nowrap shrink-0"
          >
            <img src={resolvedDark ? '/brand/logo-dark.png' : '/brand/logo.png'} alt="CARDMail" className="h-9 w-auto" />
          </a>

          {activeInbox && (
            <span className="hidden sm:inline-block truncate font-mono text-xs text-slate-500 dark:text-slate-400">
              · {activeInbox.emailAddress}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <div className="hidden sm:block">
            <PWAInstallButton compact />
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onToggleTheme}
            aria-label={resolvedDark ? 'Passer en thème clair' : 'Passer en thème sombre'}
            className="h-10 w-10"
          >
            {resolvedDark ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4" />}
          </Button>

          {/* Menu Notifications */}
          <DropdownMenu.Root
            onOpenChange={(open) => {
              if (open && unreadNotifs > 0) {
                onMarkNotificationsRead();
              }
            }}
          >
            <DropdownMenu.Trigger asChild>
              <button
                type="button"
                aria-label="Notifications"
                className="relative flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
              >
                <Bell className="h-4 w-4" />
                {unreadNotifs > 0 && (
                  <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-accent-500 ring-2 ring-white dark:ring-slate-900" />
                )}
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="end"
                sideOffset={6}
                className="z-50 w-80 rounded-xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="px-2.5 py-1.5 text-xs font-semibold text-slate-900 dark:text-white">
                  Notifications
                </div>
                <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                  {notifications.length === 0 ? (
                    <p className="px-2.5 py-6 text-center text-xs text-slate-500 dark:text-slate-400">
                      Aucune notification récente.
                    </p>
                  ) : (
                    notifications.slice(0, 8).map((n) => (
                      <div key={n.id} className="px-2.5 py-2 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-slate-900 dark:text-slate-100 truncate">
                            {n.title}
                          </span>
                          <span className="shrink-0 font-mono text-[10px] text-slate-400">
                            {formatRelativeDate(n.createdAt)}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-slate-500 dark:text-slate-400">{n.body}</p>
                      </div>
                    ))
                  )}
                </div>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>

          {/* Menu Utilisateur */}
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button
                type="button"
                aria-label="Menu utilisateur"
                className="flex h-10 items-center gap-2 rounded-lg px-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                {user.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={`${user.firstName} ${user.lastName}`}
                    referrerPolicy="no-referrer"
                    className="h-8 w-8 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                  />
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-teal-800 text-xs font-semibold text-white ring-2 ring-accent-400/70">
                    {getInitials(`${user.firstName} ${user.lastName}`)}
                  </div>
                )}
                <span className="hidden md:inline max-w-36 truncate text-xs font-medium text-slate-800 dark:text-slate-200">
                  {user.firstName} {user.lastName}
                </span>
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="end"
                sideOffset={6}
                className="z-50 w-60 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="border-b border-slate-100 px-3 py-2 dark:border-slate-800">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                    {user.firstName} {user.lastName}
                  </p>
                  <p className="font-mono text-xs text-slate-500 dark:text-slate-400 truncate">
                    {user.email}
                  </p>
                </div>
                <DropdownMenu.Item
                  onSelect={() => onSelectView('settings')}
                  className="mt-1 flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 focus:outline-none dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <Settings className="h-3.5 w-3.5" />
                  <span>Paramètres</span>
                </DropdownMenu.Item>
                {(user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') && (
                  <DropdownMenu.Item
                    onSelect={() => onSelectView('admin')}
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 focus:outline-none dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    <Shield className="h-3.5 w-3.5" />
                    <span>Administration</span>
                  </DropdownMenu.Item>
                )}
                <DropdownMenu.Item
                  onSelect={onLogout}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 focus:outline-none dark:text-red-400 dark:hover:bg-red-950/40 cursor-pointer"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>Déconnexion</span>
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </header>

      {/* Corps principal */}
      <div className="flex flex-1 overflow-hidden">
        <div className="hidden lg:block h-full">{sidebar}</div>

        {/* Tiroir mobile des dossiers */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 flex lg:hidden">
            <div
              className="fixed inset-0 bg-slate-950/50"
              onClick={() => setMobileMenuOpen(false)}
            />
            <div className="relative z-10 flex h-full w-72 flex-col bg-white dark:bg-slate-900">
              <div className="flex h-14 items-center justify-between border-b border-slate-200 px-4 dark:border-slate-800">
                <span className="font-display font-bold text-slate-900 dark:text-white">CARDMail</span>
                <button
                  type="button"
                  aria-label="Fermer le menu"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-500"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto" onClick={() => setMobileMenuOpen(false)}>
                {sidebar}
              </div>
            </div>
          </div>
        )}

        <main className="flex flex-1 overflow-hidden pb-14 lg:pb-0">{children}</main>
      </div>

      {/* Barre de navigation mobile basse (44px+ hitboxes, compacte) */}
      <nav
        aria-label="Navigation mobile"
        className="fixed bottom-0 left-0 right-0 z-30 grid h-14 grid-cols-5 items-center border-t border-slate-200 bg-white/95 backdrop-blur-md pb-safe lg:hidden dark:border-slate-800 dark:bg-slate-900/95"
      >
        <button
          type="button"
          onClick={() => onSelectView('inbox')}
          className={cn(
            'flex h-12 flex-col items-center justify-center gap-0.5 text-[10px] font-medium',
            activeView === 'inbox' ? 'text-teal-600 dark:text-teal-400' : 'text-slate-500 dark:text-slate-400'
          )}
        >
          <Inbox className="h-4 w-4" />
          <span>Boîte</span>
        </button>
        <button
          type="button"
          onClick={() => onSelectView('sent')}
          className={cn(
            'flex h-12 flex-col items-center justify-center gap-0.5 text-[10px] font-medium',
            activeView === 'sent' ? 'text-teal-600 dark:text-teal-400' : 'text-slate-500 dark:text-slate-400'
          )}
        >
          <Send className="h-4 w-4" />
          <span>Envoyés</span>
        </button>
        <button
          type="button"
          onClick={onCompose}
          aria-label="Nouveau message"
          className="flex h-12 flex-col items-center justify-center gap-0.5 text-[10px] font-medium text-teal-600 dark:text-teal-400"
        >
          <PenSquare className="h-5 w-5" />
          <span>Écrire</span>
        </button>
        <button
          type="button"
          onClick={() => onSelectView('contacts')}
          className={cn(
            'flex h-12 flex-col items-center justify-center gap-0.5 text-[10px] font-medium',
            activeView === 'contacts' ? 'text-teal-600 dark:text-teal-400' : 'text-slate-500 dark:text-slate-400'
          )}
        >
          <Users className="h-4 w-4" />
          <span>Contacts</span>
        </button>
        <button
          type="button"
          onClick={() => onSelectView('settings')}
          className={cn(
            'flex h-12 flex-col items-center justify-center gap-0.5 text-[10px] font-medium',
            activeView === 'settings' ? 'text-teal-600 dark:text-teal-400' : 'text-slate-500 dark:text-slate-400'
          )}
        >
          <Settings className="h-4 w-4" />
          <span>Réglages</span>
        </button>
      </nav>

      <OfflineIndicator />
    </div>
  );
};
