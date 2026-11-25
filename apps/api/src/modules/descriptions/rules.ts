import type { DescriptionInput } from './input.ts';

export const ruleGeneratorVersion = 'rules-pl-1';

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

export function describeRoute(input: DescriptionInput) {
  const { distanceM, elapsedDurationS, averageSpeedMps, elevationGainM, elevationLossM } = input;
  const distance = distanceM < 1000 ? `${numberFormat.format(distanceM)} m` : `${numberFormat.format(distanceM / 1000)} km`;
  const sentences = [`Trasa ma ${distance}.`];
  if (elapsedDurationS !== null) sentences.push(`Przejazd trwał ${durationText(elapsedDurationS)}.`);
  if (averageSpeedMps !== null) sentences.push(`Średnia prędkość wyniosła ${numberFormat.format(averageSpeedMps * 3.6)} km/h.`);
  if (elevationGainM !== null) sentences.push(`Suma podjazdów wyniosła ${numberFormat.format(elevationGainM)} m.`);
  if (elevationLossM !== null) sentences.push(`Suma zjazdów wyniosła ${numberFormat.format(elevationLossM)} m.`);
  return sentences.join(' ');
}
