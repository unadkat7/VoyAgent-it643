"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import useWideLayout from "@/lib/useWideLayout";

const SERIES = [
  { key: "visitors", label: "Visitors", color: "#CE532D" },
  { key: "pageviews", label: "Pageviews", color: "#B45309" },
  { key: "signups", label: "Sign-ups", color: "#181411" },
  { key: "tripsPlanned", label: "Trips Planned", color: "#15803D" },
  { key: "planFailures", label: "Failures", color: "#C82828" },
];

const PLOT_HEIGHT = 148;
const integer = new Intl.NumberFormat("en-IN");
const field = "min-h-11 max-w-full rounded-xl border border-border bg-white px-3 text-sm text-ink";

export default function TrafficTrendChart({ daily = [] }) {
  const [metric, setMetric] = useState("visitors");
  const [comparison, setComparison] = useState("");
  const [mode, setMode] = useState("line");
  const [selectedDate, setSelectedDate] = useState("");
  const wide = useWideLayout();
  const series = SERIES.filter(({ key }) => key === metric || (wide && key === comparison));
  const selected = daily.findIndex((row) => row.day === selectedDate);
  const index = selected < 0 ? daily.length - 1 : selected;
  const day = daily[index];
  const highestCount = Math.max(0, ...daily.flatMap((row) => series.map(({ key }) => row[key] ?? 0)));
  const peak = Math.max(1, highestCount);
  const slot = 100 / Math.max(1, daily.length);
  const x = (i) => slot * (i + 0.5);
  const y = (value) => PLOT_HEIGHT - (value / peak) * (PLOT_HEIGHT - 8);
  const pick = (event) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    if (!bounds.width || !Number.isFinite(event.clientX)) return;
    const position = Math.floor(((event.clientX - bounds.left) / bounds.width) * daily.length);
    setSelectedDate(daily[Math.max(0, Math.min(daily.length - 1, position))].day);
  };

  return (
    <section className="min-w-0 rounded-2xl border border-border bg-white p-4 sm:p-6">
      <h2 className="font-display text-2xl font-semibold text-ink">Daily traffic</h2>
      {day ? (
        <>
          <p className="mt-1 text-sm text-muted">{daily[0].day} – {daily.at(-1).day}</p>
          <div className="my-4 flex flex-wrap items-end gap-2">
            <label className="grid gap-1 text-xs font-semibold">Metric
              <select className={field} value={metric} onChange={(e) => setMetric(e.target.value)}>
                {SERIES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </label>
            {wide && <label className="grid gap-1 text-xs font-semibold">Compare with
              <select className={field} value={comparison === metric ? "" : comparison} onChange={(e) => setComparison(e.target.value)}>
                <option value="">None</option>
                {SERIES.filter((s) => s.key !== metric).map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </label>}
            <label className="grid gap-1 text-xs font-semibold">Chart
              <select className={field} value={mode} onChange={(e) => setMode(e.target.value)}>
                <option value="line">Line</option><option value="bars">Bars</option>
              </select>
            </label>
          </div>
          {highestCount === 0 && <p className="mb-2 text-sm text-muted">No activity for the selected metric in this period.</p>}
          <div className="flex gap-2">
            <div aria-hidden="true" className="flex flex-col justify-between text-xs tabular-nums text-muted">
              <span>{integer.format(peak)}</span><span>0</span>
            </div>
            <div className="min-w-0 flex-1">
              <svg viewBox={`0 0 100 ${PLOT_HEIGHT}`} preserveAspectRatio="none"
                className="block h-40 w-full touch-pan-y border-y border-border bg-surface-warm"
                role="img" aria-label={`Daily ${series.map((s) => s.label).join(" and ")}`}
                onPointerDown={pick} onPointerMove={(e) => { if (e.pointerType === "mouse") pick(e); }}>
                <line x1="0" x2="100" y1={PLOT_HEIGHT / 2} y2={PLOT_HEIGHT / 2} stroke="#e7e0d5" strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />
                {series.map((s, j) => mode === "line" && daily.length > 1 ? (
                  <polyline key={s.key} points={daily.map((row, i) => `${x(i)},${y(row[s.key] ?? 0)}`).join(" ")}
                    fill="none" stroke={s.color} strokeWidth="2.5" strokeDasharray={j ? "5 3" : undefined} vectorEffect="non-scaling-stroke" />
                ) : daily.map((row, i) => {
                  const bar = slot * 0.72 / series.length;
                  const top = y(row[s.key] ?? 0);
                  return <rect key={`${s.key}-${row.day}`} x={x(i) - slot * 0.36 + j * bar} y={top}
                    width={bar} height={PLOT_HEIGHT - top} fill={s.color} />;
                }))}
                <line x1={x(index)} x2={x(index)} y1="0" y2={PLOT_HEIGHT} stroke="#73685e" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
              </svg>
              <div className="flex justify-between pt-1 text-xs text-muted"><span>{daily[0].day}</span>{daily.length > 1 && <span>{daily.at(-1).day}</span>}</div>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between gap-2 rounded-xl bg-bg px-2 py-1">
            <button type="button" className="grid size-11 shrink-0 place-items-center rounded-lg disabled:opacity-30"
              aria-label="Previous day" disabled={index <= 0} onClick={() => setSelectedDate(daily[index - 1].day)}><ChevronLeft size={18} /></button>
            <div aria-live="polite" className="text-center text-xs text-muted">
              <time dateTime={day.day}>{day.day}</time>
              {series.map((s) => <p key={s.key} className="font-semibold text-ink"><span style={{ color: s.color }}>{s.label}</span> {integer.format(day[s.key] ?? 0)}</p>)}
            </div>
            <button type="button" className="grid size-11 shrink-0 place-items-center rounded-lg disabled:opacity-30"
              aria-label="Next day" disabled={index >= daily.length - 1} onClick={() => setSelectedDate(daily[index + 1].day)}><ChevronRight size={18} /></button>
          </div>
        </>
      ) : <p className="mt-3 text-sm text-muted">No daily traffic recorded in this period.</p>}
    </section>
  );
}
