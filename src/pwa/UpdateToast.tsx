import { useEffect, useRef } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { useToast } from '../components/Toast';
import { useI18n } from '../lib/i18n/useI18n';

export function UpdateToast() {
  const { push } = useToast();
  const { t } = useI18n();
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
    push(t('JEPUB is ready to work offline.'));
    setOfflineReady(false);
  }, [offlineReady, push, setOfflineReady]);

  useEffect(() => {
    if (!needRefresh) return;
    push(t('A new version of JEPUB is ready.'), {
      duration: 0,
      actions: [
        {
          label: t('Reload'),
          onClick: () => {
            void updateServiceWorker(true).catch(() => {
              push(t('Could not update JEPUB. Reload the page to try again.'), { tone: 'error' });
            });
          },
        },
        {
          label: t('Later'),
          onClick: (dismiss) => {
            dismiss();
            setNeedRefresh(false);
          },
        },
      ],
    });
  }, [needRefresh, push, setNeedRefresh, t, updateServiceWorker]);

  return null;
}
