import type { DescriptionInput } from './input.ts';

const numberFormat = new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 2 });

function durationText(seconds: number) {
  if (seconds < 1) return `${numberFormat.format(seconds)} s`;
  const rounded = Math.round(seconds);
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const remainder = rounded % 60;
  if (hours) return `${hours} h ${minutes} min ${remainder} s`;
  return minutes ? `${minutes} min ${remainder} s` : `${remainder} s`;
}

export function formatDescriptionFacts(input: DescriptionInput) {
  const { distanceM, elapsedDurationS, averageSpeedMps, elevationGainM, elevationLossM } = input;
  return {
    distance: distanceM < 1000 ? `${numberFormat.format(distanceM)} m` : `${numberFormat.format(distanceM / 1000)} km`,
    duration: elapsedDurationS === null ? null : durationText(elapsedDurationS),
    averageSpeed: averageSpeedMps === null ? null : `${numberFormat.format(averageSpeedMps * 3.6)} km/h`,
    elevationGain: elevationGainM === null ? null : `${numberFormat.format(elevationGainM)} m`,
    elevationLoss: elevationLossM === null ? null : `${numberFormat.format(elevationLossM)} m`,
  };
}
