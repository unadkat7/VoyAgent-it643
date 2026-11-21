"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import dynamic from "next/dynamic";
import {
  ArrowLeft,
  Building2,
  Calendar,
  Map as MapIcon,
  Plane,
  ShieldAlert,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";
import toast from "react-hot-toast";
import { deleteTrip, getTripById } from "@/services/trip.service";
import {
  budgetBreakdown,
  formatDateRange,
  formatInr,
  mapPoints,
  tripRouteLabel,
  tripTitle,
} from "@/lib/tripView";
import FeedbackWidget from "@/components/feedback/FeedbackWidget";
import AppHeader from "@/components/layout/AppHeader";
import BrandLogo from "@/components/layout/BrandLogo";
import PageWrapper from "@/components/layout/PageWrapper";
import FlightList from "@/components/trip/FlightList";
import HotelList from "@/components/trip/HotelList";
import ItineraryList from "@/components/trip/ItineraryList";
import TripOverview from "@/components/trip/TripOverview";
import ConfirmModal from "@/components/ui/ConfirmModal";
import Skeleton from "@/components/ui/Skeleton";

// Leaflet needs `window`, so the map only loads in the browser.
const TripMap = dynamic(() => import("@/components/trip/TripMap"), {
  ssr: false,
  loading: () => <Skeleton className="h-[60vh] min-h-[380px] w-full" />,
});

function errorMessage(status) {
  if (status === 401) return null;
  if (status === 403) return "This Trip belongs to another account.";
  if (status === 404 || status === 400) return "This Trip does not exist any more.";
  return "Could not load this Trip. Please try again.";
}

export default function TripDetailPage() {
  const { id: tripId } = useParams();
  const router = useRouter();

  const [trip, setTrip] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("itinerary");
  const [selectedDay, setSelectedDay] = useState("all");
  const [focusedPointKey, setFocusedPointKey] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    // Ignore a late answer if the user has already moved to another Trip.
    let cancelled = false;
    getTripById(tripId)
      .then((data) => {
        if (!cancelled) setTrip(data.trip);
      })
      .catch((err) => {
        if (cancelled) return;
        const message = errorMessage(err.response?.status);
        if (message === null) router.replace("/login");
        else setError(message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tripId, router]);

  const hasMapPins = useMemo(
    () => (trip?.plan ? mapPoints(trip.plan, "all").length > 0 : false),
    [trip]
  );

  const handleDelete = async () => {
    try {
      setDeleting(true);
      await deleteTrip(tripId);
      toast.success("Trip deleted");
      router.push("/dashboard");
    } catch {
      toast.error("Could not delete the Trip. Please try again.");
      setDeleting(false);
    }
  };

  const handleSelectDay = (day) => {
    setSelectedDay(day);
    setFocusedPointKey(null);
  };

  const handleFocusActivity = (pointKey, dayNumber) => {
    setFocusedPointKey((current) => (current === pointKey ? null : pointKey));
    if (selectedDay !== "all" && selectedDay !== dayNumber) {
      setSelectedDay(dayNumber);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF8F4] font-sans">
        <div className="bg-[#FAF8F4]/90 border-b border-[#E7E0D5] px-6 h-16 flex items-center">
          <div className="max-w-6xl w-full mx-auto flex justify-between">
            <Skeleton className="w-24 h-6" />
            <Skeleton className="w-24 h-6" />
            <Skeleton className="w-20 h-7" />
          </div>
        </div>
        <div className="max-w-6xl mx-auto px-6 pt-8 space-y-5">
          <Skeleton className="w-72 h-10" />
          <Skeleton className="w-96 h-5" />
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-4">
            <Skeleton className="lg:col-span-7 h-96" />
            <Skeleton className="lg:col-span-5 h-96" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !trip?.plan) {
    return (
      <div className="min-h-screen bg-[#FAF8F4] flex flex-col items-center justify-center text-center p-8">
        <div className="bg-white border border-[#E7E0D5] rounded-3xl p-8 max-w-md w-full shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-[#FEF7E6] border border-[#D97706]/20 flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-6 h-6 text-[#B45309]" aria-hidden />
          </div>
          <h2 className="font-display text-2xl font-semibold text-[#181411] mb-2">
            {error ?? "This Trip is not planned yet"}
          </h2>
          <p className="text-sm text-[#73685E] mb-6">
            {error
              ? "Return to your Dashboard to view your saved Trips."
              : "Pick up the Conversation where you left off to finish planning."}
          </p>
          <div className="flex flex-col sm:flex-row gap-2.5 justify-center">
            {!error && trip && (
              <button
                type="button"
                onClick={() => router.push(`/trip/new?tripId=${trip._id}`)}
                className="bg-[#CE532D] hover:bg-[#B54320] text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
              >
                Continue planning
              </button>
            )}
            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              className="bg-[#181411] hover:bg-[#2C2520] text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { plan } = trip;
  const route = tripRouteLabel(trip);
  const breakdown = budgetBreakdown(plan);

  const tabs = [
    { id: "itinerary", label: "Itinerary", icon: Calendar, count: plan.itinerary?.length },
    { id: "map", label: "Map", icon: MapIcon },
    { id: "hotels", label: "Stays", icon: Building2, count: plan.hotels?.length },
    { id: "flights", label: "Flights", icon: Plane, count: plan.flights?.length },
    { id: "summary", label: "Summary", icon: Sparkles },
  ];

  return (
    <PageWrapper>
      <div className="min-h-screen bg-[#FAF8F4] font-sans pb-24">
        <AppHeader
          maxWidth="max-w-7xl"
          left={
            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#73685E] hover:text-[#181411] bg-white border border-[#E7E0D5] hover:border-[#D6CCC0] px-3 py-1.5 rounded-xl transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" aria-hidden />
              Dashboard
            </button>
          }
          center={<BrandLogo href="/dashboard" size="sm" />}
          right={
            <button
              type="button"
              onClick={() => setShowConfirm(true)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#C82828] bg-[#FEF2F2] hover:bg-[#FEE2E2] px-3 py-1.5 rounded-xl border border-[#C82828]/15 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" aria-hidden />
              Delete
            </button>
          }
        />

        {/* ── Editorial Dossier Masthead ── */}
        <section className="bg-white border-b border-[#E7E0D5]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-8">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-7">
              <div className="space-y-2.5 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  {route && (
                    <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#CE532D] bg-[#FCEEE8] border border-[#F3CFC0] px-2.5 py-0.5 rounded-full">
                      {route}
                    </span>
                  )}
                  <span className="text-[11px] font-semibold text-[#15803D] bg-[#ECFDF3] border border-[#15803D]/15 px-2.5 py-0.5 rounded-full">
                    Planned
                  </span>
                  {plan.request?.travel_style && (
                    <span className="text-[11px] font-medium capitalize text-[#3B342E] bg-[#FAF8F4] border border-[#E7E0D5] px-2.5 py-0.5 rounded-full">
                      {plan.request.travel_style}
                    </span>
                  )}
                </div>

                <h1 className="font-display text-3xl sm:text-4xl lg:text-[42px] font-semibold text-[#181411] tracking-tight leading-tight">
                  {tripTitle(trip)}
                </h1>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs sm:text-sm text-[#73685E]">
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-[#CE532D]" aria-hidden />
                    {formatDateRange(plan.check_in, plan.check_out)} · {plan.nights} nights
                  </span>
                  {plan.request?.party_size && (
                    <span className="inline-flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-[#73685E]" aria-hidden />
                      {plan.request.party_size} Travelers
                    </span>
                  )}
                  {plan.request?.budget && (
                    <span className="font-mono text-xs text-[#3B342E]">
                      Budget {formatInr(plan.request.budget)}
                    </span>
                  )}
                </div>
              </div>

              {/* Quick Estimated Cost + Budget Feasibility Pill */}
              {plan.estimated_cost && (
                <button
                  type="button"
                  onClick={() => setActiveTab("summary")}
                  className="text-left lg:text-right bg-[#FAF8F4] hover:bg-[#F2EDE4]/70 border border-[#E7E0D5] rounded-2xl px-5 py-3.5 transition-colors shrink-0 lg:min-w-[250px]"
                >
                  <div className="flex items-baseline justify-between lg:justify-end gap-3">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-[#73685E]">
                      Estimated Cost
                    </span>
                    <span className="font-mono text-2xl font-semibold text-[#15803D]">
                      {formatInr(plan.estimated_cost.total)}
                    </span>
                  </div>
                  {breakdown.budget > 0 && (
                    <div className="mt-2 space-y-1">
                      <div className="h-1.5 rounded-full bg-[#E7E0D5] overflow-hidden flex">
                        <div
                          className="bg-[#CE532D] h-full"
                          style={{ width: `${breakdown.hotelPercent}%` }}
                        />
                        <div
                          className="bg-[#181411] h-full"
                          style={{ width: `${breakdown.flightPercent}%` }}
                        />
                      </div>
                      <p className="font-mono text-[10px] text-[#73685E]">
                        {breakdown.usedPercent}% of Budget · Stays &amp; Flights
                      </p>
                    </div>
                  )}
                </button>
              )}
            </div>

            {/* Segmented Editorial Tab Bar */}
            <nav className="flex gap-1 overflow-x-auto -mb-px" aria-label="Trip sections">
              {tabs.map(({ id, label, icon: Icon, count }) => {
                const active = activeTab === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setActiveTab(id)}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 whitespace-nowrap transition-all ${
                      active
                        ? "border-[#CE532D] text-[#CE532D]"
                        : "border-transparent text-[#73685E] hover:text-[#181411]"
                    }`}
                  >
                    <Icon className="w-4 h-4" aria-hidden />
                    {label}
                    {typeof count === "number" && count > 0 && (
                      <span
                        className={`font-mono text-[10px] px-1.5 py-0.5 rounded-full ${
                          active
                            ? "bg-[#FCEEE8] text-[#B54320]"
                            : "bg-[#F2EDE4] text-[#73685E]"
                        }`}
                      >
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>
        </section>

        {/* ── Main Content Workspace ── */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              {activeTab === "itinerary" && (
                <div
                  className={
                    hasMapPins
                      ? "grid grid-cols-1 lg:grid-cols-12 gap-6 items-start"
                      : "max-w-4xl"
                  }
                >
                  <div className={hasMapPins ? "lg:col-span-7" : ""}>
                    <ItineraryList
                      days={plan.itinerary}
                      selectedDay={selectedDay}
                      onSelectDay={handleSelectDay}
                      focusedPointKey={focusedPointKey}
                      onFocusActivity={hasMapPins ? handleFocusActivity : null}
                    />
                  </div>

                  {/* Desktop Split-Pane Synced Trip Map */}
                  {hasMapPins && (
                    <aside
                      className="hidden lg:block lg:col-span-5 sticky top-24"
                      aria-label="Synced Trip Map"
                    >
                      <TripMap
                        plan={plan}
                        selectedDay={selectedDay}
                        onDayChange={handleSelectDay}
                        focusedPointKey={focusedPointKey}
                        compact
                      />
                    </aside>
                  )}
                </div>
              )}

              {activeTab === "map" && (
                <TripMap
                  plan={plan}
                  selectedDay={selectedDay}
                  onDayChange={handleSelectDay}
                  focusedPointKey={focusedPointKey}
                />
              )}

              {activeTab === "hotels" && (
                <HotelList hotels={plan.hotels} nights={plan.nights} />
              )}

              {activeTab === "flights" && (
                <FlightList flights={plan.flights} partySize={plan.request?.party_size} />
              )}

              {activeTab === "summary" && <TripOverview plan={plan} />}
            </motion.div>
          </AnimatePresence>
        </main>

        <ConfirmModal
          isOpen={showConfirm}
          title="Delete this Trip?"
          message="This permanently deletes the Trip Plan. It cannot be undone."
          confirmLabel="Delete"
          loading={deleting}
          onConfirm={handleDelete}
          onCancel={() => setShowConfirm(false)}
        />
        <FeedbackWidget page={`/trip/${trip._id}`} />
      </div>
    </PageWrapper>
  );
}
