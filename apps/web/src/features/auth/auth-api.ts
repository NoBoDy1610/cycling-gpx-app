export interface Account {
  id: string;
  email: string;
}

const errorMessages: Record<string, string> = {
  INVALID_EMAIL: 'Podaj poprawny adres e-mail.',
  INVALID_PASSWORD: 'Podaj hasło o wymaganej długości.',
  INVALID_CREDENTIALS: 'Adres e-mail lub hasło są nieprawidłowe.',
  SESSION_REQUIRED: 'Sesja wygasła. Zaloguj się ponownie.',
  EMAIL_TAKEN: 'Ten adres e-mail jest już używany.',
  ACCOUNT_CHANGED: 'Dane konta zostały zmienione. Spróbuj ponownie.',
  TOO_MANY_ATTEMPTS: 'Zbyt wiele prób. Spróbuj ponownie za kilka minut.',
};

export class AccountRequestError extends Error {
  constructor(readonly code: string) {
    super(Object.hasOwn(errorMessages, code) ? errorMessages[code] : 'Operacja nie powiodła się. Spróbuj ponownie.');
  }
}

export function requestErrorMessage(error: unknown) {
  return error instanceof AccountRequestError ? error.message : 'Nie udało się połączyć z usługą konta.';
}

async function request(path: string, method: string, body?: object, signal?: AbortSignal): Promise<unknown> {
  const response = await fetch(`/api/auth${path}`, {
    method,
    signal,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (response.status === 204) {
    return undefined;
  }

  const payload: unknown = await response.json();
  if (!response.ok) {
    const error = payload && typeof payload === 'object' && 'error' in payload ? payload.error : undefined;
    const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
    throw new AccountRequestError(typeof code === 'string' ? code : 'UNKNOWN_ERROR');
  }
  return payload;
}

async function readAccount(response: Promise<unknown>): Promise<Account> {
  const payload = await response;
  const user = payload && typeof payload === 'object' && 'user' in payload ? payload.user : undefined;
  if (user && typeof user === 'object' && 'id' in user && 'email' in user &&
    typeof user.id === 'string' && typeof user.email === 'string') {
    return { id: user.id, email: user.email };
  }
  throw new AccountRequestError('UNKNOWN_ERROR');
}

export async function getSession(signal: AbortSignal) {
  try {
    return await readAccount(request('/session', 'GET', undefined, signal));
  } catch (error) {
    if (error instanceof AccountRequestError && error.code === 'SESSION_REQUIRED') {
      return null;
    }
    throw error;
  }
}

export function submitCredentials(mode: 'login' | 'register', email: string, password: string) {
  return readAccount(request(`/${mode}`, 'POST', { email, password }));
}

export function changeEmail(email: string, currentPassword: string) {
  return readAccount(request('/account/email', 'PATCH', { email, currentPassword }));
}

export async function changePassword(currentPassword: string, newPassword: string) {
  await request('/account/password', 'PATCH', { currentPassword, newPassword });
}

export async function deleteAccount(currentPassword: string) {
  await request('/account', 'DELETE', { currentPassword });
}

export async function logOut() {
  await request('/session', 'DELETE');
}
