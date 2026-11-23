import { useEffect } from "react";

const FOCUSABLE =
  'button:enabled, a[href], input:enabled, select:enabled, textarea:enabled, [tabindex]:not([tabindex="-1"])';

// Shared modal behaviour: focus moves in on open, Tab stays inside, Esc closes, focus returns on close.
export default function useModalFocus(panelRef, open, onClose, { initialFocusRef, canClose = true } = {}) {
  useEffect(() => {
    if (!open) return;
    const trigger = document.activeElement;
    const target = initialFocusRef?.current ?? panelRef.current?.querySelector(FOCUSABLE);
    target?.focus();
    return () => trigger?.focus?.();
  }, [open, panelRef, initialFocusRef]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event) => {
      if (event.key === "Escape" && canClose) {
        onClose?.();
        return;
      }
      if (event.key !== "Tab") return;
      const items = panelRef.current?.querySelectorAll(FOCUSABLE);
      if (!items?.length) {
        event.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (!panelRef.current.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, panelRef, onClose, canClose]);
}
