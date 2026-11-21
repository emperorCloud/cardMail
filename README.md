# CARDMail — messagerie professionnelle CARDIT (`cardit.cm`)

Webmail interne construite sur **Resend Inboxes**, déployable sur **Vercel** avec **Neon** (PostgreSQL) et **Vercel Blob** (pièces jointes).

## Architecture

| Besoin | Solution |
|---|---|
| Front (React 19 + Vite, PWA) | Fichiers statiques servis par Vercel |
| API (Express 5) | Une fonction serverless : `api/index.ts` (toutes les routes `/api/*`) |
| Données (utilisateurs, sessions, contacts, préférences, audit, limitation de débit) | Neon, schéma créé automatiquement au premier appel (`src/server/db/schema.ts`) |
| Pièces jointes à l'envoi | Navigateur → Vercel Blob **privé** (upload direct), puis le serveur lit le fichier, l'envoie via Resend et le supprime |
| Pièces jointes reçues | Redirection vers l'URL temporaire signée par Resend (après contrôle d'accès à la boîte) |
| Temps réel | Scrutation toutes les 20 s (en pause si l'onglet est masqué) + notifications Web Push |
| Webhook Resend | `POST /api/webhooks/resend` (signature Svix vérifiée, idempotent) |

## Déploiement

1. **Importer le dépôt** dans Vercel (framework détecté : Vite).
2. **Neon** : Storage → Marketplace → Neon. `DATABASE_URL` est injectée automatiquement.
3. **Blob** : Storage → Create → Blob, accès **Private**, puis connecter au projet.
4. **Variables d'environnement** (voir `.env.example`) :
   - `AUTH_SECRET` : `openssl rand -hex 32` (obligatoire, l'application refuse de démarrer sans)
   - `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`
   - `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` : `npx web-push generate-vapid-keys`
   - `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_PASSWORD` : crée le premier SUPER_ADMIN si la base est vide
5. **Resend** : pointer le webhook vers `https://<votre-domaine>/api/webhooks/resend`.
6. Se connecter, **retirer `BOOTSTRAP_ADMIN_PASSWORD`**, puis créer les boîtes et les comptes depuis l'onglet Administration.

## Développement local

```bash
npm install
cp .env.example .env     # DATABASE_URL = une branche Neon de développement
npm run dev              # http://localhost:3000
```

`SEED_DEMO=true` (hors production) crée quatre comptes de démonstration (mots de passe : voir l'écran de connexion en mode dev). Sans `RESEND_API_KEY`, un bac à sable local simule Resend Inboxes. Pour tester l'envoi de pièces jointes en local, `BLOB_READ_WRITE_TOKEN` est nécessaire.

## Identité visuelle

Logos et icônes dans `public/brand/` et `public/` (dérivés des fichiers fournis). Palette : bleu `#1556d6` (enveloppe), orange `#ff8a0a` (orbite, réservé aux signaux : non lu, notifications), neutres marine. Typographies : Outfit (titres) et Figtree (texte).

## Sécurité

- Sessions HttpOnly (hachées HMAC en base), CSRF double-submit, rate limiting partagé en base.
- Isolation stricte des boîtes : toute requête vérifie l'attribution utilisateur → boîte. Les administrateurs gèrent les comptes et attributions mais ne lisent pas les messages des autres.
- Pièces jointes : un utilisateur ne peut référencer que `mail-uploads/<son id>/…`; stockage privé; suppression après envoi.
- En-têtes de sécurité (CSP, HSTS, X-Frame-Options) dans `vercel.json` et `src/server/app.ts`.

## Limites connues

- La réinitialisation de mot de passe émet un jeton mais **ne l'envoie pas par e-mail** : en production, un administrateur réinitialise le mot de passe depuis l'onglet Administration.
- Les images distantes des e-mails ne sont pas bloquées (suivi d'ouverture possible).
