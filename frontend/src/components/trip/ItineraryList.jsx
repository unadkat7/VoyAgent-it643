"use client";

import { Calendar, MapPin } from "lucide-react";
import { formatInr } from "@/lib/tripView";
import SegmentedControl from "@/components/ui/SegmentedControl";
import EmptyState from "./EmptyState";

const hasCoordinates = (coords) =>
  Number.isFinite(coords?.lat) && Number.isFinite(coords?.lng);

export default function ItineraryList({
  days,
  selectedDay = "all",
  onSelectDay = null,
  focusedPointKey = null,
  onFocusActivity = null,
}) {
  if (!days?.length) {
    return (
      <EmptyState icon={Calendar}>
        No day-by-day plan was produced for this Trip.
      </EmptyState>
    );
  }

  const visibleDays =
    selectedDay === "all" ? days : days.filter((day) => day.day === selectedDay);
  const dayOptions = [
    { value: "all", label: `All ${days.length} days` },
    ...days.map((day) => ({ value: day.day, label: `Day ${day.day}` })),
  ];

  return (
    <div className="space-y-4">
      {days.length > 1 && onSelectDay && (
        <SegmentedControl
          label="Filter Itinerary by day"
          options={dayOptions}
          value={selectedDay}
          onChange={onSelectDay}
          className="-mx-4 px-4 sm:mx-0 sm:px-0"
        />
      )}

      {visibleDays.map((day) => (
        <section key={day.day} className="overflow-hidden rounded-2xl border border-border bg-surface">
          <header className="flex items-end justify-between gap-3 px-4 pb-2 pt-4 sm:px-5">
            <div className="min-w-0">
              <p className="text-label font-semibold uppercase tracking-wider text-primary">Day {day.day}</p>
              <h2 className="font-display text-xl font-semibold leading-snug text-ink">{day.title}</h2>
            </div>
            <span className="shrink-0 pb-0.5 text-sm text-muted">
              {day.activities.length} {day.activities.length === 1 ? "stop" : "stops"}
            </span>
          </header>

          <ol className="divide-y divide-border">
            {day.activities.map((activity, index) => {
              const pointKey = `activity-${day.day}-${index}`;
              const canLocate = hasCoordinates(activity.coordinates) && Boolean(onFocusActivity);
              const isFocused = focusedPointKey === pointKey;

              return (
                <li
                  key={`${activity.time}-${activity.title}-${index}`}
                  className={`flex gap-3 px-4 py-4 sm:px-5 ${isFocused ? "bg-primary-light/60" : ""}`}
                >
                  <span
                    className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full font-mono text-xs font-bold ${
                      isFocused ? "bg-ink text-bg" : "bg-primary text-white"
                    }`}
                    aria-hidden
                  >
                    {index + 1}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="text-label font-semibold uppercase tracking-wider text-primary">
                      {activity.time}
                      <span className="ml-2 normal-case tracking-normal text-success">
                        {activity.estimated_cost > 0
                          ? `Est. ${formatInr(activity.estimated_cost)} per traveller`
                          : "Free"}
                      </span>
                    </p>
                    <h3 className="mt-0.5 text-base font-semibold text-ink">{activity.title}</h3>
                    {activity.description && (
                      <p className="mt-1 text-sm leading-relaxed text-muted">{activity.description}</p>
                    )}
                    {activity.location && (
                      <p className="mt-1.5 flex items-center gap-1 text-sm text-ink-soft">
                        <MapPin className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden />
                        {activity.location}
                      </p>
                    )}
                  </div>

                  {canLocate && (
                    <button
                      type="button"
                      id={pointKey}
                      aria-label="Locate on map"
                      aria-pressed={isFocused}
                      onClick={() => onFocusActivity(pointKey, day.day)}
                      className={`flex size-tap shrink-0 scroll-mt-40 items-center justify-center self-center rounded-xl border transition-colors ${
                        isFocused
                          ? "border-ink bg-ink text-bg"
                          : "border-border bg-surface text-ink-soft hover:border-primary hover:text-primary"
                      }`}
                    >
                      <MapPin className="h-5 w-5" aria-hidden />
                    </button>
                  )}
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}
