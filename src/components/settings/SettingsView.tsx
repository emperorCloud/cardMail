import { Bell, KeyRound, Monitor, Moon, Save, Smartphone, Sun } from 'lucide-react';
import React, { useState } from 'react';
import { toast } from 'sonner';
import { usePushNotifications } from '../../hooks/usePushNotifications.ts';
import { apiFetch } from '../../lib/api.ts';
import { sanitizeEmailHtml } from '../../lib/sanitize.ts';
import { cn } from '../../lib/utils.ts';
import type { ThemePreference, UserPreferences, UserProfile } from '../../types/cardmail.ts';
import { PWAInstallButton } from '../pwa/PWAControls.tsx';
import { Button, Input, Switch } from '../ui/primitives.tsx';

interface SettingsViewProps {
  user: UserProfile;
  preferences: UserPreferences;
  onUpdated: (user: UserProfile, prefs: UserPreferences) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ user, preferences, onUpdated }) => {
  const [firstName, setFirstName] = useState(user.firstName);
  const [lastName, setLastName] = useState(user.lastName);
  const [theme, setTheme] = useState<ThemePreference>(preferences.theme);
  const [signatureHtml, setSignatureHtml] = useState(preferences.signatureHtml);
  const [compactDensity, setCompactDensity] = useState(preferences.compactDensity);
  const [saving, setSaving] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [changingPw, setChangingPw] = useState(false);

  const { isSupported: pushSupported, busy: pushBusy, subscribe, unsubscribe } = usePushNotifications();

  const handleSavePreferences = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await apiFetch<{ data: UserPreferences; user: UserProfile }>('/api/preferences', {
        method: 'PATCH',
        body: JSON.stringify({
          firstName,
          lastName,
          theme,
          signatureHtml,
          compactDensity,
        }),
      });
      onUpdated(res.user, res.data);
      toast.success('Paramètres enregistrés.');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erreur d\'enregistrement.');
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePush = async (checked: boolean) => {
    if (checked) {
      const ok = await subscribe();
      if (ok) {
        onUpdated(user, { ...preferences, pushEnabled: true });
        toast.success('Notifications Web Push activées sur cet appareil.');
      } else {
        toast.error('Permission refusée ou navigateur incompatible.');
      }
    } else {
      await unsubscribe();
      onUpdated(user, { ...preferences, pushEnabled: false });
      toast.info('Notifications Web Push désactivées.');
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setChangingPw(true);
    try {
      await apiFetch('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setCurrentPassword('');
      setNewPassword('');
      toast.success('Mot de passe mis à jour avec succès.');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Échec de mise à jour du mot de passe.');
    } finally {
      setChangingPw(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50/70 p-4 sm:p-6 lg:p-8 dark:bg-[#070C1C]">
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-slate-900 dark:text-white">
            Paramètres personnels
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Compte {user.email} · Rôle {user.role}
          </p>
        </div>

        <form onSubmit={handleSavePreferences} className="space-y-6">
          {/* Profil & Apparence */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
              Identité & Affichage
            </h2>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">Prénom</label>
                <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">Nom</label>
                <Input value={lastName} onChange={(e) => setLastName(e.target.value)} required />
              </div>
            </div>

            <div className="mt-5">
              <span className="mb-2 block text-xs font-medium text-slate-600 dark:text-slate-300">Thème de l'interface</span>
              <div className="grid grid-cols-3 gap-2 max-w-md">
                {(
                  [
                    { id: 'light', label: 'Clair', icon: Sun },
                    { id: 'dark', label: 'Sombre', icon: Moon },
                    { id: 'system', label: 'Système', icon: Monitor },
                  ] as const
                ).map((opt) => {
                  const Icon = opt.icon;
                  const active = theme === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setTheme(opt.id)}
                      className={cn(
                        'flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors cursor-pointer',
                        active
                          ? 'border-teal-600 bg-teal-50 text-teal-800 dark:border-teal-500 dark:bg-teal-950/60 dark:text-teal-300'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      <span>{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4 dark:border-slate-800">
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-white">Densité compacte</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Affiche davantage de conversations simultanément dans la liste.
                </p>
              </div>
              <Switch checked={compactDensity} onCheckedChange={setCompactDensity} />
            </div>
          </div>

          {/* Signature professionnelle */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
              Signature professionnelle CARDIT
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Insérée automatiquement à la fin de vos nouveaux messages et réponses.
            </p>
            <textarea
              rows={5}
              value={signatureHtml}
              onChange={(e) => setSignatureHtml(e.target.value)}
              className="mt-3 w-full rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-xs text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
            <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/60">
              <p className="mb-1.5 text-[11px] font-medium text-slate-400">Aperçu de la signature</p>
              <div
                className="cardmail-email-body text-sm text-slate-800 dark:text-slate-200"
                dangerouslySetInnerHTML={{ __html: sanitizeEmailHtml(signatureHtml) }}
              />
            </div>

            <div className="mt-4 flex justify-end">
              <Button type="submit" disabled={saving}>
                <Save className="h-4 w-4" />
                <span>{saving ? 'Enregistrement…' : 'Enregistrer les préférences'}</span>
              </Button>
            </div>
          </div>
        </form>

        {/* Notifications Push & PWA Mobile */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <Bell className="mt-0.5 h-5 w-5 text-teal-600 dark:text-teal-400" />
              <div>
                <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                  Notifications Web Push
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {pushSupported
                    ? 'Recevez une alerte instantanée dès qu\'un message arrive dans votre boîte @cardit.cm.'
                    : 'Votre navigateur actuel ne prend pas en charge les notifications Web Push.'}
                </p>
              </div>
            </div>
            <Switch
              checked={preferences.pushEnabled}
              disabled={!pushSupported || pushBusy}
              onCheckedChange={(v) => void handleTogglePush(v)}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-4 dark:border-slate-800">
            <div className="flex items-start gap-3">
              <Smartphone className="mt-0.5 h-5 w-5 text-teal-600 dark:text-teal-400" />
              <div>
                <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                  Application mobile & bureau (PWA)
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Installez CARDMail sur Android, iOS ou poste de travail en mode autonome sans barre navigateur.
                </p>
              </div>
            </div>
            <PWAInstallButton />
          </div>
        </div>

        {/* Sécurité : Changement de mot de passe */}
        <form
          onSubmit={handleChangePassword}
          className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-teal-600 dark:text-teal-400" />
            <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
              Sécurité du compte
            </h2>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">
                Mot de passe actuel
              </label>
              <Input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">
                Nouveau mot de passe (min. 10 caractères)
              </label>
              <Input
                type="password"
                required
                minLength={10}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button type="submit" variant="outline" disabled={changingPw}>
              {changingPw ? 'Modification…' : 'Mettre à jour le mot de passe'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
