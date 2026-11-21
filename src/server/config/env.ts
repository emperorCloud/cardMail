import crypto from 'node:crypto';
import dotenv from 'dotenv';

dotenv.config();

const isProd = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);

function getAuthSecret(): string {
  const fromEnv = process.env.AUTH_SECRET?.trim();
  if (fromEnv && fromEnv.length >= 32) return fromEnv;
  if (isProd) {
    // En serverless, un secret éphémère invaliderait les sessions à chaque instance : on refuse de démarrer.
    throw new Error('AUTH_SECRET (min. 32 caractères) est obligatoire en production.');
  }
  return crypto.createHash('sha256').update('cardmail-dev-only-secret').digest('hex');
}

export const serverEnv = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isProd,
  port: Number(process.env.PORT || 3000),
  appUrl: process.env.APP_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : 'http://localhost:3000'),
  authSecret: getAuthSecret(),
  databaseUrl: process.env.DATABASE_URL?.trim() || process.env.POSTGRES_URL?.trim() || '',
  resendApiKey: process.env.RESEND_API_KEY?.trim() || '',
  resendWebhookSecret: process.env.RESEND_WEBHOOK_SECRET?.trim() || '',
  vapidPublicKey: process.env.VAPID_PUBLIC_KEY?.trim() || '',
  vapidPrivateKey: process.env.VAPID_PRIVATE_KEY?.trim() || '',
  vapidSubject: process.env.VAPID_SUBJECT?.trim() || 'mailto:admin@cardit.cm',
  bootstrapAdminEmail: process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase() || '',
  bootstrapAdminPassword: process.env.BOOTSTRAP_ADMIN_PASSWORD || '',
  seedDemo: process.env.SEED_DEMO === 'true',
};
