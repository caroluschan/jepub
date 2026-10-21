import { useEffect } from 'react';
import { useToast } from '../components/Toast';

export function useOnlineStatus(): void {
  const { push } = useToast();

  useEffect(() => {
    const onOffline = (): void => {
      push("You're offline — cached books still work.");
    };
    const onOnline = (): void => {
      push('Back online.');
    };
    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);
    return () => {
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
    };
  }, [push]);
}
