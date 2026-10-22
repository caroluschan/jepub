import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Icon } from './Icon';
import { useI18n } from '../lib/i18n/useI18n';

export type ToastTone = 'default' | 'error' | 'success';

export interface ToastAction {
  label: string;
  onClick: (dismiss: () => void) => void;
}

export interface ToastOptions {
  tone?: ToastTone;
  duration?: number;
  actions?: ToastAction[];
}

interface ToastItem {
  id: string;
  message: string;
  tone: ToastTone;
  actions: ToastAction[];
}

interface ToastContextValue {
  push: (message: string, options?: ToastOptions) => string;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let toastCounter = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const [items, setItems] = useState<ToastItem[]>([]);
  const timers = useRef(new Map<string, number>());

  const dismiss = useCallback((id: string) => {
    const timer = timers.current.get(id);
    if (timer !== undefined) {
      window.clearTimeout(timer);
      timers.current.delete(id);
    }
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const push = useCallback(
    (message: string, options: ToastOptions = {}) => {
      toastCounter += 1;
      const id = `toast-${toastCounter}`;
      const item: ToastItem = {
        id,
        message,
        tone: options.tone ?? 'default',
        actions: options.actions ?? [],
      };

      setItems((current) => [...current, item].slice(-2));

      const duration = options.duration ?? 4500;
      if (duration > 0) {
        const timer = window.setTimeout(() => dismiss(id), duration);
        timers.current.set(id, timer);
      }

      return id;
    },
    [dismiss],
  );

  useEffect(() => {
    const activeTimers = timers.current;
    return () => {
      for (const timer of activeTimers.values()) window.clearTimeout(timer);
      activeTimers.clear();
    };
  }, []);

  const value = useMemo<ToastContextValue>(() => ({ push, dismiss }), [push, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-viewport" aria-live="polite" aria-atomic="false">
        {items.map((item) => (
          <div
            key={item.id}
            className={`toast toast--${item.tone}`}
            data-testid="toast"
            data-tone={item.tone}
          >
            <span className="toast__message">{item.message}</span>
            {item.actions.length > 0 ? (
              <span className="toast__actions">
                {item.actions.map((action) => (
                  <button
                    key={action.label}
                    type="button"
                    className="toast__action"
                    onClick={() => action.onClick(() => dismiss(item.id))}
                  >
                    {action.label}
                  </button>
                ))}
              </span>
            ) : null}
            <button
              type="button"
              className="toast__dismiss"
              aria-label={t('Dismiss notification')}
              onClick={() => dismiss(item.id)}
            >
              <Icon name="close" size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (context === null) {
    throw new Error('useToast must be used inside a ToastProvider.');
  }
  return context;
}
