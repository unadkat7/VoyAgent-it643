import { Loader2 } from "lucide-react";

const VARIANTS = {
  primary:
    "bg-primary hover:bg-primary-hover text-white shadow-sm hover:shadow-md shadow-primary/20",
  dark:
    "bg-ink hover:bg-ink-hover text-bg shadow-sm",
  secondary:
    "bg-white hover:bg-bg-subtle/70 text-ink border border-border hover:border-border-strong",
  ghost:
    "bg-transparent hover:bg-bg-subtle text-muted hover:text-ink",
  danger:
    "bg-danger hover:bg-danger-hover text-white shadow-sm",
};

const SIZES = {
  sm: "min-h-tap text-sm px-4 rounded-xl",
  md: "min-h-tap text-base px-5 py-2.5 rounded-xl",
  lg: "min-h-12 text-base px-6 py-3 rounded-2xl",
  icon: "size-tap shrink-0 rounded-xl",
};

export default function Button({
  children,
  loading = false,
  variant = "primary",
  size = "md",
  fullWidth = true,
  className = "",
  ...props
}) {
  return (
    <button
      {...props}
      disabled={loading || props.disabled}
      className={`
        ${fullWidth ? "w-full" : "inline-flex"}
        flex items-center justify-center gap-2 font-semibold
        active:scale-[0.985] transition-all duration-150
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-bg
        disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100
        ${VARIANTS[variant] ?? VARIANTS.primary}
        ${SIZES[size] ?? SIZES.md}
        ${className}
      `}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden />}
      {children}
    </button>
  );
}
