import { hash, verify } from '@node-rs/argon2';
import { Prisma } from '../../generated/prisma/client.ts';

const errorStatuses = {
  INVALID_EMAIL: 400,
  INVALID_PASSWORD: 400,
  INVALID_BODY: 400,
  INVALID_CREDENTIALS: 401,
  SESSION_REQUIRED: 401,
  INVALID_ORIGIN: 403,
  EMAIL_TAKEN: 409,
  ACCOUNT_CHANGED: 409,
  BODY_TOO_LARGE: 413,
  TOO_MANY_ATTEMPTS: 429,
  INTERNAL_ERROR: 500,
};

export class AuthError extends Error {
  readonly code: keyof typeof errorStatuses;

  constructor(code: keyof typeof errorStatuses) {
    super(code);
    this.code = code;
  }

  get status() {
    return errorStatuses[this.code];
  }
}

// Valid Argon2id parameters for performing the same work when an account is absent.
const dummyHash = '$argon2id$v=19$m=19456,t=2,p=1$c29tZS1kdW1teS1zYWx0$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const argon2id = 2;

export function hashPassword(password: string) {
  return hash(password, {
    algorithm: argon2id,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
  });
}

export function verifyPassword(password: string, passwordHash?: string) {
  return verify(passwordHash ?? dummyHash, password);
}

function field(input: unknown, key: string) {
  if (typeof input !== 'object' || input === null || !Object.hasOwn(input, key)) {
    return undefined;
  }
  return (input as Record<string, unknown>)[key];
}

export function readEmail(input: unknown) {
  const value = field(input, 'email');
  const email = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new AuthError('INVALID_EMAIL');
  }
  return email;
}

export function readPassword(input: unknown, key: string, minLength = 1) {
  const value = field(input, key);
  if (typeof value !== 'string') {
    throw new AuthError('INVALID_PASSWORD');
  }
  const length = Array.from(value).length;
  if (length < minLength || length > 128) {
    throw new AuthError('INVALID_PASSWORD');
  }
  return value;
}

export function emailConflict(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    throw new AuthError('EMAIL_TAKEN');
  }
  throw error;
}
