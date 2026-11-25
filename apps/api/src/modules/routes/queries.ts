import type { Prisma, PrismaClient } from '../../generated/prisma/client.ts';

const uuid = /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i;
const defaultPageSize = 12;
const maxPageSize = 50;

type RouteErrorCode = 'INVALID_PAGINATION' | 'ROUTE_NOT_FOUND' | 'ANALYSIS_NOT_FOUND' | 'COMPARISON_NOT_FOUND';

export class RouteError extends Error {
  readonly code: RouteErrorCode;

  constructor(code: RouteErrorCode) {
    super(code);
    this.code = code;
  }

  get status() {
    return this.code === 'INVALID_PAGINATION' ? 400 : 404;
  }
}

export const analysisSelect = {
  id: true,
  algorithmVersion: true,
  distanceM: true,
  elevationGainM: true,
  elevationLossM: true,
  elapsedDurationS: true,
  averageSpeedMps: true,
  qualityFlags: true,
} satisfies Prisma.RouteAnalysisSelect;

export const latestAnalysisOrder = [{ createdAt: 'desc' }, { id: 'desc' }] satisfies Prisma.RouteAnalysisOrderByWithRelationInput[];

export function isUuid(value: string) {
  return uuid.test(value);
}

function readPageSize(value: unknown) {
  if (value === undefined) return defaultPageSize;
  if (typeof value !== 'string' || !/^\d{1,2}$/.test(value) || Number(value) < 1 || Number(value) > maxPageSize) {
    throw new RouteError('INVALID_PAGINATION');
  }
  return Number(value);
}

function readCursor(value: unknown) {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !/^[\w-]{1,160}$/.test(value)) {
    throw new RouteError('INVALID_PAGINATION');
  }

  try {
    const key: unknown = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    if (Array.isArray(key) && key.length === 3) {
      const [date, importId, trackIndex]: unknown[] = key;
      if (typeof date === 'string' && typeof importId === 'string' && isUuid(importId) &&
        typeof trackIndex === 'number' && Number.isInteger(trackIndex) && trackIndex >= 0 && trackIndex <= 2_147_483_647) {
        const importedAt = new Date(date);
        if (importedAt.toISOString() === date) return { importedAt, importId, trackIndex };
      }
    }
  } catch {
    throw new RouteError('INVALID_PAGINATION');
  }
  throw new RouteError('INVALID_PAGINATION');
}

export async function listRoutes(database: PrismaClient, userId: string, limit: unknown, cursor: unknown) {
  const pageSize = readPageSize(limit);
  const key = readCursor(cursor);
  const rows = await database.route.findMany({
    where: {
      routeImport: { userId },
      OR: key && [
        { routeImport: { createdAt: { lt: key.importedAt } } },
        { routeImport: { createdAt: key.importedAt, id: { lt: key.importId } } },
        { importId: key.importId, routeImport: { createdAt: key.importedAt }, trackIndex: { gt: key.trackIndex } },
      ],
    },
    orderBy: [{ routeImport: { createdAt: 'desc' } }, { importId: 'desc' }, { trackIndex: 'asc' }],
    take: pageSize + 1,
    select: {
      id: true,
      title: true,
      importId: true,
      trackIndex: true,
      routeImport: { select: { createdAt: true } },
      analyses: { orderBy: latestAnalysisOrder, take: 1, select: { distanceM: true } },
    },
  });

  const page = rows.slice(0, pageSize);
  const last = page.at(-1);
  const nextCursor = last && rows.length > pageSize
    ? Buffer.from(JSON.stringify([last.routeImport.createdAt, last.importId, last.trackIndex])).toString('base64url')
    : null;

  return {
    routes: page.map(({ id, title, routeImport, analyses }) => ({
      id, title, importedAt: routeImport.createdAt, distanceM: analyses[0]?.distanceM ?? null,
    })),
    nextCursor,
  };
}

export function ownedRoute(userId: string, routeId: string): Prisma.RouteWhereInput {
  if (!isUuid(routeId)) throw new RouteError('ROUTE_NOT_FOUND');
  return { id: routeId, routeImport: { userId } };
}

function readSegments(geometry: Prisma.JsonValue, version: number) {
  if (version !== 1 || !Array.isArray(geometry) || geometry.length === 0) throw new Error('Invalid route geometry.');

  return geometry.map((segment) => {
    if (!Array.isArray(segment) || segment.length < 2) throw new Error('Invalid route segment.');

    return segment.map((point): [number, number] => {
      if (!point || typeof point !== 'object' || Array.isArray(point) ||
        typeof point.latitude !== 'number' || typeof point.longitude !== 'number') {
        throw new Error('Invalid route point.');
      }
      return [point.latitude, point.longitude];
    });
  });
}

export async function findRoute(database: PrismaClient, userId: string, routeId: string) {
  const route = await database.route.findFirst({
    where: ownedRoute(userId, routeId),
    select: {
      id: true, title: true, pointCount: true, geometry: true, geometryVersion: true,
      routeImport: { select: { createdAt: true } },
      analyses: { orderBy: latestAnalysisOrder, take: 1, select: analysisSelect },
    },
  });
  if (!route) throw new RouteError('ROUTE_NOT_FOUND');

  return {
    id: route.id,
    title: route.title,
    pointCount: route.pointCount,
    importedAt: route.routeImport.createdAt,
    segments: readSegments(route.geometry, route.geometryVersion),
    analysis: route.analyses[0] ?? null,
  };
}

export async function deleteRoute(database: PrismaClient, userId: string, routeId: string) {
  const result = await database.route.deleteMany({ where: ownedRoute(userId, routeId) });
  if (!result.count) throw new RouteError('ROUTE_NOT_FOUND');
}
