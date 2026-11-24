import { ExternalLink } from "lucide-react";
import { formatMoney, formatShortDate, planCurrency } from "@/lib/tripView";
import FlightList from "./FlightList";
import RoadRouteCard from "./RoadRouteCard";
import TrainList from "./TrainList";
import TravelOptions from "./TravelOptions";

const IRCTC_URL = "https://www.irctc.co.in/nget/train-search";

// The Travel tab: priced ways to travel, then flights, trains there and back, and the drive.
// Older plans have flights only.
export default function TravelPanel({ plan, travelMode = null, onSelectMode = null }) {
  const currency = planCurrency(plan);
  const flights = plan.flights ?? [];
  const trainsOut = plan.trains_out ?? [];
  const trainsBack = plan.trains_back ?? [];
  const hasTrains = trainsOut.length > 0 || trainsBack.length > 0;
  const hasOtherWays = hasTrains || Boolean(plan.road_route);

  return (
    <div className="max-w-3xl space-y-8">
      <TravelOptions plan={plan} travelMode={travelMode} onSelectMode={onSelectMode} />
      <section aria-labelledby="flights-heading" className="space-y-3">
        {hasOtherWays && (
          <h2 id="flights-heading" className="font-display text-xl font-semibold text-ink">
            Flights
          </h2>
        )}
        {flights.length === 0 && hasOtherWays ? (
          <p className="text-base text-muted">
            {hasTrains
              ? "No flights for this trip. Trains and road options are below."
              : "No flights or trains for this trip. The road route is below."}
          </p>
        ) : (
          <FlightList flights={flights} partySize={plan.request?.party_size} currency={currency} notes={plan.notes} />
        )}
      </section>

      {plan.legs?.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-display text-xl font-semibold text-ink">Between cities</h2>
          {plan.legs.map((leg, index) => (
            <p key={index}>
              {leg.from_city} → {leg.to_city} · {leg.mode} · ≈{" "}
              {formatMoney(leg.est_per_person ?? leg.est_inr_per_person, currency)} per person (estimate)
            </p>
          ))}
        </section>
      )}

      {hasTrains && (
        <div className="space-y-8">
          <TrainList title="Getting there by train" options={trainsOut} roadLeg={plan.road_leg} currency={currency} />
          <TrainList title="Coming back by train" options={trainsBack} currency={currency} />
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-bg px-4 py-3">
            <a
              href={IRCTC_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-tap items-center gap-1.5 text-base font-semibold text-primary hover:underline"
            >
              Check fares and seats on IRCTC
              <ExternalLink className="h-4 w-4" aria-hidden />
            </a>
            {plan.timetable_as_of && (
              <p className="text-sm text-muted">
                Timetable as of {formatShortDate(plan.timetable_as_of)}. Times can change; confirm before booking.
              </p>
            )}
          </div>
        </div>
      )}

      {plan.road_route && (
        <section aria-labelledby="road-heading" className="space-y-3">
          <h2 id="road-heading" className="font-display text-xl font-semibold text-ink">
            By road
          </h2>
          <RoadRouteCard route={plan.road_route} />
        </section>
      )}
    </div>
  );
}
