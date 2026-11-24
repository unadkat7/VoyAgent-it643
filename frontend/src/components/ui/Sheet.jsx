"use client";

import { useId, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import useModalFocus from "@/lib/useModalFocus";

const LAYOUT = {
  // Bottom sheet on phones, centred dialog from `sm` up.
  center: {
    frame: "items-end justify-center sm:items-center sm:p-4",
    panel: "max-h-[88dvh] w-full rounded-t-3xl sm:max-w-md sm:rounded-3xl",
  },
  // Bottom sheet on phones, full-height panel on the right from `lg` up (e.g. a chat).
  side: {
    frame: "items-end justify-center lg:items-stretch lg:justify-end",
    panel: "h-[88dvh] w-full rounded-t-3xl lg:h-full lg:max-h-none lg:max-w-md lg:rounded-none lg:rounded-l-3xl",
  },
};

export default function Sheet({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  placement = "center",
}) {
  const layout = LAYOUT[placement] ?? LAYOUT.center;
  const panel = useRef(null);
  const titleId = useId();
  const reduceMotion = useReducedMotion();
  useModalFocus(panel, open, onClose);

  return (
    <AnimatePresence>
      {open && (
        <div className={`fixed inset-0 z-50 flex ${layout.frame}`}>
          <motion.div
            data-testid="sheet-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-ink/40"
            onClick={onClose}
          />
          <motion.div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            initial={reduceMotion ? { opacity: 0 } : { y: "100%" }}
            animate={reduceMotion ? { opacity: 1 } : { y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { y: "100%" }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className={`relative flex flex-col bg-surface shadow-2xl ${layout.panel}`}
          >
            <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-border-strong sm:hidden" aria-hidden />
            <div className="flex items-start justify-between gap-3 px-5 pt-3 sm:pt-5">
              <div className="min-w-0 pt-2">
                <h2 id={titleId} className="font-display text-xl font-semibold text-ink">
                  {title}
                </h2>
                {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="flex size-tap shrink-0 items-center justify-center rounded-xl text-muted hover:bg-bg hover:text-ink"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 pt-3">{children}</div>
            {footer && <div className="safe-footer border-t border-border px-5 pt-3">{footer}</div>}
            {!footer && <div className="h-[env(safe-area-inset-bottom)] shrink-0" aria-hidden />}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
