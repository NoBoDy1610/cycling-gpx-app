import { Router } from 'express';
import type { ErrorRequestHandler } from 'express';
import { AuthError } from '../auth/credentials.ts';
import type { AuthOptions } from '../auth/router.ts';
import { requireAllowedOrigin, requireSessionUser } from '../auth/sessions.ts';
import { GpxImportError } from '../gpx/model.ts';
import { importRoutes } from './import.ts';
import { deleteRoute, findRoute, listRoutes, RouteError } from './queries.ts';
import { receiveGpxUpload } from './upload.ts';

const handleRouteError: ErrorRequestHandler = (error: unknown, _request, response, _next) => {
  if (error instanceof AuthError || error instanceof GpxImportError || error instanceof RouteError) {
    response.status(error.status).json({ error: { code: error.code } });
    return;
  }
  console.error('An unexpected route request error occurred.');
  response.status(500).json({ error: { code: 'INTERNAL_ERROR' } });
};

export function createRoutesRouter({ database, origins }: Pick<AuthOptions, 'database' | 'origins'>) {
  const router = Router();

  router.use((_request, response, next) => {
    response.set('Cache-Control', 'no-store');
    next();
  });

  router.get('/', async (request, response) => {
    const { id } = await requireSessionUser(database, request);
    response.json(await listRoutes(database, id, request.query.limit, request.query.cursor));
  });

  router.post('/import', async (request, response) => {
    requireAllowedOrigin(request, origins);
    const { id } = await requireSessionUser(database, request);
    const bytes = await receiveGpxUpload(request);
    const imported = await importRoutes(database, id, bytes);
    response.status(201).json({ import: imported });
  });

  router.get('/:routeId', async (request, response) => {
    const { id } = await requireSessionUser(database, request);
    response.json({ route: await findRoute(database, id, request.params.routeId) });
  });

  router.delete('/:routeId', async (request, response) => {
    requireAllowedOrigin(request, origins);
    const { id } = await requireSessionUser(database, request);
    await deleteRoute(database, id, request.params.routeId);
    response.sendStatus(204);
  });

  router.use(handleRouteError);
  return router;
}
