// "live" prices came from a Provider search; "estimated" ones were suggested by the AI.
export default function PriceSourceBadge({ source }) {
  if (source === "live") {
    return (
      <span className="inline-flex items-center gap-1.5 text-label font-semibold text-success bg-success-light border border-success/15 px-2.5 py-0.5 rounded-full">
        <span className="w-1.5 h-1.5 rounded-full bg-success" aria-hidden />
        Live price
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1.5 text-label font-semibold text-warning bg-warning-light border border-warning/15 px-2.5 py-0.5 rounded-full"
      title="Suggested by the AI. Check the real price before booking."
    >
      <span className="w-1.5 h-1.5 rounded-full bg-star" aria-hidden />
      Estimated Cost
    </span>
  );
}
