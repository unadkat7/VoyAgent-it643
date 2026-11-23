export default function Input({
  label,
  id,
  icon: Icon,
  rightElement,
  hint,
  error,
  className = "",
  ...props
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={id} className="text-xs font-semibold uppercase tracking-wider text-ink-soft">
          {label}
        </label>
      )}

      <div className="relative flex items-center">
        {Icon && (
          <span className="absolute left-3.5 text-muted pointer-events-none">
            <Icon size={16} aria-hidden />
          </span>
        )}

        <input
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || hint ? `${id}-detail` : undefined}
          className={`
            w-full bg-surface-warm border rounded-xl
            text-sm text-ink placeholder-faint
            px-4 py-3
            ${Icon ? "pl-10" : ""}
            ${rightElement ? "pr-10" : ""}
            ${
              error
                ? "border-danger focus:border-danger focus:ring-2 focus:ring-danger/15"
                : "border-border hover:border-border-strong focus:bg-white focus:border-primary focus:ring-2 focus:ring-primary/15"
            }
            focus:outline-none transition-all duration-150
            ${className}
          `}
          {...props}
        />

        {rightElement && (
          <span className="absolute right-1 flex items-center">{rightElement}</span>
        )}
      </div>

      {error ? (
        <p id={`${id}-detail`} className="text-sm text-danger">{error}</p>
      ) : hint ? (
        <p id={`${id}-detail`} className="text-sm text-muted">{hint}</p>
      ) : null}
    </div>
  );
}
