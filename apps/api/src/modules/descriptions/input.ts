import { createHash } from 'node:crypto';
import type { Prisma } from '../../generated/prisma/client.ts';

export const inputSchemaVersion = 1;

export type DescriptionInput = {
  distanceM: number;
  elevationGainM: number | null;
  elevationLossM: number | null;
  elapsedDurationS: number | null;
  averageSpeedMps: number | null;
  qualityFlags: string[];
};

export function captureDescriptionInput(analysis: Omit<DescriptionInput, 'qualityFlags'> & { qualityFlags: Prisma.JsonValue }): DescriptionInput {
  const { distanceM, elevationGainM, elevationLossM, elapsedDurationS, averageSpeedMps, qualityFlags } = analysis;
  if (!Array.isArray(qualityFlags) || !qualityFlags.every((flag) => typeof flag === 'string')) {
    throw new Error('Invalid analysis quality flags.');
  }
  return {
    distanceM, elevationGainM, elevationLossM, elapsedDurationS, averageSpeedMps,
    qualityFlags: qualityFlags.toSorted(),
  };
}

export function hashDescriptionInput(input: DescriptionInput) {
  const canonicalFacts = [
    inputSchemaVersion, input.distanceM, input.elevationGainM, input.elevationLossM,
    input.elapsedDurationS, input.averageSpeedMps, input.qualityFlags.toSorted(),
  ];
  return createHash('sha256').update(JSON.stringify(canonicalFacts)).digest('hex');
}
