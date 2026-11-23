"use client";

import { Repeat, Users } from "lucide-react";
import { formatPercent } from "@/lib/adminAnalytics";

const CARD =
  "bg-white border border-[#E7E0D5] rounded-2xl p-5 shadow-[0_8px_24px_-20px_rgba(24,20,17,0.16)]";
const EYEBROW = "text-[11px] font-semibold uppercase tracking-wider text-[#73685E]";

function cohortTone(pct) {
  if (pct === null || pct === undefined) return "bg-transparent text-[#C7BDB2]";
  if (pct === 0) return "bg-[#FAF8F4] text-[#A89E94]";
  if (pct < 25) return "bg-[#FCEEE8] text-[#B54320]";
  if (pct < 50) return "bg-[#F3CFC0] text-[#7A2910]";
  if (pct < 75) return "bg-[#CE532D]/85 text-white";
  return "bg-[#181411] text-[#FAF8F4]";
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
            <h3 className="font-display text-lg font-semibold text-[#181411] flex items-center gap-1.5">
              <Repeat className="w-4 h-4 text-[#CE532D]" aria-hidden />
              Signed-up travelers returning in Weeks 1–4
            </h3>
          </div>
          <span className="font-mono text-[11px] text-[#73685E]">
            Last {retention.weeks} weeks
          </span>
        </div>

        {cohorts.length === 0 ? (
          <p className="text-sm text-[#73685E]">Not enough cohort history yet.</p>
        ) : (
          <div className="max-w-full overflow-x-auto">
            <table className="w-full text-xs">
              <caption className="pb-2 text-left text-xs text-muted">Percent returning by week. A dash means the week is still ahead.</caption>
              <thead className="text-[10px] uppercase tracking-wider text-[#73685E] font-mono">
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
              <tbody className="divide-y divide-[#F2EDE4]">
                {cohorts.map((cohort) => (
                  <tr key={cohort.weekStart}>
                    <td className="py-1.5 pr-3 font-mono text-[#3B342E] whitespace-nowrap">
                      {cohort.weekStart}
                    </td>
                    <td className="py-1.5 px-2 font-mono font-semibold text-right text-[#181411]">
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
          <h3 className="font-display text-lg font-semibold text-[#181411] flex items-center gap-1.5 mb-4">
            <Users className="w-4 h-4 text-[#CE532D]" aria-hidden />
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
                className="rounded-xl bg-[#FAF8F4] border border-[#E7E0D5] p-3 text-center"
              >
                <p className="font-mono text-[10px] uppercase tracking-wider text-[#73685E]">
                  {item.label}
                </p>
                <p className="font-mono text-xl font-semibold text-[#181411] mt-0.5">
                  {item.value}
                </p>
              </div>
            ))}
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="flex items-center justify-between bg-[#FAF8F4] border border-[#E7E0D5] rounded-xl px-3.5 py-2.5">
              <span className="text-[#3B342E] font-medium">DAU / WAU stickiness</span>
              <strong className="font-mono text-[#181411]">
                {formatPercent(stickiness.dauWauRatio)}
              </strong>
            </div>
            <div className="flex items-center justify-between bg-[#FAF8F4] border border-[#E7E0D5] rounded-xl px-3.5 py-2.5">
              <span className="text-[#3B342E] font-medium">WAU / MAU stickiness</span>
              <strong className="font-mono text-[#181411]">
                {formatPercent(stickiness.wauMauRatio)}
              </strong>
            </div>
          </div>
        </div>

        {/* Active Signed-In Users: New vs Returning (7d) */}
        <div className="pt-4 border-t border-[#F2EDE4]">
          <div className="flex justify-between text-xs mb-1.5">
            <span className="font-medium text-[#3B342E]">Active accounts (7d)</span>
            <span className="font-mono text-[#15803D] font-semibold">
              {formatPercent(userSplit7d.returningPct)} returning
            </span>
          </div>
          <div className="h-2.5 rounded-full bg-[#F2EDE4] overflow-hidden flex">
            <div
              className="bg-[#15803D] h-full"
              style={{
                width: `${activeTotal > 0 ? (userSplit7d.returningUsers / activeTotal) * 100 : 0}%`,
              }}
            />
            <div
              className="bg-[#CE532D] h-full"
              style={{
                width: `${activeTotal > 0 ? (userSplit7d.newUsers / activeTotal) * 100 : 0}%`,
              }}
            />
          </div>
          <div className="flex justify-between text-[11px] font-mono text-[#73685E] mt-1.5">
            <span>{userSplit7d.returningUsers} returning</span>
            <span>{userSplit7d.newUsers} new</span>
          </div>
        </div>
      </div>
    </section>
  );
}
