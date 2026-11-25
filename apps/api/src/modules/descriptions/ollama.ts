import type { AiDescriptionProvider } from './ai.ts';
import { formatDescriptionFacts } from './facts.ts';
import type { DescriptionInput } from './input.ts';

const promptVersion = 'route-pl-1';
const parameters = { temperature: 0.2, seed: 42, num_ctx: 2048, num_predict: 256 };
const responseFormat = {
  type: 'object',
  required: ['description'],
  additionalProperties: false,
  properties: { description: { type: 'string' } },
};

function messages(input: DescriptionInput) {
  const facts = formatDescriptionFacts(input);
  const entries = [
    ['Dystans', facts.distance], ['Czas przejazdu', facts.duration], ['Średnia prędkość', facts.averageSpeed],
    ['Suma podjazdów', facts.elevationGain], ['Suma zjazdów', facts.elevationLoss],
  ];
  return [
    { role: 'system', content: 'Napisz krótki, neutralny opis przejazdu rowerowego po polsku, pełnymi zdaniami. Używaj wyłącznie przekazanych faktów. Każdą wartość przytocz dokładnie raz i zachowaj zapis liczby oraz jednostki, w tym zapis złożonego czasu. Zwróć obiekt JSON z kluczem description.' },
    { role: 'user', content: entries.filter(([, value]) => value !== null).map(([label, value]) => `${label}: ${value}`).join('\n') },
  ];
}

function decodeResponse(payload: unknown) {
  if (payload && typeof payload === 'object' && 'message' in payload) {
    const message = payload.message;
    if (message && typeof message === 'object' && 'content' in message && typeof message.content === 'string') {
      try {
        return JSON.parse(message.content) as unknown;
      } catch {
        return null;
      }
    }
  }
  return null;
}

async function readModelRevision(baseUrl: URL, modelId: string, signal: AbortSignal) {
  try {
    const response = await fetch(new URL('/api/tags', baseUrl), { signal });
    if (!response.ok) return null;
    const payload: unknown = await response.json();
    if (payload && typeof payload === 'object' && 'models' in payload && Array.isArray(payload.models)) {
      for (const model of payload.models as unknown[]) {
        if (model && typeof model === 'object' && 'name' in model && typeof model.name === 'string' &&
          model.name.toLowerCase() === modelId.toLowerCase() && 'digest' in model && typeof model.digest === 'string') {
          return model.digest;
        }
      }
    }
  } catch {
    // Generation can be measured when the service cannot report a model digest.
  }
  return null;
}

export function createOllamaProvider(baseUrl: URL, modelId: string): AiDescriptionProvider {
  return {
    metadata: { provider: 'ollama', modelId, generatorVersion: 'ollama-chat-1', promptVersion, parameters },
    async generate(input, signal) {
      const modelRevision = await readModelRevision(baseUrl, modelId, signal);
      const response = await fetch(new URL('/api/chat', baseUrl), {
        method: 'POST', signal, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: modelId, messages: messages(input), format: responseFormat, stream: false, options: parameters }),
      });
      if (!response.ok) throw new Error('The model service did not return a successful response.');
      const payload: unknown = await response.json();
      return { output: decodeResponse(payload), modelRevision };
    },
  };
}
