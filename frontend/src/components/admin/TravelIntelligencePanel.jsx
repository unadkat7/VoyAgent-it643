"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import {
  AlertTriangle,
  CheckCircle2,
  Compass,
  IndianRupee,
  MapPin,
  Route,
  Sparkles,
} from "lucide-react";
import { formatLatency, formatMoney, formatPercent } from "@/lib/adminAnalytics";
import Skeleton from "@/components/ui/Skeleton";

const DestinationsMap = dynamic(() => import("./DestinationsMap"), {
  ssr: false,
  loading: () => <Skeleton className="h-72 w-full rounded-2xl" />,
});

const CARD =
  "bg-white border border-border rounded-2xl p-5 shadow-[0_8px_24px_-20px_rgba(24,20,17,0.16)]";
const EYEBROW = "text-label font-semibold uppercase tracking-wider text-muted";

const MISSING_LABELS = {
  origin: "Origin city",
  destination: "Destination",
  duration_days: "Duration",
  budget: "INR Budget",
  party_size: "Party Size",
  travel_style: "Travel Style",
};

export function StatusDonut({ planned, draft, failed }) {
  const total = planned + draft + failed;
  if (!total) return <p className="text-sm text-muted">No trips in this period.</p>;
  const r = 42;
  const c = 2 * Math.PI * r;
  const segments = [
    { label: "Planned", count: planned, color: "#15803D" },
    { label: "Draft / Clarification", count: draft, color: "#D97706" },
    { label: "Failed", count: failed, color: "#C82828" },
  ];

  const completionPct = total > 0 ? Math.round((planned / total) * 100) : 0;

  let offset = 0;
  return (
    <div className="flex flex-col sm:flex-row items-center gap-5">
      <div className="relative w-28 h-28 shrink-0">
        <svg viewBox="0 0 110 110" className="w-full h-full -rotate-90" aria-hidden="true">
          <circle cx="55" cy="55" r={r} fill="none" stroke="#F2EDE4" strokeWidth="13" />
          {total > 0 &&
            segments.map((seg) => {
              if (seg.count <= 0) return null;
              const len = (seg.count / total) * c;
              const dashOffset = -offset;
              offset += len;
              return (
                <circle
                  key={seg.label}
                  cx="55"
                  cy="55"
                  r={r}
                  fill="none"
                  stroke={seg.color}
                  strokeWidth="13"
                  strokeDasharray={`${len} ${c - len}`}
                  strokeDashoffset={dashOffset}
                />
              );
            })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-xl font-semibold text-ink">{completionPct}%</span>
          <span className="text-label text-muted uppercase tracking-wider">Planned</span>
        </div>
      </div>

      <ul className="flex-1 w-full space-y-2 text-xs">
        {segments.map((seg) => (
          <li key={seg.label} className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-2 text-ink-soft">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: seg.color }}
                aria-hidden
              />
              {seg.label}
            </span>
            <span className="font-mono font-semibold text-ink">
              {seg.count}{" "}
              <span className="text-muted font-normal">
                ({total > 0 ? Math.round((seg.count / total) * 100) : 0}%)
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function TravelIntelligencePanel({ trips, showMap = true }) {
  const [showAll, setShowAll] = useState(false);
  const [geoMode, setGeoMode] = useState("destinations");
  const { budgetAnalysis, priceSourceCoverage, planningHealth } = trips;

  const maxBand = Math.max(1, ...budgetAnalysis.bands.map((b) => b.count));
  const maxStyle = Math.max(1, ...trips.travelStyles.map((s) => s.count));
  const maxMissing = Math.max(1, ...planningHealth.topMissingFields.map((m) => m.count));

  const totalHotel = priceSourceCoverage.liveHotels + priceSourceCoverage.estimatedHotels;
  const totalFlight = priceSourceCoverage.liveFlights + priceSourceCoverage.estimatedFlights;

  return (
    <section className="space-y-4">
      {/* Row 1: Destinations Atlas Map (full view) + Trip Lifecycle & Destinations Leaderboard */}
      {showMap && (
        <div className={CARD}>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div>
              <p className={EYEBROW}>Planned Destinations Atlas</p>
              <h2 className="font-display text-lg font-semibold text-ink flex items-center gap-2">
                <MapPin className="w-4 h-4 text-primary" aria-hidden />
                Where outside travelers are planning Trips
              </h2>
            </div>
            <span className="font-mono text-xs text-muted bg-bg border border-border px-3 py-1 rounded-full">
              {trips.destinationPins.length} geocoded{" "}
              {trips.destinationPins.length === 1 ? "destination" : "destinations"}
            </span>
          </div>
          <DestinationsMap pins={trips.destinationPins} />
        </div>
      )}

      {/* Row 2: Destinations/Routes Leaderboard + Budget Intelligence */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className={`${CARD} lg:col-span-6 flex flex-col justify-between`}>
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <div>
                <p className={EYEBROW}>Travel Demand</p>
                <h3 className="font-display text-lg font-semibold text-ink flex items-center gap-1.5">
                  <Route className="w-4 h-4 text-primary" aria-hidden />
                  Popular Destinations &amp; Corridors
                </h3>
              </div>
              <div className="flex gap-1 bg-bg border border-border rounded-xl p-0.5">
                {[
                  { id: "destinations", label: "Destinations" },
                  { id: "routes", label: "Routes" },
                  { id: "origins", label: "Origins" },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => { setGeoMode(opt.id); setShowAll(false); }}
                    aria-pressed={geoMode === opt.id}
                    className={`min-h-tap text-sm font-semibold px-3 rounded-lg transition-colors ${
                      geoMode === opt.id
                        ? "bg-ink text-white"
                        : "text-muted hover:text-ink"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {geoMode === "destinations" &&
              (trips.topDestinations.length === 0 ? (
                <p className="text-sm text-muted">No planned destinations in this window yet.</p>
              ) : (
                <ul className="space-y-2.5">
                  {trips.topDestinations.slice(0, showAll ? undefined : 5).map((row) => {
                    const max = Math.max(1, trips.topDestinations[0].count);
                    return (
                      <li key={row.destination} className="text-xs">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="font-semibold text-ink">{row.destination}</span>
                          <span className="font-mono text-muted">
                            {row.avgBudgetInr ? `${formatMoney(row.avgBudgetInr, "INR")} avg · ` : ""}
                            {row.avgDays ? `${row.avgDays}d · ` : ""}
                            <strong className="text-ink">{row.count}</strong>
                          </span>
                        </div>
                        <div className="h-1.5 bg-bg-subtle rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full"
                            style={{ width: `${(row.count / max) * 100}%` }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ))}

            {geoMode === "routes" &&
              (trips.topRoutes.length === 0 ? (
                <p className="text-sm text-muted">No Origin → Destination corridors yet.</p>
              ) : (
                <ul className="space-y-2.5">
                  {trips.topRoutes.slice(0, showAll ? undefined : 5).map((row) => {
                    const max = Math.max(1, trips.topRoutes[0].count);
                    return (
                      <li key={row.route} className="text-xs">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="font-semibold text-ink">{row.route}</span>
                          <span className="font-mono text-muted">
                            {row.avgBudgetInr ? `${formatMoney(row.avgBudgetInr, "INR")} · ` : ""}
                            <strong className="text-ink">{row.count}</strong>
                          </span>
                        </div>
                        <div className="h-1.5 bg-bg-subtle rounded-full overflow-hidden">
                          <div
                            className="h-full bg-ink rounded-full"
                            style={{ width: `${(row.count / max) * 100}%` }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ))}

            {geoMode === "origins" &&
              (trips.topOrigins.length === 0 ? (
                <p className="text-sm text-muted">No origin cities recorded yet.</p>
              ) : (
                <ul className="space-y-2.5">
                  {trips.topOrigins.slice(0, showAll ? undefined : 5).map((row) => {
                    const max = Math.max(1, trips.topOrigins[0].count);
                    return (
                      <li key={row.origin} className="text-xs">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="font-semibold text-ink">{row.origin}</span>
                          <span className="font-mono font-semibold text-ink">
                            {row.count}
                          </span>
                        </div>
                        <div className="h-1.5 bg-bg-subtle rounded-full overflow-hidden">
                          <div
                            className="h-full bg-warning rounded-full"
                            style={{ width: `${(row.count / max) * 100}%` }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ))}
          </div>

          {(geoMode === "destinations" ? trips.topDestinations : geoMode === "routes" ? trips.topRoutes : trips.topOrigins).length > 5 && (
            <button type="button" aria-expanded={showAll} onClick={() => setShowAll(!showAll)}
              className="mt-2 min-h-11 text-sm font-semibold text-primary-hover">{showAll ? "Show fewer" : "View all"}</button>
          )}
          <div className="mt-5 pt-4 border-t border-bg-subtle">
            <p className={`${EYEBROW} mb-3`}>Trip Lifecycle</p>
            <StatusDonut
              planned={trips.plannedTrips}
              draft={trips.draftTrips}
              failed={trips.failedTrips}
            />
          </div>
        </div>

        {/* INR Budget & Spend Split */}
        <div className={`${CARD} lg:col-span-6 flex flex-col justify-between gap-5`}>
          <div>
            <p className={EYEBROW}>INR Budget Intelligence</p>
            <h3 className="font-display text-lg font-semibold text-ink flex items-center gap-1.5 mb-1">
              <IndianRupee className="w-4 h-4 text-success" aria-hidden />
              Budget utilization &amp; spend allocation
            </h3>
            <p className="text-xs text-muted mb-4">
              INR trips only
              {budgetAnalysis.nonInrTrips > 0
                ? ` (${budgetAnalysis.nonInrTrips} in other currencies)`
                : ""}
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mb-4">
              <div className="rounded-xl bg-bg border border-border p-3">
                <p className="text-label uppercase tracking-wider font-semibold text-muted">
                  Avg Budget
                </p>
                <p className="font-mono text-base font-semibold text-ink mt-0.5">
                  {formatMoney(budgetAnalysis.avgBudgetInr, "INR")}
                </p>
              </div>
              <div className="rounded-xl bg-bg border border-border p-3">
                <p className="text-label uppercase tracking-wider font-semibold text-muted">
                  Median Budget
                </p>
                <p className="font-mono text-base font-semibold text-ink mt-0.5">
                  {formatMoney(budgetAnalysis.medianBudgetInr, "INR")}
                </p>
              </div>
              <div className="rounded-xl bg-success-light border border-success/15 p-3 col-span-2 sm:col-span-1">
                <p className="text-label uppercase tracking-wider font-semibold text-success">
                  Avg full trip estimate
                </p>
                <p className="font-mono text-base font-semibold text-success mt-0.5">
                  {formatMoney(budgetAnalysis.avgEstimatedCostInr, "INR")}
                </p>
              </div>
            </div>

            {/* Stacked Budget Split Bar */}
            {budgetAnalysis.avgUtilizationPct !== null && (
              <div className="mb-5">
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="font-medium text-ink-soft">Average budget allocation</span>
                  <span className="font-mono font-semibold text-success">
                    {formatPercent(budgetAnalysis.avgUtilizationPct)} utilized
                  </span>
                </div>
                <div className="h-3 rounded-full bg-bg-subtle overflow-hidden flex">
                  <div
                    className="bg-primary h-full"
                    style={{ width: `${budgetAnalysis.avgHotelSharePct ?? 0}%` }}
                    title={`Stays: ${formatPercent(budgetAnalysis.avgHotelSharePct)}`}
                  />
                  <div
                    className="bg-ink h-full"
                    style={{ width: `${budgetAnalysis.avgFlightSharePct ?? 0}%` }}
                    title={`Travel: ${formatPercent(budgetAnalysis.avgFlightSharePct)}`}
                  />
                  <div
                    className="bg-success/35 h-full"
                    style={{ width: `${budgetAnalysis.avgBufferSharePct ?? 0}%` }}
                    title={`Buffer: ${formatPercent(budgetAnalysis.avgBufferSharePct)}`}
                  />
                </div>
                <div className="flex flex-wrap gap-3 mt-2 text-label text-muted">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-primary" />
                    Stays {formatPercent(budgetAnalysis.avgHotelSharePct)}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-ink" />
                    Travel {formatPercent(budgetAnalysis.avgFlightSharePct)}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-success/45" />
                    Buffer {formatPercent(budgetAnalysis.avgBufferSharePct)}
                  </span>
                </div>
              </div>
            )}

            {/* Budget Bands Histogram */}
            <p className={`${EYEBROW} mb-2`}>Budget Tiers</p>
            <div className="space-y-2">
              {budgetAnalysis.bands.map((band) => (
                <div key={band.label} className="text-xs">
                  <div className="flex justify-between text-ink-soft mb-1">
                    <span className="font-mono">{band.label}</span>
                    <span className="font-mono font-semibold text-ink">{band.count}</span>
                  </div>
                  <div className="h-1.5 bg-bg-subtle rounded-full overflow-hidden">
                    <div
                      className="h-full bg-success rounded-full"
                      style={{
                        width: `${band.count > 0 ? Math.max(6, (band.count / maxBand) * 100) : 0}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-3 border-t border-bg-subtle flex items-center justify-between text-xs text-muted">
            <span>Total planned budget volume</span>
            <strong className="font-mono text-ink">
              {formatMoney(budgetAnalysis.totalPlannedBudgetInr, "INR")}
            </strong>
          </div>
        </div>
      </div>

      {/* Row 3: Traveler Preferences + AI Planning Health & Live Pricing */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Travel Styles, Party Size & Duration */}
        <div className={`${CARD} lg:col-span-5 space-y-5`}>
          <div>
            <p className={EYEBROW}>Traveler Preferences</p>
            <h3 className="font-display text-lg font-semibold text-ink flex items-center gap-1.5 mb-3">
              <Sparkles className="w-4 h-4 text-primary" aria-hidden />
              Travel styles, parties &amp; durations
            </h3>

            {trips.travelStyles.length === 0 ? (
              <p className="text-xs text-muted">No travel styles recorded yet.</p>
            ) : (
              <ul className="space-y-2">
                {trips.travelStyles.slice(0, 6).map((item) => (
                  <li key={item.style} className="text-xs">
                    <div className="flex justify-between text-ink-soft mb-1">
                      <span className="capitalize font-medium">{item.style}</span>
                      <span className="font-mono text-muted">
                        {item.avgBudgetInr ? `${formatMoney(item.avgBudgetInr, "INR")} · ` : ""}
                        <strong className="text-ink">{item.count}</strong>
                      </span>
                    </div>
                    <div className="h-1.5 bg-bg-subtle rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full"
                        style={{ width: `${(item.count / maxStyle) * 100}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 pt-3 border-t border-bg-subtle">
            <div>
              <p className={`${EYEBROW} mb-2`}>Party Size</p>
              <ul className="space-y-1.5 text-xs">
                {trips.partySizes.map((row) => (
                  <li key={row.label} className="flex justify-between text-ink-soft">
                    <span>{row.label}</span>
                    <span className="font-mono font-semibold text-ink">{row.count}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className={`${EYEBROW} mb-2`}>Duration</p>
              <ul className="space-y-1.5 text-xs">
                {trips.durationBuckets.map((row) => (
                  <li key={row.label} className="flex justify-between text-ink-soft">
                    <span>{row.label}</span>
                    <span className="font-mono font-semibold text-ink">{row.count}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* AI Planning Engine Health + Live Pricing + Clarification Bottlenecks */}
        <div className={`${CARD} lg:col-span-7 space-y-5`}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className={EYEBROW}>Planning Engine Telemetry</p>
              <h3 className="font-display text-lg font-semibold text-ink flex items-center gap-1.5">
                <Compass className="w-4 h-4 text-primary" aria-hidden />
                AI performance, pricing sources &amp; clarifications
              </h3>
            </div>
            <span className="inline-flex items-center gap-1 text-label font-mono font-semibold bg-success-light text-success border border-success/15 px-2.5 py-1 rounded-full">
              <CheckCircle2 className="w-3 h-3" aria-hidden />
              Geocoded {formatPercent(planningHealth.geocodedCoveragePct)}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="rounded-xl bg-bg border border-border p-3">
              <p className="text-label uppercase tracking-wider font-semibold text-muted">
                P50 Latency
              </p>
              <p className="font-mono text-base font-semibold text-ink mt-0.5">
                {formatLatency(planningHealth.p50LatencyMs)}
              </p>
            </div>
            <div className="rounded-xl bg-bg border border-border p-3">
              <p className="text-label uppercase tracking-wider font-semibold text-muted">
                P95 Latency
              </p>
              <p className="font-mono text-base font-semibold text-warning mt-0.5">
                {formatLatency(planningHealth.p95LatencyMs)}
              </p>
            </div>
            <div className="rounded-xl bg-bg border border-border p-3">
              <p className="text-label uppercase tracking-wider font-semibold text-muted">
                1st-Try Success
              </p>
              <p className="font-mono text-base font-semibold text-success mt-0.5">
                {formatPercent(planningHealth.firstAttemptSuccessRate)}
              </p>
            </div>
            <div className="rounded-xl bg-bg border border-border p-3">
              <p className="text-label uppercase tracking-wider font-semibold text-muted">
                Avg Turns
              </p>
              <p className="font-mono text-base font-semibold text-ink mt-0.5">
                {planningHealth.avgAttemptsToPlan ?? "—"}
              </p>
            </div>
          </div>

          {/* Live vs Estimated Pricing Coverage */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              {
                label: "Hotel recommendations",
                live: priceSourceCoverage.liveHotels,
                est: priceSourceCoverage.estimatedHotels,
                total: totalHotel,
                pctVal: priceSourceCoverage.liveHotelPct,
              },
              {
                label: "Flight recommendations",
                live: priceSourceCoverage.liveFlights,
                est: priceSourceCoverage.estimatedFlights,
                total: totalFlight,
                pctVal: priceSourceCoverage.liveFlightPct,
              },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-xl bg-bg border border-border p-3.5 space-y-2"
              >
                <div className="flex justify-between text-xs">
                  <span className="font-medium text-ink-soft">{item.label}</span>
                  <span className="font-mono font-semibold text-success">
                    {item.total ? `${formatPercent(item.pctVal)} live` : "No recommendations"}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-border overflow-hidden flex">
                  <div
                    className="bg-success h-full"
                    style={{ width: `${item.total > 0 ? (item.live / item.total) * 100 : 0}%` }}
                  />
                  <div
                    className="bg-warning/65 h-full"
                    style={{ width: `${item.total > 0 ? (item.est / item.total) * 100 : 0}%` }}
                  />
                </div>
                <p className="text-label font-mono text-muted">
                  {item.total} total · {item.live} live · {item.est} estimated
                </p>
              </div>
            ))}
          </div>

          {/* Top Missing Clarification Fields */}
          <div className="pt-3 border-t border-bg-subtle">
            <p className={`${EYEBROW} mb-2 flex items-center gap-1.5`}>
              <AlertTriangle className="w-3.5 h-3.5 text-warning" aria-hidden />
              Top Clarification Bottlenecks (Missing Fields)
            </p>
            {planningHealth.topMissingFields.length === 0 ? (
              <p className="text-xs text-muted">No missing-field clarifications recorded yet.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-2">
                {planningHealth.topMissingFields.map((row) => (
                  <div key={row.field} className="text-xs">
                    <div className="flex justify-between text-ink-soft mb-1">
                      <span>{MISSING_LABELS[row.field] ?? row.field}</span>
                      <span className="font-mono font-semibold text-warning">{row.count}</span>
                    </div>
                    <div className="h-1.5 bg-bg-subtle rounded-full overflow-hidden">
                      <div
                        className="h-full bg-star rounded-full"
                        style={{ width: `${(row.count / maxMissing) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
