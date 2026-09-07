import { useEffect, useRef } from 'react';

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

/** Contains keyboard and programmatic focus inside a rendered aria-modal surface. */
export function useModalFocusTrap<T extends HTMLElement>(active: boolean) {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (!active) return;
    const modal = ref.current;
    if (!modal) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    let disposed = false;
    const focusable = () => Array.from(modal.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((item) => item.getAttribute('aria-hidden') !== 'true');
    const focusFirst = () => (focusable()[0] ?? modal).focus();
    queueMicrotask(() => { if (!disposed) focusFirst(); });
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const items = focusable();
      if (items.length === 0) {
        event.preventDefault();
        modal.focus();
        return;
      }
      const first = items[0], last = items[items.length - 1];
      const outside = !modal.contains(document.activeElement);
      if (event.shiftKey && (outside || document.activeElement === first)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (outside || document.activeElement === last)) {
        event.preventDefault();
        first.focus();
      }
    };
    const onFocusIn = (event: FocusEvent) => {
      if (!modal.contains(event.target as Node)) focusFirst();
    };
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('focusin', onFocusIn, true);
    return () => {
      disposed = true;
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('focusin', onFocusIn, true);
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, [active]);
  return ref;
}
