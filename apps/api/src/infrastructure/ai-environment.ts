import type { AiDescriptionOptions } from '../modules/descriptions/ai.ts';
import { createOllamaProvider } from '../modules/descriptions/ollama.ts';

export function aiSettings(): AiDescriptionOptions | undefined {
  const provider = process.env.AI_PROVIDER?.trim();
  if (!provider) return undefined;
  if (provider !== 'ollama') throw new Error('AI_PROVIDER must be ollama or empty.');

  const model = process.env.OLLAMA_MODEL?.trim();
  if (!model) throw new Error('Set OLLAMA_MODEL when AI_PROVIDER=ollama.');

  const baseUrl = new URL(process.env.OLLAMA_BASE_URL ?? 'http://127.0.0.1:11434');
  if (!['http:', 'https:'].includes(baseUrl.protocol) || baseUrl.username || baseUrl.password ||
    baseUrl.pathname !== '/' || baseUrl.search || baseUrl.hash) {
    throw new Error('OLLAMA_BASE_URL must be an HTTP or HTTPS origin.');
  }

  const timeoutMs = Number(process.env.AI_TIMEOUT_MS ?? 45000);
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 120000) {
    throw new Error('AI_TIMEOUT_MS must be an integer between 1 and 120000.');
  }

  const modelId = model.includes(':') ? model : `${model}:latest`;
  return { provider: createOllamaProvider(baseUrl, modelId), timeoutMs };
}
