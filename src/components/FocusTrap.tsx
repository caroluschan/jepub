import { useEffect, useRef, type ReactNode, type RefObject } from 'react';

const FOCUSABLE =
  'a[href],area[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),iframe,object,embed,[contenteditable="true"],[tabindex]:not([tabindex="-1"])';

interface FocusTrapProps {
  containerRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  restoreFocus?: HTMLElement | null | undefined;
  initialFocusRef?: RefObject<HTMLElement | null> | undefined;
  children: ReactNode;
}

export function FocusTrap({
  containerRef,
  onClose,
  restoreFocus,
  initialFocusRef,
  children,
}: FocusTrapProps) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const container = containerRef.current;
    if (container === null) return;

    const active = document.activeElement;
    const previous =
      restoreFocus ?? (active instanceof HTMLElement && active !== document.body ? active : null);

    const focusables = (): HTMLElement[] =>
      Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((element) => {
        if (element.getAttribute('aria-hidden') === 'true') return false;
        if (element === document.activeElement) return true;
        return element.offsetWidth > 0 || element.offsetHeight > 0;
      });

    const raf = requestAnimationFrame(() => {
      const target = initialFocusRef?.current ?? focusables()[0] ?? container;
      target.focus();
    });

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;

      const items = focusables();
      if (items.length === 0) {
        event.preventDefault();
        container.focus();
        return;
      }

      const first = items[0];
      const last = items[items.length - 1];
      if (first === undefined || last === undefined) return;

      const current = document.activeElement;
      const outside = !(current instanceof Node) || !container.contains(current);

      if (event.shiftKey) {
        if (current === first || outside) {
          event.preventDefault();
          last.focus();
        }
        return;
      }

      if (current === last || outside) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', onKeyDown, true);
      if (previous !== null && previous.isConnected) previous.focus();
    };
  }, [containerRef, initialFocusRef, restoreFocus]);

  return <>{children}</>;
}
