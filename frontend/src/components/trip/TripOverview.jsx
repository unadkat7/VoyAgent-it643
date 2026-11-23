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
      <section className="bg-white border border-border rounded-2xl p-6 shadow-[0_8px_24px_-20px_rgba(24,20,17,0.16)]">
        <div className="flex flex-wrap items-start justify-between gap-4 pb-5 border-b border-bg-subtle">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-ink text-bg flex items-center justify-center shrink-0">
              <IndianRupee className="w-5 h-5" aria-hidden />
            </div>
            <div>
              <h3 className="font-display text-xl font-semibold text-ink">
                Estimated Cost
              </h3>
              <p className="text-xs text-muted">
                Covers stays and flights only; food and activities are extra.
              </p>
            </div>
          </div>
          <div className="text-left sm:text-right">
            <p
              data-testid="estimated-total"
              className="font-mono text-3xl font-semibold text-success"
            >
              {formatInr(cost.total)}
            </p>
            {breakdown.budget > 0 && (
              <p className="font-mono text-xs text-muted mt-0.5">
                of {formatInr(breakdown.budget)} Budget ({breakdown.usedPercent}%)
              </p>
            )}
          </div>
        </div>

        {/* Visual Stacked INR Budget Allocation Bar */}
        {breakdown.budget > 0 && (
          <div className="mt-5 mb-5">
            <div className="h-3 rounded-full bg-bg-subtle overflow-hidden flex">
              {breakdown.hotelPercent > 0 && (
                <div
                  className="bg-primary h-full transition-all"
                  style={{ width: `${breakdown.hotelPercent}%` }}
                  title={`Stays: ${formatInr(breakdown.hotelTotal)}`}
                />
              )}
              {breakdown.flightPercent > 0 && (
                <div
                  className="bg-ink h-full transition-all"
                  style={{ width: `${breakdown.flightPercent}%` }}
                  title={`Flights: ${formatInr(breakdown.flightTotal)}`}
                />
              )}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 mt-2 text-xs text-muted">
              <div className="flex flex-wrap items-center gap-4">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-primary" aria-hidden />
                  Stays ({breakdown.hotelPercent}%)
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-ink" aria-hidden />
                  Flights ({breakdown.flightPercent}%)
                </span>
              </div>
              <span className="font-mono font-semibold text-success">
                {formatInr(breakdown.remaining)} buffer for food &amp; activities
              </span>
            </div>
          </div>
        )}

        <ul className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-ink">
          <li className="bg-bg border border-border rounded-xl p-3.5 font-medium">
            {`Stays: ${formatInr(cost.hotel_total)} for ${plan.nights} nights`}
          </li>
          <li className="bg-bg border border-border rounded-xl p-3.5 font-medium">
            {`Flights: ${formatInr(cost.flight_total)}${partySize ? ` for ${partySize} Travelers` : ""}`}
          </li>
        </ul>
      </section>

      {/* Editorial Trip Summary */}
      <section className="bg-white border border-border rounded-2xl p-6 shadow-[0_8px_24px_-20px_rgba(24,20,17,0.16)]">
        <h3 className="font-display text-lg font-semibold text-ink flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-primary" aria-hidden />
          Trip overview
        </h3>
        <p className="text-sm text-ink-soft leading-relaxed whitespace-pre-line max-w-3xl">
          {plan.summary}
        </p>

        {requestTags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-bg-subtle">
            {requestTags.map((tag) => (
              <span
                key={tag}
                className="text-[11px] font-medium capitalize text-ink-soft bg-bg border border-border px-2.5 py-1 rounded-full"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </section>

      {/* Planner Notes */}
      {plan.notes?.length > 0 && (
        <section className="bg-warning-light border border-star/30 rounded-2xl p-6">
          <h3 className="font-display text-base font-semibold text-warning flex items-center gap-2 mb-3">
            <Info className="w-4 h-4" aria-hidden />
            Things to know
          </h3>
          <ul className="space-y-2 text-sm text-ink-soft">
            {plan.notes.map((note) => (
              <li key={note} className="flex items-start gap-2 leading-relaxed">
                <span className="w-1.5 h-1.5 rounded-full bg-star mt-2 shrink-0" aria-hidden />
                <span>{note}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Travel Tips */}
      {plan.important_tips?.length > 0 && (
        <section className="bg-white border border-border rounded-2xl p-6 shadow-[0_8px_24px_-20px_rgba(24,20,17,0.16)]">
          <h3 className="font-display text-lg font-semibold text-ink flex items-center gap-2 mb-4">
            <CheckCircle2 className="w-4 h-4 text-success" aria-hidden />
            Travel tips
          </h3>
          <ol className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {plan.important_tips.map((tip, index) => (
              <li
                key={tip}
                className="flex items-start gap-3 p-3.5 rounded-xl bg-bg border border-border text-xs text-ink-soft leading-relaxed"
              >
                <span className="font-mono text-[11px] font-semibold text-primary shrink-0 pt-0.5">
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
