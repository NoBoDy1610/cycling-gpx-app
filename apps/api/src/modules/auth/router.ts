import { json, Router } from 'express';
import type { ErrorRequestHandler, Request, Response } from 'express';
import { rateLimit } from 'express-rate-limit';
import type { PrismaClient } from '../../generated/prisma/client.ts';
import { AuthError, emailConflict, hashPassword, readEmail, readPassword, verifyPassword } from './credentials.ts';
import { newSession, readSessionHash, requireAllowedOrigin, requireSessionUser, sessionCookie, sessionCookieOptions } from './sessions.ts';

export interface AuthOptions {
  database: PrismaClient;
  origins: readonly string[];
  secureCookies: boolean;
}

function sendAuthError(response: Response, error: AuthError) {
  response.status(error.status).json({ error: { code: error.code } });
}

const handleError: ErrorRequestHandler = (error: unknown, _request, response, _next) => {
  if (error instanceof AuthError) {
    sendAuthError(response, error);
    return;
  }
  if (error instanceof Error && 'type' in error) {
    if (error.type === 'entity.parse.failed') {
      sendAuthError(response, new AuthError('INVALID_BODY'));
      return;
    }
    if (error.type === 'entity.too.large') {
      sendAuthError(response, new AuthError('BODY_TOO_LARGE'));
      return;
    }
  }
  console.error('An unexpected authentication error occurred.');
  sendAuthError(response, new AuthError('INTERNAL_ERROR'));
};

export function createAuthRouter({ database, origins, secureCookies }: AuthOptions) {
  const router = Router();
  const cookieOptions = sessionCookieOptions(secureCookies);
  const credentialAttempts = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_request, response) => sendAuthError(response, new AuthError('TOO_MANY_ATTEMPTS')),
  });

  router.use((request, response, next) => {
    response.set('Cache-Control', 'no-store');
    if (!['GET', 'HEAD'].includes(request.method)) {
      requireAllowedOrigin(request, origins);
    }
    next();
  });
  router.use(json({ limit: '8kb' }));

  async function confirmPassword(request: Request) {
    const user = await requireSessionUser(database, request);
    const currentPassword = readPassword(request.body, 'currentPassword');
    if (!await verifyPassword(currentPassword, user.passwordHash)) {
      throw new AuthError('INVALID_CREDENTIALS');
    }
    return user;
  }

  router.post('/register', credentialAttempts, async (request, response) => {
    const email = readEmail(request.body);
    const password = readPassword(request.body, 'password', 15);
    const session = newSession();
    const user = await database.user.create({
      data: {
        email,
        passwordHash: await hashPassword(password),
        sessions: { create: { tokenHash: session.tokenHash, expiresAt: session.expiresAt } },
      },
      select: { id: true, email: true },
    }).catch(emailConflict);

    response.cookie(sessionCookie, session.token, { ...cookieOptions, expires: session.expiresAt });
    response.status(201).json({ user });
  });

  router.post('/login', credentialAttempts, async (request, response) => {
    const email = readEmail(request.body);
    const password = readPassword(request.body, 'password');
    const user = await database.user.findUnique({ where: { email } });
    const verified = await verifyPassword(password, user?.passwordHash);
    if (!user || !verified) {
      throw new AuthError('INVALID_CREDENTIALS');
    }

    const session = newSession();
    await database.$transaction(async (transaction) => {
      // Serialize session creation with credential changes for the same user.
      const users = await transaction.$queryRaw<{ id: string }[]>`
        SELECT id FROM "users"
        WHERE id = ${user.id}::uuid AND email = ${email} AND "passwordHash" = ${user.passwordHash}
        FOR UPDATE
      `;
      if (!users.length) {
        throw new AuthError('INVALID_CREDENTIALS');
      }
      await transaction.session.deleteMany({ where: { userId: user.id, expiresAt: { lte: new Date() } } });
      await transaction.session.create({
        data: { userId: user.id, tokenHash: session.tokenHash, expiresAt: session.expiresAt },
      });
    });

    response.cookie(sessionCookie, session.token, { ...cookieOptions, expires: session.expiresAt });
    response.json({ user: { id: user.id, email: user.email } });
  });

  router.get('/session', async (request, response) => {
    const { id, email } = await requireSessionUser(database, request);
    response.json({ user: { id, email } });
  });

  router.delete('/session', async (request, response) => {
    const tokenHash = readSessionHash(request);
    if (tokenHash) {
      await database.session.deleteMany({ where: { tokenHash } });
    }
    response.clearCookie(sessionCookie, cookieOptions).sendStatus(204);
  });

  router.patch('/account/email', credentialAttempts, async (request, response) => {
    const user = await confirmPassword(request);
    const email = readEmail(request.body);
    const result = await database.user.updateMany({
      where: { id: user.id, email: user.email, passwordHash: user.passwordHash },
      data: { email },
    }).catch(emailConflict);
    if (!result.count) {
      throw new AuthError('ACCOUNT_CHANGED');
    }
    response.json({ user: { id: user.id, email } });
  });

  router.patch('/account/password', credentialAttempts, async (request, response) => {
    const user = await confirmPassword(request);
    const password = readPassword(request.body, 'newPassword', 15);
    const passwordHash = await hashPassword(password);
    await database.$transaction(async (transaction) => {
      const result = await transaction.user.updateMany({
        where: { id: user.id, passwordHash: user.passwordHash },
        data: { passwordHash },
      });
      if (!result.count) {
        throw new AuthError('ACCOUNT_CHANGED');
      }
      await transaction.session.deleteMany({ where: { userId: user.id } });
    });
    response.clearCookie(sessionCookie, cookieOptions).sendStatus(204);
  });

  router.delete('/account', credentialAttempts, async (request, response) => {
    const user = await confirmPassword(request);
    const result = await database.user.deleteMany({ where: { id: user.id, passwordHash: user.passwordHash } });
    if (!result.count) {
      throw new AuthError('ACCOUNT_CHANGED');
    }
    response.clearCookie(sessionCookie, cookieOptions).sendStatus(204);
  });

  router.use(handleError);
  return router;
}
