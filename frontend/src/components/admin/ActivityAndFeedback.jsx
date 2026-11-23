"use client";

import { useMemo, useState } from "react";
import { Activity, MessageSquareHeart } from "lucide-react";
import {
  formatDeviceLabel,
  formatLatency,
  formatPlace,
  formatShortDate,
} from "@/lib/adminAnalytics";

const CARD =
  "bg-white border border-[#E7E0D5] rounded-2xl p-5 shadow-[0_8px_24px_-20px_rgba(24,20,17,0.16)]";
const EYEBROW = "text-[11px] font-semibold uppercase tracking-wider text-[#73685E]";

const EVENT_LABELS = {
  pageview: "Viewed a page",
  signup: "Signed up",
  login: "Logged in",
  trip_plan_requested: "Asked for a plan",
  trip_clarification_requested: "Got clarification",
  trip_planned: "Got a Trip Plan",
  trip_plan_failed: "Planning failed",
  trip_viewed: "Opened a Trip",
  trip_deleted: "Deleted a Trip",
  trip_shared: "Shared a Trip",
  shared_trip_viewed: "Opened a shared Trip",
  feedback_submitted: "Sent feedback",
  feature_interaction: "Used feature",
};

const INTERACTION_LABELS = {
  map_style_changed: "Switched map style",
  map_fullscreen_opened: "Opened fullscreen map",
  map_pin_focused: "Focused map pin",
  map_day_filtered: "Filtered map day",
  map_layer_toggled: "Toggled map layer",
  map_reset_view: "Reset map bounds",
  map_google_maps_opened: "Opened Google Maps",
  trip_tab_viewed: "Viewed Trip tab",
  hotel_deal_clicked: "Clicked stay link",
  brief_builder_submitted: "Submitted Guided Brief",
  brief_builder_prefilled: "Edited Brief in chat",
  starter_trip_selected: "Picked starter Trip",
  clarification_inline_submitted: "Sent inline details",
};

const EVENT_GROUPS = [
  { id: "all", label: "All" },
  { id: "planning", label: "Planning" },
  { id: "interactions", label: "Map & UI" },
  { id: "auth", label: "Auth" },
  { id: "shares", label: "Shares" },
  { id: "feedback", label: "Feedback" },
];

function matchesEventGroup(event, group) {
  if (group === "all") return true;
  if (group === "planning") {
    return [
      "trip_plan_requested",
      "trip_clarification_requested",
      "trip_planned",
      "trip_plan_failed",
      "trip_viewed",
      "trip_deleted",
    ].includes(event.type);
  }
  if (group === "interactions") return event.type === "feature_interaction";
  if (group === "auth") return event.type === "signup" || event.type === "login";
  if (group === "shares") {
    return event.type === "trip_shared" || event.type === "shared_trip_viewed";
  }
  if (group === "feedback") return event.type === "feedback_submitted";
  return true;
}

function eventToneDot(type) {
  if (type === "trip_planned" || type === "signup") return "bg-[#15803D]";
  if (type === "trip_plan_failed") return "bg-[#C82828]";
  if (type === "trip_clarification_requested" || type === "feedback_submitted") {
    return "bg-[#D97706]";
  }
  if (type === "feature_interaction" || type === "trip_shared") return "bg-[#CE532D]";
  return "bg-[#181411]/45";
}

function formatEventTitle(event) {
  if (event.type === "feature_interaction" && event.meta?.action) {
    const base = INTERACTION_LABELS[event.meta.action] ?? event.meta.action;
    return event.meta.value ? `${base} (${event.meta.value.replace(/_/g, " ")})` : base;
  }
  const base = EVENT_LABELS[event.type] ?? event.type;
  if (event.type === "trip_planned" && event.meta?.destination) {
    return `${base} · ${event.meta.destination}`;
  }
  return base;
}

export default function ActivityAndFeedback({
  recentEvents = [],
  feedback = [],
  feedbackSummary,
  showActivity = true,
}) {
  const [query, setQuery] = useState("");
  const [eventGroup, setEventGroup] = useState("all");
  const [ratingFilter, setRatingFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const filteredEvents = useMemo(
    () => recentEvents.filter((event) => matchesEventGroup(event, eventGroup)),
    [recentEvents, eventGroup]
  );

  const filteredFeedback = useMemo(
    () =>
      feedback.filter((item) => {
        const text = [item.message, item.page, item.category].join(" ").toLowerCase();
        if (!text.includes(query.trim().toLowerCase())) return false;
        if (ratingFilter !== "all" && item.rating !== Number(ratingFilter)) return false;
        if (categoryFilter !== "all" && (item.category || "general") !== categoryFilter) {
          return false;
        }
        return true;
      }),
    [feedback, ratingFilter, categoryFilter, query]
  );

  const dist = feedbackSummary?.distribution ?? { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const totalFeedback = feedbackSummary?.total ?? feedback.length;
  const categories = feedbackSummary?.byCategory ?? [];

  return (
    <section className={`grid grid-cols-1 ${showActivity ? "lg:grid-cols-2" : ""} gap-4`}>
      {/* Live Activity Feed */}
      {showActivity && (
        <div className={CARD}>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <p className={`${EYEBROW} flex items-center gap-1.5`}>
              <Activity className="w-3.5 h-3.5 text-[#CE532D]" aria-hidden />
              Recent Activity ({filteredEvents.length})
            </p>
            <div className="flex flex-wrap gap-1" role="group" aria-label="Filter activity events">
              {EVENT_GROUPS.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setEventGroup(g.id)}
                  aria-pressed={eventGroup === g.id}
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-colors ${
                    eventGroup === g.id
                      ? "bg-[#181411] border-[#181411] text-[#FAF8F4]"
                      : "bg-[#FAF8F4] border-[#E7E0D5] text-[#73685E] hover:text-[#181411]"
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          {filteredEvents.length === 0 ? (
            <p className="text-sm text-[#73685E] py-4">No matching events yet.</p>
          ) : (
            <ul className="divide-y divide-[#F2EDE4] text-sm max-h-[440px] overflow-y-auto pr-1">
              {filteredEvents.map((event, index) => (
                <li key={`${event.createdAt}-${index}`} className="py-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2 min-w-0">
                      <span
                        className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${eventToneDot(event.type)}`}
                        aria-hidden
                      />
                      <div className="min-w-0">
                        <span className="font-medium text-[#181411] text-xs">
                          {formatEventTitle(event)}
                          {event.path && (
                            <span className="font-mono text-[11px] text-[#73685E]">
                              {" "}
                              {event.path}
                            </span>
                          )}
                        </span>
                        <p className="text-[11px] text-[#73685E] mt-0.5">
                          {event.user ?? "Visitor"} · {formatPlace(event)} ·{" "}
                          {formatDeviceLabel(event.device)}
                          {event.referrer ? ` · via ${event.referrer}` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0 flex flex-col items-end gap-0.5">
                      <span className="text-[11px] text-[#73685E]">
                        {formatShortDate(event.createdAt)}
                      </span>
                      {Number.isFinite(event.durationMs) && event.durationMs > 0 && (
                        <span className="font-mono text-[10px] font-semibold text-[#B45309] bg-[#FEF7E6] px-1.5 py-0.2 rounded">
                          {formatLatency(event.durationMs)}
                        </span>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Feedback Analytics & Anonymous Log */}
      <div className={CARD}>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <p className={`${EYEBROW} flex items-center gap-1.5`}>
            <MessageSquareHeart className="w-3.5 h-3.5 text-[#CE532D]" aria-hidden />
            Feedback Intelligence ({filteredFeedback.length})
          </p>
          {feedbackSummary?.npsProxy !== null && feedbackSummary?.npsProxy !== undefined && (
            <span className="font-mono text-[11px] font-semibold bg-[#ECFDF3] text-[#15803D] border border-[#15803D]/15 px-2.5 py-0.5 rounded-full">
              NPS {feedbackSummary.npsProxy > 0 ? `+${feedbackSummary.npsProxy}` : feedbackSummary.npsProxy}
            </span>
          )}
        </div>

        {/* 5★ to 1★ Distribution Histogram */}
        {totalFeedback > 0 && (
          <div className="bg-[#FAF8F4] border border-[#E7E0D5] rounded-xl p-3.5 mb-3 space-y-1.5">
            {[5, 4, 3, 2, 1].map((star) => {
              const count = dist[star] ?? 0;
              const pct = totalFeedback > 0 ? Math.round((count / totalFeedback) * 100) : 0;
              const active = ratingFilter === String(star);
              return (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRatingFilter(active ? "all" : String(star))}
                  aria-pressed={active}
                  className={`w-full flex items-center gap-2 text-xs px-1.5 py-0.5 rounded-lg transition-colors ${
                    active ? "bg-white ring-1 ring-[#CE532D]" : "hover:bg-white/70"
                  }`}
                >
                  <span className="font-mono w-6 text-left text-[#3B342E]">{star}★</span>
                  <div className="flex-1 h-2 bg-[#E7E0D5] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#CE532D] rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="font-mono text-[11px] text-[#73685E] w-14 text-right">
                    {count} ({pct}%)
                  </span>
                </button>
              );
            })}
          </div>
        )}

        <input type="search" aria-label="Search feedback" placeholder="Search comments or pages" value={query}
          onChange={(e) => setQuery(e.target.value)} className="mb-3 min-h-11 w-full rounded-xl border border-border bg-surface-warm px-3 text-sm" />
        {/* Category Filter Chips */}
        {categories.length > 0 && (
          <div
            className="flex flex-wrap gap-1.5 mb-3"
            role="group"
            aria-label="Filter feedback by category"
          >
            <button
              type="button"
              onClick={() => setCategoryFilter("all")}
              aria-pressed={categoryFilter === "all"}
              className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full border ${
                categoryFilter === "all"
                  ? "bg-[#181411] border-[#181411] text-white"
                  : "bg-[#FAF8F4] border-[#E7E0D5] text-[#73685E]"
              }`}
            >
              All topics
            </button>
            {categories.map((row) => (
              <button
                key={row.category}
                type="button"
                onClick={() =>
                  setCategoryFilter(categoryFilter === row.category ? "all" : row.category)
                }
                aria-pressed={categoryFilter === row.category}
                className={`text-[10px] font-semibold capitalize px-2.5 py-0.5 rounded-full border ${
                  categoryFilter === row.category
                    ? "bg-[#CE532D] border-[#CE532D] text-white"
                    : "bg-[#FAF8F4] border-[#E7E0D5] text-[#3B342E] hover:border-[#D6CCC0]"
                }`}
              >
                {row.category} ({row.count})
              </button>
            ))}
          </div>
        )}

        {filteredFeedback.length === 0 ? (
          <p className="text-sm text-[#73685E] py-4">No feedback matching this filter.</p>
        ) : (
          <ul className="divide-y divide-[#F2EDE4] text-sm max-h-[340px] overflow-y-auto pr-1">
            {filteredFeedback.map((item, index) => (
              <li key={`${item.createdAt}-${index}`} className="py-2.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[#CE532D]" aria-label={`${item.rating} out of 5`}>
                      {"★".repeat(item.rating)}
                      <span className="text-[#E7E0D5]">{"★".repeat(5 - item.rating)}</span>
                    </span>
                    {item.category && (
                      <span className="capitalize text-[10px] font-semibold bg-[#FAF8F4] border border-[#E7E0D5] text-[#73685E] px-2 py-0.5 rounded-full">
                        {item.category}
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-[#73685E]">
                    {formatShortDate(item.createdAt)}
                  </span>
                </div>
                {item.message && (
                  <p className="text-xs text-[#3B342E] mt-1 leading-relaxed">{item.message}</p>
                )}
                {item.page && (
                  <p className="font-mono text-[10px] text-[#73685E] mt-0.5">{item.page}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
