// Primary actions pinned to the bottom of the scroll area, clear of the home indicator.
export default function StickyActionBar({ children, hint, className = "" }) {
  return (
    <div className={`safe-footer sticky bottom-0 z-20 -mx-4 border-t border-border bg-surface/95 px-4 pt-3 backdrop-blur-md sm:mx-0 sm:rounded-b-2xl ${className}`}>
      {hint && <p className="mb-2 text-sm text-muted">{hint}</p>}
      <div className="flex items-center gap-2.5">{children}</div>
    </div>
  );
}
