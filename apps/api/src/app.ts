import express from 'express';
import { createAuthRouter } from './modules/auth/router.ts';
import type { AuthOptions } from './modules/auth/router.ts';
import type { AiDescriptionOptions } from './modules/descriptions/ai.ts';
import { createRoutesRouter } from './modules/routes/router.ts';

export function createApp(checkDatabase: () => Promise<void>, auth?: AuthOptions & { ai?: AiDescriptionOptions }) {
  const app = express();
  app.disable('x-powered-by');

  app.get('/api/health', async (_request, response) => {
    response.set('Cache-Control', 'no-store');

    try {
      await checkDatabase();
    } catch {
      response.status(503).json({ status: 'unavailable', database: 'unavailable' });
      return;
    }

    response.json({ status: 'ok', database: 'connected' });
  });

  if (auth) {
    app.use('/api/auth', createAuthRouter(auth));
    app.use('/api/routes', createRoutesRouter(auth));
  }

  return app;
}
