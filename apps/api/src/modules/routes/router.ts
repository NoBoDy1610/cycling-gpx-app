import { Router } from 'express';
import type { ErrorRequestHandler } from 'express';
import { AuthError } from '../auth/credentials.ts';
import type { AuthOptions } from '../auth/router.ts';
import { requireAllowedOrigin, requireSessionUser } from '../auth/sessions.ts';
import { GpxImportError } from '../gpx/model.ts';
import { importRoutes } from './import.ts';
import { receiveGpxUpload } from './upload.ts';

const handleImportError: ErrorRequestHandler = (error: unknown, _request, response, _next) => {
  if (error instanceof AuthError || error instanceof GpxImportError) {
    response.status(error.status).json({ error: { code: error.code } });
    return;
  }
  console.error('An unexpected GPX import error occurred.');
  response.status(500).json({ error: { code: 'INTERNAL_ERROR' } });
};

export function createRoutesRouter({ database, origins }: Pick<AuthOptions, 'database' | 'origins'>) {
  const router = Router();

  router.post('/import', async (request, response) => {
    response.set('Cache-Control', 'no-store');
    requireAllowedOrigin(request, origins);
    const { id } = await requireSessionUser(database, request);
    const bytes = await receiveGpxUpload(request);
    const imported = await importRoutes(database, id, bytes);
    response.status(201).json({ import: imported });
  });

  router.use(handleImportError);
  return router;
}
