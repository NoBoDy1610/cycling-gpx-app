import express from 'express';

export function createApp(checkDatabase: () => Promise<void>) {
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

  return app;
}
