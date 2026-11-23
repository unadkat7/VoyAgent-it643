"use client";

import { useMemo, useState } from "react";
import { ArrowUpDown, Search, Users } from "lucide-react";
import {
  formatDeviceLabel,
  formatInr,
  formatPlace,
  formatShortDate,
} from "@/lib/adminAnalytics";

import useWideLayout from "@/lib/useWideLayout";

const TIERS = [
  { id: "all", label: "All" },
  { id: "power", label: "Power" },
  { id: "active", label: "Active" },
  { id: "explorer", label: "Explorer" },
  { id: "new", label: "New" },
];

const TIER_BADGE = {
  power: "bg-primary-light text-primary-hover border-primary-border",
  active: "bg-success-light text-success border-success/15",
  explorer: "bg-bg text-ink-soft border-border",
  new: "bg-warning-light text-warning border-warning/15",
};

export default function UsersTable({ users = [] }) {
  const wide = useWideLayout();
  const [query, setQuery] = useState("");
  const [tier, setTier] = useState("all");
  const [sortBy, setSortBy] = useState("joinedAt");
  const [sortDir, setSortDir] = useState("desc");

  const toggleSort = (key) => {
    if (sortBy === key) {
      setSortDir((prev) => (prev === "desc" ? "asc" : "desc"));
    } else {
      setSortBy(key);
      setSortDir("desc");
    }
  };

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const list = users.filter((u) => {
      if (tier !== "all" && (u.engagementTier ?? "explorer") !== tier) return false;
      if (!needle) return true;
      const haystack = [
        u.email,
        u.city ?? "",
        u.country ?? "",
        u.topDestination ?? "",
        u.signupSource ?? "",
        u.device?.browser ?? "",
        u.device?.os ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });

    const factor = sortDir === "asc" ? 1 : -1;
    return [...list].sort((a, b) => {
      if (sortBy === "trips" || sortBy === "plannedTrips" || sortBy === "avgBudgetInr") {
        return ((a[sortBy] ?? -1) - (b[sortBy] ?? -1)) * factor;
      }
      const aTime = a[sortBy] ? new Date(a[sortBy]).getTime() : 0;
      const bTime = b[sortBy] ? new Date(b[sortBy]).getTime() : 0;
      return (aTime - bTime) * factor;
    });
  }, [users, query, tier, sortBy, sortDir]);

  return (
    <section className="bg-white border border-border rounded-2xl p-5 shadow-[0_8px_24px_-20px_rgba(24,20,17,0.16)]">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
        <div>
          <p className="text-label font-semibold uppercase tracking-wider text-muted flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-primary" aria-hidden />
            Outside Users ({filtered.length}
            {filtered.length !== users.length ? ` of ${users.length}` : ""})
          </p>
          <p className="text-xs text-muted mt-0.5">
            Emails stay masked for privacy. Admin accounts are excluded.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1" role="group" aria-label="Filter users by tier">
            {TIERS.map((opt) => {
              const active = tier === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setTier(opt.id)}
                  aria-pressed={active}
                  className={`min-h-tap min-w-tap text-sm font-semibold px-3 rounded-full border transition-colors ${
                    active
                      ? "bg-ink border-ink text-bg"
                      : "bg-bg border-border text-muted hover:text-ink"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          <div className="relative w-full sm:w-56">
            <Search
              className="w-3.5 h-3.5 text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search email, city, dest..."
              aria-label="Search outside users"
              className="w-full bg-bg border border-border focus:bg-white focus:border-primary rounded-xl pl-8 pr-3 min-h-tap text-base text-ink placeholder-faint focus:outline-none transition-all"
            />
          </div>
        </div>
      </div>

      {users.length === 0 ? (
        <p className="text-sm text-muted">No outside users yet.</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted py-6 text-center">
          No outside users match your current filter.
        </p>
      ) : !wide ? (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <select aria-label="Sort users by" value={sortBy} className="min-h-11 rounded-lg border border-border px-2"
              onChange={(e) => setSortBy(e.target.value)}>
              <option value="joinedAt">Joined</option><option value="trips">Trips</option>
              <option value="avgBudgetInr">Average budget</option><option value="lastActiveAt">Last active</option>
            </select>
            <button type="button" onClick={() => toggleSort(sortBy)} className="min-h-11 rounded-lg px-2 text-xs font-semibold">
              {sortDir === "desc" ? "Descending" : "Ascending"}
            </button>
          </div>
          {filtered.map((user) => (
            <details key={`${user.email}-${user.joinedAt}`} className="rounded-xl border border-border px-3">
              <summary className="cursor-pointer py-3 text-sm font-semibold break-words"><span>{user.email}</span>
                <span className="ml-2 text-xs font-normal text-muted">{user.trips} trips</span>
              </summary>
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 border-t border-border py-3 text-xs">
                {Object.entries({
                  Tier: user.engagementTier ?? "explorer", Joined: formatShortDate(user.joinedAt),
                  "Last active": formatShortDate(user.lastActiveAt), "Planned trips": user.plannedTrips,
                  Destination: user.topDestination, "Average budget": user.avgBudgetInr ? formatInr(user.avgBudgetInr) : null,
                  Location: formatPlace(user), Device: formatDeviceLabel(user.device), Source: user.signupSource ?? "direct",
                }).map(([label, value]) => <div key={label} className="contents"><dt className="text-muted">{label}</dt><dd>{value ?? "—"}</dd></div>)}
              </dl>
            </details>
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-left text-label uppercase tracking-wider text-muted border-b border-border">
              <tr>
                <th className="py-2.5 pr-3">User &amp; Source</th>
                <th className="py-2.5 pr-3">Tier</th>
                <th className="py-2.5 pr-3">
                  <button
                    type="button"
                    onClick={() => toggleSort("joinedAt")}
                    className="inline-flex items-center gap-1 hover:text-ink"
                  >
                    Joined <ArrowUpDown className="w-3 h-3" aria-hidden />
                  </button>
                </th>
                <th className="py-2.5 pr-3">
                  <button
                    type="button"
                    onClick={() => toggleSort("plannedTrips")}
                    className="inline-flex items-center gap-1 hover:text-ink"
                  >
                    Trips <ArrowUpDown className="w-3 h-3" aria-hidden />
                  </button>
                </th>
                <th className="py-2.5 pr-3">Top Dest.</th>
                <th className="py-2.5 pr-3">
                  <button
                    type="button"
                    onClick={() => toggleSort("avgBudgetInr")}
                    className="inline-flex items-center gap-1 hover:text-ink"
                  >
                    Avg Budget <ArrowUpDown className="w-3 h-3" aria-hidden />
                  </button>
                </th>
                <th className="py-2.5 pr-3">
                  <button
                    type="button"
                    onClick={() => toggleSort("lastActiveAt")}
                    className="inline-flex items-center gap-1 hover:text-ink"
                  >
                    Last active <ArrowUpDown className="w-3 h-3" aria-hidden />
                  </button>
                </th>
                <th className="py-2.5">Location &amp; Device</th>
              </tr>
            </thead>
            <tbody className="text-ink-soft divide-y divide-bg-subtle">
              {filtered.map((user) => {
                const userTier = user.engagementTier ?? "explorer";
                const sourceLabel =
                  user.signupSource === "share_link"
                    ? "share link"
                    : user.signupSource ?? "direct";
                return (
                  <tr
                    key={`${user.email}-${user.joinedAt}`}
                    className="hover:bg-bg/70 transition-colors"
                  >
                    <td className="py-2.5 pr-3 whitespace-nowrap">
                      <p className="font-mono text-label font-medium text-ink">
                        {user.email}
                      </p>
                      <p className="font-mono text-label text-muted">via {sourceLabel}</p>
                    </td>
                    <td className="py-2.5 pr-3">
                      <span
                        className={`inline-block capitalize text-label font-semibold px-2 py-0.5 rounded-full border ${
                          TIER_BADGE[userTier] ?? TIER_BADGE.explorer
                        }`}
                      >
                        {userTier}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3 whitespace-nowrap">
                      {formatShortDate(user.joinedAt)}
                    </td>
                    <td className="py-2.5 pr-3 font-mono whitespace-nowrap">
                      <strong className="text-ink">{user.trips}</strong> ({user.plannedTrips})
                    </td>
                    <td className="py-2.5 pr-3 whitespace-nowrap">
                      {user.topDestination ?? "—"}
                    </td>
                    <td className="py-2.5 pr-3 font-mono whitespace-nowrap">
                      {user.avgBudgetInr ? formatInr(user.avgBudgetInr) : "—"}
                    </td>
                    <td className="py-2.5 pr-3 whitespace-nowrap">
                      {formatShortDate(user.lastActiveAt)}
                    </td>
                    <td className="py-2.5">
                      <p className="text-ink whitespace-nowrap">{formatPlace(user)}</p>
                      <p className="text-label text-muted capitalize truncate max-w-[200px]">
                        {formatDeviceLabel(user.device)}
                      </p>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
