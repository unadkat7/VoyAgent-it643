"use client";

import {
  Activity,
  Compass,
  Eye,
  Gauge,
  MessageSquareHeart,
  Share2,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  formatCompactNumber,
  formatDelta,
  formatLatency,
  formatPercent,
} from "@/lib/adminAnalytics";

function Sparkline({ values, color }) {
  if (!values || values.length < 2) return null;
  const width = 96;
  const height = 28;
  const max = Math.max(1, ...values);
  const step = width / (values.length - 1);
  const points = values
    .map((v, i) => `${(i * step).toFixed(1)},${(height - (v / max) * (height - 4) - 2).toFixed(1)}`)
    .join(" ");

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="hidden xl:block overflow-visible shrink-0"
      aria-hidden="true"
    >
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

function DeltaPill({ pct, labelSuffix }) {
  const delta = formatDelta(pct);
  if (!delta) return null;
  const toneClass =
    delta.tone === "positive"
      ? "bg-success-light text-success border-success/15"
      : delta.tone === "negative"
      ? "bg-danger-light text-danger border-danger/15"
      : "bg-bg-subtle text-muted border-border";

  return (
    <span
      className={`inline-flex items-center gap-0.5 text-label font-mono font-semibold px-2 py-0.5 rounded-full border ${toneClass}`}
    >
      {delta.tone === "positive" && <TrendingUp className="w-2.5 h-2.5" aria-hidden />}
      {delta.tone === "negative" && <TrendingDown className="w-2.5 h-2.5" aria-hidden />}
      {delta.label}
      {labelSuffix ? ` ${labelSuffix}` : ""}
    </span>
  );
}

export default function KpiGrid({ stats, daily, trips, days }) {
  const visitorSeries = daily.map((d) => d.visitors ?? 0);
  const signupSeries = daily.map((d) => d.signups ?? 0);
  const plannedSeries = daily.map((d) => d.tripsPlanned ?? 0);
  const shareSeries = daily.map((d) => (d.shares ?? 0) + (d.sharedViews ?? 0));

  const cards = [
    {
      label: "Outside Accounts",
      value: formatCompactNumber(stats.outsideAccounts),
      sub: `${stats.signupsLast7Days} in 7d · ${stats.signupsInPeriod} in ${days}d`,
      deltaPct: stats.signupsDeltaPct,
      icon: Users,
      accent: "#181411",
      sparkline: signupSeries,
      testId: "stat-outside-accounts",
    },
    {
      label: `Visitors (${days}d)`,
      value: formatCompactNumber(stats.visitorsInPeriod),
      sub: `${stats.uniqueVisitors7d} in 7d · ${formatCompactNumber(stats.pageviewsInPeriod)} views`,
      deltaPct: stats.visitorsDeltaPct,
      icon: Eye,
      accent: "#CE532D",
      sparkline: visitorSeries,
    },
    {
      label: "Planned Trips",
      value: formatCompactNumber(stats.outsidePlannedTrips),
      sub: `${formatPercent(stats.planSuccessRate)} success · ${stats.plannedInPeriod} in ${days}d`,
      deltaPct: stats.plannedDeltaPct,
      icon: Compass,
      accent: "#15803D",
      sparkline: plannedSeries,
    },
    {
      label: "Planning Speed",
      value: formatLatency(trips.planningHealth.avgLatencyMs ?? stats.avgPlanningLatencyMs),
      sub: `P95 ${formatLatency(trips.planningHealth.p95LatencyMs ?? stats.p95PlanningLatencyMs)} · ${
        trips.planningHealth.avgAttemptsToPlan
          ? `${trips.planningHealth.avgAttemptsToPlan} avg turns`
          : "no turns yet"
      }`,
      icon: Gauge,
      accent: "#B45309",
    },
    {
      label: "Shared Reach",
      value: formatCompactNumber(stats.totalShareViews),
      sub: `${stats.sharedTripsCount} shared links · ${formatPercent(stats.shareRate)} share rate`,
      icon: Share2,
      accent: "#CE532D",
      sparkline: shareSeries,
    },
    {
      label: "Feedback & NPS",
      value: `${stats.feedbackCount}${stats.averageRating ? ` · ${stats.averageRating}★` : ""}`,
      sub:
        stats.npsProxy !== null
          ? `NPS proxy ${stats.npsProxy > 0 ? `+${stats.npsProxy}` : stats.npsProxy} · ${stats.activeUsers7d} active 7d`
          : `${stats.activeUsers7d} active accounts in 7d`,
      icon: stats.feedbackCount > 0 ? MessageSquareHeart : Activity,
      accent: "#15803D",
    },
  ];

  return (
    <section className="grid grid-cols-2 lg:grid-cols-3 gap-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <article
            key={card.label}
            data-testid={card.testId}
            className="bg-white border border-border hover:border-border-strong rounded-2xl p-3 sm:p-5 shadow-[0_8px_24px_-20px_rgba(24,20,17,0.16)] transition-all flex flex-col justify-between gap-3"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="hidden sm:flex w-7 h-7 rounded-lg bg-bg border border-border items-center justify-center text-ink-soft">
                  <Icon className="w-3.5 h-3.5" aria-hidden />
                </span>
                <p className="text-label font-semibold uppercase tracking-wider text-muted">
                  {card.label}
                </p>
              </div>
              <DeltaPill pct={card.deltaPct} />
            </div>

            <div className="flex items-end justify-between gap-3">
              <div className="min-w-0">
                <p className="font-mono text-xl sm:text-3xl font-semibold text-ink tracking-tight">
                  {card.value}
                </p>
                <p className="text-xs text-muted mt-1 break-words">{card.sub}</p>
              </div>
              {card.sparkline && <Sparkline values={card.sparkline} color={card.accent} />}
            </div>
          </article>
        );
      })}
    </section>
  );
}
