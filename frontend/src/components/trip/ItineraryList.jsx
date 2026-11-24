"use client";

import { useState } from "react";
import { Calendar, ExternalLink, MapPin, Star } from "lucide-react";
import { formatInr } from "@/lib/tripView";
import SegmentedControl from "@/components/ui/SegmentedControl";
import EmptyState from "./EmptyState";

const hasCoordinates = (coords) =>
  Number.isFinite(coords?.lat) && Number.isFinite(coords?.lng);

function ActivityPhoto({ src, alt }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return null;
  return (
    // Provider thumbnails come from varying hosts, so a plain img with an error fallback.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className="size-16 shrink-0 self-center rounded-xl bg-bg-subtle object-cover"
    />
  );
}

export default function ItineraryList({
  days,
  stops = [],
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

      {visibleDays.map((day, index) => (
        <section key={day.day} className="overflow-hidden rounded-2xl border border-border bg-surface">
          {stops.length > 1 && stops[day.stop] && visibleDays[index - 1]?.stop !== day.stop && (
            <h2 className="border-b border-border px-4 py-2 font-semibold sm:px-5">
              {stops[day.stop].city} · Days {1 + stops.slice(0, day.stop).reduce((n, s) => n + s.days, 0)}–{stops.slice(0, day.stop + 1).reduce((n, s) => n + s.days, 0)}
            </h2>
          )}
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
                    {(activity.rating != null || activity.maps_url) && (
                      <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                        {activity.rating != null && (
                          <span className="inline-flex items-center gap-1 font-mono font-semibold text-warning">
                            <Star className="h-3.5 w-3.5 fill-star text-star" aria-hidden />
                            {activity.rating}
                          </span>
                        )}
                        {activity.maps_url && (
                          <a
                            href={activity.maps_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
                          >
                            Google Maps
                            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                          </a>
                        )}
                      </p>
                    )}
                  </div>

                  <ActivityPhoto src={activity.image_url} alt={activity.title} />

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
