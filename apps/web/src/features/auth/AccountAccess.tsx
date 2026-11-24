import { useEffect, useState } from 'react';
import type { ComponentProps, FormEvent } from 'react';
import {
  AccountRequestError, changeEmail, changePassword, deleteAccount, getSession, logOut,
  requestErrorMessage, submitCredentials,
} from './auth-api';
import type { Account } from './auth-api';

const actionButton = 'rounded-lg px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50';
const primaryButton = `${actionButton} bg-teal-800 hover:bg-teal-900`;
const secondaryButton = 'rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium hover:bg-stone-100 disabled:opacity-50';

function Field({ label, ...props }: ComponentProps<'input'> & { label: string }) {
  return (
    <label className="block space-y-1.5 text-sm font-medium">
      <span>{label}</span>
      <input {...props} required className="block w-full rounded-lg border border-stone-300 px-3 py-2.5 outline-offset-2 focus:outline-teal-700" />
    </label>
  );
}

function formValue(data: FormData, name: string) {
  const value = data.get(name);
  return typeof value === 'string' ? value : '';
}

function useRequest(onError?: (error: unknown) => boolean) {
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState('');

  async function run(action: () => Promise<void>) {
    setFeedback('');
    setPending(true);
    try {
      await action();
    } catch (error) {
      if (!onError?.(error)) {
        setFeedback(requestErrorMessage(error));
      }
    } finally {
      setPending(false);
    }
  }

  return { pending, feedback, clearFeedback: () => setFeedback(''), run };
}

function ErrorMessage({ message }: { message: string }) {
  return message ? <p role="alert" className="text-sm font-medium text-red-800">{message}</p> : null;
}

function Credentials({ onSignIn }: { onSignIn: (account: Account) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const { pending, feedback, clearFeedback, run } = useRequest();
  const registering = mode === 'register';

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    void run(async () => onSignIn(await submitCredentials(mode, formValue(data, 'email'), formValue(data, 'password'))));
  }

  return (
    <>
      <div className="mb-5 flex flex-wrap gap-2" aria-label="Dostęp do konta">
        {([['login', 'Logowanie'], ['register', 'Rejestracja']] as const).map(([value, label]) => (
          <button key={value} type="button" disabled={pending} aria-pressed={mode === value}
            onClick={() => { setMode(value); clearFeedback(); }}
            className={`${secondaryButton} aria-pressed:border-teal-800 aria-pressed:bg-teal-50 aria-pressed:text-teal-900`}>
            {label}
          </button>
        ))}
      </div>
      <form key={mode} onSubmit={submit} className="space-y-4" aria-label={registering ? 'Rejestracja' : 'Logowanie'}>
        <Field label="Adres e-mail" name="email" type="email" autoComplete="email" maxLength={254} disabled={pending} />
        <Field label="Hasło" name="password" type="password" autoComplete={registering ? 'new-password' : 'current-password'}
          minLength={registering ? 15 : undefined} disabled={pending} />
        {registering && <p className="text-sm text-stone-600">Użyj od 15 do 128 znaków.</p>}
        <ErrorMessage message={feedback} />
        <button className={primaryButton} disabled={pending}>{registering ? 'Załóż konto' : 'Zaloguj się'}</button>
      </form>
    </>
  );
}

const settingLabels = { email: 'Zmień e-mail', password: 'Zmień hasło', delete: 'Usuń konto' };
type Setting = keyof typeof settingLabels;

function AccountSettings({ account, onUpdate, onSignOut }: {
  account: Account;
  onUpdate: (account: Account) => void;
  onSignOut: (message: string) => void;
}) {
  const [setting, setSetting] = useState<Setting>();
  const [notice, setNotice] = useState('');
  const { pending, feedback, clearFeedback, run } = useRequest((error) => {
    if (error instanceof AccountRequestError && error.code === 'SESSION_REQUIRED') {
      onSignOut(error.message);
      return true;
    }
    return false;
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const currentPassword = formValue(data, 'currentPassword');

    void run(async () => {
      switch (setting) {
        case 'email':
          onUpdate(await changeEmail(formValue(data, 'email'), currentPassword));
          setSetting(undefined);
          setNotice('Adres e-mail został zmieniony.');
          break;
        case 'password':
          await changePassword(currentPassword, formValue(data, 'newPassword'));
          onSignOut('Hasło zostało zmienione. Zaloguj się ponownie.');
          break;
        case 'delete':
          await deleteAccount(currentPassword);
          onSignOut('Konto zostało usunięte.');
          break;
      }
    });
  }

  return (
    <section aria-labelledby="account-heading" className="space-y-4">
      <h2 id="account-heading" className="text-lg font-semibold">Twoje konto</h2>
      <p className="break-words text-sm text-stone-700">{account.email}</p>
      <div className="flex flex-wrap gap-2">
        {(Object.keys(settingLabels) as Setting[]).map((value) => (
          <button key={value} type="button" aria-expanded={setting === value} className={secondaryButton} disabled={pending}
            onClick={() => { clearFeedback(); setNotice(''); setSetting(setting === value ? undefined : value); }}>
            {settingLabels[value]}
          </button>
        ))}
        <button type="button" className={secondaryButton} disabled={pending}
          onClick={() => void run(async () => { await logOut(); onSignOut(''); })}>
          Wyloguj się
        </button>
      </div>
      {setting && (
        <form key={setting} onSubmit={submit} aria-label={settingLabels[setting]} className="space-y-4 border-t border-stone-200 pt-4">
          {setting === 'email' && (
            <Field label="Nowy adres e-mail" name="email" type="email" autoComplete="email" maxLength={254} disabled={pending} />
          )}
          <Field label="Obecne hasło" name="currentPassword" type="password" autoComplete="current-password" disabled={pending} />
          {setting === 'password' && (
            <>
              <Field label="Nowe hasło" name="newPassword" type="password" autoComplete="new-password" minLength={15} disabled={pending} />
              <p className="text-sm text-stone-600">Użyj od 15 do 128 znaków. Zmiana hasła zakończy wszystkie sesje konta.</p>
            </>
          )}
          {setting === 'delete' && <p className="text-sm text-stone-700">Usunięcie konta jest trwałe.</p>}
          <button className={setting === 'delete' ? `${actionButton} bg-red-800 hover:bg-red-900` : primaryButton} disabled={pending}>
            {setting === 'delete' ? 'Potwierdź usunięcie' : 'Zapisz zmianę'}
          </button>
        </form>
      )}
      <ErrorMessage message={feedback} />
      {notice && <p role="status" className="text-sm text-teal-900">{notice}</p>}
    </section>
  );
}

export function AccountAccess() {
  const [account, setAccount] = useState<Account | null | undefined>();
  const [loadError, setLoadError] = useState('');
  const [notice, setNotice] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    void getSession(controller.signal).then((current) => {
      if (!controller.signal.aborted) setAccount(current);
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) setLoadError(requestErrorMessage(error));
    });
    return () => controller.abort();
  }, [attempt]);

  if (loadError) {
    return (
      <div className="space-y-3">
        <ErrorMessage message={loadError} />
        <button type="button" className={secondaryButton} onClick={() => { setLoadError(''); setAttempt(attempt + 1); }}>Ponów próbę</button>
      </div>
    );
  }
  if (account === undefined) return <p role="status" className="text-sm text-stone-600">Sprawdzanie sesji…</p>;
  if (account) {
    return <AccountSettings account={account} onUpdate={setAccount} onSignOut={(message) => { setAccount(null); setNotice(message); }} />;
  }
  return (
    <div className="space-y-4">
      {notice && <p role="status" className="text-sm text-teal-900">{notice}</p>}
      <Credentials onSignIn={(current) => { setNotice(''); setAccount(current); }} />
    </div>
  );
}
