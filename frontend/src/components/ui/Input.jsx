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
        <label htmlFor={id} className="text-xs font-semibold uppercase tracking-wider text-[#3B342E]">
          {label}
        </label>
      )}

      <div className="relative flex items-center">
        {Icon && (
          <span className="absolute left-3.5 text-[#73685E] pointer-events-none">
            <Icon size={16} aria-hidden />
          </span>
        )}

        <input
          id={id}
          className={`
            w-full bg-[#FDFBF7] border rounded-xl
            text-sm text-[#181411] placeholder-[#A89E94]
            px-4 py-3
            ${Icon ? "pl-10" : ""}
            ${rightElement ? "pr-10" : ""}
            ${
              error
                ? "border-[#C82828] focus:border-[#C82828] focus:ring-2 focus:ring-[#C82828]/15"
                : "border-[#E7E0D5] hover:border-[#D6CCC0] focus:bg-white focus:border-[#CE532D] focus:ring-2 focus:ring-[#CE532D]/15"
            }
            focus:outline-none transition-all duration-150
            ${className}
          `}
          {...props}
        />

        {rightElement && (
          <span className="absolute right-3.5 flex items-center">{rightElement}</span>
        )}
      </div>

      {error ? (
        <p className="text-xs text-[#C82828]">{error}</p>
      ) : hint ? (
        <p className="text-xs text-[#73685E]">{hint}</p>
      ) : null}
    </div>
  );
}
