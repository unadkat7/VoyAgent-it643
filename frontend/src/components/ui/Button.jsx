import { Loader2 } from "lucide-react";

const VARIANTS = {
  primary:
    "bg-[#CE532D] hover:bg-[#B54320] text-white shadow-sm hover:shadow-md shadow-[#CE532D]/20",
  dark:
    "bg-[#181411] hover:bg-[#2C2520] text-[#FAF8F4] shadow-sm",
  secondary:
    "bg-white hover:bg-[#F2EDE4]/70 text-[#181411] border border-[#E7E0D5] hover:border-[#D6CCC0]",
  ghost:
    "bg-transparent hover:bg-[#F2EDE4] text-[#73685E] hover:text-[#181411]",
  danger:
    "bg-[#C82828] hover:bg-[#A91F1F] text-white shadow-sm",
};

const SIZES = {
  sm: "text-xs px-3.5 py-2 rounded-xl",
  md: "text-sm px-5 py-3 rounded-xl",
  lg: "text-sm px-6 py-3.5 rounded-2xl",
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
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#CE532D]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#FAF8F4]
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
