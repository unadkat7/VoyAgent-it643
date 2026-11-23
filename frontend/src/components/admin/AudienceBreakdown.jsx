"use client";

import { useState } from "react";
import { Globe2, Link2, MonitorSmartphone, Share2 } from "lucide-react";

const CARD =
  "bg-white border border-[#E7E0D5] rounded-2xl p-5 shadow-[0_8px_24px_-20px_rgba(24,20,17,0.16)]";
const EYEBROW = "text-[11px] font-semibold uppercase tracking-wider text-[#73685E]";

function RankedBars({ rows, empty, barColor = "#CE532D" }) {
  const [expanded, setExpanded] = useState(false);
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (rows.length === 0) {
    return <p className="text-sm text-[#73685E]">{empty}</p>;
  }
  return (
    <>
    <ul className="space-y-2.5">
      {(expanded ? rows : rows.slice(0, 5)).map((row) => (
        <li key={row.key ?? row.label} className="text-xs">
          <div className="flex items-center justify-between gap-2 text-[#3B342E] mb-1">
            <span className="min-w-0 break-words font-medium">{row.label}</span>
            <span className="font-mono text-[#73685E] shrink-0">
              {row.meta ? `${row.meta} · ` : ""}
              <strong className="text-[#181411]">{row.value}</strong>
            </span>
          </div>
          <div className="h-1.5 bg-[#F2EDE4] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{ width: `${(row.value / max) * 100}%`, backgroundColor: barColor }}
            />
          </div>
        </li>
      ))}
    </ul>
    {rows.length > 5 && <button type="button" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}
      className="mt-2 min-h-11 text-sm font-semibold text-primary-hover">{expanded ? "Show fewer" : `View all (${rows.length})`}</button>}
    </>
  );
}

export default function AudienceBreakdown({ activity, expanded = false }) {
  const [geoTab, setGeoTab] = useState("countries");
  const [techTab, setTechTab] = useState("browsers");

  return (
    <section className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Geography Card */}
        <div className={CARD}>
          <div className="flex items-center justify-between gap-2 mb-3">
            <p className={`${EYEBROW} flex items-center gap-1.5`}>
              <Globe2 className="w-3.5 h-3.5 text-[#CE532D]" aria-hidden />
              Geography
            </p>
            <div className="flex gap-1 bg-[#FAF8F4] border border-[#E7E0D5] rounded-lg p-0.5">
              {["countries", "cities"].map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setGeoTab(tab)}
                  aria-pressed={geoTab === tab}
                  className={`text-[10px] font-semibold capitalize px-2 py-0.5 rounded-md ${
                    geoTab === tab
                      ? "bg-[#181411] text-white"
                      : "text-[#73685E] hover:text-[#181411]"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {geoTab === "countries" ? (
            <RankedBars
              empty="No location data yet."
              rows={activity.countries.map((row) => ({
                label: row.country,
                value: row.visitors,
              }))}
            />
          ) : (
            <RankedBars
              empty="No city data yet."
              rows={activity.cities.map((row) => ({
                key: `${row.city}-${row.country}`,
                label: [row.city, row.country].filter(Boolean).join(", "),
                value: row.visitors,
              }))}
            />
          )}
        </div>

        {/* Devices & Tech Card */}
        <div className={CARD}>
          <div className="flex items-center justify-between gap-2 mb-3">
            <p className={`${EYEBROW} flex items-center gap-1.5`}>
              <MonitorSmartphone className="w-3.5 h-3.5 text-[#CE532D]" aria-hidden />
              Devices &amp; Tech
            </p>
            <div className="flex gap-1 bg-[#FAF8F4] border border-[#E7E0D5] rounded-lg p-0.5">
              {[
                { id: "browsers", label: "Browsers" },
                { id: "os", label: "OS" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setTechTab(tab.id)}
                  aria-pressed={techTab === tab.id}
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${
                    techTab === tab.id
                      ? "bg-[#181411] text-white"
                      : "text-[#73685E] hover:text-[#181411]"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <h3 className="mb-2 text-sm font-semibold">Visitors by device</h3>
          <RankedBars empty="No device data in this period." rows={[...activity.devices]
            .sort((a, b) => b.visitors - a.visitors)
            .map((d) => ({ label: d.type ?? "Unknown", value: d.visitors }))} />

          <div className="pt-3 border-t border-[#F2EDE4]">
            {techTab === "browsers" ? (
              <RankedBars
                empty="No browser telemetry yet."
                barColor="#181411"
                rows={activity.browsers.map((row) => ({
                  label: row.browser,
                  value: row.visitors,
                }))}
              />
            ) : (
              <RankedBars
                empty="No OS telemetry yet."
                barColor="#B45309"
                rows={activity.operatingSystems.map((row) => ({
                  label: row.os,
                  value: row.visitors,
                }))}
              />
            )}
          </div>
        </div>

        {/* Most Viewed Shared Trips */}
        <div className={CARD}>
          <p className={`${EYEBROW} flex items-center gap-1.5 mb-3`}>
            <Share2 className="w-3.5 h-3.5 text-[#CE532D]" aria-hidden />
            Most Viewed Shared Trips
          </p>
          <RankedBars
            empty="No Trips shared yet."
            barColor="#15803D"
            rows={activity.topShared.map((row, idx) => ({
              key: `${row.destination ?? "Untitled"}-${idx}`,
              label: row.destination ?? "Untitled",
              value: row.shareViews,
              meta: "views",
            }))}
          />
        </div>
      </div>

      {/* Referrers & Top Pages Row */}
      {(expanded || activity.referrers.length > 0 || activity.topPages.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className={CARD}>
            <p className={`${EYEBROW} flex items-center gap-1.5 mb-3`}>
              <Link2 className="w-3.5 h-3.5 text-[#CE532D]" aria-hidden />
              Acquisition Sources (Referrers)
            </p>
            <RankedBars
              empty="No referrer data recorded yet."
              barColor="#CE532D"
              rows={activity.referrers.map((row) => ({
                label: row.source === "share_link" ? "Shared Trip Link" : row.source,
                value: row.visitors,
                meta: `${row.views} views`,
              }))}
            />
          </div>

          <div className={CARD}>
            <p className={`${EYEBROW} mb-3`}>Top Visited Pages</p>
            <RankedBars
              empty="No page views recorded yet."
              barColor="#181411"
              rows={activity.topPages.map((row) => ({
                label: row.path,
                value: row.views,
                meta: `${row.visitors} visitors`,
              }))}
            />
          </div>
        </div>
      )}
    </section>
  );
}
