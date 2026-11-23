"use client";

import { useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import useModalFocus from "@/lib/useModalFocus";

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
  useModalFocus(panel, isOpen, onCancel, { initialFocusRef: cancelButton, canClose: !loading });

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
            className="absolute inset-0 bg-ink/40 backdrop-blur-xs"
            onClick={() => !loading && onCancel?.()}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="relative bg-white border border-border rounded-2xl shadow-2xl p-6 w-full max-w-sm z-10"
          >
            <div className="w-11 h-11 bg-danger-light border border-danger/15 rounded-xl flex items-center justify-center mb-4">
              <AlertTriangle className="w-5 h-5 text-danger" aria-hidden />
            </div>

            <h3
              id="confirm-modal-title"
              className="font-display text-lg font-semibold text-ink mb-1.5"
            >
              {title}
            </h3>
            <p className="text-sm text-muted leading-relaxed mb-6">{message}</p>

            <div className="flex gap-2.5">
              <button
                type="button"
                ref={cancelButton}
                onClick={onCancel}
                disabled={loading}
                className="flex-1 min-h-tap rounded-xl border border-border text-sm font-semibold text-ink-soft hover:bg-bg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={loading}
                className="flex-1 min-h-tap rounded-xl bg-danger hover:bg-danger-hover text-white text-sm font-semibold transition-colors disabled:opacity-50"
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
