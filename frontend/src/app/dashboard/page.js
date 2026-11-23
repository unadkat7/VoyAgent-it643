"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Calendar,
  CheckCheck,
  ChevronRight,
  Clock,
  Compass,
  Copy,
  LogOut,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";
import toast from "react-hot-toast";
import { getCurrentUser, logout } from "@/services/auth.service";
import { trackInteraction } from "@/services/event.service";
import { deleteTrip, getUserTrips } from "@/services/trip.service";
import {
  formatDateRange,
  formatInr,
  statusInfo,
  tripLink,
  tripRouteLabel,
  tripTitle,
} from "@/lib/tripView";
import FeedbackWidget from "@/components/feedback/FeedbackWidget";
import AppHeader from "@/components/layout/AppHeader";
import BrandLogo from "@/components/layout/BrandLogo";
import PageWrapper from "@/components/layout/PageWrapper";
import ConfirmModal from "@/components/ui/ConfirmModal";
import Skeleton from "@/components/ui/Skeleton";

const TONE_BADGE = {
  success: "bg-[#ECFDF3] text-[#15803D] border-[#15803D]/15",
  warning: "bg-[#FEF7E6] text-[#B45309] border-[#B45309]/15",
  danger: "bg-[#FEF2F2] text-[#C82828] border-[#C82828]/15",
};

const TONE_STRIPE = {
  success: "bg-[#15803D]",
  warning: "bg-[#D97706]",
  danger: "bg-[#C82828]",
};

const FILTER_OPTIONS = [
  { id: "all", label: "All Trips" },
  { id: "planned", label: "Planned" },
  { id: "draft", label: "Needs details" },
  { id: "planning_failed", label: "Failed" },
];

const MISSING_FIELD_LABELS = {
  origin: "Origin",
  destination: "Destination",
  duration_days: "Duration",
  budget: "Budget",
  party_size: "Party Size",
  travel_style: "Travel Style",
};

const STARTER_JOURNEYS = [
  {
    title: "North Goa Coast",
    route: "Ahmedabad → Goa",
    meta: "3 days · 2 Travelers · ₹40,000 · Relaxed",
    prompt: "3 days in Goa from Ahmedabad, 2 people, ₹40,000, relaxed",
  },
  {
    title: "Manali Mountain Escape",
    route: "Delhi → Manali",
    meta: "3 days · 4 Travelers · ₹30,000 · Adventure",
    prompt: "3 days in Manali from Delhi, 4 friends, ₹30,000, adventure",
  },
  {
    title: "Kerala Backwaters",
    route: "Mumbai → Kerala",
    meta: "4 days · Family of 4 · ₹60,000 · Relaxed",
    prompt: "4 days Kerala backwaters from Mumbai, family of 4, ₹60,000, relaxed",
  },
  {
    title: "Royal Rajasthan Circuit",
    route: "Delhi → Jaipur",
    meta: "5 days · 2 Travelers · ₹50,000 · Culture",
    prompt: "5-day Jaipur & Rajasthan tour from Delhi, 2 people, ₹50,000, culture",
  },
];

export default function DashboardPage() {
  const router = useRouter();

  const [user, setUser] = useState(null);
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);

  const [statusFilter, setStatusFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [confirmModal, setConfirmModal] = useState({ open: false, tripId: null });
  const [deleting, setDeleting] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState(null);

  const [loadError, setLoadError] = useState(false);

  const loadPage = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const authData = await getCurrentUser();
      if (!authData?.user) return router.replace("/login");
      setUser(authData.user);

      const tripsData = await getUserTrips();
      if (tripsData?.trips) setTrips(tripsData.trips);
    } catch (error) {
      if (error.response?.status === 401) router.replace("/login");
      else setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      loadPage();
    }, 0);
    return () => clearTimeout(timeoutId);
  }, [loadPage]);

  const counts = useMemo(() => {
    const summary = { all: trips.length, planned: 0, draft: 0, planning_failed: 0 };
    for (const trip of trips) {
      if (trip.status === "planned") summary.planned += 1;
      else if (trip.status === "planning_failed") summary.planning_failed += 1;
      else summary.draft += 1;
    }
    return summary;
  }, [trips]);

  const filteredTrips = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return trips.filter((trip) => {
      if (statusFilter !== "all" && trip.status !== statusFilter) return false;
      if (!needle) return true;
      const haystack = [
        tripTitle(trip),
        tripRouteLabel(trip) ?? "",
        trip.conversation?.[0]?.content ?? "",
        trip.plan?.request?.travel_style ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [trips, statusFilter, query]);

  const handleLogout = async () => {
    try {
      await logout();
      router.replace("/login");
    } catch {
      toast.error("Could not sign out. Please try again.");
    }
  };

  const askDeleteTrip = (e, tripId) => {
    e.stopPropagation();
    setConfirmModal({ open: true, tripId });
  };

  const confirmDelete = async () => {
    try {
      setDeleting(true);
      await deleteTrip(confirmModal.tripId);
      setTrips((prev) => prev.filter((t) => t._id !== confirmModal.tripId));
      setConfirmModal({ open: false, tripId: null });
      toast.success("Trip deleted");
    } catch {
      toast.error("Could not delete the Trip. Please try again.");
    } finally {
      setDeleting(false);
    }
  };

  const copyPrompt = (e, text, idx) => {
    e.stopPropagation();
    navigator.clipboard?.writeText(text);
    setCopiedIdx(idx);
    toast.success("Prompt copied");
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const launchStarter = (prompt) => {
    trackInteraction("starter_trip_selected", { value: "dashboard", path: "/dashboard" });
    router.push(`/trip/new?prompt=${encodeURIComponent(prompt)}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF8F4] font-sans">
        <div className="bg-[#FAF8F4]/90 border-b border-[#E7E0D5] px-6 h-16 flex items-center">
          <div className="max-w-6xl w-full mx-auto flex items-center justify-between">
            <Skeleton className="w-32 h-6" />
            <Skeleton className="w-24 h-8" />
          </div>
        </div>
        <div className="max-w-6xl mx-auto px-6 pt-10 space-y-6">
          <div className="flex flex-wrap gap-3 justify-between items-end">
            <div className="space-y-2">
              <Skeleton className="w-56 h-8" />
              <Skeleton className="w-72 h-4" />
            </div>
            <Skeleton className="w-36 h-11" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-56 w-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (loadError) return (
    <main className="mx-auto max-w-md px-5 py-16">
      <h1 className="font-display text-3xl font-semibold">Couldn’t load your trips</h1>
      <p className="mt-2 text-sm text-muted">Check your connection and try again.</p>
      <button type="button" onClick={loadPage} className="mt-4 rounded-xl bg-ink px-4 py-3 text-sm font-semibold text-white">Try again</button>
    </main>
  );
  if (!user) return null;

  const firstName = user.name.split(" ")[0];
  const initial = firstName.charAt(0).toUpperCase();

  return (
    <PageWrapper>
      <div className="min-h-screen bg-[#FAF8F4] font-sans pb-24">
        <AppHeader
          left={<BrandLogo href="/dashboard" size="sm" />}
          right={
            <>
              {user.isAdmin && (
                <Link
                  href="/admin"
                  className="text-xs font-semibold text-[#181411] bg-white border border-[#E7E0D5] hover:bg-[#F2EDE4]/70 px-3 py-1.5 rounded-xl transition-colors"
                >
                  Admin
                </Link>
              )}
              <div className="hidden sm:flex items-center gap-2 bg-white border border-[#E7E0D5] pl-1.5 pr-3 py-1 rounded-full">
                <span className="w-6 h-6 rounded-full bg-[#181411] text-[#FAF8F4] text-xs font-semibold flex items-center justify-center">
                  {initial}
                </span>
                <span className="text-xs font-medium text-[#3B342E]">{firstName}</span>
              </div>
              <button
                type="button"
                aria-label="Sign out"
                onClick={handleLogout}
                className="flex items-center gap-1.5 text-xs font-semibold text-[#73685E] hover:text-[#CE532D] px-3 py-2 rounded-xl hover:bg-[#F2EDE4]/70 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" aria-hidden />
                <span className="hidden sm:inline">Sign out</span>
              </button>
            </>
          }
        />

        <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-5 sm:pt-10">
          {/* ── Editorial Masthead ── */}
          <section className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pb-4 mb-4 sm:gap-6 sm:pb-8 sm:mb-8 border-b border-[#E7E0D5]">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#CE532D] mb-2">
                Saved trips
              </p>
              <h1 className="font-display text-3xl sm:text-4xl font-semibold text-[#181411] tracking-tight">
                {firstName}’s trips
              </h1>
              <p className="text-sm text-[#73685E] mt-1.5">
                {trips.length > 0
                  ? `${counts.planned} planned ${counts.planned === 1 ? "Trip" : "Trips"}${
                      counts.draft > 0 ? ` · ${counts.draft} waiting on details` : ""
                    }${counts.planning_failed > 0 ? ` · ${counts.planning_failed} to retry` : ""}.`
                  : "Describe a Trip or use the guided brief builder to generate your first INR-budgeted plan."}
              </p>
            </div>

            <button
              type="button"
              onClick={() => router.push("/trip/new")}
              className="inline-flex items-center justify-center gap-2 bg-[#CE532D] hover:bg-[#B54320] active:scale-[0.985] text-white font-semibold text-sm px-5 py-3 rounded-2xl shadow-md shadow-[#CE532D]/20 transition-all shrink-0"
            >
              <Plus className="w-4 h-4" aria-hidden />
              Plan New Trip
            </button>
          </section>

          {/* ── EMPTY STATE / ONBOARDING ── */}
          {trips.length === 0 && (
            <section className="space-y-6">
              <div className="bg-white border border-[#E7E0D5] rounded-3xl p-6 sm:p-8 shadow-[0_12px_32px_-24px_rgba(24,20,17,0.18)]">
                <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                  <div className="flex items-center gap-2.5">
                    <span className="w-9 h-9 rounded-xl bg-[#FCEEE8] text-[#CE532D] flex items-center justify-center">
                      <Compass className="w-4 h-4" aria-hidden />
                    </span>
                    <div>
                      <h2 className="font-display text-xl font-semibold text-[#181411]">
                        Plan your first trip
                      </h2>
                      <p className="text-xs text-[#73685E]">
                        Start with your own plans or choose an example below.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => router.push("/trip/new")}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-[#181411] hover:bg-[#2C2520] px-4 py-2.5 rounded-xl transition-colors"
                  >
                    Open Trip Planner
                    <ArrowRight className="w-3.5 h-3.5" aria-hidden />
                  </button>
                </div>

                <div className="hidden md:grid md:grid-cols-3 gap-3.5 mb-8">
                  {[
                    {
                      num: "01",
                      label: "Share 6 Trip details",
                      desc: "Origin, Destination, Days, Party Size, INR Budget & Style.",
                    },
                    {
                      num: "02",
                      label: "Parallel research",
                      desc: "Stays, Flights & Itinerary specialists run simultaneously.",
                    },
                    {
                      num: "03",
                      label: "Explore & map",
                      desc: "Review your Budget breakdown, Stays, Flights & Trip Map.",
                    },
                  ].map((step) => (
                    <div
                      key={step.num}
                      className="p-4 rounded-2xl bg-[#FAF8F4] border border-[#E7E0D5]"
                    >
                      <span className="font-mono text-[11px] font-semibold text-[#CE532D]">
                        STEP {step.num}
                      </span>
                      <p className="text-sm font-bold text-[#181411] mt-1">{step.label}</p>
                      <p className="text-xs text-[#73685E] mt-1 leading-relaxed">{step.desc}</p>
                    </div>
                  ))}
                </div>

                <div>
                  <p className="text-xs font-semibold text-[#73685E] uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#CE532D]" aria-hidden />
                    Try a starting itinerary
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {STARTER_JOURNEYS.map((item, idx) => (
                      <div
                        key={item.title}
                        className="group relative p-4 rounded-2xl bg-[#FDFBF7] border border-[#E7E0D5] hover:border-[#CE532D]/50 hover:bg-white cursor-pointer transition-all flex items-start justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <p className="font-mono text-[11px] text-[#CE532D] uppercase tracking-wider">
                            {item.route}
                          </p>
                          <p className="font-display text-lg font-semibold text-[#181411] group-hover:text-[#CE532D] transition-colors">
                            <button type="button" onClick={() => launchStarter(item.prompt)} className="text-left after:absolute after:inset-0">{item.title}</button>
                          </p>
                          <p className="text-xs text-[#73685E] mt-1">{item.meta}</p>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => copyPrompt(e, item.prompt, idx)}
                          title="Copy prompt"
                          aria-label={`Copy prompt for ${item.title}`}
                          className="relative z-10 grid size-11 place-items-center rounded-xl border border-[#E7E0D5] bg-white text-[#73685E] hover:text-[#CE532D] hover:border-[#CE532D]/40 transition-colors shrink-0"
                        >
                          {copiedIdx === idx ? (
                            <CheckCheck className="w-3.5 h-3.5 text-[#15803D]" aria-hidden />
                          ) : (
                            <Copy className="w-3.5 h-3.5" aria-hidden />
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* ── SAVED TRIPS TOOLBAR + GRID ── */}
          {trips.length > 0 && (
            <section className="space-y-6">
              {/* Filter Pills + Search */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter Trips by status">
                  {FILTER_OPTIONS.map((option) => {
                    const active = statusFilter === option.id;
                    const count = counts[option.id];
                    if (option.id !== "all" && count === 0) return null;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setStatusFilter(option.id)}
                        aria-pressed={active}
                        className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                          active
                            ? "bg-[#181411] border-[#181411] text-[#FAF8F4]"
                            : "bg-white border-[#E7E0D5] text-[#73685E] hover:text-[#181411] hover:border-[#D6CCC0]"
                        }`}
                      >
                        {option.label}
                        <span
                          className={`font-mono text-[10px] px-1.5 py-0.2 rounded-full ${
                            active ? "bg-[#FAF8F4]/15 text-[#FAF8F4]" : "bg-[#F2EDE4] text-[#73685E]"
                          }`}
                        >
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="relative w-full md:w-72">
                  <Search
                    className="w-4 h-4 text-[#73685E] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                    aria-hidden
                  />
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Filter by destination or style..."
                    aria-label="Filter saved Trips"
                    className="w-full bg-white border border-[#E7E0D5] rounded-xl pl-9 pr-3.5 py-2 text-xs text-[#181411] placeholder-[#A89E94] focus:outline-none focus:border-[#CE532D] focus:ring-2 focus:ring-[#CE532D]/15 transition-all"
                  />
                </div>
              </div>

              {/* Filtered Empty Notice */}
              {filteredTrips.length === 0 ? (
                <div className="bg-white border border-[#E7E0D5] rounded-2xl p-10 text-center">
                  <p className="font-display text-lg font-semibold text-[#181411] mb-1">
                    No matching Trips
                  </p>
                  <p className="text-sm text-[#73685E] mb-4">
                    Try clearing your search or switching the status filter.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setStatusFilter("all");
                      setQuery("");
                    }}
                    className="text-xs font-semibold text-[#CE532D] hover:underline"
                  >
                    Reset filters
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {filteredTrips.map((trip, idx) => {
                    const status = statusInfo(trip.status);
                    const route = tripRouteLabel(trip);
                    const plan = trip.plan;
                    const firstMessage = trip.conversation?.[0]?.content ?? "";
                    const missingFields = trip.clarification?.missingFields ?? [];
                    const dateStr = new Date(trip.createdAt).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    });

                    return (
                      <motion.article
                        key={trip._id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: Math.min(idx * 0.04, 0.25) }}
                        className="group relative bg-white border border-[#E7E0D5] hover:border-[#CE532D]/45 hover:shadow-[0_18px_40px_-24px_rgba(24,20,17,0.28)] hover:-translate-y-0.5 rounded-2xl overflow-hidden cursor-pointer transition-all flex flex-col justify-between"
                      >
                        {/* Top status accent line */}
                        <div className={`h-1 w-full ${TONE_STRIPE[status.tone]}`} />

                        <div className="px-4 py-3 md:p-5 flex-1 flex flex-col">
                          {/* Status + delete */}
                          <div className="flex items-center justify-between gap-2 mb-3.5">
                            <span
                              className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${TONE_BADGE[status.tone]}`}
                            >
                              {status.label}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => askDeleteTrip(e, trip._id)}
                              className="relative z-10 min-h-11 min-w-11 grid place-items-center text-[#73685E] hover:text-[#C82828] hover:bg-[#FEF2F2] p-1.5 rounded-lg transition-colors"
                              title="Delete trip"
                              aria-label={`Delete ${tripTitle(trip)}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" aria-hidden />
                            </button>
                          </div>

                          {/* Route + Title */}
                          {route && (
                            <p className="font-mono text-[11px] uppercase tracking-wider text-[#73685E] mb-1 truncate">
                              {route}
                            </p>
                          )}
                          <h3 className="font-display text-xl font-semibold text-[#181411] group-hover:text-[#CE532D] transition-colors leading-snug mb-2">
                            <Link href={tripLink(trip)} className="after:absolute after:inset-0">{tripTitle(trip)}</Link>
                          </h3>

                          {/* Planned Trip structured facts */}
                          {plan ? (
                            <div className="hidden md:flex space-y-3 mt-1 flex-1 flex-col justify-between">
                              <div className="flex flex-wrap gap-1.5 text-[11px] text-[#3B342E]">
                                {plan.check_in && plan.check_out && (
                                  <span className="inline-flex items-center gap-1 bg-[#FAF8F4] border border-[#E7E0D5] px-2 py-0.5 rounded-md">
                                    <Calendar className="w-3 h-3 text-[#73685E]" aria-hidden />
                                    {formatDateRange(plan.check_in, plan.check_out)}
                                  </span>
                                )}
                                {plan.request?.party_size && (
                                  <span className="inline-flex items-center gap-1 bg-[#FAF8F4] border border-[#E7E0D5] px-2 py-0.5 rounded-md">
                                    <Users className="w-3 h-3 text-[#73685E]" aria-hidden />
                                    {plan.request.party_size} Travelers
                                  </span>
                                )}
                                {plan.request?.travel_style && (
                                  <span className="capitalize bg-[#FCEEE8] text-[#B54320] px-2 py-0.5 rounded-md font-medium">
                                    {plan.request.travel_style}
                                  </span>
                                )}
                              </div>

                              {plan.estimated_cost && (
                                <div className="rounded-xl bg-[#FAF8F4] border border-[#E7E0D5] px-3.5 py-2.5 flex items-baseline justify-between gap-2">
                                  <div>
                                    <p className="text-[10px] uppercase tracking-wider font-semibold text-[#73685E]">
                                      Estimated Cost
                                    </p>
                                    <p className="font-mono text-base font-semibold text-[#15803D]">
                                      {formatInr(plan.estimated_cost.total)}
                                    </p>
                                  </div>
                                  {plan.request?.budget && (
                                    <p className="font-mono text-[11px] text-[#73685E] text-right">
                                      Budget {formatInr(plan.request.budget)}
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="space-y-2.5 mt-1 flex-1">
                              <p className="text-xs text-[#73685E] line-clamp-2 leading-relaxed">
                                {firstMessage || "Conversation started"}
                              </p>
                              {trip.status === "draft" && missingFields.length > 0 && (
                                <div className="flex flex-wrap gap-1 pt-1">
                                  {missingFields.slice(0, 4).map((field) => (
                                    <span
                                      key={field}
                                      className="text-[10px] font-medium text-[#B45309] bg-[#FEF7E6] border border-[#B45309]/15 px-2 py-0.5 rounded-md"
                                    >
                                      Needs {MISSING_FIELD_LABELS[field] ?? field}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Card Footer */}
                        <div className="px-4 py-2 md:px-5 md:py-3.5 bg-[#FDFBF7] border-t border-[#F2EDE4] flex items-center justify-between">
                          <span className="flex items-center gap-1.5 text-[11px] text-[#73685E]">
                            <Clock className="w-3.5 h-3.5" aria-hidden />
                            {dateStr}
                          </span>
                          <span className="text-xs font-semibold text-[#CE532D] flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                            {status.action}
                            <ChevronRight className="w-3.5 h-3.5" aria-hidden />
                          </span>
                        </div>
                      </motion.article>
                    );
                  })}
                </div>
              )}
            </section>
          )}
        </main>

        <ConfirmModal
          isOpen={confirmModal.open}
          title="Delete this Trip?"
          message="This permanently removes the Trip and its Conversation. It cannot be undone."
          confirmLabel="Delete"
          loading={deleting}
          onConfirm={confirmDelete}
          onCancel={() => setConfirmModal({ open: false, tripId: null })}
        />
        <FeedbackWidget page="/dashboard" />
      </div>
    </PageWrapper>
  );
}
