"use client";

import { useMemo, useState } from "react";
import { Clock } from "lucide-react";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function cellTone(count, max) {
  if (!count || max <= 0) return "bg-[#F5F1EA]";
  const ratio = count / max;
  if (ratio <= 0.25) return "bg-[#FCEEE8]";
  if (ratio <= 0.5) return "bg-[#F3CFC0]";
  if (ratio <= 0.78) return "bg-[#CE532D]/85";
  return "bg-[#181411]";
}

export default function ActivityHeatmap({ cells = [] }) {
  const [weekday, setWeekday] = useState(1);
  const [hovered, setHovered] = useState(null);

  const { grid, max, peak } = useMemo(() => {
    const map = new Map();
    let maxVal = 0;
    let peakCell = null;
    for (const cell of cells) {
      const key = `${cell.dayOfWeek}-${cell.hour}`;
      map.set(key, cell.count);
      if (cell.count > maxVal) {
        maxVal = cell.count;
        peakCell = cell;
      }
    }
    return { grid: map, max: maxVal, peak: peakCell };
  }, [cells]);

  return (
    <section className="bg-white border border-[#E7E0D5] rounded-2xl p-5 shadow-[0_8px_24px_-20px_rgba(24,20,17,0.16)]">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#73685E]">
            Peak Activity Windows (IST)
          </p>
          <p className="font-display text-lg font-semibold text-[#181411]">
            7 × 24 hourly engagement heatmap
          </p>
        </div>
        {peak ? (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-mono font-semibold text-[#B54320] bg-[#FCEEE8] border border-[#F3CFC0] px-2.5 py-1 rounded-full">
            <Clock className="w-3 h-3" aria-hidden />
            Peak: {DAYS[peak.dayOfWeek]} {String(peak.hour).padStart(2, "0")}:00 ({peak.count})
          </span>
        ) : null}
      </div>

      {max === 0 ? <p className="text-sm text-muted">No hourly activity in this period.</p> : <>
      <div className="space-y-3 lg:hidden">
        <label className="grid gap-1 text-sm font-semibold">Weekday
          <select className="min-h-11 rounded-xl border border-border bg-white px-3" value={weekday} onChange={(e) => setWeekday(Number(e.target.value))}>
            {DAYS.map((day, i) => <option key={day} value={i}>{day}</option>)}
          </select>
        </label>
        <dl className="grid grid-cols-4 gap-1.5 sm:grid-cols-8">
          {HOURS.map((hour) => {
            const count = grid.get(`${weekday}-${hour}`) ?? 0;
            return <div key={hour} className="rounded-lg border border-border px-1 py-2 text-center">
              <dt className="text-xs text-muted">{String(hour).padStart(2, "0")}:00</dt>
              <dd className="text-sm font-semibold">{count}<span className="sr-only"> events</span></dd>
            </div>;
          })}
        </dl>
      </div>
      <div className="hidden lg:block overflow-x-auto">
        <div className="min-w-[560px] space-y-1.5">
          {/* Hour Header */}
          <div className="grid grid-cols-[36px_repeat(24,minmax(0,1fr))] gap-1 text-[9px] font-mono text-[#73685E]">
            <span />
            {HOURS.map((hour) => (
              <span key={hour} className="text-center">
                {hour % 3 === 0 ? `${String(hour).padStart(2, "0")}` : ""}
              </span>
            ))}
          </div>

          {/* 7 Day Rows */}
          {DAYS.map((dayLabel, dayIdx) => (
            <div
              key={dayLabel}
              className="grid grid-cols-[36px_repeat(24,minmax(0,1fr))] gap-1 items-center"
            >
              <span className="text-[10px] font-mono text-[#73685E]">{dayLabel}</span>
              {HOURS.map((hour) => {
                const count = grid.get(`${dayIdx}-${hour}`) ?? 0;
                return (
                  <button
                    key={hour}
                    type="button"
                    onMouseEnter={() => setHovered({ day: dayLabel, hour, count })}
                    onClick={() => setHovered({ day: dayLabel, hour, count })}
                    onFocus={() => setHovered({ day: dayLabel, hour, count })}
                    onMouseLeave={() => setHovered(null)}
                    aria-label={`${dayLabel} ${hour}:00 IST — ${count} events`}
                    title={`${dayLabel} ${String(hour).padStart(2, "0")}:00 IST — ${count} events`}
                    className={`h-5 rounded-[4px] transition-transform hover:scale-110 ${cellTone(
                      count,
                      max
                    )}`}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="hidden lg:flex flex-wrap items-center justify-between gap-2 mt-4 pt-3 border-t border-[#F2EDE4] text-[11px] text-[#73685E]">
        <span>
          {hovered
            ? `${hovered.day} ${String(hovered.hour).padStart(2, "0")}:00 IST — ${hovered.count} events`
            : "Select an hour to see its event count."}
        </span>
        <div className="flex items-center gap-1.5">
          <span>Quiet</span>
          <span className="w-3 h-3 rounded-[3px] bg-[#F5F1EA]" />
          <span className="w-3 h-3 rounded-[3px] bg-[#FCEEE8]" />
          <span className="w-3 h-3 rounded-[3px] bg-[#F3CFC0]" />
          <span className="w-3 h-3 rounded-[3px] bg-[#CE532D]/85" />
          <span className="w-3 h-3 rounded-[3px] bg-[#181411]" />
          <span>Peak</span>
        </div>
      </div>
      </>}
    </section>
  );
}
