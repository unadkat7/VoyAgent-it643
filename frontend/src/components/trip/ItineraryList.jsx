"use client";

import { Calendar, MapPin } from "lucide-react";
import { formatInr } from "@/lib/tripView";
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

  return (
    <div className="space-y-5">
      {/* Day filter pill bar when synced or multiple days exist */}
      {days.length > 1 && onSelectDay && (
        <div
          className="flex flex-wrap items-center gap-1.5"
          role="group"
          aria-label="Filter Itinerary by day"
        >
          <button
            type="button"
            onClick={() => onSelectDay("all")}
            aria-pressed={selectedDay === "all"}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all ${
              selectedDay === "all"
                ? "bg-[#181411] border-[#181411] text-[#FAF8F4]"
                : "bg-white border-[#E7E0D5] text-[#73685E] hover:text-[#181411] hover:border-[#D6CCC0]"
            }`}
          >
            All {days.length} days
          </button>
          {days.map((day) => {
            const active = selectedDay === day.day;
            return (
              <button
                key={day.day}
                type="button"
                onClick={() => onSelectDay(day.day)}
                aria-pressed={active}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                  active
                    ? "bg-[#CE532D] border-[#CE532D] text-white"
                    : "bg-white border-[#E7E0D5] text-[#73685E] hover:text-[#181411] hover:border-[#D6CCC0]"
                }`}
              >
                Day {day.day}
              </button>
            );
          })}
        </div>
      )}

      {/* Day Sections */}
      <div className="space-y-5">
        {visibleDays.map((day) => (
          <section
            key={day.day}
            className="bg-white border border-[#E7E0D5] rounded-2xl overflow-hidden shadow-[0_8px_24px_-20px_rgba(24,20,17,0.16)]"
          >
            <header className="flex items-center justify-between gap-3 px-5 py-4 bg-[#FDFBF7] border-b border-[#E7E0D5]">
              <div className="flex items-center gap-3 min-w-0">
                <span className="font-mono text-[11px] font-semibold tracking-wider uppercase px-2.5 py-1 rounded-lg bg-[#CE532D] text-white shrink-0">
                  Day {String(day.day).padStart(2, "0")}
                </span>
                <h3 className="font-display text-lg font-semibold text-[#181411] truncate">
                  {day.title}
                </h3>
              </div>
              <span className="font-mono text-[11px] text-[#73685E] shrink-0">
                {day.activities.length} {day.activities.length === 1 ? "stop" : "stops"}
              </span>
            </header>

            <ol className="p-5 space-y-3.5">
              {day.activities.map((activity, index) => {
                const pointKey = `activity-${day.day}-${index}`;
                const canLocate = hasCoordinates(activity.coordinates) && Boolean(onFocusActivity);
                const isFocused = focusedPointKey === pointKey;

                return (
                  <li
                    key={`${activity.time}-${activity.title}-${index}`}
                    className={`relative flex gap-3.5 p-4 rounded-2xl border transition-all ${
                      isFocused
                        ? "bg-[#FCEEE8]/55 border-[#CE532D] shadow-sm"
                        : "bg-[#FAF8F4] border-[#E7E0D5] hover:border-[#D6CCC0]"
                    }`}
                  >
                    {/* Numbered pin badge matching TripMap order */}
                    <div className="flex flex-col items-center shrink-0">
                      <span
                        className={`w-7 h-7 rounded-full font-mono text-xs font-bold flex items-center justify-center ${
                          isFocused
                            ? "bg-[#181411] text-[#FAF8F4]"
                            : "bg-[#CE532D] text-white"
                        }`}
                      >
                        {index + 1}
                      </span>
                      {index < day.activities.length - 1 && (
                        <span className="w-px flex-1 bg-[#E7E0D5] mt-2" aria-hidden="true" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                        <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[#CE532D]">
                          {activity.time}
                        </span>
                        <span className="text-[11px] font-semibold text-[#15803D] bg-[#ECFDF3] border border-[#15803D]/15 px-2.5 py-0.5 rounded-full">
                          {activity.estimated_cost > 0
                            ? `Est. ${formatInr(activity.estimated_cost)} per traveller`
                            : "Free"}
                        </span>
                      </div>

                      <p className="text-sm font-bold text-[#181411]">{activity.title}</p>

                      {activity.description && (
                        <p className="text-xs text-[#73685E] mt-1 leading-relaxed">
                          {activity.description}
                        </p>
                      )}

                      <div className="flex flex-wrap items-center justify-between gap-2 mt-2.5">
                        {activity.location ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-[#3B342E]">
                            <MapPin className="w-3 h-3 text-[#73685E]" aria-hidden />
                            {activity.location}
                          </span>
                        ) : (
                          <span />
                        )}

                        {canLocate && (
                          <button
                            type="button"
                            onClick={() => onFocusActivity(pointKey, day.day)}
                            className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-colors ${
                              isFocused
                                ? "bg-[#181411] border-[#181411] text-[#FAF8F4]"
                                : "bg-white border-[#E7E0D5] text-[#3B342E] hover:border-[#CE532D] hover:text-[#CE532D]"
                            }`}
                          >
                            <MapPin className="w-3 h-3" aria-hidden />
                            {isFocused ? "Pinned" : "Locate on map"}
                          </button>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        ))}
      </div>
    </div>
  );
}
