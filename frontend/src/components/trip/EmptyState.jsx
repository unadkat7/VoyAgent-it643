import { Compass } from "lucide-react";

// Explains an empty section in place, with the planner's notes when there are any.
export default function EmptyState({ children, icon: Icon = Compass, notes = [] }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-border bg-surface p-6 text-center sm:p-10">
      <div className="mb-3 flex size-10 items-center justify-center rounded-xl bg-bg text-muted">
        <Icon className="h-5 w-5" aria-hidden />
      </div>
      <p className="max-w-md text-base leading-relaxed text-ink-soft">{children}</p>
      {notes.length > 0 && (
        <ul className="mt-3 max-w-md space-y-1 text-sm leading-relaxed text-muted">
          {notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
