"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import { getAdminOverview } from "@/services/admin.service";
import { normalizeAdminOverview } from "@/lib/adminAnalytics";
import AppHeader from "@/components/layout/AppHeader";
import BottomNav from "@/components/layout/BottomNav";
import BrandLogo from "@/components/layout/BrandLogo";
import SegmentedControl from "@/components/ui/SegmentedControl";
import Skeleton from "@/components/ui/Skeleton";
import ActivityAndFeedback from "./ActivityAndFeedback";
import ActivityHeatmap from "./ActivityHeatmap";
import AdminMasthead from "./AdminMasthead";
import AudienceBreakdown from "./AudienceBreakdown";
import ConversionFunnel from "./ConversionFunnel";
import FeatureEngagementPanel from "./FeatureEngagementPanel";
import KpiGrid from "./KpiGrid";
import RetentionCohortTable from "./RetentionCohortTable";
import TrafficTrendChart from "./TrafficTrendChart";
import TravelIntelligencePanel, { StatusDonut } from "./TravelIntelligencePanel";
import UsersTable from "./UsersTable";

const WORKSPACE_TABS = [
  { value: "overview", label: "Overview" },
  { value: "traffic", label: "Traffic & stages" },
  { value: "product", label: "TripMap & Product" },
  { value: "travel", label: "Travel Intelligence" },
  { value: "audience", label: "Audience & Retention" },
  { value: "users", label: "Users & Feedback" },
];

// Usage evidence & analytics command center for outside users, TripMap, Travel Intelligence and feedback.
export default function AdminPage() {
  const router = useRouter();
  const [days, setDays] = useState(30);
  const [activeTab, setActiveTab] = useState("overview");
  const [rawData, setRawData] = useState(null);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);

  const [revision, setRevision] = useState(0);
  const refresh = () => {
    setRefreshing(true);
    setRevision((value) => value + 1);
  };
  // A new section starts at its top when the tab row is already stuck under the header.
  const selectTab = (tab) => {
    setActiveTab(tab);
    const tabs = document.querySelector('[aria-label="Analytics sections"]')?.parentElement;
    const headerHeight = document.querySelector("header")?.offsetHeight ?? 0;
    if (tabs && tabs.getBoundingClientRect().top <= headerHeight + 1) {
      const masthead = document.querySelector("main section");
      const target = masthead ? masthead.getBoundingClientRect().bottom + window.scrollY - headerHeight : 0;
      if (window.scrollY > target) window.scrollTo({ top: target, behavior: "instant" });
    }
  };

  const changePeriod = (value) => {
    if (value === days) return;
    setRefreshing(true);
    setDays(value);
  };

  useEffect(() => {
    let cancelled = false;
    getAdminOverview(days)
      .then((overview) => {
        if (!cancelled) {
          setRawData({ overview, days });
          setRefreshing(false);
          setError(null);
          setLastUpdatedAt(Date.now());
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setRefreshing(false);
        const status = err.response?.status;
        if (status === 401) router.replace("/login");
        else setError(status === 403 ? "Admins only" : "Could not load usage data.");
      });
    return () => {
      cancelled = true;
    };
  }, [days, revision, router]);

  const header = (
    <AppHeader
      maxWidth="max-w-7xl"
      left={
        <button
          type="button"
          onClick={() => router.push("/dashboard")}
          aria-label="Back to trips"
          className="inline-flex min-h-tap min-w-tap items-center justify-center gap-1.5 rounded-xl text-sm font-semibold text-ink-soft hover:bg-bg-subtle hover:text-ink sm:px-3"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden />
          <span className="hidden sm:inline">Trips</span>
        </button>
      }
      center={<BrandLogo href="/dashboard" size="sm" subtitle="Admin" />}
    />
  );

  if (error) {
    return (
      <div className="min-h-screen bg-bg font-sans">
        {header}
        <div className="max-w-md mx-auto mt-24 bg-white border border-border rounded-3xl p-8 text-center shadow-sm">
          <ShieldAlert className="w-7 h-7 text-warning mx-auto mb-3" aria-hidden />
          <h2 className="font-display text-2xl font-semibold text-ink">{error}</h2>
          <p className="text-xs text-muted mt-2">
            {error === "Admins only" ? "Sign in with an admin account to view analytics." : "Check your connection and try again."}
          </p>
          {error !== "Admins only" && <button type="button" disabled={refreshing} onClick={refresh} className="mt-4 rounded-xl bg-ink px-4 py-3 text-sm text-white">Try again</button>}
        </div>
      </div>
    );
  }

  if (!rawData) {
    return (
      <div className="min-h-screen bg-bg font-sans">
        {header}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 space-y-5">
          <Skeleton className="h-44 w-full rounded-3xl" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }, (_, index) => (
              <Skeleton key={index} className="h-28 rounded-2xl" />
            ))}
          </div>
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  const data = normalizeAdminOverview(rawData.overview);
  const { stats, users, activity, feedback, feedbackSummary, trips, retention } = data;

  return (
    <div className="min-h-screen bg-bg font-sans pb-nav">
      {header}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        <AdminMasthead
          data={data}
          days={days}
          onDaysChange={changePeriod}
          onRefresh={refresh}
          refreshing={refreshing}
          lastUpdatedAt={lastUpdatedAt}
        />

        {/* Section tabs: one sticky row that scrolls sideways on phones */}
        <div className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-20 -mx-4 bg-bg sm:top-[calc(4rem+env(safe-area-inset-top))] sm:-mx-6">
          <SegmentedControl
            label="Analytics sections"
            variant="tabs"
            options={WORKSPACE_TABS}
            value={activeTab}
            onChange={selectTab}
            className="px-4 sm:px-6"
          />
        </div>

        {/* ── OVERVIEW (Executive Suite) ── */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            <KpiGrid stats={stats} daily={activity.daily} trips={trips} days={rawData.days} />

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              <div className="lg:col-span-8">
                <TrafficTrendChart daily={activity.daily} />
              </div>
              <div className="lg:col-span-4">
                <section className="h-full rounded-2xl border border-border bg-white p-4 sm:p-6">
                  <h2 className="mb-4 font-display text-2xl font-semibold">Trip outcomes</h2>
                  <StatusDonut planned={trips.plannedTrips} draft={trips.draftTrips} failed={trips.failedTrips} />
                </section>
              </div>
            </div>
          </div>
        )}

        {/* ── TRAFFIC & FUNNEL ── */}
        {activeTab === "traffic" && (
          <div className="space-y-6">
            <TrafficTrendChart daily={activity.daily} />
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              <div className="lg:col-span-5">
                <ConversionFunnel funnel={activity.funnel} />
              </div>
              <div className="lg:col-span-7">
                <ActivityHeatmap cells={activity.hourlyHeatmap} />
              </div>
            </div>
            <AudienceBreakdown activity={activity} expanded />
          </div>
        )}

        {/* ── TRIPMAP & PRODUCT ENGAGEMENT ── */}
        {activeTab === "product" && (
          <div className="space-y-6">
            <FeatureEngagementPanel featureEngagement={activity.featureEngagement} />
            <ActivityAndFeedback
              recentEvents={activity.recentEvents}
              feedback={feedback}
              feedbackSummary={feedbackSummary}
            />
          </div>
        )}

        {/* ── TRAVEL INTELLIGENCE ── */}
        {activeTab === "travel" && (
          <div className="space-y-6">
            <TravelIntelligencePanel trips={trips} showMap />
          </div>
        )}

        {/* ── AUDIENCE & RETENTION ── */}
        {activeTab === "audience" && (
          <div className="space-y-6">
            <RetentionCohortTable retention={retention} />
            <AudienceBreakdown activity={activity} expanded />
            <ActivityHeatmap cells={activity.hourlyHeatmap} />
          </div>
        )}

        {/* ── USERS & FEEDBACK ── */}
        {activeTab === "users" && (
          <div className="space-y-6">
            <UsersTable users={users} />
            <ActivityAndFeedback
              recentEvents={activity.recentEvents}
              feedback={feedback}
              feedbackSummary={feedbackSummary}
              showActivity={false}
            />
          </div>
        )}
      </main>
      <BottomNav page="/admin" isAdmin />
    </div>
  );
}
