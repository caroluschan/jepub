import { useEffect } from 'react';
import { useToast } from '../components/Toast';
import { useI18n } from '../lib/i18n/useI18n';

export function useOnlineStatus(): void {
  const { push } = useToast();
  const { t } = useI18n();

  useEffect(() => {
    const onOffline = (): void => {
      push(t("You're offline — cached books still work."));
    };
    const onOnline = (): void => {
      push(t('Back online.'));
    };
    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);
    return () => {
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
    };
  }, [push, t]);
}
