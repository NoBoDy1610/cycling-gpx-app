import { once } from 'node:events';
import { expect, test } from 'vitest';
import { createApp } from '../src/app.ts';

async function requestHealth(checkDatabase: () => Promise<void>) {
  const server = createApp(checkDatabase).listen(0, '127.0.0.1');

  try {
    await once(server, 'listening');
    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('The test server must listen on a TCP port.');
    }

    const response = await fetch(`http://127.0.0.1:${address.port}/api/health`);
    const body: unknown = await response.json();
    return { status: response.status, body };
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

test('reports that the API and database are ready', async () => {
  const response = await requestHealth(async () => {});

  expect(response).toEqual({
    status: 200,
    body: { status: 'ok', database: 'connected' },
  });
});

test('returns 503 without exposing the database error', async () => {
  const response = await requestHealth(async () => {
    throw new Error('Connection refused');
  });

  expect(response).toEqual({
    status: 503,
    body: { status: 'unavailable', database: 'unavailable' },
  });
});
