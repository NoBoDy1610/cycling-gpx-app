import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { readFileSync } from 'node:fs';
import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { createApp } from '../src/app.ts';
import { createDatabase } from '../src/infrastructure/database.ts';
import { gpxLimits } from '../src/modules/gpx/model.ts';

const origin = 'http://127.0.0.1:5173';
const testRun = randomUUID();
const password = 'synthetic gpx integration test';
const fixture = readFileSync(new URL('./fixtures/multiple-tracks.gpx', import.meta.url), 'utf8');

function upload(content = fixture, field = 'file') {
  const form = new FormData();
  form.append(field, new Blob([content], { type: 'application/octet-stream' }), 'route.gpx');
  return form;
}

describe.runIf(process.env.RUN_DATABASE_TESTS === '1')('GPX imports with PostgreSQL', () => {
  let database: ReturnType<typeof createDatabase>;
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    database = createDatabase(true);
    server = createApp(async () => { await database.pool.query('SELECT 1'); }, {
      database: database.client, origins: [origin], secureCookies: false,
    }).listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('The test server must listen on a TCP port.');
    baseUrl = `http://127.0.0.1:${address.port}/api`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    try {
      await database.client.user.deleteMany({ where: { email: { endsWith: `-${testRun}@example.test` } } });
    } finally {
      await database.client.$disconnect();
      await database.pool.end();
    }
  });

  async function createAccount(prefix: string) {
    const email = `${prefix}-${testRun}@example.test`;
    const response = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    expect(response.status).toBe(201);
    const cookie = response.headers.get('Set-Cookie')?.split(';')[0];
    if (!cookie) throw new Error('The API did not set a session cookie.');
    const { id } = await database.client.user.findUniqueOrThrow({ where: { email }, select: { id: true } });
    return { id, cookie };
  }

  async function importFile(body: FormData | string, cookie?: string, requestOrigin = origin) {
    const headers = new Headers({ Origin: requestOrigin });
    if (cookie) headers.set('Cookie', cookie);
    const response = await fetch(`${baseUrl}/routes/import`, { method: 'POST', headers, body });
    const json: unknown = await response.json();
    return { status: response.status, json, headers: response.headers };
  }

  test('persists two routes with analyses owned by the session account and removes them with the account', async () => {
    const account = await createAccount('multiple');
    const result = await importFile(upload(), account.cookie);
    const stored = await database.client.routeImport.findFirstOrThrow({
      where: { userId: account.id },
      include: { routes: { orderBy: { trackIndex: 'asc' }, include: { analyses: true } } },
    });

    expect(result.status).toBe(201);
    expect(result.headers.get('Cache-Control')).toBe('no-store');
    expect(result.json).toMatchObject({ import: {
      id: stored.id,
      gpxVersion: '1.1',
      createdAt: stored.createdAt.toISOString(),
      warnings: [
        { code: 'IGNORED_SEGMENT', trackIndex: 0, segmentIndex: 1 },
        { code: 'ELEVATION_UNAVAILABLE', trackIndex: 1 },
        { code: 'TIME_UNAVAILABLE', trackIndex: 1 },
      ],
      routes: [
        { id: stored.routes[0].id, title: 'Pętla testowa & odcinki', trackIndex: 0, pointCount: 4, analysis: { elapsedDurationS: 120 } },
        { id: stored.routes[1].id, title: 'Ślad 2', trackIndex: 1, pointCount: 2, analysis: { elapsedDurationS: null } },
      ],
    } });
    expect(result.json).not.toHaveProperty('import.routes.0.geometry');
    expect(stored.routes[0].geometry).toEqual([
      [
        { latitude: 0, longitude: 0, elevationM: 100, recordedAt: '2026-01-01T11:00:00.000Z' },
        { latitude: 0, longitude: 0.01, elevationM: 150, recordedAt: '2026-01-01T11:00:30.000Z' },
      ],
      [
        { latitude: 0, longitude: 50, elevationM: 800, recordedAt: '2026-01-01T11:01:30.000Z' },
        { latitude: 0, longitude: 50.01, elevationM: 790, recordedAt: '2026-01-01T11:02:00.000Z' },
      ],
    ]);
    expect(stored.routes[0].analyses).toHaveLength(1);
    expect(stored.routes[0].analyses[0].distanceM).toBeCloseTo(2223.89853, 5);

    const deletion = await fetch(`${baseUrl}/auth/account`, {
      method: 'DELETE', headers: { Origin: origin, Cookie: account.cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword: password }),
    });
    expect(deletion.status).toBe(204);
    expect(await database.client.routeImport.findUnique({ where: { id: stored.id } })).toBeNull();
    expect(await database.client.route.count({ where: { importId: stored.id } })).toBe(0);
    expect(await database.client.routeAnalysis.count({ where: { routeId: { in: stored.routes.map(({ id }) => id) } } })).toBe(0);
  });

  test('rejects the entire import when the second track is invalid', async () => {
    const account = await createAccount('atomic');
    const invalid = fixture.replace('<trkpt lat="0" lon="0"><time>2026-02-30', '<trkpt lat="91" lon="0"><time>2026-02-30');
    expect(await importFile(upload(invalid), account.cookie))
      .toMatchObject({ status: 422, json: { error: { code: 'INVALID_COORDINATES' } } });
    expect(await database.client.routeImport.count({ where: { userId: account.id } })).toBe(0);
  });

  test('requires an active session and an allowed origin before importing', async () => {
    const account = await createAccount('protected');
    expect(await importFile(upload())).toMatchObject({ status: 401, json: { error: { code: 'SESSION_REQUIRED' } } });
    expect(await importFile(upload(), account.cookie, 'https://untrusted.example.test'))
      .toMatchObject({ status: 403, json: { error: { code: 'INVALID_ORIGIN' } } });
    expect(await database.client.routeImport.count({ where: { userId: account.id } })).toBe(0);
  });

  test('accepts exactly one nonempty file in the file field and validates contents', async () => {
    const account = await createAccount('multipart');
    const extraFile = upload();
    extraFile.append('file', new Blob([fixture]), 'additional.gpx');
    const extraField = upload();
    extraField.append('extra', 'unexpected');
    for (const form of [new FormData(), upload(''), upload(fixture, 'wrong'), extraFile, extraField]) {
      expect(await importFile(form, account.cookie))
        .toMatchObject({ status: 400, json: { error: { code: 'INVALID_MULTIPART' } } });
    }
    expect(await importFile(fixture, account.cookie))
      .toMatchObject({ status: 415, json: { error: { code: 'UNSUPPORTED_MEDIA_TYPE' } } });
    expect(await importFile(upload('<gpx>'), account.cookie))
      .toMatchObject({ status: 422, json: { error: { code: 'UNSUPPORTED_GPX_VERSION' } } });
    expect(await database.client.routeImport.count({ where: { userId: account.id } })).toBe(0);
  });

  test('enforces the maximum file size with no partial database write', async () => {
    const account = await createAccount('file-limit');
    const xml = fixture.replace('</gpx>', '<!----></gpx>');
    const pad = 'x'.repeat(gpxLimits.fileBytes - Buffer.byteLength(xml));
    const exact = xml.replace('<!---->', `<!--${pad}-->`);
    expect(await importFile(upload(`${exact} `), account.cookie))
      .toMatchObject({ status: 413, json: { error: { code: 'GPX_LIMIT_EXCEEDED' } } });
    expect(await database.client.routeImport.count({ where: { userId: account.id } })).toBe(0);
    expect((await importFile(upload(exact), account.cookie)).status).toBe(201);
  });
});
