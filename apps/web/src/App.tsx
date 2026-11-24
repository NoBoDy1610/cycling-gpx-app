import { useEffect, useState } from 'react';
import { AccountAccess } from './features/auth/AccountAccess';

const statusMessages = {
  checking: 'Sprawdzanie połączenia z API i PostgreSQL…',
  connected: 'API i PostgreSQL działają.',
  'database-unavailable': 'API działa. PostgreSQL jest niedostępny.',
  'api-unavailable': 'API jest niedostępne.',
};

type ConnectionStatus = keyof typeof statusMessages;

async function checkHealth(signal: AbortSignal): Promise<ConnectionStatus> {
  const response = await fetch('/api/health', { signal });
  const body: unknown = await response.json();

  if (typeof body === 'object' && body !== null && 'database' in body) {
    if (response.ok && body.database === 'connected') {
      return 'connected';
    }
    if (response.status === 503 && body.database === 'unavailable') {
      return 'database-unavailable';
    }
  }

  return 'api-unavailable';
}

export function App() {
  const [status, setStatus] = useState<ConnectionStatus>('checking');

  useEffect(() => {
    const controller = new AbortController();

    void checkHealth(controller.signal)
      .catch((): ConnectionStatus => 'api-unavailable')
      .then((result) => {
        if (!controller.signal.aborted) {
          setStatus(result);
        }
      });

    return () => controller.abort();
  }, []);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-stone-100 p-6 font-sans text-stone-900">
      <div className="w-full max-w-lg rounded-2xl border border-stone-200 bg-white p-8">
        <h1 className="mb-6 text-3xl font-semibold tracking-tight">Analiza tras rowerowych</h1>
        <AccountAccess />
        <p role="status" className="mt-5 border-t border-stone-200 pt-5 text-stone-600">
          {statusMessages[status]}
        </p>
      </div>
    </main>
  );
}
