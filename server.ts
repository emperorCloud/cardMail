// Serveur de développement local : API Express + Vite en middleware. En production, Vercel sert le front statique
// et exécute api/index.ts : ce fichier n'est pas utilisé.
import http from 'node:http';
import { serverEnv } from './src/server/config/env.ts';
import { createApp } from './src/server/app.ts';

async function bootstrap() {
  const app = createApp();
  const { createServer: createViteServer } = await import('vite');
  const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
  app.use(vite.middlewares);
  http.createServer(app).listen(serverEnv.port, '0.0.0.0', () => {
    console.log(`[CARDMail] http://localhost:${serverEnv.port}`);
  });
}

bootstrap().catch((err) => {
  console.error('[CARDMail] Erreur fatale au démarrage:', err);
  process.exit(1);
});
