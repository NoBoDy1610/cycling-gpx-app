import { Prisma } from '../../generated/prisma/client.ts';
import type { PrismaClient } from '../../generated/prisma/client.ts';
import { analysisSelect, isUuid, latestAnalysisOrder, ownedRoute, RouteError } from '../routes/queries.ts';
import { validateAiDescription } from './ai.ts';
import type { AiDescriptionOptions, AiDescriptionProvider } from './ai.ts';
import { captureDescriptionInput, hashDescriptionInput, inputSchemaVersion } from './input.ts';
import type { DescriptionInput } from './input.ts';
import { describeRoute, ruleGeneratorVersion } from './rules.ts';

const recoveryGraceMs = 5000;

const comparisonSelect = {
  id: true,
  analysisId: true,
  inputSnapshot: true,
  inputSchemaVersion: true,
  inputHash: true,
  createdAt: true,
  runs: {
    orderBy: { method: 'asc' },
    select: {
      id: true, method: true, status: true, outputText: true, durationMs: true, generatorVersion: true, errorCode: true,
      provider: true, modelId: true, modelRevision: true, promptVersion: true, parameters: true,
    },
  },
} satisfies Prisma.DescriptionComparisonSelect;

async function persistComparison(database: PrismaClient, userId: string, routeId: string, aiRun?: Prisma.DescriptionRunCreateWithoutComparisonInput) {
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

  const ruleRun: Prisma.DescriptionRunCreateWithoutComparisonInput = {
    method: 'RULE_BASED', status: 'SUCCEEDED', outputText, durationMs, generatorVersion: ruleGeneratorVersion,
  };
  const comparison = await database.descriptionComparison.create({
    data: {
      analysisId: analysis.id, inputSnapshot, inputSchemaVersion, inputHash,
      runs: { create: aiRun ? [ruleRun, aiRun] : [ruleRun] },
    },
    select: comparisonSelect,
  }).catch((error: unknown) => {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
      throw new RouteError('ANALYSIS_NOT_FOUND');
    }
    throw error;
  });
  return { comparison, inputSnapshot };
}

export async function createRuleComparison(database: PrismaClient, userId: string, routeId: string) {
  return (await persistComparison(database, userId, routeId)).comparison;
}

function generateUntilAbort(provider: AiDescriptionProvider, input: DescriptionInput, signal: AbortSignal) {
  return new Promise<Awaited<ReturnType<AiDescriptionProvider['generate']>>>((resolve, reject) => {
    signal.throwIfAborted();
    const onAbort = () => reject(signal.reason);
    signal.addEventListener('abort', onAbort, { once: true });
    void Promise.resolve().then(() => provider.generate(input, signal)).then(resolve, reject).finally(() => {
      signal.removeEventListener('abort', onAbort);
    });
  });
}

async function runAi(input: DescriptionInput, { provider, timeoutMs }: AiDescriptionOptions, requestSignal: AbortSignal) {
  const timeout = AbortSignal.timeout(timeoutMs);
  const signal = AbortSignal.any([requestSignal, timeout]);
  const start = performance.now();
  let outcome: Prisma.DescriptionRunUpdateManyMutationInput;
  try {
    const result = await generateUntilAbort(provider, input, signal);
    const outputText = validateAiDescription(result.output, input);
    outcome = outputText === null
      ? { status: 'FAILED', errorCode: 'AI_INVALID_RESPONSE' }
      : { status: 'SUCCEEDED', outputText };
    outcome.modelRevision = result.modelRevision;
  } catch {
    if (requestSignal.aborted) outcome = { status: 'INTERRUPTED', errorCode: 'AI_INTERRUPTED' };
    else if (timeout.aborted) outcome = { status: 'TIMED_OUT', errorCode: 'AI_TIMEOUT' };
    else outcome = { status: 'FAILED', errorCode: 'AI_PROVIDER_ERROR' };
  }
  return { ...outcome, durationMs: performance.now() - start, deadlineAt: null };
}

export async function createAiComparison(database: PrismaClient, userId: string, routeId: string,
  ai: AiDescriptionOptions | undefined, requestSignal: AbortSignal) {
  const run: Prisma.DescriptionRunCreateWithoutComparisonInput = ai
    ? {
      method: 'AI', status: 'RUNNING', ...ai.provider.metadata,
      parameters: { ...ai.provider.metadata.parameters, timeoutMs: ai.timeoutMs },
      deadlineAt: new Date(Date.now() + ai.timeoutMs + recoveryGraceMs),
    }
    : { method: 'AI', status: 'FAILED', generatorVersion: 'ai-unconfigured', errorCode: 'AI_NOT_CONFIGURED' };
  const { comparison, inputSnapshot } = await persistComparison(database, userId, routeId, run);
  if (!ai) return comparison;

  const outcome = await runAi(inputSnapshot, ai, requestSignal);
  await database.descriptionRun.updateMany({
    where: { comparisonId: comparison.id, method: 'AI', status: 'RUNNING' },
    data: outcome,
  });
  const completed = await database.descriptionComparison.findUnique({ where: { id: comparison.id }, select: comparisonSelect });
  if (!completed) throw new RouteError('COMPARISON_NOT_FOUND');
  return completed;
}

async function recoverInterrupted(database: PrismaClient, comparison: Prisma.DescriptionComparisonWhereInput) {
  await database.descriptionRun.updateMany({
    where: { comparison, method: 'AI', status: 'RUNNING', deadlineAt: { lte: new Date() } },
    data: { status: 'INTERRUPTED', errorCode: 'AI_INTERRUPTED', deadlineAt: null },
  });
}

export async function listComparisons(database: PrismaClient, userId: string, routeId: string) {
  const route = ownedRoute(userId, routeId);
  if (!await database.route.findFirst({ where: route, select: { id: true } })) {
    throw new RouteError('ROUTE_NOT_FOUND');
  }

  const where = { analysis: { route } };
  await recoverInterrupted(database, where);
  return database.descriptionComparison.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: 12,
    select: comparisonSelect,
  });
}

export async function findComparison(database: PrismaClient, userId: string, routeId: string, comparisonId: string) {
  const route = ownedRoute(userId, routeId);
  if (!isUuid(comparisonId)) throw new RouteError('COMPARISON_NOT_FOUND');

  const where = { id: comparisonId, analysis: { route } };
  await recoverInterrupted(database, where);
  const comparison = await database.descriptionComparison.findFirst({
    where,
    select: comparisonSelect,
  });
  if (!comparison) throw new RouteError('COMPARISON_NOT_FOUND');
  return comparison;
}
