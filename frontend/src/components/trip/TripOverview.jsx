import { CheckCircle2, Info, Sparkles } from "lucide-react";
import { budgetBreakdown, formatInr } from "@/lib/tripView";

const CARD = "rounded-2xl border border-border bg-surface p-4 sm:p-6";

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
    <div className="max-w-3xl space-y-4">
      <section className={CARD}>
        <h2 className="mb-2 flex items-center gap-2 font-display text-xl font-semibold text-ink">
          <Sparkles className="h-4 w-4 text-primary" aria-hidden />
          Trip overview
        </h2>
        <p className="whitespace-pre-line text-base leading-relaxed text-ink-soft">{plan.summary}</p>
        {requestTags.length > 0 && (
          <p className="mt-3 text-sm capitalize text-muted">{requestTags.join(" · ")}</p>
        )}
      </section>

      <section className={CARD}>
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="font-display text-xl font-semibold text-ink">Estimated cost</h2>
            <p className="text-sm text-muted">Stays and flights only; food and activities are extra.</p>
          </div>
          <div className="sm:text-right">
            <p data-testid="estimated-total" className="font-mono text-3xl font-semibold text-success">
              {formatInr(cost.total)}
            </p>
            {breakdown.budget > 0 && (
              <p className="text-sm text-muted">
                of {formatInr(breakdown.budget)} budget ({breakdown.usedPercent}%)
              </p>
            )}
          </div>
        </div>

        {breakdown.budget > 0 && (
          <div className="mt-4">
            <div className="flex h-3 overflow-hidden rounded-full bg-bg-subtle">
              {breakdown.hotelPercent > 0 && (
                <div className="h-full bg-primary" style={{ width: `${breakdown.hotelPercent}%` }} />
              )}
              {breakdown.flightPercent > 0 && (
                <div className="h-full bg-ink" style={{ width: `${breakdown.flightPercent}%` }} />
              )}
            </div>
            <p className="mt-2 text-sm font-semibold text-success">
              {formatInr(breakdown.remaining)} left for food &amp; activities
            </p>
          </div>
        )}

        <dl className="mt-4 divide-y divide-border border-t border-border text-base">
          <div className="flex items-center justify-between gap-3 py-3">
            <dt className="flex items-center gap-2 text-ink-soft">
              <span className="size-2.5 rounded-full bg-primary" aria-hidden />
              Stays · {plan.nights} nights
            </dt>
            <dd className="font-mono font-semibold text-ink">{formatInr(cost.hotel_total)}</dd>
          </div>
          <div className="flex items-center justify-between gap-3 py-3">
            <dt className="flex items-center gap-2 text-ink-soft">
              <span className="size-2.5 rounded-full bg-ink" aria-hidden />
              Flights{partySize ? ` · ${partySize} travelers` : ""}
            </dt>
            <dd className="font-mono font-semibold text-ink">{formatInr(cost.flight_total)}</dd>
          </div>
        </dl>
      </section>

      {plan.notes?.length > 0 && (
        <section className="rounded-2xl bg-warning-light p-4 sm:p-6">
          <h2 className="mb-2 flex items-center gap-2 font-display text-lg font-semibold text-warning">
            <Info className="h-4 w-4" aria-hidden />
            Things to know
          </h2>
          <ul className="list-disc space-y-1.5 pl-5 text-base leading-relaxed text-ink-soft">
            {plan.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </section>
      )}

      {plan.important_tips?.length > 0 && (
        <section className={CARD}>
          <h2 className="mb-2 flex items-center gap-2 font-display text-lg font-semibold text-ink">
            <CheckCircle2 className="h-4 w-4 text-success" aria-hidden />
            Travel tips
          </h2>
          <ol className="list-decimal space-y-1.5 pl-5 text-base leading-relaxed text-ink-soft marker:font-mono marker:text-primary">
            {plan.important_tips.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
