import { useEffect, useRef, useState } from 'react';
import { routeErrorText } from './presentation';
import { fetchDescriptionComparison, generateDescriptionComparison } from './routes-api';
import type { DescriptionComparison } from './routes-api';

const aiErrors: Record<string, string> = {
  AI_NOT_CONFIGURED: 'Dostawca AI wymaga konfiguracji.',
  AI_PROVIDER_ERROR: 'Usługa AI jest chwilowo niedostępna.',
  AI_INVALID_RESPONSE: 'Odpowiedź AI nie przeszła weryfikacji liczb i jednostek.',
  AI_TIMEOUT: 'Model przekroczył limit czasu.',
  AI_INTERRUPTED: 'Generowanie opisu AI zostało przerwane.',
};

const durationFormat = new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 2 });

export function RouteDescriptions({ routeId, onSessionExpired }: { routeId: string; onSessionExpired: () => void }) {
  const request = useRef<AbortController>(null);
  const [status, setStatus] = useState<'loading' | 'generating' | 'ready'>('loading');
  const [comparison, setComparison] = useState<DescriptionComparison | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    request.current = controller;
    let timer: number | undefined;

    async function load() {
      try {
        const saved = await fetchDescriptionComparison(routeId, controller.signal);
        if (controller.signal.aborted) return;
        setComparison(saved);
        if (saved?.ai?.status === 'RUNNING') {
          setStatus('generating');
          timer = window.setTimeout(() => void load(), 1500);
        } else setStatus('ready');
      } catch (error) {
        if (controller.signal.aborted) return;
        setStatus('ready');
        setError(routeErrorText(error, onSessionExpired));
      }
    }

    void load();
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [routeId, onSessionExpired]);

  async function generate(includeAi: boolean) {
    const signal = request.current?.signal;
    if (!signal || status !== 'ready') return;
    setStatus('generating');
    setError('');
    try {
      const generated = await generateDescriptionComparison(routeId, signal, includeAi);
      if (!signal.aborted) setComparison(generated);
    } catch (error) {
      if (!signal.aborted) setError(routeErrorText(error, onSessionExpired));
    } finally {
      if (!signal.aborted) setStatus('ready');
    }
  }

  const ai = comparison?.ai;
  const failed = ai && ['FAILED', 'TIMED_OUT', 'INTERRUPTED'].includes(ai.status);
  const aiError = failed && ai.errorCode && Object.hasOwn(aiErrors, ai.errorCode)
    ? aiErrors[ai.errorCode] : 'Opis AI jest niedostępny.';

  return (
    <section className="space-y-3 border-t border-stone-200 pt-5" aria-labelledby="route-descriptions-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 id="route-descriptions-title" className="text-base font-semibold">Opisy trasy</h3>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void generate(false)} disabled={status !== 'ready'}
            className="min-h-10 rounded-lg border border-stone-300 px-4 py-2 text-sm font-semibold hover:bg-stone-100 disabled:opacity-50">
            Wygeneruj opis regułowy
          </button>
          <button type="button" onClick={() => void generate(true)} disabled={status !== 'ready'}
            className="min-h-10 rounded-lg bg-teal-800 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-900 disabled:opacity-50">
            Porównaj z AI
          </button>
        </div>
      </div>
      {status === 'loading' && <p role="status" className="text-sm text-stone-600">Wczytywanie opisów…</p>}
      {status === 'generating' && <p role="status" className="text-sm text-stone-600">Generowanie opisów…</p>}
      {error && <p role="alert" className="text-sm text-red-800">{error}</p>}
      {comparison && (
        <div className="grid gap-3 md:grid-cols-2">
          <section aria-labelledby="rule-description-title" className="space-y-2 rounded-lg bg-stone-100 p-4">
            <h4 id="rule-description-title" className="text-sm font-semibold">Opis regułowy</h4>
            <p className="leading-relaxed text-stone-800">{comparison.ruleText}</p>
          </section>
          {ai && (
            <section aria-labelledby="ai-description-title" className="space-y-2 rounded-lg bg-teal-50 p-4">
              <h4 id="ai-description-title" className="text-sm font-semibold">Opis AI</h4>
              {ai.outputText && <p className="leading-relaxed text-stone-800">{ai.outputText}</p>}
              {failed && <p className="text-sm text-stone-700">{aiError}</p>}
              {ai.status === 'RUNNING' && <p className="text-sm text-stone-700">Oczekiwanie na odpowiedź modelu…</p>}
              {ai.durationMs !== null && <p className="text-sm text-stone-600">Czas generowania {durationFormat.format(ai.durationMs / 1000)} s</p>}
            </section>
          )}
        </div>
      )}
    </section>
  );
}
