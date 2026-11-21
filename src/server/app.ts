import cookieParser from 'cookie-parser';
import express from 'express';
import adminRoutes from './routes/admin.routes.ts';
import authRoutes from './routes/auth.routes.ts';
import contactsRoutes from './routes/contacts.routes.ts';
import mailRoutes from './routes/mail.routes.ts';
import notificationsRoutes from './routes/notifications.routes.ts';
import preferencesRoutes from './routes/preferences.routes.ts';
import webhookRoutes from './routes/webhook.routes.ts';

/** Application Express sans `listen()` : utilisée par la fonction Vercel (api/index.ts) et par le serveur de dev. */
export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
  });

  // Le webhook Resend exige le corps brut pour la signature Svix
  app.use('/api/webhooks', express.raw({ type: 'application/json', limit: '2mb' }), webhookRoutes);

  app.use(express.json({ limit: '2mb' }));
  app.use(cookieParser());

  app.use('/api/auth', authRoutes);
  app.use('/api/mail', mailRoutes);
  app.use('/api/contacts', contactsRoutes);
  app.use('/api/preferences', preferencesRoutes);
  app.use('/api/notifications', notificationsRoutes);
  app.use('/api/admin', adminRoutes);

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'CARDMail', domain: 'cardit.cm' });
  });

  app.use('/api', (_req, res) => res.status(404).json({ error: 'Route introuvable.' }));

  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('[CARDMail] Erreur:', err);
    const isClient = err instanceof SyntaxError || (err as { status?: number }).status === 400;
    res.status(isClient ? 400 : 500).json({ error: isClient ? 'Requête invalide.' : 'Erreur interne du serveur.' });
  });

  return app;
}
