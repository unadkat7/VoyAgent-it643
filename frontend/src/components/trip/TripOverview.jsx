import { CheckCircle2, IndianRupee, Info, Sparkles } from "lucide-react";
import { budgetBreakdown, formatInr } from "@/lib/tripView";

export default function TripOverview({ plan }) {
  const cost = plan.estimated_cost;
  const partySize = plan.request?.party_size;
  const breakdown = budgetBreakdown(plan);
  const requestTags = [
    plan.request?.origin ? `Origin: ${plan.request.origin}` : null,
    plan.request?.travel_style ? `Style: ${plan.request.travel_style}` : null,
    plan.request?.accommodation_type ? `Stay: ${plan.request.accommodation_type}` : null,
    ...(plan.request?.interests ?? []),
  ].filter(Boolean);

  return (
    <div className="space-y-5">
      {/* Estimated Cost & Visual Budget Feasibility Card */}
      <section className="bg-white border border-[#E7E0D5] rounded-2xl p-6 shadow-[0_8px_24px_-20px_rgba(24,20,17,0.16)]">
        <div className="flex flex-wrap items-start justify-between gap-4 pb-5 border-b border-[#F2EDE4]">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-[#181411] text-[#FAF8F4] flex items-center justify-center shrink-0">
              <IndianRupee className="w-5 h-5" aria-hidden />
            </div>
            <div>
              <h3 className="font-display text-xl font-semibold text-[#181411]">
                Estimated Cost
              </h3>
              <p className="text-xs text-[#73685E]">
                Covers stays and flights only; food and activities are extra.
              </p>
            </div>
          </div>
          <div className="text-left sm:text-right">
            <p
              data-testid="estimated-total"
              className="font-mono text-3xl font-semibold text-[#15803D]"
            >
              {formatInr(cost.total)}
            </p>
            {breakdown.budget > 0 && (
              <p className="font-mono text-xs text-[#73685E] mt-0.5">
                of {formatInr(breakdown.budget)} Budget ({breakdown.usedPercent}%)
              </p>
            )}
          </div>
        </div>

        {/* Visual Stacked INR Budget Allocation Bar */}
        {breakdown.budget > 0 && (
          <div className="mt-5 mb-5">
            <div className="h-3 rounded-full bg-[#F2EDE4] overflow-hidden flex">
              {breakdown.hotelPercent > 0 && (
                <div
                  className="bg-[#CE532D] h-full transition-all"
                  style={{ width: `${breakdown.hotelPercent}%` }}
                  title={`Stays: ${formatInr(breakdown.hotelTotal)}`}
                />
              )}
              {breakdown.flightPercent > 0 && (
                <div
                  className="bg-[#181411] h-full transition-all"
                  style={{ width: `${breakdown.flightPercent}%` }}
                  title={`Flights: ${formatInr(breakdown.flightTotal)}`}
                />
              )}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 mt-2 text-xs text-[#73685E]">
              <div className="flex flex-wrap items-center gap-4">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#CE532D]" aria-hidden />
                  Stays ({breakdown.hotelPercent}%)
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#181411]" aria-hidden />
                  Flights ({breakdown.flightPercent}%)
                </span>
              </div>
              <span className="font-mono font-semibold text-[#15803D]">
                {formatInr(breakdown.remaining)} buffer for food &amp; activities
              </span>
            </div>
          </div>
        )}

        <ul className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-[#181411]">
          <li className="bg-[#FAF8F4] border border-[#E7E0D5] rounded-xl p-3.5 font-medium">
            {`Stays: ${formatInr(cost.hotel_total)} for ${plan.nights} nights`}
          </li>
          <li className="bg-[#FAF8F4] border border-[#E7E0D5] rounded-xl p-3.5 font-medium">
            {`Flights: ${formatInr(cost.flight_total)}${partySize ? ` for ${partySize} Travelers` : ""}`}
          </li>
        </ul>
      </section>

      {/* Editorial Trip Summary */}
      <section className="bg-white border border-[#E7E0D5] rounded-2xl p-6 shadow-[0_8px_24px_-20px_rgba(24,20,17,0.16)]">
        <h3 className="font-display text-lg font-semibold text-[#181411] flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-[#CE532D]" aria-hidden />
          Trip overview
        </h3>
        <p className="text-sm text-[#3B342E] leading-relaxed whitespace-pre-line max-w-3xl">
          {plan.summary}
        </p>

        {requestTags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-[#F2EDE4]">
            {requestTags.map((tag) => (
              <span
                key={tag}
                className="text-[11px] font-medium capitalize text-[#3B342E] bg-[#FAF8F4] border border-[#E7E0D5] px-2.5 py-1 rounded-full"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </section>

      {/* Planner Notes */}
      {plan.notes?.length > 0 && (
        <section className="bg-[#FEF7E6] border border-[#D97706]/30 rounded-2xl p-6">
          <h3 className="font-display text-base font-semibold text-[#B45309] flex items-center gap-2 mb-3">
            <Info className="w-4 h-4" aria-hidden />
            Things to know
          </h3>
          <ul className="space-y-2 text-sm text-[#3B342E]">
            {plan.notes.map((note) => (
              <li key={note} className="flex items-start gap-2 leading-relaxed">
                <span className="w-1.5 h-1.5 rounded-full bg-[#D97706] mt-2 shrink-0" aria-hidden />
                <span>{note}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Travel Tips */}
      {plan.important_tips?.length > 0 && (
        <section className="bg-white border border-[#E7E0D5] rounded-2xl p-6 shadow-[0_8px_24px_-20px_rgba(24,20,17,0.16)]">
          <h3 className="font-display text-lg font-semibold text-[#181411] flex items-center gap-2 mb-4">
            <CheckCircle2 className="w-4 h-4 text-[#15803D]" aria-hidden />
            Travel tips
          </h3>
          <ol className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {plan.important_tips.map((tip, index) => (
              <li
                key={tip}
                className="flex items-start gap-3 p-3.5 rounded-xl bg-[#FAF8F4] border border-[#E7E0D5] text-xs text-[#3B342E] leading-relaxed"
              >
                <span className="font-mono text-[11px] font-semibold text-[#CE532D] shrink-0 pt-0.5">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span>{tip}</span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
