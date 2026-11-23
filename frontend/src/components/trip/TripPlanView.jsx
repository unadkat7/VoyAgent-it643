"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import useWideLayout from "@/lib/useWideLayout";
import dynamic from "next/dynamic";
import { ArrowLeft, ChevronRight } from "lucide-react";
import {
  budgetBreakdown,
  formatDateRange,
  formatInr,
  mapPoints,
  tripRouteLabel,
  tripTitle,
} from "@/lib/tripView";
import FlightList from "@/components/trip/FlightList";
import HotelList from "@/components/trip/HotelList";
import ItineraryList from "@/components/trip/ItineraryList";
import TripOverview from "@/components/trip/TripOverview";
import SegmentedControl from "@/components/ui/SegmentedControl";
import Skeleton from "@/components/ui/Skeleton";
import { trackInteraction } from "@/services/event.service";

// Leaflet needs `window`, so the map only loads in the browser.
const TripMap = dynamic(() => import("@/components/trip/TripMap"), {
  ssr: false,
  // Same height as the loaded map (plus its day row) so the page can scroll it into place.
  loading: () => <Skeleton className="h-[calc(100dvh-11.5rem-env(safe-area-inset-bottom))] min-h-72 w-full lg:h-[70vh]" />,
});

const TABS = [
  { value: "itinerary", label: "Itinerary" },
  { value: "map", label: "Map" },
  { value: "hotels", label: "Stays" },
  { value: "flights", label: "Flights" },
  { value: "summary", label: "Summary" },
];

// Height of the sticky app header, so the tab bar sticks right under it.
const STICKY_TOP = "top-[calc(3.5rem+env(safe-area-inset-top))] sm:top-[calc(4rem+env(safe-area-inset-top))]";

// The read-only Trip Plan: masthead, tabs and content. Used by the owner's page and the share page.
export default function TripPlanView({ trip }) {
  const [activeTab, setActiveTab] = useState("itinerary");
  const [selectedDay, setSelectedDay] = useState("all");
  const [focusedPointKey, setFocusedPointKey] = useState(null);

  const wideLayout = useWideLayout();
  const [originStop, setOriginStop] = useState(null);
  const mapReturnButton = useRef(null);
  const tabsAnchor = useRef(null);

  useEffect(() => {
    const restoreStop = (event) => {
      if (event.state?.voyStop) {
        setOriginStop(event.state.voyStop);
        setSelectedDay(event.state.voyStop.day);
        setFocusedPointKey(event.state.voyStop.key);
        setActiveTab("map");
      } else if (originStop) {
        const { key, day } = originStop;
        setOriginStop(null);
        setSelectedDay(day);
        setFocusedPointKey(null);
        setActiveTab("itinerary");
        requestAnimationFrame(() => document.getElementById(key)?.focus());
      }
    };
    window.addEventListener("popstate", restoreStop);
    return () => window.removeEventListener("popstate", restoreStop);
  }, [originStop]);

  const hasMapPins = useMemo(
    () => (trip?.plan ? mapPoints(trip.plan, "all").length > 0 : false),
    [trip]
  );

  const handleTrack = (action, value) => {
    const path = typeof window !== "undefined" ? window.location.pathname : undefined;
    trackInteraction(action, { value, tripId: trip?._id, path });
  };

  // A new tab starts at its top; the map always scrolls up so it fills the screen under the tabs.
  const scrollToTabs = (always = false) => {
    const anchor = tabsAnchor.current;
    if (!anchor) return;
    const headerHeight = document.querySelector("header")?.offsetHeight ?? 0;
    const target = anchor.getBoundingClientRect().top + window.scrollY - headerHeight;
    if (always ? window.scrollY !== target : window.scrollY > target) {
      window.scrollTo({ top: target, behavior: "instant" });
    }
  };

  const handleSelectTab = (tabId) => {
    if (originStop && tabId === "itinerary") {
      window.history.back();
      return;
    }
    if (originStop && tabId !== "map") {
      const state = { ...window.history.state };
      delete state.voyStop;
      window.history.replaceState(state, "");
      setOriginStop(null);
    }
    setActiveTab(tabId);
    if (tabId === "map" && !wideLayout) requestAnimationFrame(() => scrollToTabs(true));
    else scrollToTabs();
    handleTrack("trip_tab_viewed", tabId);
  };

  const handleSelectDay = (day) => {
    setSelectedDay(day);
    setFocusedPointKey(null);
  };

  const handleFocusActivity = (pointKey, dayNumber) => {
    if (!wideLayout) {
      const stop = { key: pointKey, day: selectedDay };
      setOriginStop(stop);
      window.history.pushState({ ...window.history.state, voyStop: stop }, "");
      setFocusedPointKey(pointKey);
      setActiveTab("map");
      handleTrack("trip_tab_viewed", "map");
      handleTrack("map_pin_focused", "locate_from_itinerary");
      requestAnimationFrame(() => {
        scrollToTabs(true);
        mapReturnButton.current?.focus({ preventScroll: true });
      });
      return;
    }
    const willFocus = focusedPointKey !== pointKey;
    setFocusedPointKey((current) => (current === pointKey ? null : pointKey));
    if (willFocus) handleTrack("map_pin_focused", "locate_from_itinerary");
    if (selectedDay !== "all" && selectedDay !== dayNumber) {
      setSelectedDay(dayNumber);
    }
  };

  const { plan } = trip;
  const route = tripRouteLabel(trip);
  const breakdown = budgetBreakdown(plan);
  const partySize = plan.request?.party_size;
  const meta = [
    formatDateRange(plan.check_in, plan.check_out),
    `${plan.nights} ${plan.nights === 1 ? "night" : "nights"}`,
    partySize ? `${partySize} ${partySize === 1 ? "traveler" : "travelers"}` : null,
    plan.request?.travel_style,
  ].filter(Boolean);

  return (
    <>
      {/* ── Masthead ── */}
      <section className="bg-surface">
        <div className="mx-auto max-w-7xl px-4 pb-4 pt-5 sm:px-6 sm:pt-8 lg:flex lg:items-end lg:justify-between lg:gap-6 lg:pb-6">
          <div className="min-w-0">
            {route && <p className="text-label font-semibold uppercase tracking-wider text-primary">{route}</p>}
            <h1 className="mt-1 font-display text-3xl font-semibold leading-tight tracking-tight text-ink sm:text-4xl">
              {tripTitle(trip)}
            </h1>
            <p className="mt-1.5 text-sm text-muted">{meta.join(" · ")}</p>
          </div>

          {plan.estimated_cost && (
            <button
              type="button"
              onClick={() => handleSelectTab("summary")}
              className="mt-4 flex min-h-tap w-full items-center justify-between gap-3 rounded-2xl bg-bg px-4 py-2.5 text-left hover:bg-bg-subtle lg:mt-0 lg:w-auto lg:min-w-72"
            >
              <span className="min-w-0">
                <span className="block text-label font-semibold uppercase tracking-wider text-muted">Estimated cost</span>{" "}
                <span className="font-mono text-xl font-semibold text-success">{formatInr(plan.estimated_cost.total)}</span>
                {breakdown.budget > 0 && (
                  <span className="ml-2 text-sm text-muted">
                    {breakdown.usedPercent}% of {formatInr(breakdown.budget)}
                  </span>
                )}
              </span>
              <ChevronRight className="h-5 w-5 shrink-0 text-muted" aria-hidden />
            </button>
          )}
        </div>
      </section>

      {/* ── Sticky section tabs ── */}
      <div ref={tabsAnchor} aria-hidden />
      <div className={`sticky ${STICKY_TOP} z-20 bg-surface`}>
        <div className="mx-auto max-w-7xl sm:px-6">
          <SegmentedControl
            label="Trip sections"
            variant="tabs"
            options={TABS}
            value={activeTab}
            onChange={handleSelectTab}
          />
        </div>
      </div>

      {/* ── Content ── */}
      <main className="mx-auto max-w-7xl px-4 pt-4 sm:px-6 sm:pt-6">
        {activeTab === "itinerary" && (
          <div className={hasMapPins ? "grid grid-cols-1 items-start gap-6 lg:grid-cols-12" : "max-w-3xl"}>
            <div className={hasMapPins ? "lg:col-span-7" : ""}>
              <ItineraryList
                days={plan.itinerary}
                selectedDay={selectedDay}
                onSelectDay={handleSelectDay}
                focusedPointKey={focusedPointKey}
                onFocusActivity={hasMapPins ? handleFocusActivity : null}
              />
            </div>

            {/* Desktop split-pane map, synced with the itinerary */}
            {hasMapPins && wideLayout && (
              <aside className="sticky top-36 hidden lg:col-span-5 lg:block" aria-label="Synced Trip Map">
                <TripMap
                  plan={plan}
                  selectedDay={selectedDay}
                  onDayChange={handleSelectDay}
                  focusedPointKey={focusedPointKey}
                  onClearFocus={() => setFocusedPointKey(null)}
                  onTrack={handleTrack}
                  compact
                />
              </aside>
            )}
          </div>
        )}

        {activeTab === "map" && (
          <>
            {originStop && (
              <button
                ref={mapReturnButton}
                type="button"
                className="mb-3 inline-flex min-h-tap items-center gap-2 rounded-xl border border-border bg-surface px-4 text-sm font-semibold text-ink"
                onClick={() => window.history.back()}
              >
                <ArrowLeft className="h-4 w-4" aria-hidden />
                Back to itinerary stop
              </button>
            )}
            <TripMap
              plan={plan}
              selectedDay={selectedDay}
              onDayChange={handleSelectDay}
              focusedPointKey={focusedPointKey}
              onClearFocus={() => setFocusedPointKey(null)}
              onTrack={handleTrack}
              showQuickStrip
              belowButton={Boolean(originStop)}
            />
          </>
        )}

        {activeTab === "hotels" && (
          <HotelList hotels={plan.hotels} nights={plan.nights} notes={plan.notes} onTrack={handleTrack} />
        )}

        {activeTab === "flights" && (
          <FlightList flights={plan.flights} partySize={partySize} notes={plan.notes} />
        )}

        {activeTab === "summary" && <TripOverview plan={plan} />}
      </main>
    </>
  );
}
