// "live" prices came from a Provider search; "estimated" ones were suggested by the AI.
export default function PriceSourceBadge({ source }) {
  if (source === "live") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#15803D] bg-[#ECFDF3] border border-[#15803D]/15 px-2.5 py-0.5 rounded-full">
        <span className="w-1.5 h-1.5 rounded-full bg-[#15803D]" aria-hidden />
        Live price
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#B45309] bg-[#FEF7E6] border border-[#B45309]/15 px-2.5 py-0.5 rounded-full"
      title="Suggested by the AI. Check the real price before booking."
    >
      <span className="w-1.5 h-1.5 rounded-full bg-[#D97706]" aria-hidden />
      Estimated Cost
    </span>
  );
}
