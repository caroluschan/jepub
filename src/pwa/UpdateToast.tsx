import { useEffect, useRef } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { useToast } from '../components/Toast';

export function UpdateToast() {
  const { push } = useToast();
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const lastUpdateCheckRef = useRef(Date.now());
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      registrationRef.current = registration ?? null;
    },
  });

  useEffect(() => {
    const onVisibilityChange = (): void => {
      if (document.visibilityState !== 'visible') return;
      const now = Date.now();
      if (now - lastUpdateCheckRef.current < 60 * 60 * 1000) return;
      lastUpdateCheckRef.current = now;
      void registrationRef.current?.update().catch((error: unknown) => {
        console.warn('JEPUB: service worker update check failed.', error);
      });
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, []);

  useEffect(() => {
    if (!offlineReady) return;
    push('JEPUB is ready to work offline.');
    setOfflineReady(false);
  }, [offlineReady, push, setOfflineReady]);

  useEffect(() => {
    if (!needRefresh) return;
    push('A new version of JEPUB is ready.', {
      duration: 0,
      actions: [
        {
          label: 'Reload',
          onClick: () => {
            void updateServiceWorker(true).catch(() => {
              push('Could not update JEPUB. Reload the page to try again.', { tone: 'error' });
            });
          },
        },
        {
          label: 'Later',
          onClick: (dismiss) => {
            dismiss();
            setNeedRefresh(false);
          },
        },
      ],
    });
  }, [needRefresh, push, setNeedRefresh, updateServiceWorker]);

  return null;
}
