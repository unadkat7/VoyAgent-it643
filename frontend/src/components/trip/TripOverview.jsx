import { CheckCircle2, Info, Sparkles } from "lucide-react";
import {
  budgetBreakdown,
  daysAndNights,
  fareRange,
  formatInr,
  formatShortDate,
  stayLabel,
} from "@/lib/tripView";

const CARD = "rounded-2xl border border-border bg-surface p-4 sm:p-6";
const SEGMENT_COLOR = {
  hotel: "bg-primary",
  travel: "bg-ink",
  activities: "bg-success",
  daily: "bg-star",
};

function CostRow({ color, label, detail, amount }) {
  return (
    <div className="flex items-start justify-between gap-3 py-3">
      <dt className="min-w-0">
        <span className="flex items-center gap-2 text-ink-soft">
          <span className={`size-2.5 shrink-0 rounded-full ${color}`} aria-hidden />
          {label}
        </span>
        {detail && <span className="mt-0.5 block pl-4.5 text-sm text-muted">{detail}</span>}
      </dt>
      <dd className="shrink-0 font-mono font-semibold text-ink">{amount}</dd>
    </div>
  );
}

export default function TripOverview({ plan, travelMode = null }) {
  const partySize = plan.request?.party_size;
  const days = plan.request?.duration_days;
  const breakdown = budgetBreakdown(plan, travelMode);
  const travel = breakdown.travel;
  const firstStay = plan.hotels?.[0];
  const travellers = partySize ? `${partySize} ${partySize === 1 ? "traveller" : "travellers"}` : null;
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
        <p className="mt-3 text-sm font-semibold text-ink-soft">
          {daysAndNights(plan)} · check-in {formatShortDate(plan.check_in)}, check-out{" "}
          {formatShortDate(plan.check_out)}
        </p>
        {requestTags.length > 0 && (
          <p className="mt-1 text-sm capitalize text-muted">{requestTags.join(" · ")}</p>
        )}
      </section>

      <section className={CARD}>
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="font-display text-xl font-semibold text-ink">Estimated cost</h2>
            <p className="text-sm text-muted">
              What the whole trip should cost{travellers ? ` for ${travellers}` : ""}.
            </p>
          </div>
          <div className="sm:text-right">
            <p data-testid="estimated-total" className="font-mono text-3xl font-semibold text-success">
              {formatInr(breakdown.total)}
            </p>
            {breakdown.perPerson > 0 && partySize > 1 && (
              <p className="text-sm font-semibold text-ink-soft">{formatInr(breakdown.perPerson)} per person</p>
            )}
          </div>
        </div>

        {breakdown.budget > 0 && (
          <div className="mt-4">
            <div className="flex h-3 overflow-hidden rounded-full bg-bg-subtle">
              {breakdown.segments.map(
                (segment) =>
                  segment.percent > 0 && (
                    <div
                      key={segment.key}
                      className={`h-full ${SEGMENT_COLOR[segment.key]}`}
                      style={{ width: `${segment.percent}%` }}
                    />
                  )
              )}
            </div>
            {breakdown.overBy > 0 ? (
              <p className="mt-2 text-sm font-semibold text-warning">
                About {formatInr(breakdown.overBy)} over {breakdown.budgetGuessed ? "the guessed" : "your"}{" "}
                {formatInr(breakdown.budget)} budget
              </p>
            ) : (
              <p className="mt-2 text-sm font-semibold text-success">
                {formatInr(breakdown.remaining)} left of {breakdown.budgetGuessed ? "the guessed" : "your"}{" "}
                {formatInr(breakdown.budget)} budget
              </p>
            )}
          </div>
        )}

        <dl className="mt-4 divide-y divide-border border-t border-border text-base">
          <CostRow
            color="bg-primary"
            label={`Stay · ${stayLabel(plan.nights, breakdown.rooms)}`}
            detail={
              firstStay
                ? `${firstStay.name} · ${formatInr(firstStay.price_per_night)} a night`
                : "No stay found"
            }
            amount={formatInr(breakdown.hotelTotal)}
          />
          <CostRow
            color="bg-ink"
            label={travel ? `Getting there · ${travel.label}` : "Getting there"}
            detail={
              travel
                ? `${fareRange(travel)} per person, round trip · change it in the Travel tab`
                : breakdown.travelTotal > 0
                  ? `Round trip${travellers ? ` for ${travellers}` : ""}`
                  : "Not counted: no fares were found"
            }
            amount={formatInr(breakdown.travelTotal)}
          />
          {breakdown.activitiesTotal > 0 && (
            <CostRow
              color="bg-success"
              label="Activities"
              detail="Entry fees and tours from the itinerary"
              amount={formatInr(breakdown.activitiesTotal)}
            />
          )}
          {breakdown.dailySpendTotal > 0 && (
            <CostRow
              color="bg-star"
              label="Food & local travel"
              detail={days ? `Rough amount for ${days} ${days === 1 ? "day" : "days"}` : "Rough amount"}
              amount={formatInr(breakdown.dailySpendTotal)}
            />
          )}
          <div className="flex items-center justify-between gap-3 py-3">
            <dt className="font-semibold text-ink">Total</dt>
            <dd className="font-mono font-semibold text-ink">{formatInr(breakdown.total)}</dd>
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
