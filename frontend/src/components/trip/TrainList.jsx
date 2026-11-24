import { TrainFront } from "lucide-react";
import {
  formatMinutes,
  formatMoney,
  formatRunningDays,
  formatTrainDeparture,
  formatTrainTime,
} from "@/lib/tripView";
import RoadRouteCard from "./RoadRouteCard";

function TrainOptionCard({ option, currency = "INR" }) {
  const start = option.departs;
  const fares = [
    fareText("Sleeper", option.sleeper, currency),
    fareText("3AC", option.ac3, currency),
  ].filter(Boolean);
  return (
    <li className="rounded-2xl border border-border bg-surface p-4">
      <div className="space-y-3">
        {option.legs.map((leg, index) => (
          <div key={`${leg.train_number}-${index}`}>
            {index > 0 && (
              <p className="mb-3 rounded-lg bg-bg px-3 py-2 text-sm font-medium text-ink-soft">
                Change at {option.change_at} · wait {formatMinutes(option.wait_minutes)}
              </p>
            )}
            <p className="flex items-center gap-2 text-base font-semibold text-ink">
              <TrainFront className="h-4 w-4 shrink-0 text-primary" aria-hidden />
              {leg.train_number} {leg.train_name}
            </p>
            <p className="mt-1 text-sm text-ink-soft">
              {leg.from_station}{" "}
              <span className="font-mono">
                {index === 0 ? formatTrainDeparture(leg.departs) : formatTrainTime(leg.departs, start)}
              </span>
              {" → "}
              {leg.to_station} <span className="font-mono">{formatTrainTime(leg.arrives, start)}</span>
            </p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-sm text-muted">
        {formatMinutes(option.duration_minutes)}
        {formatRunningDays(option.runs_on) && <> · {formatRunningDays(option.runs_on)}</>}
      </p>
      {fares.length > 0 && (
        <p className="mt-1 text-sm font-medium text-ink-soft">
          {fares.join(" · ")} one way per person · web estimate, check IRCTC
        </p>
      )}
    </li>
  );
}

const fareText = (label, range, currency = "INR") =>
  range &&
  `${label} ${formatMoney(range.low, currency)}${range.high > range.low ? `–${formatMoney(range.high, currency)}` : ""}`;

// Train Options from the timetable; fares are web estimates for these trains when found.
export default function TrainList({ title, options, roadLeg = null, currency = "INR" }) {
  if (!options?.length) return null;
  const id = title.toLowerCase().replace(/\W+/g, "-");
  return (
    <section aria-labelledby={id} className="space-y-3">
      <h2 id={id} className="font-display text-xl font-semibold text-ink">
        {title}
      </h2>
      <ol className="space-y-3">
        {options.map((option) => (
          <TrainOptionCard
            key={`${option.departs}-${option.legs.map((l) => l.train_number).join("-")}`}
            option={option}
            currency={currency}
          />
        ))}
      </ol>
      {roadLeg && <RoadRouteCard route={roadLeg} lead="Then by road: " />}
    </section>
  );
}
