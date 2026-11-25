import { AccountAccess } from './features/auth/AccountAccess';
import { RoutesWorkspace } from './features/routes/RoutesWorkspace';

export function App() {
  return (
    <AccountAccess>
      {(accountControls, onSessionExpired) => (
        <RoutesWorkspace accountControls={accountControls} onSessionExpired={onSessionExpired} />
      )}
    </AccountAccess>
  );
}
