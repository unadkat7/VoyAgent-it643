import { Bus, Car, Plane, TrainFront } from "lucide-react";
import { chosenTravel, fareRange, formatMoney, planCurrency } from "@/lib/tripView";
import PriceSourceBadge from "./PriceSourceBadge";

const ICONS = { flight: Plane, train: TrainFront, bus: Bus, car: Car };

// Every priced way there and back. The owner picks which one counts in the total.
export default function TravelOptions({ plan, travelMode, onSelectMode = null }) {
  const options = plan.travel_options ?? [];
  if (options.length === 0) return null;
  const currency = planCurrency(plan);
  const chosen = chosenTravel(plan, travelMode);
  const partySize = plan.request?.party_size;

  return (
    <section aria-labelledby="travel-options-heading" className="space-y-3">
      <div>
        <h2 id="travel-options-heading" className="font-display text-xl font-semibold text-ink">
          Ways to get there
        </h2>
        <p className="text-sm text-muted">
          Round trip{partySize ? ` for ${partySize}` : ""}. Train and bus fares are rough web prices.
        </p>
      </div>
      <fieldset className="space-y-2.5">
        <legend className="sr-only">Way to travel counted in the total</legend>
        {options.map((option) => {
          const Icon = ICONS[option.mode] ?? Plane;
          const isChosen = chosen?.mode === option.mode;
          const card = (
            <>
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-bg">
                <Icon className="h-5 w-5 text-primary" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-semibold text-ink">{option.label}</span>
                  {option.over_budget && (
                    <span className="rounded-full bg-warning-light px-2 py-0.5 text-label font-semibold text-warning">
                      Over your flight budget
                    </span>
                  )}
                </span>
                <span className="mt-0.5 block text-sm text-muted">
                  {fareRange(option, currency)} per person
                  {option.detail ? ` · ${option.detail}` : ""}
                </span>
                <span className="mt-1.5 block">
                  <PriceSourceBadge source={option.source} />
                </span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block font-mono font-semibold text-ink">{formatMoney(option.total, currency)}</span>
                {isChosen && <span className="text-label font-semibold text-success">In total</span>}
              </span>
            </>
          );
          const frame = `flex w-full items-start gap-3 rounded-2xl border p-3.5 text-left ${
            isChosen ? "border-primary bg-primary-light/40" : "border-border bg-surface"
          }`;

          if (!onSelectMode) {
            return (
              <div key={option.mode} className={frame}>
                {card}
              </div>
            );
          }
          return (
            <label key={option.mode} className={`${frame} cursor-pointer hover:border-primary/50`}>
              <input
                type="radio"
                name="travel-mode"
                value={option.mode}
                checked={isChosen}
                onChange={() => onSelectMode(option.mode)}
                className="mt-3 size-4 shrink-0 accent-primary"
                aria-label={`Use ${option.label} for the total`}
              />
              {card}
            </label>
          );
        })}
      </fieldset>
    </section>
  );
}
