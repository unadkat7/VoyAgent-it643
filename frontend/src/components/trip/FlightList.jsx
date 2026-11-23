import { Plane } from "lucide-react";
import { formatInr } from "@/lib/tripView";
import EmptyState from "./EmptyState";
import PriceSourceBadge from "./PriceSourceBadge";

function stopsLabel(stops) {
  if (!stops) return "Non-stop";
  return `${stops} stop${stops > 1 ? "s" : ""}`;
}

export default function FlightList({ flights, partySize }) {
  if (!flights?.length) {
    return (
      <EmptyState icon={Plane}>
        No flights to suggest for this Trip. The Summary tab explains why.
      </EmptyState>
    );
  }

  return (
    <div className="space-y-4">
      {flights.map((flight, index) => {
        const partyTotal =
          Number.isFinite(partySize) && partySize > 1 && Number.isFinite(flight.price_per_traveler)
            ? flight.price_per_traveler * partySize
            : null;

        return (
          <article
            key={`${flight.airline}-${flight.flight_number ?? index}`}
            className="bg-white border border-border hover:border-border-strong rounded-2xl overflow-hidden shadow-[0_8px_24px_-18px_rgba(24,20,17,0.16)] transition-all"
          >
            <div className="grid grid-cols-1 md:grid-cols-12">
              {/* Left: Carrier + Flight Number */}
              <div className="md:col-span-3 p-5 flex items-center gap-3.5 bg-surface-warm border-b md:border-b-0 md:border-r border-bg-subtle">
                <div className="w-11 h-11 rounded-xl bg-primary-light border border-primary-border flex items-center justify-center shrink-0">
                  <Plane className="w-5 h-5 text-primary" aria-hidden />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-primary uppercase tracking-wider truncate">
                    {flight.airline}
                  </p>
                  {flight.flight_number && (
                    <p className="font-mono text-sm font-semibold text-ink mt-0.5">
                      {flight.flight_number}
                    </p>
                  )}
                  <div className="mt-1.5">
                    <PriceSourceBadge source={flight.price_source} />
                  </div>
                </div>
              </div>

              {/* Center: Visual Boarding-Pass Route Track */}
              <div className="md:col-span-6 p-5 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  {flight.departure_time && (
                    <p className="font-mono text-lg font-semibold text-ink">
                      {flight.departure_time}
                    </p>
                  )}
                  <p className="text-xs font-medium text-ink-soft mt-0.5">
                    {flight.departure_airport}
                  </p>
                </div>

                <div className="flex-1 flex flex-col items-center px-2 min-w-[96px]">
                  <p className="font-mono text-[11px] text-muted mb-1.5 text-center">
                    {[flight.duration, stopsLabel(flight.stops)].filter(Boolean).join(" · ")}
                  </p>
                  <div className="w-full flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full border-2 border-primary bg-white shrink-0" />
                    <span className="flex-1 border-t border-dashed border-border-strong" />
                    <Plane className="w-3.5 h-3.5 text-primary shrink-0" aria-hidden />
                    <span className="flex-1 border-t border-dashed border-border-strong" />
                    <span className="w-2 h-2 rounded-full bg-ink shrink-0" />
                  </div>
                </div>

                <div className="min-w-0 text-right">
                  {flight.arrival_time && (
                    <p className="font-mono text-lg font-semibold text-ink">
                      {flight.arrival_time}
                    </p>
                  )}
                  <p className="text-xs font-medium text-ink-soft mt-0.5">
                    {flight.arrival_airport}
                  </p>
                </div>
              </div>

              {/* Right: Perforated Boarding-Pass Fare Stub */}
              <div className="md:col-span-3 p-5 flex md:flex-col items-center md:items-end justify-between md:justify-center border-t md:border-t-0 md:border-l border-dashed border-border-strong bg-bg/70">
                <div className="md:text-right">
                  <p className="font-mono text-2xl font-semibold text-success">
                    {formatInr(flight.price_per_traveler)}
                  </p>
                  <p className="text-xs text-muted">per traveller</p>
                </div>
                {partyTotal != null && (
                  <p className="font-mono text-[11px] text-ink-soft bg-white border border-border px-2.5 py-1 rounded-lg md:mt-2">
                    {formatInr(partyTotal)} for {partySize}
                  </p>
                )}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
