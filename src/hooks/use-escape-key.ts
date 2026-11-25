'use client';

import { useEffect } from 'react';

/**
 * Closes a modal/overlay when the user presses the Escape key.
 *
 * Pass the close callback and (optionally) a boolean to disable it
 * (e.g. when a confirmation dialog is open inside the modal).
 *
 * Usage:
 *   useEscapeKey(onClose);
 *   useEscapeKey(onClose, confirmOpen); // disabled while confirm is open
 */
export function useEscapeKey(onClose: () => void, disabled: boolean = false): void {
  useEffect(() => {
    if (disabled) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, disabled]);
}
