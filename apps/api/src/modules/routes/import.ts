import { Prisma } from '../../generated/prisma/client.ts';
import type { PrismaClient } from '../../generated/prisma/client.ts';
import { AuthError } from '../auth/credentials.ts';
import { gpxVersion } from '../gpx/model.ts';
import { parseGpx } from '../gpx/parser.ts';
import { analyzeTrack } from '../gpx/statistics.ts';
import { analysisSelect } from './queries.ts';

export async function importRoutes(database: PrismaClient, userId: string, bytes: Buffer) {
  const { tracks, warnings } = parseGpx(bytes);
  const routes = tracks.map(({ trackIndex, title, segments }) => {
    const { pointCount, analysis } = analyzeTrack(segments);
    for (const code of analysis.qualityFlags) {
      warnings.push({ code, trackIndex });
    }

    return {
      trackIndex,
      title,
      pointCount,
      geometry: segments,
      geometryVersion: 1,
      analyses: { create: analysis },
    };
  });

  const result = await database.routeImport.create({
    data: {
      userId,
      gpxVersion,
      warnings,
      routes: { create: routes },
    },
    select: {
      id: true,
      createdAt: true,
      routes: {
        orderBy: { trackIndex: 'asc' },
        select: {
          id: true,
          trackIndex: true,
          title: true,
          pointCount: true,
          analyses: { select: analysisSelect },
        },
      },
    },
  }).catch((error: unknown) => {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
      throw new AuthError('SESSION_REQUIRED');
    }
    throw error;
  });

  return {
    id: result.id,
    gpxVersion,
    createdAt: result.createdAt,
    warnings,
    routes: result.routes.map(({ analyses: [analysis], ...route }) => ({ ...route, analysis })),
  };
}
