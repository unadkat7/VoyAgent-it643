"use client";

export default function AppHeader({
  left,
  center = null,
  right = null,
  maxWidth = "max-w-6xl",
}) {
  return (
    <header className="sticky top-0 z-30 bg-[#FAF8F4]/88 backdrop-blur-md border-b border-[#E7E0D5]">
      <div
        className={`${maxWidth} mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4`}
      >
        <div className="flex items-center gap-3 min-w-0">{left}</div>
        {center && (
          <div className="hidden md:flex items-center justify-center min-w-0">
            {center}
          </div>
        )}
        <div className="flex items-center gap-2.5 shrink-0">{right}</div>
      </div>
    </header>
  );
}
