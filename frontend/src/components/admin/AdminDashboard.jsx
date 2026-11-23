"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import { getAdminOverview } from "@/services/admin.service";
import AppHeader from "@/components/layout/AppHeader";
import BrandLogo from "@/components/layout/BrandLogo";
import Skeleton from "@/components/ui/Skeleton";

const RANGES = [7, 30, 90];

const EVENT_LABELS = {
  pageview: "Viewed a page",
  signup: "Signed up",
  login: "Logged in",
  trip_plan_requested: "Asked for a plan",
  trip_planned: "Got a Trip Plan",
  trip_plan_failed: "Planning failed",
  trip_viewed: "Opened a Trip",
  trip_deleted: "Deleted a Trip",
  trip_shared: "Shared a Trip",
  shared_trip_viewed: "Opened a shared Trip",
  feedback_submitted: "Sent feedback",
};

const CARD = "bg-white border border-[#E7E0D5] rounded-2xl p-5";
const HEADING = "text-[11px] font-semibold uppercase tracking-wider text-[#73685E] mb-3";

const formatDate = (value) =>
  value
    ? new Date(value).toLocaleString("en-IN", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

const place = ({ city, country }) => [city, country].filter(Boolean).join(", ") || "Unknown";
const deviceLabel = (device) =>
  device ? [device.type, device.os, device.browser].filter(Boolean).join(" · ") : "—";

function StatTile({ label, value, testId }) {
  return (
    <div className={CARD} data-testid={testId}>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-[#73685E]">{label}</p>
      <p className="font-mono text-3xl font-semibold text-[#181411] mt-2">{value}</p>
    </div>
  );
}

function DailyChart({ daily }) {
  const max = Math.max(1, ...daily.map((row) => row.visitors));
  return (
    <div className={CARD}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[#73685E]">
          Daily visitors and sign-ups
        </p>
        <p className="flex items-center gap-3 text-[11px] text-[#73685E]">
          <span className="inline-flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-[#CE532D]" /> Visitors
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-[#181411]" /> Sign-ups
          </span>
        </p>
      </div>
      <div className="flex items-end gap-[3px] h-40" role="img" aria-label="Daily visitors and sign-ups">
        {daily.map((row) => (
          <div
            key={row.day}
            className="flex-1 h-full flex flex-col justify-end relative group"
            title={`${row.day}: ${row.visitors} visitors, ${row.signups} sign-ups, ${row.tripsPlanned} Trips planned`}
          >
            <div
              className="bg-[#CE532D]/80 rounded-t-sm"
              style={{ height: `${(row.visitors / max) * 100}%` }}
            />
            {row.signups > 0 && (
              <div
                className="bg-[#181411] absolute bottom-0 left-1/4 right-1/4 rounded-t-sm"
                style={{ height: `${(Math.min(row.signups, max) / max) * 100}%` }}
              />
            )}
          </div>
        ))}
      </div>
      <div className="flex justify-between font-mono text-[10px] text-[#73685E] mt-1.5">
        <span>{daily[0]?.day}</span>
        <span>{daily.at(-1)?.day}</span>
      </div>
    </div>
  );
}

function BarList({ title, rows, empty }) {
  const max = Math.max(1, ...rows.map((row) => row.value));
  return (
    <div className={CARD}>
      <p className={HEADING}>{title}</p>
      {rows.length === 0 ? (
        <p className="text-sm text-[#73685E]">{empty}</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li key={row.label} className="text-sm">
              <div className="flex justify-between text-[#3B342E]">
                <span className="capitalize">{row.label}</span>
                <span className="font-mono">{row.value}</span>
              </div>
              <div className="h-1.5 bg-[#F2EDE4] rounded-full mt-1">
                <div
                  className="h-full bg-[#CE532D] rounded-full"
                  style={{ width: `${(row.value / max) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Usage evidence for the project: outside sign-ups, activity, devices, places and feedback.
export default function AdminPage() {
  const router = useRouter();
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    getAdminOverview(days)
      .then((overview) => {
        if (!cancelled) setData(overview);
      })
      .catch((err) => {
        if (cancelled) return;
        const status = err.response?.status;
        if (status === 401) router.replace("/login");
        else setError(status === 403 ? "Admins only" : "Could not load usage data.");
      });
    return () => {
      cancelled = true;
    };
  }, [days, router]);

  const header = (
    <AppHeader
      left={
        <button
          type="button"
          onClick={() => router.push("/dashboard")}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#73685E] hover:text-[#181411] bg-white border border-[#E7E0D5] px-3 py-1.5 rounded-xl transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" aria-hidden />
          Dashboard
        </button>
      }
      center={<BrandLogo href="/dashboard" size="sm" />}
    />
  );

  if (error) {
    return (
      <div className="min-h-screen bg-[#FAF8F4] font-sans">
        {header}
        <div className="max-w-md mx-auto mt-24 bg-white border border-[#E7E0D5] rounded-3xl p-8 text-center">
          <ShieldAlert className="w-6 h-6 text-[#B45309] mx-auto mb-3" aria-hidden />
          <h2 className="font-display text-2xl font-semibold text-[#181411]">{error}</h2>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-[#FAF8F4] font-sans">
        {header}
        <div className="max-w-6xl mx-auto px-6 pt-8 grid grid-cols-2 md:grid-cols-5 gap-4">
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="h-24" />
          ))}
          <Skeleton className="col-span-2 md:col-span-5 h-56" />
        </div>
      </div>
    );
  }

  const { stats, users, activity, feedback } = data;

  return (
    <div className="min-h-screen bg-[#FAF8F4] font-sans pb-24">
      {header}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-8 space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-semibold text-[#181411]">Usage</h1>
            <p className="text-sm text-[#73685E]">
              Outside users only: admin accounts are left out. Emails are masked.
            </p>
          </div>
          <div className="flex gap-1 bg-white border border-[#E7E0D5] rounded-xl p-1">
            {RANGES.map((range) => (
              <button
                key={range}
                type="button"
                onClick={() => setDays(range)}
                aria-pressed={days === range}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg ${
                  days === range ? "bg-[#181411] text-white" : "text-[#73685E] hover:text-[#181411]"
                }`}
              >
                {range} days
              </button>
            ))}
          </div>
        </div>

        <section className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <StatTile label="Outside accounts" value={stats.outsideAccounts} testId="stat-outside-accounts" />
          <StatTile label="Sign-ups, 7 days" value={stats.signupsLast7Days} />
          <StatTile label="Visitors, 7 days" value={stats.uniqueVisitors7d} />
          <StatTile label="Planned Trips" value={stats.outsidePlannedTrips} />
          <StatTile
            label="Feedback"
            value={`${stats.feedbackCount}${stats.averageRating ? ` · ${stats.averageRating}★` : ""}`}
          />
        </section>

        <DailyChart daily={activity.daily} />

        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <BarList
            title="Countries (visitors)"
            empty="No location data yet."
            rows={activity.countries.map((row) => ({ label: row.country, value: row.visitors }))}
          />
          <BarList
            title="Devices (visitors)"
            empty="No visits yet."
            rows={activity.devices.map((row) => ({ label: row.type ?? "unknown", value: row.visitors }))}
          />
          <BarList
            title="Most viewed shared Trips"
            empty="No Trips shared yet."
            rows={activity.topShared.map((row) => ({
              label: row.destination ?? "Untitled",
              value: row.shareViews,
            }))}
          />
        </section>

        <section className={CARD}>
          <p className={HEADING}>Users ({users.length})</p>
          {users.length === 0 ? (
            <p className="text-sm text-[#73685E]">No outside users yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-[11px] uppercase tracking-wider text-[#73685E]">
                  <tr>
                    <th className="py-2 pr-4">User</th>
                    <th className="py-2 pr-4">Joined</th>
                    <th className="py-2 pr-4">Trips (planned)</th>
                    <th className="py-2 pr-4">Last active</th>
                    <th className="py-2 pr-4">Location</th>
                    <th className="py-2">Device</th>
                  </tr>
                </thead>
                <tbody className="text-[#3B342E]">
                  {users.map((user) => (
                    <tr key={`${user.email}-${user.joinedAt}`} className="border-t border-[#F2EDE4]">
                      <td className="py-2 pr-4 font-mono text-xs">{user.email}</td>
                      <td className="py-2 pr-4">{formatDate(user.joinedAt)}</td>
                      <td className="py-2 pr-4 font-mono">
                        {user.trips} ({user.plannedTrips})
                      </td>
                      <td className="py-2 pr-4">{formatDate(user.lastActiveAt)}</td>
                      <td className="py-2 pr-4">{place(user)}</td>
                      <td className="py-2 capitalize">{deviceLabel(user.device)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className={CARD}>
            <p className={HEADING}>Recent activity</p>
            {activity.recentEvents.length === 0 ? (
              <p className="text-sm text-[#73685E]">Nothing yet.</p>
            ) : (
              <ul className="divide-y divide-[#F2EDE4] text-sm max-h-[420px] overflow-y-auto">
                {activity.recentEvents.map((event, index) => (
                  <li key={`${event.createdAt}-${index}`} className="py-2">
                    <div className="flex justify-between gap-3">
                      <span className="font-medium text-[#181411]">
                        {EVENT_LABELS[event.type] ?? event.type}
                        {event.path && <span className="font-mono text-xs text-[#73685E]"> {event.path}</span>}
                      </span>
                      <span className="text-xs text-[#73685E] shrink-0">{formatDate(event.createdAt)}</span>
                    </div>
                    <p className="text-xs text-[#73685E]">
                      {event.user ?? "Visitor"} · {place(event)} · {deviceLabel(event.device)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className={CARD}>
            <p className={HEADING}>Feedback log</p>
            {feedback.length === 0 ? (
              <p className="text-sm text-[#73685E]">No feedback yet.</p>
            ) : (
              <ul className="divide-y divide-[#F2EDE4] text-sm max-h-[420px] overflow-y-auto">
                {feedback.map((item, index) => (
                  <li key={`${item.createdAt}-${index}`} className="py-2">
                    <div className="flex justify-between gap-3">
                      <span className="text-[#CE532D]" aria-label={`${item.rating} out of 5`}>
                        {"★".repeat(item.rating)}
                        <span className="text-[#E7E0D5]">{"★".repeat(5 - item.rating)}</span>
                      </span>
                      <span className="text-xs text-[#73685E]">{formatDate(item.createdAt)}</span>
                    </div>
                    {item.message && <p className="text-[#3B342E] mt-0.5">{item.message}</p>}
                    {item.page && <p className="font-mono text-[11px] text-[#73685E]">{item.page}</p>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
