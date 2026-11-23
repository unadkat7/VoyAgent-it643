"use client";

import { useState } from "react";
import {
  Compass,
  ExternalLink,
  Layers,
  Map as MapIcon,
  Maximize2,
  MousePointerClick,
  SlidersHorizontal,
} from "lucide-react";
import { formatPercent } from "@/lib/adminAnalytics";

const CARD =
  "bg-white border border-[#E7E0D5] rounded-2xl p-5 shadow-[0_8px_24px_-20px_rgba(24,20,17,0.16)]";
const EYEBROW = "text-[11px] font-semibold uppercase tracking-wider text-[#73685E]";

const TAB_LABELS = {
  itinerary: "Itinerary",
  map: "Trip Map",
  hotels: "Stays",
  flights: "Flights",
  summary: "Summary",
};

const STYLE_COLORS = {
  atlas: { label: "Atlas (OSM)", color: "#CE532D" },
  satellite: { label: "Satellite", color: "#181411" },
  terrain: { label: "Terrain", color: "#15803D" },
};

const PIN_LABELS = {
  activity: "Activity pins",
  hotel: "Stay pins",
  destination: "Destination pin",
  locate_from_itinerary: "Locate from Itinerary",
};

export default function FeatureEngagementPanel({ featureEngagement, compact = false }) {
  const [allActions, setAllActions] = useState(false);
  const { tripMap, dossierTabs, hotelOutbound, creationFlow } = featureEngagement;

  const totalStyles = tripMap.styles.reduce((sum, s) => sum + s.count, 0);
  const rankedTabs = [...dossierTabs].sort((a, b) => b.views - a.views);
  const maxTabViews = Math.max(1, ...dossierTabs.map((t) => t.views));

  const mapActionRows = [
    ...tripMap.pinFocuses.map((p) => ({
      label: PIN_LABELS[p.kind] ?? p.kind,
      value: p.count,
    })),
    { label: "Day filter switches", value: tripMap.dayFilters },
    { label: "Fullscreen opens", value: tripMap.fullscreenOpens },
    { label: "Google Maps handoffs", value: tripMap.googleMapsClicks },
    {
      label: "Layer toggles",
      value: tripMap.layerToggles.reduce((sum, l) => sum + l.count, 0),
    },
    { label: "Fit-all resets", value: tripMap.resetViews },
  ].sort((a, b) => b.value - a.value);

  const maxMapAction = Math.max(1, ...mapActionRows.map((r) => r.value));

  const creationRows = [
    { label: "Guided Trip Brief submitted", value: creationFlow.briefBuilderSubmitted },
    { label: "Guided Brief → Edit in chat", value: creationFlow.briefBuilderPrefilled },
    { label: "Curated Starters (Studio)", value: creationFlow.starterStudio },
    { label: "Curated Starters (Dashboard)", value: creationFlow.starterDashboard },
    { label: "Inline Clarification submitted", value: creationFlow.clarificationInlineSubmitted },
  ];
  const maxCreation = Math.max(1, ...creationRows.map((r) => r.value));

  return (
    <section className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* TripMap Engagement Card */}
        <div className={`${CARD} lg:col-span-7 flex flex-col justify-between gap-5`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className={EYEBROW}>TripMap Engagement</p>
              <h2 className="font-display text-lg font-semibold text-[#181411] flex items-center gap-2">
                <MapIcon className="w-4 h-4 text-[#CE532D]" aria-hidden />
                Interactive map usage &amp; styles
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <div className="bg-[#FAF8F4] border border-[#E7E0D5] rounded-xl px-3 py-1.5 text-right">
                <p className="text-[10px] uppercase tracking-wider text-[#73685E] font-semibold">
                  Map Adoption
                </p>
                <p className="font-mono text-sm font-semibold text-[#181411]">
                  {formatPercent(tripMap.adoptionRatePct)}
                </p>
              </div>
              <div className="bg-[#FCEEE8] border border-[#F3CFC0] rounded-xl px-3 py-1.5 text-right">
                <p className="text-[10px] uppercase tracking-wider text-[#B54320] font-semibold">
                  Interactions
                </p>
                <p className="font-mono text-sm font-semibold text-[#B54320]">
                  {tripMap.totalInteractions.toLocaleString("en-IN")}
                </p>
              </div>
            </div>
          </div>

          {/* Map Style Preference Split */}
          <div>
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-medium text-[#3B342E] inline-flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-[#73685E]" aria-hidden />
                Map style switches
              </span>
              <span className="font-mono text-[11px] text-[#73685E]">
                {totalStyles} total switches
              </span>
            </div>
            {totalStyles > 0 ? (
              <>
                <div className="h-2.5 rounded-full bg-[#F2EDE4] overflow-hidden flex">
                  {tripMap.styles.map((s) => {
                    if (s.count <= 0) return null;
                    const cfg = STYLE_COLORS[s.style] ?? { label: s.style, color: "#73685E" };
                    return (
                      <div
                        key={s.style}
                        style={{
                          width: `${(s.count / totalStyles) * 100}%`,
                          backgroundColor: cfg.color,
                        }}
                        title={`${cfg.label}: ${s.count}`}
                      />
                    );
                  })}
                </div>
                <div className="flex flex-wrap gap-3 mt-2 text-[11px] text-[#3B342E]">
                  {tripMap.styles.map((s) => {
                    const cfg = STYLE_COLORS[s.style] ?? { label: s.style, color: "#73685E" };
                    return (
                      <span key={s.style} className="inline-flex items-center gap-1.5">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: cfg.color }}
                          aria-hidden
                        />
                        {cfg.label}: <strong className="font-mono">{s.count}</strong>
                      </span>
                    );
                  })}
                </div>
              </>
            ) : (
              <p className="text-xs text-[#73685E] bg-[#FAF8F4] border border-[#F2EDE4] rounded-xl px-3 py-2">
                No map style switches recorded in this window yet.
              </p>
            )}
          </div>

          {/* Ranked Map Actions */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-2.5">
            {mapActionRows.slice(0, allActions ? undefined : 5).map((row) => (
              <div key={row.label} className="text-xs">
                <div className="flex justify-between text-[#3B342E] mb-1">
                  <span>{row.label}</span>
                  <span className="font-mono font-semibold text-[#181411]">{row.value}</span>
                </div>
                <div className="h-1.5 bg-[#F2EDE4] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#CE532D] rounded-full"
                    style={{ width: `${row.value > 0 ? Math.max(6, (row.value / maxMapAction) * 100) : 0}%` }}
                  />
                </div>
              </div>
            ))}
            {mapActionRows.length > 5 && <button type="button" aria-expanded={allActions} onClick={() => setAllActions(!allActions)}
              className="min-h-11 text-sm font-semibold text-primary-hover">{allActions ? "Show fewer" : "View all"}</button>}
          </div>

          {/* Highlight Pills */}
          <div className="flex flex-wrap gap-2 pt-3 border-t border-[#F2EDE4] text-[11px]">
            <span className="inline-flex items-center gap-1.5 bg-[#FAF8F4] border border-[#E7E0D5] px-2.5 py-1 rounded-full text-[#3B342E]">
              <Maximize2 className="w-3 h-3 text-[#CE532D]" aria-hidden />
              Fullscreen opens: <strong className="font-mono">{tripMap.fullscreenOpens}</strong>
            </span>
            <span className="inline-flex items-center gap-1.5 bg-[#FAF8F4] border border-[#E7E0D5] px-2.5 py-1 rounded-full text-[#3B342E]">
              <ExternalLink className="w-3 h-3 text-[#15803D]" aria-hidden />
              Google Maps handoffs: <strong className="font-mono">{tripMap.googleMapsClicks}</strong>
            </span>
            <span className="inline-flex items-center gap-1.5 bg-[#FAF8F4] border border-[#E7E0D5] px-2.5 py-1 rounded-full text-[#3B342E]">
              <MousePointerClick className="w-3 h-3 text-[#181411]" aria-hidden />
              Map visitors: <strong className="font-mono">{tripMap.uniqueVisitors}</strong>
            </span>
          </div>
        </div>

        {/* Right Column: Dossier Tab Engagement + Hotel Outbound + Creation Flow */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          {/* Trip Plan Tabs + Outbound Hotel Clicks */}
          <div className={CARD}>
            <div className="flex items-start justify-between gap-2 mb-3">
              <div>
                <p className={EYEBROW}>Trip Plan Dossier Tabs</p>
                <h3 className="font-display text-base font-semibold text-[#181411] flex items-center gap-1.5">
                  <Compass className="w-4 h-4 text-[#CE532D]" aria-hidden />
                  Section views &amp; outbound clicks
                </h3>
              </div>
              {hotelOutbound.staysTabCtrPct !== null && (
                <span className="font-mono text-[11px] font-semibold bg-[#ECFDF3] text-[#15803D] border border-[#15803D]/15 px-2.5 py-0.5 rounded-full">
                  Stays CTR {formatPercent(hotelOutbound.staysTabCtrPct)}
                </span>
              )}
            </div>

            {dossierTabs.every((t) => t.views === 0) ? (
              <p className="text-xs text-[#73685E] mb-3">
                Tab switch telemetry will appear as travelers explore Trip Plans.
              </p>
            ) : (
              <ul className="space-y-2 mb-4">
                {rankedTabs.map((item) => (
                  <li key={item.tab} className="text-xs">
                    <div className="flex justify-between text-[#3B342E] mb-1">
                      <span className="font-medium">{TAB_LABELS[item.tab] ?? item.tab}</span>
                      <span className="font-mono text-[#73685E]">
                        <strong className="text-[#181411]">{item.views}</strong> views ·{" "}
                        {item.visitors} visitors
                      </span>
                    </div>
                    <div className="h-1.5 bg-[#F2EDE4] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#181411] rounded-full"
                        style={{
                          width: `${item.views > 0 ? Math.max(5, (item.views / maxTabViews) * 100) : 0}%`,
                        }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <div className="grid grid-cols-2 gap-2.5 pt-3 border-t border-[#F2EDE4]">
              <div className="rounded-xl bg-[#FAF8F4] border border-[#E7E0D5] px-3 py-2">
                <p className="text-[10px] uppercase tracking-wider font-semibold text-[#73685E]">
                  Hotel Deal Clicks
                </p>
                <p className="font-mono text-lg font-semibold text-[#15803D]">
                  {hotelOutbound.bookingUrlClicks}
                </p>
              </div>
              <div className="rounded-xl bg-[#FAF8F4] border border-[#E7E0D5] px-3 py-2">
                <p className="text-[10px] uppercase tracking-wider font-semibold text-[#73685E]">
                  Hotel Map Lookups
                </p>
                <p className="font-mono text-lg font-semibold text-[#181411]">
                  {hotelOutbound.googleMapsClicks}
                </p>
              </div>
            </div>
          </div>

          {/* Creation UX Adoption */}
          <div className={CARD}>
            <p className={EYEBROW}>Planner Creation Flow</p>
            <h3 className="font-display text-base font-semibold text-[#181411] flex items-center gap-1.5 mb-3">
              <SlidersHorizontal className="w-4 h-4 text-[#CE532D]" aria-hidden />
              Brief Builder, Starters &amp; Clarifications
            </h3>
            <ul className="space-y-2">
              {creationRows.map((row) => (
                <li key={row.label} className="text-xs">
                  <div className="flex justify-between text-[#3B342E] mb-1">
                    <span>{row.label}</span>
                    <span className="font-mono font-semibold text-[#181411]">{row.value}</span>
                  </div>
                  <div className="h-1.5 bg-[#F2EDE4] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#B45309] rounded-full"
                      style={{
                        width: `${row.value > 0 ? Math.max(6, (row.value / maxCreation) * 100) : 0}%`,
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
