import {
  Activity,
  KeyRound,
  Link2,
  MailPlus,
  RefreshCw,
  ShieldCheck,
  UserPlus,
  Users,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { apiFetch } from '../../lib/api.ts';
import { cn, formatFullDateTime } from '../../lib/utils.ts';
import type { AuditLogItem, RoleType, ServiceStatusReport, UserProfile } from '../../types/cardmail.ts';
import { Button, Dialog, DialogContent, Input } from '../ui/primitives.tsx';

interface AdminUserRow extends UserProfile {
  inboxes: Array<{ id: string; emailAddress: string; displayName: string; isDefault: boolean }>;
}

interface AdminInboxRow {
  id: string;
  resendInboxId: string;
  emailAddress: string;
  displayName: string;
  fromName: string;
  syncStatus: 'ACTIVE' | 'ERROR' | 'PAUSED';
  lastSyncAt: string | null;
  lastError: string | null;
}

export const AdminView: React.FC<{ currentUser: UserProfile }> = ({ currentUser }) => {
  const [tab, setTab] = useState<'users' | 'inboxes' | 'audit' | 'health'>('users');
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [inboxes, setInboxes] = useState<AdminInboxRow[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [health, setHealth] = useState<ServiceStatusReport | null>(null);
  const [loading, setLoading] = useState(true);

  // Modale création utilisateur
  const [newUserOpen, setNewUserOpen] = useState(false);
  const [uEmail, setUEmail] = useState('');
  const [uFirst, setUFirst] = useState('');
  const [uLast, setULast] = useState('');
  const [uPassword, setUPassword] = useState('');
  const [uRole, setURole] = useState<RoleType>('USER');
  const [uInboxId, setUInboxId] = useState('');

  // Modale création boîte Resend
  const [newInboxOpen, setNewInboxOpen] = useState(false);
  const [iEmail, setIEmail] = useState('');
  const [iDisplay, setIDisplay] = useState('');
  const [iFrom, setIFrom] = useState('');

  // Modale réinitialisation mot de passe
  const [resetTarget, setResetTarget] = useState<AdminUserRow | null>(null);
  const [resetPw, setResetPw] = useState('');

  // Modale association boîte
  const [assignTarget, setAssignTarget] = useState<AdminUserRow | null>(null);
  const [assignInboxId, setAssignInboxId] = useState('');

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [uRes, iRes, aRes, sRes] = await Promise.all([
        apiFetch<{ data: AdminUserRow[] }>('/api/admin/users'),
        apiFetch<{ data: AdminInboxRow[] }>('/api/admin/inboxes'),
        apiFetch<{ data: AuditLogItem[] }>('/api/admin/audit-logs'),
        apiFetch<{ data: ServiceStatusReport }>('/api/admin/service-status'),
      ]);
      setUsers(uRes.data);
      setInboxes(iRes.data);
      setAuditLogs(aRes.data);
      setHealth(sRes.data);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erreur chargement administration.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify({
          email: uEmail,
          firstName: uFirst,
          lastName: uLast,
          password: uPassword,
          role: uRole,
          inboxId: uInboxId || undefined,
        }),
      });
      setNewUserOpen(false);
      setUEmail('');
      setUFirst('');
      setULast('');
      setUPassword('');
      toast.success('Collaborateur créé.');
      await loadAll();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erreur création utilisateur.');
    }
  };

  const handleToggleActive = async (u: AdminUserRow) => {
    try {
      await apiFetch(`/api/admin/users/${encodeURIComponent(u.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !u.isActive }),
      });
      toast.success(u.isActive ? 'Compte désactivé.' : 'Compte réactivé.');
      await loadAll();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erreur mise à jour.');
    }
  };

  const handleChangeRole = async (u: AdminUserRow, role: RoleType) => {
    try {
      await apiFetch(`/api/admin/users/${encodeURIComponent(u.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      });
      toast.success('Rôle mis à jour.');
      await loadAll();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Action refusée.');
    }
  };

  const handleAdminResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTarget) return;
    try {
      await apiFetch(`/api/admin/users/${encodeURIComponent(resetTarget.id)}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ newPassword: resetPw }),
      });
      setResetTarget(null);
      setResetPw('');
      toast.success('Mot de passe réinitialisé.');
      await loadAll();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erreur réinitialisation.');
    }
  };

  const handleCreateInbox = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/admin/inboxes', {
        method: 'POST',
        body: JSON.stringify({
          emailAddress: iEmail,
          displayName: iDisplay,
          fromName: iFrom,
        }),
      });
      setNewInboxOpen(false);
      setIEmail('');
      setIDisplay('');
      setIFrom('');
      toast.success('Boîte Resend Inbox créée.');
      await loadAll();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erreur création boîte.');
    }
  };

  const handleSyncInboxes = async () => {
    try {
      const res = await apiFetch<{ synced: number; message?: string }>('/api/admin/inboxes/sync', {
        method: 'POST',
      });
      toast.success(res.message || `${res.synced} boîte(s) synchronisée(s).`);
      await loadAll();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erreur de synchronisation.');
    }
  };

  const handleAssignInbox = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignTarget || !assignInboxId) return;
    try {
      await apiFetch('/api/admin/assignments', {
        method: 'POST',
        body: JSON.stringify({ userId: assignTarget.id, inboxId: assignInboxId, isDefault: true }),
      });
      setAssignTarget(null);
      setAssignInboxId('');
      toast.success('Boîte attribuée au collaborateur.');
      await loadAll();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erreur attribution.');
    }
  };

  const handleUnassign = async (userId: string, inboxId: string) => {
    try {
      await apiFetch('/api/admin/assignments', {
        method: 'DELETE',
        body: JSON.stringify({ userId, inboxId }),
      });
      toast.info('Association supprimée.');
      await loadAll();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erreur suppression.');
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50/70 p-4 sm:p-6 lg:p-8 dark:bg-[#070C1C]">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-semibold text-slate-900 dark:text-white">
              Espace Administration CARDIT
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Gestion des collaborateurs, boîtes Resend Inboxes et audit · Confidentialité stricte : aucun accès aux contenus privés des courriels.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => void loadAll()} disabled={loading}>
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
              <span>Actualiser</span>
            </Button>
          </div>
        </div>

        {/* Navigation par onglets */}
        <div className="flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1.5 dark:border-slate-800 dark:bg-slate-900">
          {(
            [
              { id: 'users', label: 'Collaborateurs & RBAC', icon: Users },
              { id: 'inboxes', label: 'Boîtes Resend Inboxes', icon: MailPlus },
              { id: 'audit', label: 'Journaux de connexion & Audit', icon: ShieldCheck },
              { id: 'health', label: 'État des services & Webhooks', icon: Activity },
            ] as const
          ).map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={cn(
                  'flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer',
                  active
                    ? 'bg-teal-600 text-white dark:bg-teal-500 dark:text-slate-950'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Onglet Collaborateurs */}
        {tab === 'users' && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <Button size="sm" onClick={() => setNewUserOpen(true)}>
                <UserPlus className="h-4 w-4" />
                <span>Créer un collaborateur</span>
              </Button>
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50/80 text-xs font-medium text-slate-500 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-400">
                    <tr>
                      <th className="px-4 py-3">Collaborateur</th>
                      <th className="px-4 py-3">Rôle</th>
                      <th className="px-4 py-3">Boîtes attribuées</th>
                      <th className="px-4 py-3">Statut</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {users.map((u) => (
                      <tr key={u.id}>
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-900 dark:text-white">
                            {u.firstName} {u.lastName}
                          </div>
                          <div className="font-mono text-xs text-slate-500 dark:text-slate-400">
                            {u.email}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <select
                            aria-label={`Rôle de ${u.email}`}
                            value={u.role}
                            disabled={
                              u.id === currentUser.id ||
                              (u.role === 'SUPER_ADMIN' && currentUser.role !== 'SUPER_ADMIN')
                            }
                            onChange={(e) => void handleChangeRole(u, e.target.value as RoleType)}
                            className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs font-medium text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                          >
                            <option value="USER">Utilisateur</option>
                            <option value="ADMIN">Administrateur</option>
                            {currentUser.role === 'SUPER_ADMIN' && (
                              <option value="SUPER_ADMIN">Super Administrateur</option>
                            )}
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          <div className="space-y-1">
                            {u.inboxes.length === 0 ? (
                              <span className="text-xs text-slate-400">Aucune boîte</span>
                            ) : (
                              u.inboxes.map((inb) => (
                                <div key={inb.id} className="flex items-center gap-2 font-mono text-xs">
                                  <span className="text-slate-700 dark:text-slate-300">{inb.emailAddress}</span>
                                  <button
                                    type="button"
                                    onClick={() => void handleUnassign(u.id, inb.id)}
                                    className="text-[11px] text-red-600 hover:underline dark:text-red-400 cursor-pointer"
                                  >
                                    Retirer
                                  </button>
                                </div>
                              ))
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs">
                          <span className={u.isActive ? 'font-medium text-emerald-700 dark:text-emerald-400' : 'font-medium text-red-600 dark:text-red-400'}>
                            {u.isActive ? 'Actif' : 'Désactivé'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setAssignTarget(u);
                                setAssignInboxId(inboxes[0]?.id || '');
                              }}
                              title="Attribuer une boîte"
                            >
                              <Link2 className="h-3.5 w-3.5" />
                              <span className="hidden xl:inline">Boîte</span>
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setResetTarget(u);
                                setResetPw('');
                              }}
                              title="Réinitialiser mot de passe"
                            >
                              <KeyRound className="h-3.5 w-3.5" />
                            </Button>
                            {u.id !== currentUser.id && (
                              <Button
                                type="button"
                                variant={u.isActive ? 'ghost' : 'secondary'}
                                size="sm"
                                onClick={() => void handleToggleActive(u)}
                              >
                                {u.isActive ? 'Désactiver' : 'Réactiver'}
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Onglet Boîtes Resend */}
        {tab === 'inboxes' && (
          <div className="space-y-4">
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => void handleSyncInboxes()}>
                <RefreshCw className="h-4 w-4" />
                <span>Synchroniser depuis Resend</span>
              </Button>
              <Button size="sm" onClick={() => setNewInboxOpen(true)}>
                <MailPlus className="h-4 w-4" />
                <span>Nouvelle boîte @cardit.cm</span>
              </Button>
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50/80 text-xs font-medium text-slate-500 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Adresse professionnelle</th>
                    <th className="px-4 py-3">Nom affiché</th>
                    <th className="hidden md:table-cell px-4 py-3">Identifiant Resend</th>
                    <th className="px-4 py-3">Synchronisation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {inboxes.map((inb) => (
                    <tr key={inb.id}>
                      <td className="px-4 py-3 font-mono text-xs font-medium text-slate-900 dark:text-white">
                        {inb.emailAddress}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-700 dark:text-slate-300">
                        {inb.displayName} · <span className="text-slate-500">{inb.fromName}</span>
                      </td>
                      <td className="hidden md:table-cell px-4 py-3 font-mono text-xs text-slate-500 dark:text-slate-400">
                        {inb.resendInboxId}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <span className={inb.syncStatus === 'ACTIVE' ? 'text-emerald-700 dark:text-emerald-400 font-medium' : 'text-red-600 dark:text-red-400 font-medium'}>
                          {inb.syncStatus}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Onglet Audit */}
        {tab === 'audit' && (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50/80 font-medium text-slate-500 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Horodatage</th>
                    <th className="px-4 py-3">Acteur</th>
                    <th className="px-4 py-3">Action</th>
                    <th className="px-4 py-3">Statut</th>
                    <th className="px-4 py-3">Détails</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {auditLogs.map((log) => (
                    <tr key={log.id}>
                      <td className="px-4 py-2.5 font-mono tabular-nums text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {formatFullDateTime(log.createdAt)}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-slate-800 dark:text-slate-200">
                        {log.actorEmail || 'système'}
                      </td>
                      <td className="px-4 py-2.5 font-mono font-medium text-slate-900 dark:text-white">
                        {log.action}
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={cn(
                            'font-medium',
                            log.status === 'SUCCESS'
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : log.status === 'BLOCKED'
                              ? 'text-amber-700 dark:text-amber-400'
                              : 'text-red-600 dark:text-red-400'
                          )}
                        >
                          {log.status}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">
                        {log.details || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Onglet État des services */}
        {tab === 'health' && health && (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                <p className="text-xs text-slate-500 dark:text-slate-400">Mode messagerie</p>
                <p className="mt-1 font-display text-lg font-semibold text-slate-900 dark:text-white">
                  {health.resendConfigured ? 'Resend Inboxes Live' : 'Bac à sable dev'}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                <p className="text-xs text-slate-500 dark:text-slate-400">Vérification Webhook Svix</p>
                <p className="mt-1 font-display text-lg font-semibold text-slate-900 dark:text-white">
                  {health.webhookSecretConfigured ? 'Signature active' : 'Secret manquant'}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                <p className="text-xs text-slate-500 dark:text-slate-400">Boîtes @cardit.cm</p>
                <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-slate-900 dark:text-white">
                  {health.totalInboxes}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                <p className="text-xs text-slate-500 dark:text-slate-400">Erreurs de synchro</p>
                <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-slate-900 dark:text-white">
                  {health.errorInboxes + health.syncErrors.length}
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                Événements Webhooks récents
              </h2>
              {health.recentWebhooks.length === 0 ? (
                <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                  Aucun événement webhook reçu pour le moment. Configurez votre endpoint Resend sur{' '}
                  <code className="font-mono">/api/webhooks/resend</code>.
                </p>
              ) : (
                <div className="mt-3 divide-y divide-slate-100 text-xs dark:divide-slate-800">
                  {health.recentWebhooks.map((w) => (
                    <div key={w.svixId} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-medium text-slate-900 dark:text-white">{w.eventType}</span>
                        <span className="font-mono text-slate-400">{w.svixId}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={w.status === 'FAILED' ? 'text-red-600 font-medium' : 'text-emerald-700 dark:text-emerald-400 font-medium'}>
                          {w.status}
                        </span>
                        <span className="font-mono tabular-nums text-slate-500">
                          {formatFullDateTime(w.receivedAt)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modales Admin */}
      <Dialog open={newUserOpen} onOpenChange={setNewUserOpen}>
        <DialogContent title="Nouveau collaborateur CARDIT" className="max-w-md">
          <form onSubmit={handleCreateUser} className="space-y-3.5">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Prénom</label>
                <Input required value={uFirst} onChange={(e) => setUFirst(e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Nom</label>
                <Input required value={uLast} onChange={(e) => setULast(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Adresse e-mail professionnelle</label>
              <Input type="email" required value={uEmail} onChange={(e) => setUEmail(e.target.value)} placeholder="prenom.nom@cardit.cm" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Mot de passe initial (min. 10 car.)</label>
              <Input type="password" required minLength={10} value={uPassword} onChange={(e) => setUPassword(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Rôle</label>
                <select
                  value={uRole}
                  onChange={(e) => setURole(e.target.value as RoleType)}
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm dark:border-slate-700 dark:bg-slate-900"
                >
                  <option value="USER">Utilisateur</option>
                  <option value="ADMIN">Administrateur</option>
                  {currentUser.role === 'SUPER_ADMIN' && <option value="SUPER_ADMIN">Super Admin</option>}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Boîte associée</label>
                <select
                  value={uInboxId}
                  onChange={(e) => setUInboxId(e.target.value)}
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm dark:border-slate-700 dark:bg-slate-900"
                >
                  <option value="">Aucune</option>
                  {inboxes.map((inb) => (
                    <option key={inb.id} value={inb.id}>{inb.emailAddress}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setNewUserOpen(false)}>Annuler</Button>
              <Button type="submit">Créer le compte</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={newInboxOpen} onOpenChange={setNewInboxOpen}>
        <DialogContent title="Créer une boîte Resend Inbox" className="max-w-md">
          <form onSubmit={handleCreateInbox} className="space-y-3.5">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Adresse @cardit.cm</label>
              <Input type="email" required value={iEmail} onChange={(e) => setIEmail(e.target.value)} placeholder="projets@cardit.cm" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Libellé interne</label>
              <Input required value={iDisplay} onChange={(e) => setIDisplay(e.target.value)} placeholder="Cellule Projets" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Nom d'expéditeur (From Name)</label>
              <Input required value={iFrom} onChange={(e) => setIFrom(e.target.value)} placeholder="Projets CARDIT" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setNewInboxOpen(false)}>Annuler</Button>
              <Button type="submit">Provisionner</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(resetTarget)} onOpenChange={(o) => !o && setResetTarget(null)}>
        <DialogContent title="Réinitialiser le mot de passe" description={resetTarget?.email} className="max-w-sm">
          <form onSubmit={handleAdminResetPassword} className="space-y-4">
            <Input
              type="password"
              required
              minLength={10}
              placeholder="Nouveau mot de passe (min. 10 car.)"
              value={resetPw}
              onChange={(e) => setResetPw(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setResetTarget(null)}>Annuler</Button>
              <Button type="submit">Confirmer</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(assignTarget)} onOpenChange={(o) => !o && setAssignTarget(null)}>
        <DialogContent title="Attribuer une boîte professionnelle" description={assignTarget?.email} className="max-w-sm">
          <form onSubmit={handleAssignInbox} className="space-y-4">
            <select
              required
              value={assignInboxId}
              onChange={(e) => setAssignInboxId(e.target.value)}
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
            >
              {inboxes.map((inb) => (
                <option key={inb.id} value={inb.id}>{inb.emailAddress}</option>
              ))}
            </select>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setAssignTarget(null)}>Annuler</Button>
              <Button type="submit">Associer</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
