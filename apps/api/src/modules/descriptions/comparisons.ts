import { Prisma } from '../../generated/prisma/client.ts';
import type { PrismaClient } from '../../generated/prisma/client.ts';
import { analysisSelect, isUuid, latestAnalysisOrder, ownedRoute, RouteError } from '../routes/queries.ts';
import { captureDescriptionInput, hashDescriptionInput, inputSchemaVersion } from './input.ts';
import { describeRoute, ruleGeneratorVersion } from './rules.ts';

const comparisonSelect = {
  id: true,
  analysisId: true,
  inputSnapshot: true,
  inputSchemaVersion: true,
  inputHash: true,
  createdAt: true,
  runs: {
    orderBy: { method: 'asc' },
    select: { id: true, method: true, status: true, outputText: true, durationMs: true, generatorVersion: true, errorCode: true },
  },
} satisfies Prisma.DescriptionComparisonSelect;

export async function createRuleComparison(database: PrismaClient, userId: string, routeId: string) {
  const route = await database.route.findFirst({
    where: ownedRoute(userId, routeId),
    select: { analyses: { orderBy: latestAnalysisOrder, take: 1, select: analysisSelect } },
  });
  if (!route) throw new RouteError('ROUTE_NOT_FOUND');
  const [analysis] = route.analyses;
  if (!analysis) throw new RouteError('ANALYSIS_NOT_FOUND');

  const inputSnapshot = captureDescriptionInput(analysis);
  const inputHash = hashDescriptionInput(inputSnapshot);
  const start = performance.now();
  const outputText = describeRoute(inputSnapshot);
  const durationMs = performance.now() - start;

  return database.descriptionComparison.create({
    data: {
      analysisId: analysis.id, inputSnapshot, inputSchemaVersion, inputHash,
      runs: { create: { method: 'RULE_BASED', status: 'SUCCEEDED', outputText, durationMs, generatorVersion: ruleGeneratorVersion } },
    },
    select: comparisonSelect,
  }).catch((error: unknown) => {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
      throw new RouteError('ANALYSIS_NOT_FOUND');
    }
    throw error;
  });
}

export async function listComparisons(database: PrismaClient, userId: string, routeId: string) {
  const route = ownedRoute(userId, routeId);
  if (!await database.route.findFirst({ where: route, select: { id: true } })) {
    throw new RouteError('ROUTE_NOT_FOUND');
  }

  return database.descriptionComparison.findMany({
    where: { analysis: { route } },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: 12,
    select: comparisonSelect,
  });
}

export async function findComparison(database: PrismaClient, userId: string, routeId: string, comparisonId: string) {
  const route = ownedRoute(userId, routeId);
  if (!isUuid(comparisonId)) throw new RouteError('COMPARISON_NOT_FOUND');

  const comparison = await database.descriptionComparison.findFirst({
    where: { id: comparisonId, analysis: { route } },
    select: comparisonSelect,
  });
  if (!comparison) throw new RouteError('COMPARISON_NOT_FOUND');
  return comparison;
}
