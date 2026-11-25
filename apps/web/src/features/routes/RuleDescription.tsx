import { useEffect, useRef, useState } from 'react';
import { routeErrorText } from './presentation';
import { fetchRuleDescription, generateRuleDescription } from './routes-api';

export function RuleDescription({ routeId, onSessionExpired }: { routeId: string; onSessionExpired: () => void }) {
  const request = useRef<AbortController>(null);
  const [status, setStatus] = useState<'loading' | 'generating' | 'ready'>('loading');
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    request.current = controller;
    void fetchRuleDescription(routeId, controller.signal).then((savedText) => {
      if (!controller.signal.aborted) setText(savedText);
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) setError(routeErrorText(error, onSessionExpired));
    }).finally(() => {
      if (!controller.signal.aborted) setStatus('ready');
    });
    return () => controller.abort();
  }, [routeId, onSessionExpired]);

  async function generate() {
    const signal = request.current?.signal;
    if (!signal || status !== 'ready') return;
    setStatus('generating');
    setError('');
    try {
      const generated = await generateRuleDescription(routeId, signal);
      if (!signal.aborted) setText(generated);
    } catch (error) {
      if (!signal.aborted) setError(routeErrorText(error, onSessionExpired));
    } finally {
      if (!signal.aborted) setStatus('ready');
    }
  }

  return (
    <section className="space-y-3 border-t border-stone-200 pt-5" aria-labelledby="rule-description-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 id="rule-description-title" className="text-base font-semibold">Opis regułowy</h3>
        <button type="button" onClick={() => void generate()} disabled={status !== 'ready'}
          className="min-h-10 rounded-lg bg-teal-800 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-900 disabled:opacity-50">
          {status === 'generating' ? 'Generowanie…' : text ? 'Wygeneruj ponownie' : 'Wygeneruj opis'}
        </button>
      </div>
      {status === 'loading' && <p role="status" className="text-sm text-stone-600">Wczytywanie opisu…</p>}
      {error && <p role="alert" className="text-sm text-red-800">{error}</p>}
      {text && <p className="rounded-lg bg-stone-100 p-4 leading-relaxed text-stone-800" role="status">{text}</p>}
    </section>
  );
}
