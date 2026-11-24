import { createHash, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import type { Server } from 'node:http';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { createApp } from '../src/app.ts';
import { createDatabase } from '../src/infrastructure/database.ts';

const origin = 'http://127.0.0.1:5173';
const testRun = randomUUID();
const password = 'correct horse bicycle road';
const newPassword = 'reliable bicycle spare chain';

function email(prefix: string) {
  return `${prefix}-${testRun}@example.test`;
}

describe.runIf(process.env.RUN_DATABASE_TESTS === '1')('accounts and sessions with PostgreSQL', () => {
  let database: ReturnType<typeof createDatabase>;
  let server: Server;
  let baseUrl: string;

  beforeAll(() => {
    database = createDatabase(true);
  });

  afterAll(async () => {
    try {
      await database.client.user.deleteMany({ where: { email: { endsWith: `-${testRun}@example.test` } } });
    } finally {
      await database.client.$disconnect();
      await database.pool.end();
    }
  });

  beforeEach(async () => {
    server = createApp(async () => { await database.pool.query('SELECT 1'); }, {
      database: database.client,
      origins: [origin],
      secureCookies: true,
    }).listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('The test server must listen on a TCP port.');
    }
    baseUrl = `http://127.0.0.1:${address.port}/api/auth`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  async function request(path: string, options: {
    method?: string;
    body?: object;
    cookie?: string;
    requestOrigin?: string | null;
  } = {}) {
    const { method = 'GET', body, cookie, requestOrigin = origin } = options;
    const headers = new Headers();
    if (requestOrigin) headers.set('Origin', requestOrigin);
    if (body) headers.set('Content-Type', 'application/json');
    if (cookie) headers.set('Cookie', cookie);

    const response = await fetch(`${baseUrl}${path}`, { method, headers, body: body && JSON.stringify(body) });
    const json: unknown = response.status === 204 ? undefined : await response.json();
    const setCookie = response.headers.get('Set-Cookie') ?? '';
    return { status: response.status, json, setCookie, cookie: setCookie.split(';')[0], headers: response.headers };
  }

  async function register(address: string) {
    const result = await request('/register', { method: 'POST', body: { email: address, password } });
    expect(result.status).toBe(201);
    return result;
  }

  function login(address: string, secret = password) {
    return request('/login', { method: 'POST', body: { email: address, password: secret } });
  }

  test('normalizes email, stores hashes, creates a protected session and rejects duplicates', async () => {
    const address = email('register');
    const session = await register(` ${address.toUpperCase()} `);

    expect(session.json).toEqual({ user: { id: expect.any(String), email: address } });
    expect(session.headers.get('Cache-Control')).toBe('no-store');
    expect(session.setCookie).toMatch(/HttpOnly/i);
    expect(session.setCookie).toMatch(/SameSite=Lax/i);
    expect(session.setCookie).toMatch(/Secure/i);

    const record = await database.client.user.findUniqueOrThrow({ where: { email: address }, include: { sessions: true } });
    expect(record.passwordHash).toMatch(/^\$argon2id\$/);
    expect(record.sessions).toHaveLength(1);
    const token = session.cookie.split('=')[1];
    expect(record.sessions[0].tokenHash).toBe(createHash('sha256').update(token).digest('hex'));
    expect(record.sessions[0].expiresAt.getTime()).toBeGreaterThan(Date.now());

    const duplicate = await request('/register', { method: 'POST', body: { email: address, password } });
    expect(duplicate).toMatchObject({ status: 409, json: { error: { code: 'EMAIL_TAKEN' } } });
    expect((await request('/session', { cookie: session.cookie })).json).toEqual(session.json);
    expect((await request('/session')).status).toBe(401);
  });

  test('logs in, uses the same error for invalid credentials, and revokes a logged-out session', async () => {
    const address = email('login');
    await register(address);
    const wrongPassword = await login(address, `${password} wrong`);
    const unknownAccount = await login(email('unknown'));
    expect(wrongPassword).toMatchObject({ status: 401, json: { error: { code: 'INVALID_CREDENTIALS' } } });
    expect(unknownAccount.json).toEqual(wrongPassword.json);
    expect(unknownAccount.status).toBe(401);

    const session = await login(address);
    expect(session.status).toBe(200);
    expect((await request('/session', { cookie: session.cookie })).status).toBe(200);
    const logout = await request('/session', { method: 'DELETE', cookie: session.cookie });
    expect(logout.status).toBe(204);
    expect(logout.setCookie).toMatch(/^cycling_session=;/);
    expect((await request('/session', { cookie: session.cookie })).status).toBe(401);
  });

  test('rejects expired sessions', async () => {
    const address = email('expired');
    const session = await register(address);
    await database.client.session.updateMany({ where: { user: { email: address } }, data: { expiresAt: new Date(0) } });

    const lookup = await request('/session', { cookie: session.cookie });
    expect(lookup).toMatchObject({ status: 401, json: { error: { code: 'SESSION_REQUIRED' } } });
  });

  test('requires the allowed origin, a session and the current password for an email change', async () => {
    const address = email('email-before');
    const replacement = email('email-after');
    const occupied = email('email-occupied');
    const session = await register(address);
    await register(occupied);
    const action = { method: 'PATCH', body: { email: replacement, currentPassword: password } };

    expect((await request('/account/email', action)).status).toBe(401);
    for (const requestOrigin of [null, 'https://untrusted.example.test']) {
      const crossOrigin = await request('/account/email', { ...action, cookie: session.cookie, requestOrigin });
      expect(crossOrigin).toMatchObject({ status: 403, json: { error: { code: 'INVALID_ORIGIN' } } });
    }
    const wrongPassword = await request('/account/email', {
      ...action, cookie: session.cookie, body: { email: replacement, currentPassword: 'incorrect' },
    });
    expect(wrongPassword).toMatchObject({ status: 401, json: { error: { code: 'INVALID_CREDENTIALS' } } });
    const duplicate = await request('/account/email', {
      ...action, cookie: session.cookie, body: { email: occupied, currentPassword: password },
    });
    expect(duplicate).toMatchObject({ status: 409, json: { error: { code: 'EMAIL_TAKEN' } } });

    const result = await request('/account/email', { ...action, cookie: session.cookie });
    expect(result).toMatchObject({ status: 200, json: { user: { email: replacement } } });
    expect((await login(address)).status).toBe(401);
    expect((await login(replacement)).status).toBe(200);
  });

  test('requires the current password and revokes every session on a password change', async () => {
    const address = email('password');
    const first = await register(address);
    const second = await login(address);
    const action = { method: 'PATCH', cookie: first.cookie, body: { currentPassword: password, newPassword } };
    const rejected = await request('/account/password', { ...action, body: { currentPassword: 'incorrect', newPassword } });
    expect(rejected.status).toBe(401);
    expect((await request('/account/password', action)).status).toBe(204);
    expect((await request('/session', { cookie: first.cookie })).status).toBe(401);
    expect((await request('/session', { cookie: second.cookie })).status).toBe(401);
    expect((await login(address)).status).toBe(401);
    expect((await login(address, newPassword)).status).toBe(200);
  });

  test('cannot retain a session issued concurrently with a password change', async () => {
    const address = email('concurrent-password');
    const session = await register(address);
    const [oldLogin, change] = await Promise.all([
      login(address),
      request('/account/password', {
        method: 'PATCH', cookie: session.cookie, body: { currentPassword: password, newPassword },
      }),
    ]);

    expect(change.status).toBe(204);
    expect([200, 401]).toContain(oldLogin.status);
    if (oldLogin.status === 200) {
      expect((await request('/session', { cookie: oldLogin.cookie })).status).toBe(401);
    }
    expect((await login(address, newPassword)).status).toBe(200);
  });

  test('requires the current password and deletes the account and its sessions', async () => {
    const address = email('delete');
    const session = await register(address);
    const { id } = await database.client.user.findUniqueOrThrow({ where: { email: address } });
    const action = { method: 'DELETE', cookie: session.cookie, body: { currentPassword: password } };

    expect((await request('/account', { ...action, body: { currentPassword: 'incorrect' } })).status).toBe(401);
    expect((await request('/account', action)).status).toBe(204);
    expect(await database.client.user.findUnique({ where: { id } })).toBeNull();
    expect(await database.client.session.count({ where: { userId: id } })).toBe(0);
    expect((await request('/session', { cookie: session.cookie })).status).toBe(401);
  });

  test('limits credential attempts per IP address', async () => {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      expect((await login('invalid-email')).status).toBe(400);
    }
    expect(await login('invalid-email')).toMatchObject({ status: 429, json: { error: { code: 'TOO_MANY_ATTEMPTS' } } });
  });
});
