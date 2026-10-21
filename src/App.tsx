import { useEffect, useState } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ToastProvider } from './components/Toast';
import { LibraryPage } from './features/library/LibraryPage';
import { ReaderPage } from './features/reader/ReaderPage';
import { SettingsProvider } from './features/settings/SettingsProvider';
import { parseRoute, type Route } from './lib/router';
import { useLaunchQueue } from './pwa/useLaunchQueue';
import { useOnlineStatus } from './pwa/useOnlineStatus';
import { UpdateToast } from './pwa/UpdateToast';

const LIBRARY: Route = { name: 'library' };

function currentRoute(): Route {
  return parseRoute(window.location.hash) ?? LIBRARY;
}

function AppShell() {
  const [route, setRoute] = useState<Route>(currentRoute);

  useLaunchQueue();
  useOnlineStatus();

  useEffect(() => {
    const onHashChange = (): void => {
      const next = parseRoute(window.location.hash);
      // Fragments such as #reader-content are not app routes. Ignore them so
      // activating a skip link never exits the open reader.
      if (next !== null) setRoute(next);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  return (
    <>
      {route.name === 'reader' ? <ReaderPage bookId={route.bookId} /> : <LibraryPage />}
      <UpdateToast />
    </>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <SettingsProvider>
        <ToastProvider>
          <AppShell />
        </ToastProvider>
      </SettingsProvider>
    </ErrorBoundary>
  );
}
