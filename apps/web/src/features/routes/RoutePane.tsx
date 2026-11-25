import { lazy, Suspense, useEffect, useState } from 'react';
import { fetchRoute, removeRoute, RouteRequestError } from './routes-api';
import type { RouteDetails } from './routes-api';
import { formatDate, formatDistance, formatDuration, formatElevation, formatInteger, formatSpeed, routeErrorText, warningText } from './presentation';
import { RuleDescription } from './RuleDescription';

const RouteMap = lazy(() => import('./RouteMap'));

const smallButton = 'min-h-10 rounded-lg border border-stone-300 px-3 py-2 text-sm font-semibold text-stone-800 hover:bg-stone-100 disabled:opacity-50';

export function RoutePane({ routeId, onDeleted, onSessionExpired }: {
  routeId: string;
  onDeleted: (id: string) => void;
  onSessionExpired: () => void;
}) {
  const [route, setRoute] = useState<RouteDetails>();
  const [loadError, setLoadError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    void fetchRoute(routeId, controller.signal).then((current) => {
      if (!controller.signal.aborted) setRoute(current);
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) setLoadError(routeErrorText(error, onSessionExpired));
    });
    return () => controller.abort();
  }, [attempt, routeId, onSessionExpired]);

  async function handleDelete() {
    setDeleting(true);
    setDeleteError('');
    try {
      await removeRoute(routeId);
      onDeleted(routeId);
    } catch (error) {
      if (error instanceof RouteRequestError && error.code === 'ROUTE_NOT_FOUND') {
        onDeleted(routeId);
      } else {
        setDeleteError(routeErrorText(error, onSessionExpired));
      }
    } finally {
      setDeleting(false);
    }
  }

  if (loadError) {
    return (
      <div className="space-y-3 rounded-2xl border border-stone-200 bg-white p-6">
        <p role="alert" className="text-sm text-red-800">{loadError}</p>
        <button type="button" className={smallButton} onClick={() => { setLoadError(''); setAttempt((value) => value + 1); }}>
          Spróbuj ponownie
        </button>
      </div>
    );
  }

  if (!route) return <p role="status" className="rounded-2xl border border-stone-200 bg-white p-6 text-stone-600">Wczytywanie trasy…</p>;

  const metrics = [
    ['Dystans', formatDistance(route.analysis?.distanceM ?? null)],
    ['Suma podjazdów', formatElevation(route.analysis?.elevationGainM ?? null)],
    ['Suma zjazdów', formatElevation(route.analysis?.elevationLossM ?? null)],
    ['Czas trwania', formatDuration(route.analysis?.elapsedDurationS ?? null)],
    ['Średnia prędkość', formatSpeed(route.analysis?.averageSpeedMps ?? null)],
  ];
  const warnings = route.analysis?.qualityFlags ?? [];

  return (
    <article className="space-y-5 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm sm:p-6" aria-labelledby="selected-route-title">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h2 id="selected-route-title" className="wrap-break-word text-2xl font-semibold tracking-tight sm:text-3xl">{route.title}</h2>
          <p className="mt-1 text-sm text-stone-600">
            Dodano <time dateTime={route.importedAt}>{formatDate(route.importedAt)}</time>
            {' · '}{formatInteger(route.pointCount)} pkt
            {' · '}{formatInteger(route.segments.length)} segm.
          </p>
        </div>
        <button type="button" className={smallButton} aria-expanded={confirming} disabled={deleting}
          onClick={() => { setConfirming((value) => !value); setDeleteError(''); }}>
          Usuń trasę
        </button>
      </div>

      {confirming && (
        <div className="space-y-3 rounded-xl border border-red-200 bg-red-50 p-4" role="group" aria-label="Potwierdzenie usunięcia trasy">
          <p className="text-sm font-medium text-red-950">Usunąć tę trasę wraz z jej statystykami?</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="min-h-10 rounded-lg bg-red-800 px-3 py-2 text-sm font-semibold text-white hover:bg-red-900 disabled:opacity-50"
              disabled={deleting} onClick={() => void handleDelete()}>
              {deleting ? 'Usuwanie…' : 'Potwierdź usunięcie trasy'}
            </button>
            <button type="button" className={smallButton} disabled={deleting} onClick={() => { setConfirming(false); setDeleteError(''); }}>
              Anuluj
            </button>
          </div>
          {deleteError && <p role="alert" className="text-sm text-red-900">{deleteError}</p>}
        </div>
      )}

      <Suspense fallback={<p role="status" className="rounded-xl bg-stone-100 p-5 text-stone-700">Wczytywanie mapy…</p>}>
        <RouteMap title={route.title} segments={route.segments} pointCount={route.pointCount} />
      </Suspense>

      <section aria-labelledby="statistics-title">
        <h3 id="statistics-title" className="mb-3 text-base font-semibold">Statystyki przejazdu</h3>
        <dl className="grid grid-cols-2 gap-2 lg:grid-cols-3 xl:grid-cols-5">
          {metrics.map(([label, value]) => (
            <div key={label} className="rounded-lg bg-stone-100 px-3 py-3">
              <dt className="text-sm text-stone-600">{label}</dt>
              <dd className="mt-1 text-base font-semibold tabular-nums text-stone-950">{value}</dd>
            </div>
          ))}
        </dl>
        {warnings.length > 0 && (
          <ul className="mt-3 list-inside list-disc space-y-1 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-950" aria-label="Jakość danych trasy">
            {warnings.map((code) => <li key={code}>{warningText(code)}</li>)}
          </ul>
        )}
      </section>

      {route.analysis && <RuleDescription routeId={route.id} onSessionExpired={onSessionExpired} />}
    </article>
  );
}
