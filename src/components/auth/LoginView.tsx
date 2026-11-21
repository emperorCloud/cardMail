import { Eye, EyeOff, KeyRound, Lock, Mail, ShieldCheck, Smartphone } from 'lucide-react';
import React, { useState } from 'react';
import { apiFetch } from '../../lib/api.ts';
import type { UserInbox, UserPreferences, UserProfile } from '../../types/cardmail.ts';
import { Button, Dialog, DialogContent, Input } from '../ui/primitives.tsx';

interface LoginResponse {
  user: UserProfile;
  inboxes: UserInbox[];
  preferences: UserPreferences;
  mailMode: 'resend_live' | 'dev_sandbox';
}

interface LoginViewProps {
  onSuccess: (data: LoginResponse) => void;
}

const DEV_ACCOUNTS = [
  { label: 'Direction (Admin)', email: 'direction@cardit.cm', pw: 'CarditDir!2026' },
  { label: 'Super Admin', email: 'admin@cardit.cm', pw: 'CarditAdmin!2026' },
  { label: 'Support (Collaborateur)', email: 'support@cardit.cm', pw: 'CarditSup!2026' },
  { label: 'Contact (Collaborateur)', email: 'contact@cardit.cm', pw: 'CarditCon!2026' },
];

export const LoginView: React.FC<LoginViewProps> = ({ onSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [resetOpen, setResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [resetNewPw, setResetNewPw] = useState('');
  const [resetStep, setResetStep] = useState<'request' | 'confirm'>('request');
  const [resetNotice, setResetNotice] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await apiFetch<LoginResponse>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      onSuccess(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Échec de connexion.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetNotice(null);
    try {
      const res = await apiFetch<{ message: string; devResetToken?: string }>('/api/auth/reset-request', {
        method: 'POST',
        body: JSON.stringify({ email: resetEmail }),
      });
      if (res.devResetToken) {
        setResetToken(res.devResetToken);
      }
      setResetNotice(res.message);
      setResetStep('confirm');
    } catch (err: unknown) {
      setResetNotice(err instanceof Error ? err.message : 'Erreur lors de la demande.');
    }
  };

  const handleResetConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetNotice(null);
    try {
      await apiFetch('/api/auth/reset-confirm', {
        method: 'POST',
        body: JSON.stringify({ token: resetToken, newPassword: resetNewPw }),
      });
      setResetOpen(false);
      setResetStep('request');
      setResetToken('');
      setResetNewPw('');
      setError(null);
    } catch (err: unknown) {
      setResetNotice(err instanceof Error ? err.message : 'Jeton invalide ou expiré.');
    }
  };

  return (
    <div className="app-bg flex min-h-screen flex-col lg:flex-row">
      {/* Panneau de marque */}
      <div className="brand-panel relative hidden overflow-hidden text-white lg:flex lg:w-[46%] xl:w-1/2 flex-col justify-between">
        <div className="brand-grid absolute inset-0" aria-hidden="true" />
        <svg className="pointer-events-none absolute -right-24 top-1/4 h-[620px] w-[620px] opacity-90" viewBox="0 0 600 600" fill="none" aria-hidden="true">
          <defs>
            <linearGradient id="orbit-grad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#ffb347" stopOpacity="0" />
              <stop offset="0.45" stopColor="#ffa534" />
              <stop offset="1" stopColor="#ff7a00" />
            </linearGradient>
          </defs>
          <path className="orbit-path" pathLength="1" d="M40 420 C 120 120, 420 20, 560 210" stroke="url(#orbit-grad)" strokeWidth="14" strokeLinecap="round" />
          <path className="orbit-path" pathLength="1" style={{ animationDelay: '0.25s' }} d="M90 500 C 200 260, 430 150, 575 300" stroke="url(#orbit-grad)" strokeWidth="5" strokeLinecap="round" opacity="0.55" />
        </svg>

        <div className="relative z-10 p-10">
          <img src="/brand/logo-dark.png" alt="CARDMail" className="h-16 w-auto" />
        </div>

        <div className="relative z-10 max-w-xl p-10 pb-14">
          <h1 className="font-display text-4xl font-semibold leading-[1.1] text-white [text-wrap:balance] xl:text-5xl">
            Toute l'équipe CARDIT réunie dans une seule messagerie.
          </h1>
          <p className="mt-5 max-w-md text-base leading-relaxed text-blue-100/80">
            Votre boîte @cardit.cm, vos conversations et vos contacts, protégés et à jour sur tous vos appareils.
          </p>
          <ul className="mt-9 space-y-3.5 text-sm text-blue-50/90">
            <li className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15"><ShieldCheck className="h-4 w-4 text-accent-300" /></span>
              Chaque boîte reste privée, même pour les administrateurs
            </li>
            <li className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15"><Lock className="h-4 w-4 text-accent-300" /></span>
              Connexion sécurisée et sessions protégées
            </li>
            <li className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15"><Smartphone className="h-4 w-4 text-accent-300" /></span>
              S'installe sur votre téléphone comme une application
            </li>
          </ul>
        </div>
      </div>

      {/* Formulaire de connexion */}
      <div className="flex flex-1 items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md rounded-3xl border border-slate-200/70 bg-white/80 p-7 shadow-[0_30px_80px_-30px_rgba(8,15,36,0.35)] backdrop-blur-xl sm:p-9 dark:border-slate-700/50 dark:bg-slate-900/70">
          <img src="/brand/logo.png" alt="CARDMail" className="mb-8 h-14 w-auto dark:hidden lg:hidden" />
          <img src="/brand/logo-dark.png" alt="CARDMail" className="mb-8 hidden h-14 w-auto dark:block dark:lg:hidden" />

          <h2 className="font-display text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
            Bon retour parmi nous
          </h2>
          <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
            Connectez-vous avec votre adresse professionnelle CARDIT.
          </p>

          {error && (
            <div
              role="alert"
              className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/60 dark:text-red-200"
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="login-email" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Adresse professionnelle
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="login-email"
                  type="email"
                  required
                  autoComplete="username"
                  placeholder="prenom.nom@cardit.cm"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label htmlFor="login-password" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Mot de passe
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setResetEmail(email);
                    setResetStep('request');
                    setResetNotice(null);
                    setResetOpen(true);
                  }}
                  className="text-xs font-medium text-teal-700 hover:underline dark:text-teal-400 cursor-pointer"
                >
                  Mot de passe oublié ?
                </button>
              </div>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="login-password"
                  type={showPw ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-9 pr-10"
                />
                <button
                  type="button"
                  aria-label={showPw ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" disabled={loading} className="h-12 w-full text-[15px]">
              {loading ? 'Connexion en cours…' : 'Ouvrir ma messagerie'}
            </Button>
          </form>

          {import.meta.env.DEV && (
            <div className="mt-8 border-t border-slate-200 pt-5 dark:border-slate-800">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Comptes de démonstration (environnement de développement uniquement)
              </p>
              <div className="mt-2.5 grid grid-cols-2 gap-2">
                {DEV_ACCOUNTS.map((acc) => (
                  <button
                    key={acc.email}
                    type="button"
                    onClick={() => {
                      setEmail(acc.email);
                      setPassword(acc.pw);
                    }}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-left transition-colors hover:border-teal-500 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-teal-500 dark:hover:bg-slate-800/70 cursor-pointer"
                  >
                    <div className="truncate text-xs font-medium text-slate-900 dark:text-slate-100">
                      {acc.label}
                    </div>
                    <div className="truncate font-mono text-[11px] text-slate-500 dark:text-slate-400">
                      {acc.email}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modale de réinitialisation sécurisée */}
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent
          title="Réinitialisation du mot de passe"
          description="Demandez un jeton temporaire ou saisissez celui fourni par votre administrateur CARDIT."
          className="max-w-md"
        >
          {resetNotice && (
            <div className="mb-4 rounded-lg border border-teal-200 bg-teal-50 px-3.5 py-2.5 text-xs text-teal-900 dark:border-teal-900 dark:bg-teal-950/60 dark:text-teal-200">
              {resetNotice}
            </div>
          )}

          {resetStep === 'request' ? (
            <form onSubmit={handleResetRequest} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Adresse professionnelle @cardit.cm
                </label>
                <Input
                  type="email"
                  required
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder="collaborateur@cardit.cm"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setResetOpen(false)}>
                  Annuler
                </Button>
                <Button type="submit">Émettre un jeton</Button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleResetConfirm} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Jeton de réinitialisation
                </label>
                <div className="relative">
                  <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    required
                    value={resetToken}
                    onChange={(e) => setResetToken(e.target.value)}
                    className="pl-9 font-mono text-xs"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Nouveau mot de passe (min. 10 caractères)
                </label>
                <Input
                  type="password"
                  required
                  minLength={10}
                  value={resetNewPw}
                  onChange={(e) => setResetNewPw(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setResetStep('request')}>
                  Retour
                </Button>
                <Button type="submit">Confirmer</Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
