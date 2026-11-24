// Pure formatting, normalization and export helpers for the Admin Dashboard.

import { formatInr } from "./tripView";

export function formatCompactNumber(value) {
  if (!Number.isFinite(value)) return "0";
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 10_000) return `${(value / 1_000).toFixed(1)}k`;
  return value.toLocaleString("en-IN");
}

export function formatPercent(value, fallback = "—") {
  if (!Number.isFinite(value)) return fallback;
  return `${Math.round(value * 10) / 10}%`;
}

export function formatLatency(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return "—";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function formatDelta(pct) {
  if (!Number.isFinite(pct)) return null;
  if (pct === 0) return { label: "0%", tone: "neutral" };
  return {
    label: `${pct > 0 ? "+" : ""}${Math.round(pct * 10) / 10}%`,
    tone: pct > 0 ? "positive" : "negative",
  };
}

export function formatShortDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatPlace({ city, country } = {}) {
  return [city, country].filter(Boolean).join(", ") || "Unknown";
}

export function formatDeviceLabel(device) {
  return device ? [device.type, device.os, device.browser].filter(Boolean).join(" · ") : "—";
}

// Neutralize spreadsheet formula prefixes (=, +, -, @, tab, CR) and quote RFC-4180 cells.
function escapeCsvCell(raw) {
  const text = raw === null || raw === undefined ? "" : String(raw);
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  if (/[",\n\r]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

export function buildUsersCsv(users = []) {
  const headers = [
    "User (Masked)",
    "Tier",
    "Joined",
    "Trips",
    "Planned",
    "Draft",
    "Failed",
    "Shared",
    "Share Views",
    "Avg Budget (INR)",
    "Top Destination",
    "Signup Source",
    "Last Active",
    "Location",
    "Device",
  ];
  const rows = users.map((u) => [
    u.email,
    u.engagementTier ?? "explorer",
    u.joinedAt ?? "",
    u.trips ?? 0,
    u.plannedTrips ?? 0,
    u.draftTrips ?? 0,
    u.failedTrips ?? 0,
    u.sharedTrips ?? 0,
    u.totalShareViews ?? 0,
    u.avgBudgetInr ?? "",
    u.topDestination ?? "",
    u.signupSource ?? "direct",
    u.lastActiveAt ?? "",
    formatPlace(u),
    formatDeviceLabel(u.device),
  ]);
  return [headers, ...rows].map((row) => row.map(escapeCsvCell).join(",")).join("\n");
}

export function buildDailyCsv(daily = []) {
  const headers = [
    "Date",
    "Visitors",
    "Pageviews",
    "Signups",
    "Plan Requests",
    "Trips Planned",
    "Clarifications",
    "Plan Failures",
    "Shares",
    "Shared Views",
    "UI Interactions",
  ];
  const rows = daily.map((d) => [
    d.day,
    d.visitors ?? 0,
    d.pageviews ?? 0,
    d.signups ?? 0,
    d.planRequests ?? 0,
    d.tripsPlanned ?? 0,
    d.clarifications ?? 0,
    d.planFailures ?? 0,
    d.shares ?? 0,
    d.sharedViews ?? 0,
    d.interactions ?? 0,
  ]);
  return [headers, ...rows].map((row) => row.map(escapeCsvCell).join(",")).join("\n");
}

// Formats a snapshot directly compatible with USAGE_EVIDENCE.md tables.
export function buildUsageEvidenceMarkdown(raw) {
  const data = normalizeAdminOverview(raw);
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const topCountries =
    data.activity.countries
      .slice(0, 3)
      .map((c) => `${c.country} (${c.visitors})`)
      .join(", ") || "—";
  const ratingText = data.stats.averageRating ? `${data.stats.averageRating}★` : "—";
  const feedbackCell = `${data.stats.feedbackCount} / ${ratingText}`;

  const snapshotRow = `| ${today} | ${data.stats.uniqueVisitors7d} | ${data.stats.outsideAccounts} | ${data.stats.outsidePlannedTrips} | ${feedbackCell} | ${topCountries} | docs/evidence/${today}-admin.png |`;

  const userRows = data.users.slice(0, 50).map((u) => {
    const joined = u.joinedAt ? new Date(u.joinedAt).toISOString().slice(0, 10) : "—";
    return `| ${joined} | ${u.email} | ${u.trips} (${u.plannedTrips}) | ${formatPlace(u)} | ${formatDeviceLabel(u.device)} |`;
  });

  const feedbackRows = data.feedback.slice(0, 50).map((f) => {
    const date = f.createdAt ? new Date(f.createdAt).toISOString().slice(0, 10) : "—";
    const msg = (f.message || "—").replace(/\|/g, "\\|").replace(/\n+/g, " ");
    return `| ${date} | ${f.rating}/5 | ${msg} |`;
  });

  return [
    "### Snapshot row",
    "| Date | Visitors, 7 days | Outside accounts | Planned Trips | Feedback (count / avg) | Top countries | Screenshot |",
    "|---|---|---|---|---|---|---|",
    snapshotRow,
    "",
    "### User list (masked)",
    "| Joined | User | Trips (planned) | Location | Device |",
    "|---|---|---|---|---|",
    ...(userRows.length ? userRows : ["| — | — | — | — | — |"]),
    "",
    "### Feedback log",
    "| Date | Rating | Message |",
    "|---|---|---|",
    ...(feedbackRows.length ? feedbackRows : ["| — | — | — |"]),
  ].join("\n");
}

export function triggerFileDownload(content, filename, mimeType = "text/plain;charset=utf-8") {
  if (typeof window === "undefined") return;
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Guarantees safe defaults if optional sections are omitted (e.g. partial responses or tests).
export function normalizeAdminOverview(raw = {}) {
  const stats = raw.stats ?? {};
  const activity = raw.activity ?? {};
  const feedback = Array.isArray(raw.feedback) ? raw.feedback : [];
  const users = Array.isArray(raw.users) ? raw.users : [];
  const trips = raw.trips ?? {};
  const retention = raw.retention ?? {};

  const fallbackDist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const item of feedback) {
    if (item.rating >= 1 && item.rating <= 5) fallbackDist[item.rating] += 1;
  }

  const fe = activity.featureEngagement ?? {};
  const tripMap = fe.tripMap ?? {};

  return {
    stats: {
      accounts: stats.accounts ?? 0,
      outsideAccounts: stats.outsideAccounts ?? 0,
      signupsLast7Days: stats.signupsLast7Days ?? 0,
      trips: stats.trips ?? 0,
      plannedTrips: stats.plannedTrips ?? 0,
      outsidePlannedTrips: stats.outsidePlannedTrips ?? 0,
      outsideTripsTotal: stats.outsideTripsTotal ?? stats.outsidePlannedTrips ?? 0,
      feedbackCount: stats.feedbackCount ?? feedback.length,
      averageRating: stats.averageRating ?? null,
      uniqueVisitors7d: stats.uniqueVisitors7d ?? 0,
      periodDays: stats.periodDays ?? activity.days ?? 30,
      visitorsInPeriod: stats.visitorsInPeriod ?? stats.uniqueVisitors7d ?? 0,
      visitorsPrevPeriod: stats.visitorsPrevPeriod ?? 0,
      visitorsDeltaPct: stats.visitorsDeltaPct ?? null,
      pageviewsInPeriod: stats.pageviewsInPeriod ?? 0,
      pageviewsPrevPeriod: stats.pageviewsPrevPeriod ?? 0,
      pageviewsDeltaPct: stats.pageviewsDeltaPct ?? null,
      signupsInPeriod: stats.signupsInPeriod ?? stats.signupsLast7Days ?? 0,
      signupsPrevPeriod: stats.signupsPrevPeriod ?? 0,
      signupsDeltaPct: stats.signupsDeltaPct ?? null,
      plannedInPeriod: stats.plannedInPeriod ?? stats.outsidePlannedTrips ?? 0,
      plannedPrevPeriod: stats.plannedPrevPeriod ?? 0,
      plannedDeltaPct: stats.plannedDeltaPct ?? null,
      activeUsers7d: stats.activeUsers7d ?? 0,
      activeUsers30d: stats.activeUsers30d ?? 0,
      planSuccessRate: stats.planSuccessRate ?? null,
      sharedTripsCount: stats.sharedTripsCount ?? 0,
      shareRate: stats.shareRate ?? null,
      totalShareViews: stats.totalShareViews ?? 0,
      avgPlanningLatencyMs: stats.avgPlanningLatencyMs ?? null,
      p95PlanningLatencyMs: stats.p95PlanningLatencyMs ?? null,
      npsProxy: stats.npsProxy ?? null,
      tripStatusBreakdown: stats.tripStatusBreakdown ?? {
        planned: stats.outsidePlannedTrips ?? 0,
        draft: 0,
        planning_failed: 0,
      },
    },
    users,
    activity: {
      days: activity.days ?? 30,
      daily: Array.isArray(activity.daily) ? activity.daily : [],
      countries: Array.isArray(activity.countries) ? activity.countries : [],
      cities: Array.isArray(activity.cities) ? activity.cities : [],
      devices: Array.isArray(activity.devices) ? activity.devices : [],
      browsers: Array.isArray(activity.browsers) ? activity.browsers : [],
      operatingSystems: Array.isArray(activity.operatingSystems) ? activity.operatingSystems : [],
      topPages: Array.isArray(activity.topPages) ? activity.topPages : [],
      referrers: Array.isArray(activity.referrers) ? activity.referrers : [],
      hourlyHeatmap: Array.isArray(activity.hourlyHeatmap) ? activity.hourlyHeatmap : [],
      eventBreakdown: Array.isArray(activity.eventBreakdown) ? activity.eventBreakdown : [],
      funnel: Array.isArray(activity.funnel) ? activity.funnel : [],
      topShared: Array.isArray(activity.topShared) ? activity.topShared : [],
      recentEvents: Array.isArray(activity.recentEvents) ? activity.recentEvents : [],
      featureEngagement: {
        tripMap: {
          totalInteractions: tripMap.totalInteractions ?? 0,
          uniqueVisitors: tripMap.uniqueVisitors ?? 0,
          adoptionRatePct: tripMap.adoptionRatePct ?? null,
          styles: Array.isArray(tripMap.styles) ? tripMap.styles : [],
          pinFocuses: Array.isArray(tripMap.pinFocuses) ? tripMap.pinFocuses : [],
          dayFilters: tripMap.dayFilters ?? 0,
          fullscreenOpens: tripMap.fullscreenOpens ?? 0,
          layerToggles: Array.isArray(tripMap.layerToggles) ? tripMap.layerToggles : [],
          resetViews: tripMap.resetViews ?? 0,
          googleMapsClicks: tripMap.googleMapsClicks ?? 0,
        },
        dossierTabs: Array.isArray(fe.dossierTabs) ? fe.dossierTabs : [],
        hotelOutbound: {
          bookingUrlClicks: fe.hotelOutbound?.bookingUrlClicks ?? 0,
          googleMapsClicks: fe.hotelOutbound?.googleMapsClicks ?? 0,
          totalClicks: fe.hotelOutbound?.totalClicks ?? 0,
          staysTabViews: fe.hotelOutbound?.staysTabViews ?? 0,
          staysTabCtrPct: fe.hotelOutbound?.staysTabCtrPct ?? null,
        },
        creationFlow: {
          briefBuilderSubmitted: fe.creationFlow?.briefBuilderSubmitted ?? 0,
          briefBuilderPrefilled: fe.creationFlow?.briefBuilderPrefilled ?? 0,
          starterDashboard: fe.creationFlow?.starterDashboard ?? 0,
          starterStudio: fe.creationFlow?.starterStudio ?? 0,
          clarificationInlineSubmitted: fe.creationFlow?.clarificationInlineSubmitted ?? 0,
        },
        // Trip chat and Draft/Final use; older stats responses have none, so the rows are hidden.
        tripChat: fe.tripChat
          ? {
              opens: fe.tripChat.opens ?? 0,
              chipUses: fe.tripChat.chipUses ?? 0,
              finalized: fe.tripChat.finalized ?? 0,
              backToDraft: fe.tripChat.backToDraft ?? 0,
              travelModePicks: fe.tripChat.travelModePicks ?? {},
              edits: fe.tripChat.edits ?? {},
            }
          : null,
      },
    },
    feedback,
    feedbackSummary: raw.feedbackSummary ?? {
      total: feedback.length,
      averageRating: stats.averageRating ?? null,
      npsProxy: stats.npsProxy ?? null,
      distribution: fallbackDist,
      byCategory: [],
      byPage: [],
    },
    trips: {
      days: trips.days ?? activity.days ?? 30,
      totalTrips: trips.totalTrips ?? stats.outsideTripsTotal ?? 0,
      plannedTrips: trips.plannedTrips ?? stats.outsidePlannedTrips ?? 0,
      draftTrips: trips.draftTrips ?? 0,
      failedTrips: trips.failedTrips ?? 0,
      sharedTrips: trips.sharedTrips ?? stats.sharedTripsCount ?? 0,
      topDestinations: Array.isArray(trips.topDestinations) ? trips.topDestinations : [],
      topOrigins: Array.isArray(trips.topOrigins) ? trips.topOrigins : [],
      topRoutes: Array.isArray(trips.topRoutes) ? trips.topRoutes : [],
      destinationPins: Array.isArray(trips.destinationPins) ? trips.destinationPins : [],
      travelStyles: Array.isArray(trips.travelStyles) ? trips.travelStyles : [],
      partySizes: Array.isArray(trips.partySizes) ? trips.partySizes : [],
      durationBuckets: Array.isArray(trips.durationBuckets) ? trips.durationBuckets : [],
      budgetAnalysis: {
        totalPlannedBudgetInr: trips.budgetAnalysis?.totalPlannedBudgetInr ?? 0,
        totalEstimatedCostInr: trips.budgetAnalysis?.totalEstimatedCostInr ?? 0,
        avgBudgetInr: trips.budgetAnalysis?.avgBudgetInr ?? null,
        medianBudgetInr: trips.budgetAnalysis?.medianBudgetInr ?? null,
        avgEstimatedCostInr: trips.budgetAnalysis?.avgEstimatedCostInr ?? null,
        avgUtilizationPct: trips.budgetAnalysis?.avgUtilizationPct ?? null,
        avgHotelSharePct: trips.budgetAnalysis?.avgHotelSharePct ?? null,
        avgFlightSharePct: trips.budgetAnalysis?.avgFlightSharePct ?? null,
        avgBufferSharePct: trips.budgetAnalysis?.avgBufferSharePct ?? null,
        bands: Array.isArray(trips.budgetAnalysis?.bands) ? trips.budgetAnalysis.bands : [],
      },
      priceSourceCoverage: {
        liveHotels: trips.priceSourceCoverage?.liveHotels ?? 0,
        estimatedHotels: trips.priceSourceCoverage?.estimatedHotels ?? 0,
        liveFlights: trips.priceSourceCoverage?.liveFlights ?? 0,
        estimatedFlights: trips.priceSourceCoverage?.estimatedFlights ?? 0,
        liveHotelPct: trips.priceSourceCoverage?.liveHotelPct ?? null,
        liveFlightPct: trips.priceSourceCoverage?.liveFlightPct ?? null,
        liveOverallPct: trips.priceSourceCoverage?.liveOverallPct ?? null,
      },
      planningHealth: {
        avgAttemptsToPlan: trips.planningHealth?.avgAttemptsToPlan ?? null,
        firstAttemptSuccessRate: trips.planningHealth?.firstAttemptSuccessRate ?? null,
        avgLatencyMs: trips.planningHealth?.avgLatencyMs ?? stats.avgPlanningLatencyMs ?? null,
        p50LatencyMs: trips.planningHealth?.p50LatencyMs ?? null,
        p95LatencyMs: trips.planningHealth?.p95LatencyMs ?? stats.p95PlanningLatencyMs ?? null,
        geocodedTrips: trips.planningHealth?.geocodedTrips ?? 0,
        geocodedCoveragePct: trips.planningHealth?.geocodedCoveragePct ?? null,
        topMissingFields: Array.isArray(trips.planningHealth?.topMissingFields)
          ? trips.planningHealth.topMissingFields
          : [],
        failureReasons: Array.isArray(trips.planningHealth?.failureReasons)
          ? trips.planningHealth.failureReasons
          : [],
      },
    },
    retention: {
      weeks: retention.weeks ?? 8,
      cohorts: Array.isArray(retention.cohorts) ? retention.cohorts : [],
      stickiness: {
        dau: retention.stickiness?.dau ?? 0,
        wau: retention.stickiness?.wau ?? 0,
        mau: retention.stickiness?.mau ?? 0,
        dauWauRatio: retention.stickiness?.dauWauRatio ?? null,
        wauMauRatio: retention.stickiness?.wauMauRatio ?? null,
      },
      userSplit7d: {
        newUsers: retention.userSplit7d?.newUsers ?? 0,
        returningUsers: retention.userSplit7d?.returningUsers ?? 0,
        returningPct: retention.userSplit7d?.returningPct ?? null,
      },
    },
  };
}

export { formatInr };
