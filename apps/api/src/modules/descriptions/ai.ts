import { formatDescriptionFacts } from './facts.ts';
import type { DescriptionInput } from './input.ts';

export type AiProviderMetadata = {
  provider: string;
  modelId: string;
  generatorVersion: string;
  promptVersion: string;
  parameters: Record<string, string | number | boolean>;
};

export interface AiDescriptionProvider {
  readonly metadata: AiProviderMetadata;
  generate(input: DescriptionInput, signal: AbortSignal): Promise<{ output: unknown; modelRevision: string | null }>;
}

export type AiDescriptionOptions = { provider: AiDescriptionProvider; timeoutMs: number };

function normalizeText(text: string) {
  return text.normalize('NFKC').replace(/\s+/gu, ' ').trim();
}

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeMeasurements(text: string) {
  return text
    .replace(/(?<=\d)\.(?=\d)/g, ',')
    .replace(/(?<=\d) kilometr(?:ów|a|y)?(?!\p{L})/giu, ' km')
    .replace(/(?<=\d) metr(?:ów|a|y)?(?!\p{L})/giu, ' m')
    .replace(/(?<=\d) km(?: na godzinę|\s*\/\s*h)(?!\p{L})/giu, ' km/h')
    .replace(/(?<=\d) godzin(?:a|ę|y)?(?!\p{L})/giu, ' h')
    .replace(/(?<=\d) minut(?:a|ę|y)?(?!\p{L})/giu, ' min')
    .replace(/(?<=\d) sekund(?:a|ę|y)?(?!\p{L})/giu, ' s')
    .replace(/( h| min)\.? i (?=\d)/gu, '$1 ');
}

export function validateAiDescription(output: unknown, input: DescriptionInput) {
  if (!output || typeof output !== 'object' || !('description' in output) ||
    typeof output.description !== 'string' || Object.keys(output).length !== 1 || output.description.length > 1000) return null;

  const text = normalizeText(output.description);
  const required = new Map<string, number>();
  for (const fact of Object.values(formatDescriptionFacts(input))) {
    if (fact === null) continue;
    const phrase = normalizeText(fact);
    required.set(phrase, (required.get(phrase) ?? 0) + 1);
  }

  const choices = [...required.keys()].sort((first, second) => second.length - first.length).map(escapeRegExp);
  const expression = new RegExp(`(?<![\\p{N}\\p{L}+−.,-])(?:${choices.join('|')})(?![\\p{N}\\p{L}/])`, 'gu');
  const extraText = normalizeMeasurements(text).replace(expression, (phrase) => {
    const remaining = required.get(phrase) ?? 0;
    if (remaining === 0) return phrase;
    required.set(phrase, remaining - 1);
    return ' ';
  });

  if ([...required.values()].some((remaining) => remaining > 0) || /\p{N}/u.test(extraText)) return null;
  return text;
}
