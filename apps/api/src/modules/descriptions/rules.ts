import type { DescriptionInput } from './input.ts';
import { formatDescriptionFacts } from './facts.ts';

export const ruleGeneratorVersion = 'rules-pl-1';

export function describeRoute(input: DescriptionInput) {
  const { distance, duration, averageSpeed, elevationGain, elevationLoss } = formatDescriptionFacts(input);
  const sentences = [`Trasa ma ${distance}.`];
  if (duration !== null) sentences.push(`Przejazd trwał ${duration}.`);
  if (averageSpeed !== null) sentences.push(`Średnia prędkość wyniosła ${averageSpeed}.`);
  if (elevationGain !== null) sentences.push(`Suma podjazdów wyniosła ${elevationGain}.`);
  if (elevationLoss !== null) sentences.push(`Suma zjazdów wyniosła ${elevationLoss}.`);
  return sentences.join(' ');
}
