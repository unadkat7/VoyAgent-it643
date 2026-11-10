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
            className="bg-white border border-[#E7E0D5] hover:border-[#D6CCC0] rounded-2xl overflow-hidden shadow-[0_8px_24px_-18px_rgba(24,20,17,0.16)] transition-all"
          >
            <div className="grid grid-cols-1 md:grid-cols-12">
              {/* Left: Carrier + Flight Number */}
              <div className="md:col-span-3 p-5 flex items-center gap-3.5 bg-[#FDFBF7] border-b md:border-b-0 md:border-r border-[#F2EDE4]">
                <div className="w-11 h-11 rounded-xl bg-[#FCEEE8] border border-[#F3CFC0] flex items-center justify-center shrink-0">
                  <Plane className="w-5 h-5 text-[#CE532D]" aria-hidden />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-[#CE532D] uppercase tracking-wider truncate">
                    {flight.airline}
                  </p>
                  {flight.flight_number && (
                    <p className="font-mono text-sm font-semibold text-[#181411] mt-0.5">
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
                    <p className="font-mono text-lg font-semibold text-[#181411]">
                      {flight.departure_time}
                    </p>
                  )}
                  <p className="text-xs font-medium text-[#3B342E] mt-0.5">
                    {flight.departure_airport}
                  </p>
                </div>

                <div className="flex-1 flex flex-col items-center px-2 min-w-[96px]">
                  <p className="font-mono text-[11px] text-[#73685E] mb-1.5 text-center">
                    {[flight.duration, stopsLabel(flight.stops)].filter(Boolean).join(" · ")}
                  </p>
                  <div className="w-full flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full border-2 border-[#CE532D] bg-white shrink-0" />
                    <span className="flex-1 border-t border-dashed border-[#D6CCC0]" />
                    <Plane className="w-3.5 h-3.5 text-[#CE532D] shrink-0" aria-hidden />
                    <span className="flex-1 border-t border-dashed border-[#D6CCC0]" />
                    <span className="w-2 h-2 rounded-full bg-[#181411] shrink-0" />
                  </div>
                </div>

                <div className="min-w-0 text-right">
                  {flight.arrival_time && (
                    <p className="font-mono text-lg font-semibold text-[#181411]">
                      {flight.arrival_time}
                    </p>
                  )}
                  <p className="text-xs font-medium text-[#3B342E] mt-0.5">
                    {flight.arrival_airport}
                  </p>
                </div>
              </div>

              {/* Right: Perforated Boarding-Pass Fare Stub */}
              <div className="md:col-span-3 p-5 flex md:flex-col items-center md:items-end justify-between md:justify-center border-t md:border-t-0 md:border-l border-dashed border-[#D6CCC0] bg-[#FAF8F4]/70">
                <div className="md:text-right">
                  <p className="font-mono text-2xl font-semibold text-[#15803D]">
                    {formatInr(flight.price_per_traveler)}
                  </p>
                  <p className="text-xs text-[#73685E]">per traveller</p>
                </div>
                {partyTotal != null && (
                  <p className="font-mono text-[11px] text-[#3B342E] bg-white border border-[#E7E0D5] px-2.5 py-1 rounded-lg md:mt-2">
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
