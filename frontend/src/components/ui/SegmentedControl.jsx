"use client";

import { useRef } from "react";

const VARIANTS = {
  pills: {
    group: "flex gap-2 overflow-x-auto no-scrollbar",
    item: "min-h-tap shrink-0 rounded-full border px-4 text-sm font-semibold transition-colors",
    on: "border-ink bg-ink text-bg",
    off: "border-border bg-surface text-ink-soft hover:border-border-strong",
  },
  tabs: {
    group: "flex overflow-x-auto no-scrollbar border-b border-border",
    item: "min-h-tap flex-1 shrink-0 -mb-px border-b-2 px-3 text-sm font-semibold whitespace-nowrap transition-colors sm:flex-none sm:px-4",
    on: "border-primary text-primary",
    off: "border-transparent text-muted hover:text-ink",
  },
};

// Single-choice buttons (tabs, filters, ranges). Arrow keys move the selection.
export default function SegmentedControl({ label, options, value, onChange, variant = "pills", className = "" }) {
  const buttons = useRef([]);
  const styles = VARIANTS[variant] ?? VARIANTS.pills;

  const onKeyDown = (event, index) => {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
    if (!step) return;
    event.preventDefault();
    const next = (index + step + options.length) % options.length;
    onChange(options[next].value);
    buttons.current[next]?.focus();
  };

  return (
    <div role="group" aria-label={label} className={`${styles.group} ${className}`}>
      {options.map((option, index) => {
        const active = option.value === value;
        const Icon = option.icon;
        return (
          <button
            key={option.value}
            ref={(node) => {
              buttons.current[index] = node;
            }}
            type="button"
            aria-pressed={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={`inline-flex items-center justify-center gap-1.5 ${styles.item} ${active ? styles.on : styles.off}`}
          >
            {Icon && <Icon className="h-4 w-4" aria-hidden />}
            {option.label}
            {typeof option.count === "number" && option.count > 0 && (
              <span className="font-mono text-xs opacity-70">{option.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
