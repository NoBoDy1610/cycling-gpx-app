import { useEffect, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { RoutePane } from './RoutePane';
import { fetchRoutes, importGpx } from './routes-api';
import { formatDate, formatDistance, importMessage, routeErrorText, warningText } from './presentation';

const primaryButton = 'min-h-10 rounded-lg bg-teal-800 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-900 disabled:opacity-50';
const secondaryButton = 'min-h-10 rounded-lg border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-800 hover:bg-stone-100 disabled:opacity-50';
const panel = 'rounded-2xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5';

type ImportResult = Awaited<ReturnType<typeof importGpx>>;
type HistoryPage = Awaited<ReturnType<typeof fetchRoutes>>;

function ImportForm({ onImported, onSessionExpired }: {
  onImported: (result: ImportResult) => void;
  onSessionExpired: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File>();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<ImportResult>();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || pending) return;
    setPending(true);
    setError('');
    setResult(undefined);
    try {
      const imported = await importGpx(file);
      setResult(imported);
      setFile(undefined);
      if (input.current) input.current.value = '';
      onImported(imported);
    } catch (error) {
      setError(routeErrorText(error, onSessionExpired));
    } finally {
      setPending(false);
    }
  }

  return (
    <section className={panel} aria-labelledby="import-title">
      <h2 id="import-title" className="text-lg font-semibold">Importuj GPX</h2>
      <p id="gpx-file-help" className="mt-1 text-sm text-stone-600">GPX 1.1, maks. 10 MiB</p>
      <form className="mt-3 space-y-3" onSubmit={(event) => void submit(event)} aria-label="Import pliku GPX">
        <label className="flex min-w-0 items-center gap-2.5">
          <input ref={input} name="file" type="file" accept=".gpx,application/gpx+xml" className="peer sr-only" required
            aria-describedby="gpx-file-help" disabled={pending} onChange={(event) => {
              setFile(event.currentTarget.files?.[0]);
              setError('');
              setResult(undefined);
            }} />
          <span className={`${secondaryButton} shrink-0 cursor-pointer peer-focus-visible:ring-2 peer-focus-visible:ring-teal-700 peer-focus-visible:ring-offset-2`}>
            Wybierz plik
          </span>
          {file && <span className="min-w-0 truncate text-sm text-stone-700" title={file.name}>{file.name}</span>}
        </label>
        <button className={primaryButton} disabled={!file || pending}>{pending ? 'Importowanie…' : 'Dodaj do historii'}</button>
      </form>
      <div className="mt-3 flex flex-col items-start gap-2 text-sm">
        <a href={`${import.meta.env.BASE_URL}samples/ojcow-cycling-route.gpx`} download
          className="font-medium text-teal-800 underline decoration-teal-400 underline-offset-2 hover:text-teal-950">
          Pobierz przykład z wysokością (Ojców)
        </a>
        <a href={`${import.meta.env.BASE_URL}samples/poland-cycling-routes.gpx`} download
          className="text-stone-700 underline decoration-stone-400 underline-offset-2 hover:text-stone-950">
          Przykład bez wysokości (Kraków i Warszawa)
        </a>
      </div>
      {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-900">{error}</p>}
      {result && (
        <div className="mt-3 rounded-lg bg-teal-50 px-3 py-2 text-sm text-teal-950" role="status">
          <p className="font-semibold">{importMessage(result.routeCount)}</p>
          {result.warnings.length > 0 && (
            <ul className="mt-1 list-inside list-disc space-y-1">
              {result.warnings.map((code) => <li key={code}>{warningText(code)}</li>)}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

export function RoutesWorkspace({ accountControls, onSessionExpired }: { accountControls: ReactNode; onSessionExpired: () => void }) {
  const [history, setHistory] = useState<HistoryPage>();
  const [historyVersion, setHistoryVersion] = useState(0);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState('');
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedId, setSelectedId] = useState<string>();
  const [notice, setNotice] = useState('');
  const pagingRequest = useRef<AbortController>(null);
  const pane = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    void fetchRoutes(controller.signal).then((page) => {
      if (controller.signal.aborted) return;
      setHistory(page);
      setSelectedId((current) => current ?? page.routes[0]?.id);
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) setHistoryError(routeErrorText(error, onSessionExpired));
    }).finally(() => {
      if (!controller.signal.aborted) setHistoryLoading(false);
    });
    return () => {
      controller.abort();
      pagingRequest.current?.abort();
    };
  }, [historyVersion, onSessionExpired]);

  function reloadHistory() {
    pagingRequest.current?.abort();
    pagingRequest.current = null;
    setLoadingMore(false);
    setHistoryLoading(true);
    setHistoryError('');
    setHistoryVersion((value) => value + 1);
  }

  async function loadMore() {
    if (!history?.nextCursor || pagingRequest.current) return;
    const controller = new AbortController();
    pagingRequest.current = controller;
    setLoadingMore(true);
    setHistoryError('');
    try {
      const page = await fetchRoutes(controller.signal, history.nextCursor);
      if (!controller.signal.aborted) {
        setHistory({ routes: [...history.routes, ...page.routes], nextCursor: page.nextCursor });
      }
    } catch (error) {
      if (!controller.signal.aborted) setHistoryError(routeErrorText(error, onSessionExpired));
    } finally {
      if (!controller.signal.aborted) {
        pagingRequest.current = null;
        setLoadingMore(false);
      }
    }
  }

  function onImported(result: ImportResult) {
    setNotice('');
    setSelectedId(result.firstRouteId);
    reloadHistory();
  }

  function onDeleted(id: string) {
    setNotice('Trasa została usunięta.');
    setHistory((current) => current && { ...current, routes: current.routes.filter((route) => route.id !== id) });
    setSelectedId((current) => current === id ? undefined : current);
    reloadHistory();
  }

  function selectRoute(id: string) {
    setNotice('');
    setSelectedId(id);
    if (window.matchMedia('(max-width: 1023px)').matches) pane.current?.scrollIntoView({ block: 'start' });
  }

  return (
    <div className="min-h-dvh bg-stone-100 font-sans text-stone-900">
      <header className="bg-[#153a35] text-white">
        <div className="relative mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <p className="text-base font-semibold tracking-tight sm:text-lg">Analiza tras rowerowych</p>
          <details className="group">
            <summary className="cursor-pointer list-none rounded-lg border border-white/35 px-4 py-2 text-sm font-semibold hover:bg-white/10 group-open:bg-white/15 [&::-webkit-details-marker]:hidden">
              Konto
            </summary>
            <div className="absolute right-4 top-full z-10 mt-2 w-[min(24rem,calc(100vw-2rem))] rounded-xl border border-stone-200 bg-white p-4 text-stone-900 shadow-lg sm:right-6 lg:right-8">
              {accountControls}
            </div>
          </details>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <h1 className="mb-5 text-3xl font-semibold tracking-tight sm:text-4xl">Moje trasy</h1>
        {notice && <p role="status" className="mb-4 rounded-lg border border-teal-200 bg-teal-50 px-4 py-2 text-sm font-medium text-teal-950">{notice}</p>}

        <div className="grid items-start gap-5 lg:grid-cols-[20rem_minmax(0,1fr)]">
          <aside className="space-y-4">
            <ImportForm onImported={onImported} onSessionExpired={onSessionExpired} />
            <section className={panel} aria-labelledby="history-title">
              <h2 id="history-title" className="text-lg font-semibold">Historia tras</h2>
              {historyLoading && <p role="status" className="mt-2 text-sm text-stone-600">Wczytywanie historii…</p>}
              {historyError && (
                <div className="mt-3 space-y-2">
                  <p role="alert" className="text-sm text-red-900">{historyError}</p>
                  <button type="button" onClick={reloadHistory} className={secondaryButton}>Odśwież historię</button>
                </div>
              )}
              {history && history.routes.length > 0 && (
                <ul className="mt-3 space-y-2">
                  {history.routes.map((route) => (
                    <li key={route.id}>
                      <button type="button" aria-current={selectedId === route.id ? 'true' : undefined}
                        className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 rounded-lg border border-stone-200 px-3 py-2 text-left hover:border-teal-600 aria-current:border-teal-700 aria-current:bg-teal-50"
                        onClick={() => selectRoute(route.id)}>
                        <span className="min-w-0 truncate text-sm font-semibold" title={route.title}>{route.title}</span>
                        <span className="text-right text-sm tabular-nums text-teal-900">{formatDistance(route.distanceM)}</span>
                        <time dateTime={route.importedAt} className="col-span-2 text-sm text-stone-600">{formatDate(route.importedAt)}</time>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {!historyLoading && !historyError && history?.routes.length === 0 && (
                <p className="mt-2 text-sm text-stone-600">Twoje zapisane trasy pojawią się tutaj po imporcie.</p>
              )}
              {history?.nextCursor && (
                <button type="button" className={`${secondaryButton} mt-3 w-full`} disabled={historyLoading || loadingMore}
                  onClick={() => void loadMore()}>
                  {loadingMore ? 'Wczytywanie…' : 'Pokaż więcej tras'}
                </button>
              )}
            </section>
          </aside>

          <div ref={pane} className="min-w-0 scroll-mt-4">
            {selectedId ? <RoutePane key={selectedId} routeId={selectedId} onDeleted={onDeleted} onSessionExpired={onSessionExpired} /> : (
              <section className="grid min-h-56 place-content-center rounded-2xl border border-dashed border-stone-300 bg-white p-6 text-center">
                <h2 className="text-xl font-semibold">Mapa i statystyki</h2>
                <p className="mt-2 text-stone-600">Zaimportuj plik GPX lub wybierz trasę z historii.</p>
              </section>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
