import { createHash, randomBytes } from 'node:crypto';
import type { CookieOptions, Request } from 'express';
import type { PrismaClient } from '../../generated/prisma/client.ts';
import { AuthError } from './credentials.ts';

export const sessionCookie = 'cycling_session';
const sessionLifetimeMs = 7 * 24 * 60 * 60 * 1000;

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export function newSession() {
  const token = randomBytes(32).toString('base64url');
  return { token, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + sessionLifetimeMs) };
}

export function readSessionHash(request: Request) {
  const prefix = `${sessionCookie}=`;
  const cookie = request.headers.cookie?.split(';').find((part) => part.trimStart().startsWith(prefix));
  const token = cookie?.trim().slice(prefix.length);
  return token && /^[A-Za-z0-9_-]{43}$/.test(token) ? hashToken(token) : undefined;
}

export function sessionCookieOptions(secure: boolean): CookieOptions {
  return { httpOnly: true, sameSite: 'lax', secure, path: '/api' };
}

export async function requireSessionUser(database: PrismaClient, request: Request) {
  const tokenHash = readSessionHash(request);
  const session = tokenHash && await database.session.findUnique({
    where: { tokenHash },
    select: { expiresAt: true, user: { select: { id: true, email: true, passwordHash: true } } },
  });

  if (!session || session.expiresAt.getTime() <= Date.now()) {
    throw new AuthError('SESSION_REQUIRED');
  }
  return session.user;
}
