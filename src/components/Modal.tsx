import { useEffect, useRef, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { FocusTrap } from './FocusTrap';

export type ModalVariant = 'center' | 'sheet' | 'drawer' | 'confirm' | 'full';

interface ModalProps {
  onClose: () => void;
  children: ReactNode;
  variant?: ModalVariant;
  ariaLabel?: string;
  labelledBy?: string;
  restoreFocus?: HTMLElement | null | undefined;
  initialFocusRef?: RefObject<HTMLElement | null> | undefined;
  className?: string;
  backdropTestId?: string;
  panelTestId?: string;
}

let lockCount = 0;

export function Modal({
  onClose,
  children,
  variant = 'center',
  ariaLabel,
  labelledBy,
  restoreFocus,
  initialFocusRef,
  className,
  backdropTestId,
  panelTestId,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    lockCount += 1;
    document.documentElement.classList.add('scroll-locked');
    return () => {
      lockCount -= 1;
      if (lockCount <= 0) {
        lockCount = 0;
        document.documentElement.classList.remove('scroll-locked');
      }
    };
  }, []);

  const panelClass =
    className === undefined
      ? `modal-panel modal-panel--${variant}`
      : `modal-panel modal-panel--${variant} ${className}`;

  return createPortal(
    <div
      className={`modal-backdrop modal-backdrop--${variant}`}
      data-testid={backdropTestId}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        className={panelClass}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        aria-labelledby={labelledBy}
        tabIndex={-1}
        data-testid={panelTestId}
      >
        <FocusTrap
          containerRef={panelRef}
          onClose={onClose}
          restoreFocus={restoreFocus}
          initialFocusRef={initialFocusRef}
        >
          {children}
        </FocusTrap>
      </div>
    </div>,
    document.body,
  );
}
