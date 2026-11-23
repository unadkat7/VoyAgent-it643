"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle } from "lucide-react";

export default function ConfirmModal({
  isOpen,
  title = "Are you sure?",
  message = "This action cannot be undone.",
  confirmLabel = "Delete",
  loading = false,
  onConfirm,
  onCancel,
}) {
  const panel = useRef(null);
  const cancelButton = useRef(null);
  useEffect(() => {
    if (!isOpen) return;
    const trigger = document.activeElement;
    cancelButton.current?.focus();
    return () => trigger?.focus();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event) => {
      if (event.key === "Tab") {
        const buttons = panel.current?.querySelectorAll("button:enabled");
        if (!buttons?.length) {
          event.preventDefault();
          return;
        }
        const first = buttons[0];
        const last = buttons[buttons.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
      if (event.key === "Escape" && !loading) onCancel?.();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, loading, onCancel]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          ref={panel}
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-modal-title"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-[#181411]/40 backdrop-blur-xs"
            onClick={() => !loading && onCancel?.()}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="relative bg-white border border-[#E7E0D5] rounded-2xl shadow-2xl p-6 w-full max-w-sm z-10"
          >
            <div className="w-11 h-11 bg-[#FEF2F2] border border-[#C82828]/15 rounded-xl flex items-center justify-center mb-4">
              <AlertTriangle className="w-5 h-5 text-[#C82828]" aria-hidden />
            </div>

            <h3
              id="confirm-modal-title"
              className="font-display text-lg font-semibold text-[#181411] mb-1.5"
            >
              {title}
            </h3>
            <p className="text-sm text-[#73685E] leading-relaxed mb-6">{message}</p>

            <div className="flex gap-2.5">
              <button
                type="button"
                ref={cancelButton}
                onClick={onCancel}
                disabled={loading}
                className="flex-1 py-2.5 rounded-xl border border-[#E7E0D5] text-sm font-semibold text-[#3B342E] hover:bg-[#FAF8F4] transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={loading}
                className="flex-1 py-2.5 rounded-xl bg-[#C82828] hover:bg-[#A91F1F] text-white text-sm font-semibold transition-colors disabled:opacity-50"
              >
                {loading ? "Deleting..." : confirmLabel}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
