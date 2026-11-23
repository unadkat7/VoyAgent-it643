"use client";

import { Repeat, Users } from "lucide-react";
import { formatPercent } from "@/lib/adminAnalytics";

const CARD =
  "bg-white border border-border rounded-2xl p-5 shadow-[0_8px_24px_-20px_rgba(24,20,17,0.16)]";
const EYEBROW = "text-[11px] font-semibold uppercase tracking-wider text-muted";

function cohortTone(pct) {
  if (pct === null || pct === undefined) return "bg-transparent text-[#C7BDB2]";
  if (pct === 0) return "bg-bg text-faint";
  if (pct < 25) return "bg-primary-light text-primary-hover";
  if (pct < 50) return "bg-primary-border text-[#7A2910]";
  if (pct < 75) return "bg-primary/85 text-white";
  return "bg-ink text-bg";
}

export default function RetentionCohortTable({ retention }) {
  const { cohorts, stickiness, userSplit7d } = retention;
  const activeTotal = userSplit7d.newUsers + userSplit7d.returningUsers;

  return (
    <section className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      {/* Weekly Signup Cohort Heatmap */}
      <div className={`${CARD} min-w-0 lg:col-span-8`}>
        <div className="flex flex-wrap items-start justify-between gap-2 mb-4">
          <div>
            <p className={EYEBROW}>Weekly Retention Cohorts</p>
            <h3 className="font-display text-lg font-semibold text-ink flex items-center gap-1.5">
              <Repeat className="w-4 h-4 text-primary" aria-hidden />
              Signed-up travelers returning in Weeks 1–4
            </h3>
          </div>
          <span className="font-mono text-[11px] text-muted">
            Last {retention.weeks} weeks
          </span>
        </div>

        {cohorts.length === 0 ? (
          <p className="text-sm text-muted">Not enough cohort history yet.</p>
        ) : (
          <div className="max-w-full overflow-x-auto">
            <table className="w-full text-xs">
              <caption className="pb-2 text-left text-xs text-muted">Percent returning by week. A dash means the week is still ahead.</caption>
              <thead className="text-[10px] uppercase tracking-wider text-muted font-mono">
                <tr>
                  <th className="text-left py-2 pr-3">Cohort Week</th>
                  <th className="text-right py-2 px-2">Sign-ups</th>
                  <th className="text-center py-2 px-1.5">W0</th>
                  <th className="text-center py-2 px-1.5">W1</th>
                  <th className="text-center py-2 px-1.5">W2</th>
                  <th className="text-center py-2 px-1.5">W3</th>
                  <th className="text-center py-2 px-1.5">W4</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-bg-subtle">
                {cohorts.map((cohort) => (
                  <tr key={cohort.weekStart}>
                    <td className="py-1.5 pr-3 font-mono text-ink-soft whitespace-nowrap">
                      {cohort.weekStart}
                    </td>
                    <td className="py-1.5 px-2 font-mono font-semibold text-right text-ink">
                      {cohort.size}
                    </td>
                    {cohort.retention.map((pct, idx) => (
                      <td key={idx} className="py-1 px-1">
                        <div
                          className={`h-7 rounded-lg font-mono text-[11px] font-semibold flex items-center justify-center ${cohortTone(
                            pct
                          )}`}
                        >
                          {pct === null ? "·" : `${pct}%`}
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Stickiness & Returning Users */}
      <div className={`${CARD} lg:col-span-4 flex flex-col justify-between gap-4`}>
        <div>
          <p className={EYEBROW}>Engagement Stickiness</p>
          <h3 className="font-display text-lg font-semibold text-ink flex items-center gap-1.5 mb-4">
            <Users className="w-4 h-4 text-primary" aria-hidden />
            DAU / WAU / MAU
          </h3>

          <div className="grid grid-cols-3 gap-2 mb-4">
            {[
              { label: "DAU", value: stickiness.dau },
              { label: "WAU", value: stickiness.wau },
              { label: "MAU", value: stickiness.mau },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-xl bg-bg border border-border p-3 text-center"
              >
                <p className="font-mono text-[10px] uppercase tracking-wider text-muted">
                  {item.label}
                </p>
                <p className="font-mono text-xl font-semibold text-ink mt-0.5">
                  {item.value}
                </p>
              </div>
            ))}
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="flex items-center justify-between bg-bg border border-border rounded-xl px-3.5 py-2.5">
              <span className="text-ink-soft font-medium">DAU / WAU stickiness</span>
              <strong className="font-mono text-ink">
                {formatPercent(stickiness.dauWauRatio)}
              </strong>
            </div>
            <div className="flex items-center justify-between bg-bg border border-border rounded-xl px-3.5 py-2.5">
              <span className="text-ink-soft font-medium">WAU / MAU stickiness</span>
              <strong className="font-mono text-ink">
                {formatPercent(stickiness.wauMauRatio)}
              </strong>
            </div>
          </div>
        </div>

        {/* Active Signed-In Users: New vs Returning (7d) */}
        <div className="pt-4 border-t border-bg-subtle">
          <div className="flex justify-between text-xs mb-1.5">
            <span className="font-medium text-ink-soft">Active accounts (7d)</span>
            <span className="font-mono text-success font-semibold">
              {formatPercent(userSplit7d.returningPct)} returning
            </span>
          </div>
          <div className="h-2.5 rounded-full bg-bg-subtle overflow-hidden flex">
            <div
              className="bg-success h-full"
              style={{
                width: `${activeTotal > 0 ? (userSplit7d.returningUsers / activeTotal) * 100 : 0}%`,
              }}
            />
            <div
              className="bg-primary h-full"
              style={{
                width: `${activeTotal > 0 ? (userSplit7d.newUsers / activeTotal) * 100 : 0}%`,
              }}
            />
          </div>
          <div className="flex justify-between text-[11px] font-mono text-muted mt-1.5">
            <span>{userSplit7d.returningUsers} returning</span>
            <span>{userSplit7d.newUsers} new</span>
          </div>
        </div>
      </div>
    </section>
  );
}
