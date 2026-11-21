import { createApp } from '../src/server/app.ts';

// Point d'entrée serverless Vercel : toutes les routes /api/* y sont redirigées (voir vercel.json).
export default createApp();
