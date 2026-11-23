"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCheck, ChevronRight, Copy, LogOut, Plus, Search, Sparkles, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { getCurrentUser, logout } from "@/services/auth.service";
import { trackInteraction } from "@/services/event.service";
import { deleteTrip, getUserTrips } from "@/services/trip.service";
import { formatInr, statusInfo, tripLink, tripRouteLabel, tripTitle } from "@/lib/tripView";
import FeedbackWidget from "@/components/feedback/FeedbackWidget";
import AppHeader from "@/components/layout/AppHeader";
import BottomNav from "@/components/layout/BottomNav";
import { EXAMPLE_TRIPS } from "@/lib/exampleTrips";
import BrandLogo from "@/components/layout/BrandLogo";
import PageWrapper from "@/components/layout/PageWrapper";
import ConfirmModal from "@/components/ui/ConfirmModal";
import SegmentedControl from "@/components/ui/SegmentedControl";
import Skeleton from "@/components/ui/Skeleton";

const TONE_BADGE = {
  success: "bg-success-light text-success",
  warning: "bg-warning-light text-warning",
  danger: "bg-danger-light text-danger",
};

const FILTER_OPTIONS = [
  { id: "all", label: "All" },
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

const EXAMPLES_SHOWN_FIRST = 2;

function plannedSummary(plan) {
  const party = plan.request?.party_size;
  return [
    plan.nights ? `${plan.nights} ${plan.nights === 1 ? "night" : "nights"}` : null,
    party ? `${party} ${party === 1 ? "traveler" : "travelers"}` : null,
    plan.estimated_cost ? formatInr(plan.estimated_cost.total) : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

function TripCard({ trip, onDelete }) {
  const status = statusInfo(trip.status);
  const route = tripRouteLabel(trip);
  const missingFields = trip.clarification?.missingFields ?? [];

  return (
    <article className="group relative flex gap-3 rounded-2xl border border-border bg-surface p-4 transition-colors hover:border-primary/45">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2.5 py-0.5 text-label font-semibold ${TONE_BADGE[status.tone]}`}>
            {status.label}
          </span>
          {route && <span className="truncate text-label font-semibold uppercase tracking-wider text-muted">{route}</span>}
        </div>
        <h3 className="mt-1.5 font-display text-xl font-semibold leading-snug text-ink group-hover:text-primary">
          <Link href={tripLink(trip)} className="after:absolute after:inset-0">
            {tripTitle(trip)}
          </Link>
        </h3>
        {trip.plan ? (
          <p className="mt-0.5 text-sm text-muted">{plannedSummary(trip.plan)}</p>
        ) : (
          <p className="mt-0.5 line-clamp-2 text-sm text-muted">{trip.conversation?.[0]?.content || "Conversation started"}</p>
        )}
        {trip.status === "draft" && missingFields.length > 0 && (
          <p className="mt-1 text-sm font-medium text-warning">
            Needs {missingFields.map((field) => MISSING_FIELD_LABELS[field] ?? field).join(", ")}
          </p>
        )}
      </div>
      <div className="flex shrink-0 flex-col items-end justify-between">
        <button
          type="button"
          onClick={() => onDelete(trip._id)}
          className="relative z-10 grid size-tap place-items-center rounded-xl text-muted hover:bg-danger-light hover:text-danger"
          aria-label={`Delete ${tripTitle(trip)}`}
        >
          <Trash2 className="h-4 w-4" aria-hidden />
        </button>
        <span className="flex items-center gap-0.5 text-sm font-semibold text-primary">
          {status.action}
          <ChevronRight className="h-4 w-4" aria-hidden />
        </span>
      </div>
    </article>
  );
}

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
  const [showAllExamples, setShowAllExamples] = useState(false);

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

  const copyPrompt = (text, idx) => {
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
      <div className="min-h-screen bg-bg font-sans">
        <div className="flex h-14 items-center border-b border-border bg-bg px-4 sm:h-16 sm:px-6">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-8 w-24" />
          </div>
        </div>
        <div className="mx-auto max-w-6xl space-y-5 px-4 pt-6 sm:px-6 sm:pt-10">
          <Skeleton className="h-9 w-56" />
          <Skeleton className="h-12 w-full sm:w-48" />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (loadError) return (
    <main className="mx-auto max-w-md px-5 py-16">
      <h1 className="font-display text-3xl font-semibold">Couldn’t load your trips</h1>
      <p className="mt-2 text-base text-muted">Check your connection and try again.</p>
      <button type="button" onClick={loadPage} className="mt-4 min-h-tap rounded-xl bg-ink px-5 text-base font-semibold text-white">Try again</button>
    </main>
  );
  if (!user) return null;

  const firstName = user.name.split(" ")[0];
  const initial = firstName.charAt(0).toUpperCase();
  const examples = showAllExamples ? EXAMPLE_TRIPS : EXAMPLE_TRIPS.slice(0, EXAMPLES_SHOWN_FIRST);
  const filterOptions = FILTER_OPTIONS.filter((option) => option.id === "all" || counts[option.id] > 0).map(
    (option) => ({ value: option.id, label: option.label, count: counts[option.id] })
  );

  return (
    <PageWrapper>
      <div className="min-h-screen bg-bg pb-nav font-sans">
        <AppHeader
          left={<BrandLogo href="/dashboard" size="sm" />}
          right={
            <>
              {user.isAdmin && (
                <Link
                  href="/admin"
                  className="hidden min-h-tap items-center rounded-xl border border-border bg-surface px-4 text-sm font-semibold text-ink transition-colors hover:bg-bg-subtle lg:inline-flex"
                >
                  Admin
                </Link>
              )}
              <div className="hidden items-center gap-2 rounded-full border border-border bg-surface py-1 pl-1.5 pr-3 sm:flex">
                <span className="flex size-7 items-center justify-center rounded-full bg-ink text-xs font-semibold text-bg">
                  {initial}
                </span>
                <span className="text-sm font-medium text-ink-soft">{firstName}</span>
              </div>
              <button
                type="button"
                aria-label="Sign out"
                onClick={handleLogout}
                className="flex min-h-tap min-w-tap items-center justify-center gap-1.5 rounded-xl text-sm font-semibold text-muted transition-colors hover:bg-bg-subtle hover:text-primary sm:px-3"
              >
                <LogOut className="h-4 w-4" aria-hidden />
                <span className="hidden sm:inline">Sign out</span>
              </button>
            </>
          }
        />

        <main className="mx-auto max-w-6xl px-4 pt-6 sm:px-6 sm:pt-10">
          <section className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
                {firstName}’s trips
              </h1>
              <p className="mt-1 text-base text-muted">
                {trips.length > 0
                  ? `${counts.planned} planned${counts.draft > 0 ? ` · ${counts.draft} waiting on details` : ""}${
                      counts.planning_failed > 0 ? ` · ${counts.planning_failed} to retry` : ""
                    }`
                  : "Describe a trip and get a plan in rupees in about a minute."}
              </p>
            </div>
            <button
              type="button"
              onClick={() => router.push("/trip/new")}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-primary px-5 text-base font-semibold text-white transition-colors hover:bg-primary-hover"
            >
              <Plus className="h-5 w-5" aria-hidden />
              Plan a new trip
            </button>
          </section>

          {trips.length === 0 && (
            <section className="space-y-3">
              <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink-soft">
                <Sparkles className="h-4 w-4 text-primary" aria-hidden />
                Or start from an example
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {examples.map((item, idx) => (
                  <div
                    key={item.title}
                    className="group relative flex items-start justify-between gap-3 rounded-2xl border border-border bg-surface p-4 transition-colors hover:border-primary/50"
                  >
                    <div className="min-w-0">
                      <p className="text-label font-semibold uppercase tracking-wider text-primary">{item.route}</p>
                      <p className="font-display text-lg font-semibold text-ink group-hover:text-primary">
                        <button type="button" onClick={() => launchStarter(item.prompt)} className="text-left after:absolute after:inset-0">
                          {item.title}
                        </button>
                      </p>
                      <p className="mt-0.5 text-sm text-muted">{item.meta}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyPrompt(item.prompt, idx)}
                      aria-label={`Copy prompt for ${item.title}`}
                      className="relative z-10 grid size-tap shrink-0 place-items-center rounded-xl border border-border bg-surface text-muted transition-colors hover:border-primary/40 hover:text-primary"
                    >
                      {copiedIdx === idx ? (
                        <CheckCheck className="h-4 w-4 text-success" aria-hidden />
                      ) : (
                        <Copy className="h-4 w-4" aria-hidden />
                      )}
                    </button>
                  </div>
                ))}
              </div>
              {!showAllExamples && EXAMPLE_TRIPS.length > EXAMPLES_SHOWN_FIRST && (
                <button
                  type="button"
                  onClick={() => setShowAllExamples(true)}
                  className="min-h-tap rounded-xl px-1 text-sm font-semibold text-primary hover:underline"
                >
                  See more examples
                </button>
              )}
            </section>
          )}

          {trips.length > 0 && (
            <section className="space-y-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <SegmentedControl
                  label="Filter Trips by status"
                  options={filterOptions}
                  value={statusFilter}
                  onChange={setStatusFilter}
                  className="-mx-4 px-4 md:mx-0 md:px-0"
                />
                <div className="relative w-full md:w-72">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search destination or style"
                    aria-label="Filter saved Trips"
                    className="min-h-tap w-full rounded-xl border border-border bg-surface pl-10 pr-3.5 text-base text-ink placeholder-faint focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
                  />
                </div>
              </div>

              {filteredTrips.length === 0 ? (
                <div className="rounded-2xl border border-border bg-surface p-8 text-center">
                  <p className="mb-1 font-display text-lg font-semibold text-ink">No matching Trips</p>
                  <p className="mb-3 text-base text-muted">Try clearing your search or switching the filter.</p>
                  <button
                    type="button"
                    onClick={() => {
                      setStatusFilter("all");
                      setQuery("");
                    }}
                    className="min-h-tap px-2 text-sm font-semibold text-primary hover:underline"
                  >
                    Reset filters
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {filteredTrips.map((trip) => (
                    <TripCard key={trip._id} trip={trip} onDelete={(tripId) => setConfirmModal({ open: true, tripId })} />
                  ))}
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
        <BottomNav page="/dashboard" isAdmin={user.isAdmin} />
      </div>
    </PageWrapper>
  );
}
