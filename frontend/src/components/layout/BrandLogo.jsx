import Link from "next/link";

function CompassMark({ className = "w-4 h-4" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9.25" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M15.8 8.2L13.6 13.6L8.2 15.8L10.4 10.4L15.8 8.2Z"
        fill="currentColor"
      />
      <circle cx="12" cy="12" r="1.25" fill="#FAF8F4" />
    </svg>
  );
}

export default function BrandLogo({
  href = null,
  theme = "light",
  size = "md",
  subtitle = null,
}) {
  const isDark = theme === "dark";
  const boxSize = size === "sm" ? "w-7 h-7 rounded-lg" : "w-8 h-8 rounded-xl";
  const iconSize = size === "sm" ? "w-4 h-4" : "w-[18px] h-[18px]";
  const textSize = size === "sm" ? "text-base" : "text-[19px]";

  const content = (
    <span className="inline-flex items-center gap-2.5 select-none group">
      <span
        className={`${boxSize} flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:rotate-12 ${
          isDark
            ? "bg-[#CE532D] text-[#FAF8F4] shadow-md shadow-[#CE532D]/30"
            : "bg-[#181411] text-[#FAF8F4] shadow-sm"
        }`}
      >
        <CompassMark className={iconSize} />
      </span>
      <span className="flex flex-col leading-none">
        <span
          className={`font-display font-semibold tracking-tight ${textSize} ${
            isDark ? "text-[#FAF8F4]" : "text-[#181411]"
          }`}
        >
          VoyAgent
        </span>
        {subtitle && (
          <span
            className={`text-[10px] font-medium tracking-wider uppercase mt-0.5 ${
              isDark ? "text-[#FAF8F4]/55" : "text-[#73685E]"
            }`}
          >
            {subtitle}
          </span>
        )}
      </span>
    </span>
  );

  if (href) {
    return (
      <Link href={href} className="inline-flex items-center rounded-lg">
        {content}
      </Link>
    );
  }
  return content;
}
