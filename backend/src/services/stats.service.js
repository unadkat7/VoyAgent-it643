import { env } from "../config/env.js";
import { TRAVEL_MODES, TripStatus } from "../domain/trip.js";
import Event from "../models/event.model.js";
import Feedback from "../models/feedback.model.js";
import Trip from "../models/trip.model.js";
import User from "../models/user.model.js";
import { maskEmail } from "../utils/maskEmail.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;
const TIMEZONE = "Asia/Kolkata";
const LIST_LIMIT = 200;
const RECENT_EVENTS = 80;

const MAP_ACTIONS = new Set([
  "map_style_changed",
  "map_fullscreen_opened",
  "map_pin_focused",
  "map_day_filtered",
  "map_layer_toggled",
  "map_reset_view",
  "map_google_maps_opened",
]);

const DOSSIER_TABS = ["itinerary", "map", "hotels", "flights", "summary"];
const MAP_STYLE_KEYS = ["atlas", "satellite", "terrain"];

const dayKey = (date) => date.toLocaleDateString("en-CA", { timeZone: TIMEZONE });
const dayOf = (field) => ({ $dateToString: { format: "%Y-%m-%d", date: field, timezone: TIMEZONE } });
const countIf = (type) => ({ $sum: { $cond: [{ $eq: ["$type", type] }, 1, 0] } });
const distinctVisitors = { $size: "$visitors" };

// Admin accounts are not evidence of outside use, so every query filters them out.
export const insiderIds = () => User.find({ email: { $in: env.adminEmails } }).distinct("_id");

function round1(value) {
  return Number.isFinite(value) ? Math.round(value * 10) / 10 : null;
}

function pct(numerator, denominator) {
  if (!denominator || denominator <= 0) return null;
  return Math.round((numerator / denominator) * 1000) / 10;
}

function deltaPct(current, previous) {
  if (!previous) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function percentile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return Math.round(sorted[idx]);
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : Math.round(sorted[mid]);
}

function npsFromDistribution(dist, total) {
  if (!total) return null;
  const promoters = (dist[4] ?? 0) + (dist[5] ?? 0);
  const detractors = (dist[1] ?? 0) + (dist[2] ?? 0);
  return Math.round(((promoters - detractors) / total) * 100);
}

function engagementTier({ plannedTrips, trips, lastActiveAt, joinedAt }) {
  const now = Date.now();
  const ageDays = (now - new Date(joinedAt).getTime()) / DAY_MS;
  const activeRecently = lastActiveAt && now - new Date(lastActiveAt).getTime() <= 7 * DAY_MS;
  if (plannedTrips >= 3) return "power";
  if (plannedTrips >= 1) return "active";
  if (trips >= 1 || activeRecently) return "explorer";
  return ageDays <= 7 ? "new" : "explorer";
}

function cleanLabel(value) {
  if (typeof value !== "string") return "";
  return value.trim();
}

function titleKey(value) {
  return cleanLabel(value).toLowerCase();
}

export async function getOverviewStats(days = 30) {
  const insiders = await insiderIds();
  const outside = { userId: { $nin: insiders } };
  const now = Date.now();
  const weekAgo = new Date(now - 7 * DAY_MS);
  const monthAgo = new Date(now - 30 * DAY_MS);
  const periodStart = new Date(now - days * DAY_MS);
  const prevStart = new Date(now - days * 2 * DAY_MS);

  const [
    accounts,
    outsideAccounts,
    signupsLast7Days,
    trips,
    plannedTrips,
    outsidePlannedTrips,
    feedbackSummaryRows,
    visitors7d,
    signupsInPeriod,
    signupsPrevPeriod,
    plannedInPeriod,
    plannedPrevPeriod,
    periodEventRows,
    activeUsers7d,
    activeUsers30d,
    tripStatusRows,
    shareRows,
    latencyRows,
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ _id: { $nin: insiders } }),
    User.countDocuments({ _id: { $nin: insiders }, createdAt: { $gte: weekAgo } }),
    Trip.countDocuments(),
    Trip.countDocuments({ status: TripStatus.PLANNED }),
    Trip.countDocuments({ ...outside, status: TripStatus.PLANNED }),
    Feedback.aggregate([
      { $match: outside },
      { $group: { _id: "$rating", count: { $sum: 1 } } },
    ]),
    Event.distinct("visitorHash", { ...outside, type: "pageview", createdAt: { $gte: weekAgo } }),
    User.countDocuments({ _id: { $nin: insiders }, createdAt: { $gte: periodStart } }),
    User.countDocuments({
      _id: { $nin: insiders },
      createdAt: { $gte: prevStart, $lt: periodStart },
    }),
    Trip.countDocuments({
      ...outside,
      status: TripStatus.PLANNED,
      createdAt: { $gte: periodStart },
    }),
    Trip.countDocuments({
      ...outside,
      status: TripStatus.PLANNED,
      createdAt: { $gte: prevStart, $lt: periodStart },
    }),
    Event.aggregate([
      { $match: { ...outside, type: "pageview", createdAt: { $gte: prevStart } } },
      {
        $group: {
          _id: { $cond: [{ $gte: ["$createdAt", periodStart] }, "current", "previous"] },
          pageviews: { $sum: 1 },
          visitors: { $addToSet: "$visitorHash" },
        },
      },
      { $project: { pageviews: 1, visitors: distinctVisitors } },
    ]),
    Event.distinct("userId", { ...outside, userId: { $ne: null }, createdAt: { $gte: weekAgo } }),
    Event.distinct("userId", { ...outside, userId: { $ne: null }, createdAt: { $gte: monthAgo } }),
    Trip.aggregate([
      { $match: outside },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    Trip.aggregate([
      { $match: { ...outside, shareId: { $exists: true, $ne: null } } },
      {
        $group: {
          _id: null,
          sharedCount: { $sum: 1 },
          totalShareViews: { $sum: { $ifNull: ["$shareViews", 0] } },
        },
      },
    ]),
    Trip.find({ ...outside, planningLatencyMs: { $gt: 0 } })
      .select({ _id: 0, planningLatencyMs: 1 })
      .lean(),
  ]);

  const ratingDist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let feedbackCount = 0;
  let ratingSum = 0;
  for (const row of feedbackSummaryRows) {
    if (row._id >= 1 && row._id <= 5) {
      ratingDist[row._id] = row.count;
      feedbackCount += row.count;
      ratingSum += row._id * row.count;
    }
  }

  const periodMap = new Map(periodEventRows.map((row) => [row._id, row]));
  const currentPeriod = periodMap.get("current") ?? { pageviews: 0, visitors: 0 };
  const prevPeriod = periodMap.get("previous") ?? { pageviews: 0, visitors: 0 };

  const tripStatusBreakdown = {
    planned: 0,
    draft: 0,
    planning_failed: 0,
  };
  let outsideTripsTotal = 0;
  for (const row of tripStatusRows) {
    if (row._id in tripStatusBreakdown) {
      tripStatusBreakdown[row._id] = row.count;
    }
    outsideTripsTotal += row.count;
  }

  const sharedTripsCount = shareRows[0]?.sharedCount ?? 0;
  const totalShareViews = shareRows[0]?.totalShareViews ?? 0;

  const latencies = latencyRows
    .map((row) => row.planningLatencyMs)
    .filter((n) => Number.isFinite(n) && n > 0);
  const avgPlanningLatencyMs = latencies.length
    ? Math.round(latencies.reduce((sum, n) => sum + n, 0) / latencies.length)
    : null;
  const p95PlanningLatencyMs = percentile(latencies, 95);

  return {
    accounts,
    outsideAccounts,
    signupsLast7Days,
    trips,
    plannedTrips,
    outsidePlannedTrips,
    outsideTripsTotal,
    feedbackCount,
    averageRating: feedbackCount ? round1(ratingSum / feedbackCount) : null,
    uniqueVisitors7d: visitors7d.length,
    periodDays: days,
    visitorsInPeriod: currentPeriod.visitors,
    visitorsPrevPeriod: prevPeriod.visitors,
    visitorsDeltaPct: deltaPct(currentPeriod.visitors, prevPeriod.visitors),
    pageviewsInPeriod: currentPeriod.pageviews,
    pageviewsPrevPeriod: prevPeriod.pageviews,
    pageviewsDeltaPct: deltaPct(currentPeriod.pageviews, prevPeriod.pageviews),
    signupsInPeriod,
    signupsPrevPeriod,
    signupsDeltaPct: deltaPct(signupsInPeriod, signupsPrevPeriod),
    plannedInPeriod,
    plannedPrevPeriod,
    plannedDeltaPct: deltaPct(plannedInPeriod, plannedPrevPeriod),
    activeUsers7d: activeUsers7d.length,
    activeUsers30d: activeUsers30d.length,
    planSuccessRate: pct(tripStatusBreakdown.planned, outsideTripsTotal),
    sharedTripsCount,
    shareRate: pct(sharedTripsCount, tripStatusBreakdown.planned),
    totalShareViews,
    avgPlanningLatencyMs,
    p95PlanningLatencyMs,
    npsProxy: npsFromDistribution(ratingDist, feedbackCount),
    tripStatusBreakdown,
  };
}

export async function getUsersAnalytics() {
  const insiders = await insiderIds();
  const users = await User.find({ _id: { $nin: insiders } })
    .sort({ createdAt: -1 })
    .limit(LIST_LIMIT)
    .lean();
  const ids = users.map((user) => user._id);

  if (ids.length === 0) return [];

  const [tripStats, lastEvents] = await Promise.all([
    Trip.aggregate([
      { $match: { userId: { $in: ids } } },
      {
        $group: {
          _id: "$userId",
          trips: { $sum: 1 },
          plannedTrips: { $sum: { $cond: [{ $eq: ["$status", TripStatus.PLANNED] }, 1, 0] } },
          draftTrips: { $sum: { $cond: [{ $eq: ["$status", TripStatus.DRAFT] }, 1, 0] } },
          failedTrips: {
            $sum: { $cond: [{ $eq: ["$status", TripStatus.PLANNING_FAILED] }, 1, 0] },
          },
          sharedTrips: {
            $sum: { $cond: [{ $and: [{ $ne: ["$shareId", null] }, { $gt: ["$shareId", ""] }] }, 1, 0] },
          },
          totalShareViews: { $sum: { $ifNull: ["$shareViews", 0] } },
          budgets: {
            $push: {
              $cond: [
                { $eq: [{ $ifNull: ["$plan.estimated_cost.currency", "INR"] }, "INR"] },
                "$plan.request.budget",
                null,
              ],
            },
          },
          destinations: { $push: "$destination" },
        },
      },
    ]),
    Event.aggregate([
      { $match: { userId: { $in: ids } } },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: "$userId",
          lastActiveAt: { $first: "$createdAt" },
          country: { $first: "$country" },
          city: { $first: "$city" },
          device: { $first: "$device" },
        },
      },
    ]),
  ]);

  const tripsBy = new Map(tripStats.map((row) => [String(row._id), row]));
  const eventsBy = new Map(lastEvents.map((row) => [String(row._id), row]));

  return users.map((user) => {
    const tripRow = tripsBy.get(String(user._id));
    const last = eventsBy.get(String(user._id));
    const validBudgets = (tripRow?.budgets ?? []).filter((b) => Number.isFinite(b) && b > 0);
    const avgBudgetInr = validBudgets.length
      ? Math.round(validBudgets.reduce((sum, b) => sum + b, 0) / validBudgets.length)
      : null;

    const destCounts = new Map();
    for (const dest of tripRow?.destinations ?? []) {
      const cleaned = cleanLabel(dest);
      if (!cleaned) continue;
      destCounts.set(cleaned, (destCounts.get(cleaned) ?? 0) + 1);
    }
    let topDestination = null;
    let topCount = 0;
    for (const [dest, count] of destCounts) {
      if (count > topCount) {
        topDestination = dest;
        topCount = count;
      }
    }

    const lastActiveAt = last?.lastActiveAt ?? user.lastLoginAt ?? null;
    const trips = tripRow?.trips ?? 0;
    const plannedTrips = tripRow?.plannedTrips ?? 0;

    return {
      email: maskEmail(user.email),
      joinedAt: user.createdAt,
      trips,
      plannedTrips,
      draftTrips: tripRow?.draftTrips ?? 0,
      failedTrips: tripRow?.failedTrips ?? 0,
      sharedTrips: tripRow?.sharedTrips ?? 0,
      totalShareViews: tripRow?.totalShareViews ?? 0,
      avgBudgetInr,
      topDestination,
      signupSource: user.signupSource ?? "direct",
      lastLoginAt: user.lastLoginAt ?? null,
      lastActiveAt,
      country: last?.country ?? null,
      city: last?.city ?? null,
      device: last?.device ?? null,
      engagementTier: engagementTier({
        plannedTrips,
        trips,
        lastActiveAt,
        joinedAt: user.createdAt,
      }),
    };
  });
}

function buildFeatureEngagement(interactionRows, funnelTotals, planEditRows = []) {
  const tripChat = {
    opens: 0,
    chipUses: 0,
    finalized: 0,
    backToDraft: 0,
    travelModePicks: Object.fromEntries(TRAVEL_MODES.map((mode) => [mode, 0])),
    // Server-side outcomes of chat messages: answered, updated or needs_clarification.
    edits: Object.fromEntries(planEditRows.map((row) => [row._id ?? "unknown", row.count])),
  };
  const mapStyleCounts = Object.fromEntries(MAP_STYLE_KEYS.map((key) => [key, 0]));
  const pinFocusCounts = {
    activity: 0,
    hotel: 0,
    destination: 0,
    locate_from_itinerary: 0,
  };
  const layerCounts = { activities: 0, stays: 0 };
  const tabMap = new Map(DOSSIER_TABS.map((tab) => [tab, { tab, views: 0, visitors: 0 }]));

  let totalMapInteractions = 0;
  const mapVisitorHashes = new Set();
  let dayFilters = 0;
  let fullscreenOpens = 0;
  let resetViews = 0;
  let googleMapsClicks = 0;
  let hotelBookingClicks = 0;
  let hotelMapsClicks = 0;

  const creationFlow = {
    briefBuilderSubmitted: 0,
    briefBuilderPrefilled: 0,
    starterDashboard: 0,
    starterStudio: 0,
    clarificationInlineSubmitted: 0,
  };

  for (const row of interactionRows) {
    const action = row.action;
    const value = row.value ?? "";
    const count = row.count ?? 0;
    const visitors = row.visitors ?? [];

    if (MAP_ACTIONS.has(action)) {
      totalMapInteractions += count;
      for (const hash of visitors) mapVisitorHashes.add(hash);
    }

    switch (action) {
      case "map_style_changed":
        if (value in mapStyleCounts) mapStyleCounts[value] += count;
        break;
      case "map_pin_focused":
        if (value in pinFocusCounts) pinFocusCounts[value] += count;
        else pinFocusCounts.activity += count;
        break;
      case "map_day_filtered":
        dayFilters += count;
        break;
      case "map_fullscreen_opened":
        fullscreenOpens += count;
        break;
      case "map_layer_toggled":
        if (value in layerCounts) layerCounts[value] += count;
        break;
      case "map_reset_view":
        resetViews += count;
        break;
      case "map_google_maps_opened":
        googleMapsClicks += count;
        break;
      case "trip_tab_viewed": {
        if (value === "map") {
          for (const hash of visitors) mapVisitorHashes.add(hash);
        }
        const entry = tabMap.get(value);
        if (entry) {
          entry.views += count;
          entry.visitors += visitors.length;
        }
        break;
      }
      case "hotel_deal_clicked":
        if (value === "booking_url") hotelBookingClicks += count;
        else hotelMapsClicks += count;
        break;
      case "brief_builder_submitted":
        creationFlow.briefBuilderSubmitted += count;
        break;
      case "brief_builder_prefilled":
        creationFlow.briefBuilderPrefilled += count;
        break;
      case "starter_trip_selected":
        if (value === "dashboard") creationFlow.starterDashboard += count;
        else creationFlow.starterStudio += count;
        break;
      case "clarification_inline_submitted":
        creationFlow.clarificationInlineSubmitted += count;
        break;
      case "trip_chat_opened":
        tripChat.opens += count;
        break;
      case "chat_chip_used":
        tripChat.chipUses += count;
        break;
      case "travel_mode_selected":
        if (value in tripChat.travelModePicks) tripChat.travelModePicks[value] += count;
        break;
      case "plan_stage_changed":
        if (value === "final") tripChat.finalized += count;
        else tripChat.backToDraft += count;
        break;
      default:
        break;
    }
  }

  const tripViewVisitors = funnelTotals.tripViewVisitors ?? 0;
  const staysTabViews = tabMap.get("hotels")?.views ?? 0;
  const totalHotelClicks = hotelBookingClicks + hotelMapsClicks;

  return {
    tripMap: {
      totalInteractions: totalMapInteractions,
      uniqueVisitors: mapVisitorHashes.size,
      adoptionRatePct: pct(mapVisitorHashes.size, tripViewVisitors),
      styles: MAP_STYLE_KEYS.map((style) => ({ style, count: mapStyleCounts[style] })),
      pinFocuses: [
        { kind: "activity", count: pinFocusCounts.activity },
        { kind: "hotel", count: pinFocusCounts.hotel },
        { kind: "destination", count: pinFocusCounts.destination },
        { kind: "locate_from_itinerary", count: pinFocusCounts.locate_from_itinerary },
      ],
      dayFilters,
      fullscreenOpens,
      layerToggles: [
        { layer: "activities", count: layerCounts.activities },
        { layer: "stays", count: layerCounts.stays },
      ],
      resetViews,
      googleMapsClicks,
    },
    dossierTabs: DOSSIER_TABS.map((tab) => tabMap.get(tab)),
    hotelOutbound: {
      bookingUrlClicks: hotelBookingClicks,
      googleMapsClicks: hotelMapsClicks,
      totalClicks: totalHotelClicks,
      staysTabViews,
      staysTabCtrPct: pct(totalHotelClicks, staysTabViews),
    },
    creationFlow,
    tripChat,
  };
}

export async function getActivityAnalytics(days = 30) {
  const now = Date.now();
  const since = new Date(now - days * DAY_MS);
  const insiders = await insiderIds();

  const [signups, [events], topShared] = await Promise.all([
    User.aggregate([
      { $match: { _id: { $nin: insiders }, createdAt: { $gte: since } } },
      { $group: { _id: dayOf("$createdAt"), count: { $sum: 1 } } },
    ]),
    Event.aggregate([
      { $match: { userId: { $nin: insiders }, createdAt: { $gte: since } } },
      {
        $facet: {
          byDay: [
            {
              $group: {
                _id: dayOf("$createdAt"),
                pageviews: countIf("pageview"),
                tripsPlanned: countIf("trip_planned"),
                planRequests: countIf("trip_plan_requested"),
                planFailures: countIf("trip_plan_failed"),
                planEdits: countIf("trip_plan_edited"),
                rejectedInputs: countIf("trip_input_rejected"),
                clarifications: countIf("trip_clarification_requested"),
                shares: countIf("trip_shared"),
                sharedViews: countIf("shared_trip_viewed"),
                interactions: countIf("feature_interaction"),
                visitors: { $addToSet: "$visitorHash" },
              },
            },
            {
              $project: {
                pageviews: 1,
                tripsPlanned: 1,
                planRequests: 1,
                planFailures: 1,
                planEdits: 1,
                clarifications: 1,
                rejectedInputs: 1,
                shares: 1,
                sharedViews: 1,
                interactions: 1,
                visitors: distinctVisitors,
              },
            },
          ],
          planEditOutcomes: [
            { $match: { type: "trip_plan_edited" } },
            { $group: { _id: "$meta.outcome", count: { $sum: 1 } } },
          ],
          countries: [
            { $match: { country: { $ne: null } } },
            { $group: { _id: "$country", visitors: { $addToSet: "$visitorHash" } } },
            { $project: { _id: 0, country: "$_id", visitors: distinctVisitors } },
            { $sort: { visitors: -1, country: 1 } },
            { $limit: 10 },
          ],
          cities: [
            { $match: { city: { $ne: null } } },
            {
              $group: {
                _id: { city: "$city", country: "$country" },
                visitors: { $addToSet: "$visitorHash" },
              },
            },
            {
              $project: {
                _id: 0,
                city: "$_id.city",
                country: "$_id.country",
                visitors: distinctVisitors,
              },
            },
            { $sort: { visitors: -1, city: 1 } },
            { $limit: 10 },
          ],
          devices: [
            { $group: { _id: "$device.type", visitors: { $addToSet: "$visitorHash" } } },
            { $project: { _id: 0, type: "$_id", visitors: distinctVisitors } },
            { $sort: { visitors: -1, type: 1 } },
          ],
          browsers: [
            { $match: { "device.browser": { $ne: null } } },
            { $group: { _id: "$device.browser", visitors: { $addToSet: "$visitorHash" } } },
            { $project: { _id: 0, browser: "$_id", visitors: distinctVisitors } },
            { $sort: { visitors: -1, browser: 1 } },
            { $limit: 8 },
          ],
          operatingSystems: [
            { $match: { "device.os": { $ne: null } } },
            { $group: { _id: "$device.os", visitors: { $addToSet: "$visitorHash" } } },
            { $project: { _id: 0, os: "$_id", visitors: distinctVisitors } },
            { $sort: { visitors: -1, os: 1 } },
            { $limit: 8 },
          ],
          topPages: [
            { $match: { type: "pageview", path: { $ne: null } } },
            {
              $group: {
                _id: "$path",
                views: { $sum: 1 },
                visitors: { $addToSet: "$visitorHash" },
              },
            },
            { $project: { _id: 0, path: "$_id", views: 1, visitors: distinctVisitors } },
            { $sort: { views: -1, path: 1 } },
            { $limit: 10 },
          ],
          referrers: [
            { $match: { type: "pageview" } },
            {
              $group: {
                _id: { $ifNull: ["$referrer", "direct"] },
                views: { $sum: 1 },
                visitors: { $addToSet: "$visitorHash" },
              },
            },
            { $project: { _id: 0, source: "$_id", views: 1, visitors: distinctVisitors } },
            { $sort: { visitors: -1, source: 1 } },
            { $limit: 10 },
          ],
          hourlyHeatmap: [
            {
              $group: {
                _id: {
                  dayOfWeek: { $dayOfWeek: { date: "$createdAt", timezone: TIMEZONE } },
                  hour: { $hour: { date: "$createdAt", timezone: TIMEZONE } },
                },
                count: { $sum: 1 },
              },
            },
            {
              $project: {
                _id: 0,
                dayOfWeek: { $subtract: ["$_id.dayOfWeek", 1] },
                hour: "$_id.hour",
                count: 1,
              },
            },
          ],
          eventBreakdown: [
            { $group: { _id: "$type", count: { $sum: 1 } } },
            { $project: { _id: 0, type: "$_id", count: 1 } },
            { $sort: { count: -1 } },
          ],
          funnelCounts: [
            {
              $group: {
                _id: null,
                visitors: { $addToSet: "$visitorHash" },
                signups: { $addToSet: { $cond: [{ $eq: ["$type", "signup"] }, "$userId", "$$REMOVE"] } },
                planRequesters: {
                  $addToSet: {
                    $cond: [{ $eq: ["$type", "trip_plan_requested"] }, "$userId", "$$REMOVE"],
                  },
                },
                planners: {
                  $addToSet: { $cond: [{ $eq: ["$type", "trip_planned"] }, "$userId", "$$REMOVE"] },
                },
                sharers: {
                  $addToSet: { $cond: [{ $eq: ["$type", "trip_shared"] }, "$userId", "$$REMOVE"] },
                },
                tripViewVisitors: {
                  $addToSet: {
                    $cond: [
                      { $in: ["$type", ["trip_viewed", "shared_trip_viewed"]] },
                      "$visitorHash",
                      "$$REMOVE",
                    ],
                  },
                },
              },
            },
            {
              $project: {
                _id: 0,
                visitors: { $size: "$visitors" },
                signups: { $size: "$signups" },
                planRequesters: { $size: "$planRequesters" },
                planners: { $size: "$planners" },
                sharers: { $size: "$sharers" },
                tripViewVisitors: { $size: "$tripViewVisitors" },
              },
            },
          ],
          interactions: [
            { $match: { type: "feature_interaction", "meta.action": { $ne: null } } },
            {
              $group: {
                _id: { action: "$meta.action", value: "$meta.value" },
                count: { $sum: 1 },
                visitors: { $addToSet: "$visitorHash" },
              },
            },
            {
              $project: {
                _id: 0,
                action: "$_id.action",
                value: "$_id.value",
                count: 1,
                visitors: 1,
              },
            },
          ],
          recent: [
            { $sort: { createdAt: -1 } },
            { $limit: RECENT_EVENTS },
            {
              $lookup: {
                from: "users",
                localField: "userId",
                foreignField: "_id",
                pipeline: [{ $project: { email: 1 } }],
                as: "user",
              },
            },
          ],
        },
      },
    ]),
    Trip.find({ shareId: { $exists: true, $ne: null }, userId: { $nin: insiders } })
      .sort({ shareViews: -1 })
      .limit(10)
      .select({ _id: 0, destination: 1, shareViews: 1 })
      .lean(),
  ]);

  const signupsBy = new Map(signups.map((row) => [row._id, row.count]));
  const eventsBy = new Map(events.byDay.map((row) => [row._id, row]));
  const daily = Array.from({ length: days }, (_, index) => {
    const day = dayKey(new Date(now - (days - 1 - index) * DAY_MS));
    const row = eventsBy.get(day);
    return {
      day,
      signups: signupsBy.get(day) ?? 0,
      tripsPlanned: row?.tripsPlanned ?? 0,
      pageviews: row?.pageviews ?? 0,
      visitors: row?.visitors ?? 0,
      planRequests: row?.planRequests ?? 0,
      planFailures: row?.planFailures ?? 0,
      planEdits: row?.planEdits ?? 0,
      rejectedInputs: row?.rejectedInputs ?? 0,
      clarifications: row?.clarifications ?? 0,
      shares: row?.shares ?? 0,
      sharedViews: row?.sharedViews ?? 0,
      interactions: row?.interactions ?? 0,
    };
  });

  const funnelTotals = events.funnelCounts[0] ?? {
    visitors: 0,
    signups: 0,
    planRequesters: 0,
    planners: 0,
    sharers: 0,
    tripViewVisitors: 0,
  };

  const funnelStepsRaw = [
    { key: "visitors", label: "Unique Visitors", count: funnelTotals.visitors },
    { key: "signups", label: "Signed Up", count: funnelTotals.signups },
    { key: "plan_requested", label: "Started Planning", count: funnelTotals.planRequesters },
    { key: "trip_planned", label: "Got a Trip Plan", count: funnelTotals.planners },
    { key: "trip_shared", label: "Shared a Trip", count: funnelTotals.sharers },
  ];

  const funnel = funnelStepsRaw.map((step, index) => {
    const prev = index === 0 ? step.count : funnelStepsRaw[index - 1].count;
    return {
      ...step,
      stepConversionPct: index === 0 ? 100 : pct(step.count, prev),
      overallConversionPct: pct(step.count, funnelStepsRaw[0].count),
    };
  });

  const featureEngagement = buildFeatureEngagement(
    events.interactions,
    funnelTotals,
    events.planEditOutcomes
  );

  return {
    days,
    daily,
    countries: events.countries,
    cities: events.cities,
    devices: events.devices,
    browsers: events.browsers,
    operatingSystems: events.operatingSystems,
    topPages: events.topPages,
    referrers: events.referrers,
    hourlyHeatmap: events.hourlyHeatmap,
    eventBreakdown: events.eventBreakdown,
    funnel,
    featureEngagement,
    topShared,
    recentEvents: events.recent.map((event) => ({
      type: event.type,
      path: event.path ?? null,
      referrer: event.referrer ?? null,
      durationMs: event.durationMs ?? null,
      meta: event.meta ?? null,
      user: event.user[0] ? maskEmail(event.user[0].email) : null,
      country: event.country ?? null,
      city: event.city ?? null,
      device: event.device ?? null,
      createdAt: event.createdAt,
    })),
  };
}

export async function getTripIntelligence(days = 30) {
  const insiders = await insiderIds();
  const since = new Date(Date.now() - days * DAY_MS);

  const trips = await Trip.find({ userId: { $nin: insiders }, createdAt: { $gte: since } })
    .select({
      status: 1,
      destination: 1,
      shareId: 1,
      shareViews: 1,
      planningAttempts: 1,
      planningLatencyMs: 1,
      lastError: 1,
      clarification: 1,
      "plan.request": 1,
      "plan.nights": 1,
      "plan.estimated_cost": 1,
      "plan.destination_coordinates": 1,
      "plan.hotels.price_source": 1,
      "plan.flights.price_source": 1,
    })
    .lean();

  let plannedTrips = 0;
  let draftTrips = 0;
  let failedTrips = 0;
  let sharedTrips = 0;

  const destMap = new Map();
  const originMap = new Map();
  const routeMap = new Map();
  const pinMap = new Map();
  const styleMap = new Map();
  const missingFieldCounts = new Map();
  const failureReasonCounts = new Map();

  const partyBuckets = {
    "Solo (1)": 0,
    "Couple (2)": 0,
    "Small group (3–4)": 0,
    "Group (5+)": 0,
  };
  const durationBuckets = {
    "1–2 days": 0,
    "3–4 days": 0,
    "5–7 days": 0,
    "8+ days": 0,
  };
  const budgetBands = {
    "< ₹15k": 0,
    "₹15k–₹30k": 0,
    "₹30k–₹60k": 0,
    "₹60k–₹1L": 0,
    "₹1L+": 0,
  };

  const budgets = [];
  const costs = [];
  const utilizations = [];
  const hotelShares = [];
  const flightShares = [];
  const bufferShares = [];
  const latencies = [];
  const attemptsForPlanned = [];

  let firstAttemptSuccesses = 0;
  let geocodedTrips = 0;
  let liveHotels = 0;
  let estimatedHotels = 0;
  let liveFlights = 0;
  let estimatedFlights = 0;
  let nonInrTrips = 0;

  for (const trip of trips) {
    if (trip.status === TripStatus.PLANNED) plannedTrips += 1;
    else if (trip.status === TripStatus.PLANNING_FAILED) failedTrips += 1;
    else draftTrips += 1;

    if (trip.shareId) sharedTrips += 1;

    if (Number.isFinite(trip.planningLatencyMs) && trip.planningLatencyMs > 0) {
      latencies.push(trip.planningLatencyMs);
    }

    if (trip.lastError) {
      failureReasonCounts.set(trip.lastError, (failureReasonCounts.get(trip.lastError) ?? 0) + 1);
    }

    for (const field of trip.clarification?.missingFields ?? []) {
      const key = cleanLabel(field);
      if (key) missingFieldCounts.set(key, (missingFieldCounts.get(key) ?? 0) + 1);
    }

    const plan = trip.plan;
    const req = plan?.request;
    const destination = cleanLabel(req?.destination || trip.destination);
    const origin = cleanLabel(req?.origin);
    const isInr = (plan?.estimated_cost?.currency ?? "INR") === "INR";
    if (plan && !isInr) nonInrTrips += 1;
    const budget = isInr ? Number(req?.budget) : NaN;
    const costTotal = isInr ? Number(plan?.estimated_cost?.total) : NaN;
    const hotelTotal = isInr ? Number(plan?.estimated_cost?.hotel_total) : NaN;
    // Newer plans count the chosen way to travel; older ones only had flights.
    const flightTotal = isInr
      ? Number(plan?.estimated_cost?.travel_total ?? plan?.estimated_cost?.flight_total)
      : NaN;
    const durationDays = Number(req?.duration_days ?? (plan?.nights ? plan.nights + 1 : NaN));
    const partySize = Number(req?.party_size);

    if (trip.status === TripStatus.PLANNED) {
      if (Number.isFinite(trip.planningAttempts) && trip.planningAttempts > 0) {
        attemptsForPlanned.push(trip.planningAttempts);
        if (trip.planningAttempts === 1) firstAttemptSuccesses += 1;
      }

      const coords = plan?.destination_coordinates;
      const hasCoords = Number.isFinite(coords?.lat) && Number.isFinite(coords?.lng);
      if (hasCoords) {
        geocodedTrips += 1;
        if (destination) {
          const pKey = titleKey(destination);
          const existing = pinMap.get(pKey) ?? {
            destination,
            lat: coords.lat,
            lng: coords.lng,
            count: 0,
            budgetSum: 0,
            budgetCount: 0,
          };
          existing.count += 1;
          if (Number.isFinite(budget) && budget > 0) {
            existing.budgetSum += budget;
            existing.budgetCount += 1;
          }
          pinMap.set(pKey, existing);
        }
      }

      for (const hotel of plan?.hotels ?? []) {
        if (hotel?.price_source === "live") liveHotels += 1;
        else estimatedHotels += 1;
      }
      for (const flight of plan?.flights ?? []) {
        if (flight?.price_source === "live") liveFlights += 1;
        else estimatedFlights += 1;
      }
    }

    if (destination) {
      const dKey = titleKey(destination);
      const entry = destMap.get(dKey) ?? {
        destination,
        count: 0,
        budgetSum: 0,
        budgetCount: 0,
        costSum: 0,
        costCount: 0,
        daysSum: 0,
        daysCount: 0,
      };
      entry.count += 1;
      if (Number.isFinite(budget) && budget > 0) {
        entry.budgetSum += budget;
        entry.budgetCount += 1;
      }
      if (Number.isFinite(costTotal) && costTotal > 0) {
        entry.costSum += costTotal;
        entry.costCount += 1;
      }
      if (Number.isFinite(durationDays) && durationDays > 0) {
        entry.daysSum += durationDays;
        entry.daysCount += 1;
      }
      destMap.set(dKey, entry);
    }

    if (origin) {
      const oKey = titleKey(origin);
      const entry = originMap.get(oKey) ?? { origin, count: 0 };
      entry.count += 1;
      originMap.set(oKey, entry);
    }

    if (origin && destination) {
      const rKey = `${titleKey(origin)}->${titleKey(destination)}`;
      const entry = routeMap.get(rKey) ?? {
        origin,
        destination,
        route: `${origin} → ${destination}`,
        count: 0,
        budgetSum: 0,
        budgetCount: 0,
      };
      entry.count += 1;
      if (Number.isFinite(budget) && budget > 0) {
        entry.budgetSum += budget;
        entry.budgetCount += 1;
      }
      routeMap.set(rKey, entry);
    }

    const style = cleanLabel(req?.travel_style).toLowerCase();
    if (style) {
      const entry = styleMap.get(style) ?? { style, count: 0, budgetSum: 0, budgetCount: 0 };
      entry.count += 1;
      if (Number.isFinite(budget) && budget > 0) {
        entry.budgetSum += budget;
        entry.budgetCount += 1;
      }
      styleMap.set(style, entry);
    }

    if (Number.isFinite(partySize) && partySize > 0) {
      if (partySize === 1) partyBuckets["Solo (1)"] += 1;
      else if (partySize === 2) partyBuckets["Couple (2)"] += 1;
      else if (partySize <= 4) partyBuckets["Small group (3–4)"] += 1;
      else partyBuckets["Group (5+)"] += 1;
    }

    if (Number.isFinite(durationDays) && durationDays > 0) {
      if (durationDays <= 2) durationBuckets["1–2 days"] += 1;
      else if (durationDays <= 4) durationBuckets["3–4 days"] += 1;
      else if (durationDays <= 7) durationBuckets["5–7 days"] += 1;
      else durationBuckets["8+ days"] += 1;
    }

    if (Number.isFinite(budget) && budget > 0) {
      budgets.push(budget);
      if (budget < 15000) budgetBands["< ₹15k"] += 1;
      else if (budget < 30000) budgetBands["₹15k–₹30k"] += 1;
      else if (budget < 60000) budgetBands["₹30k–₹60k"] += 1;
      else if (budget < 100000) budgetBands["₹60k–₹1L"] += 1;
      else budgetBands["₹1L+"] += 1;

      if (Number.isFinite(costTotal) && costTotal >= 0) {
        costs.push(costTotal);
        utilizations.push(Math.min(100, (costTotal / budget) * 100));
        const hShare = Number.isFinite(hotelTotal) ? Math.min(100, (hotelTotal / budget) * 100) : 0;
        const fShare = Number.isFinite(flightTotal)
          ? Math.min(100 - hShare, (flightTotal / budget) * 100)
          : 0;
        hotelShares.push(hShare);
        flightShares.push(fShare);
        bufferShares.push(Math.max(0, 100 - hShare - fShare));
      }
    }
  }

  const avgOf = (list) =>
    list.length ? list.reduce((sum, n) => sum + n, 0) / list.length : null;

  const totalHotelRecs = liveHotels + estimatedHotels;
  const totalFlightRecs = liveFlights + estimatedFlights;
  const totalRecs = totalHotelRecs + totalFlightRecs;

  return {
    days,
    totalTrips: trips.length,
    plannedTrips,
    draftTrips,
    failedTrips,
    sharedTrips,
    topDestinations: [...destMap.values()]
      .sort((a, b) => b.count - a.count || a.destination.localeCompare(b.destination))
      .slice(0, 10)
      .map((entry) => ({
        destination: entry.destination,
        count: entry.count,
        avgBudgetInr: entry.budgetCount ? Math.round(entry.budgetSum / entry.budgetCount) : null,
        avgCostInr: entry.costCount ? Math.round(entry.costSum / entry.costCount) : null,
        avgDays: entry.daysCount ? round1(entry.daysSum / entry.daysCount) : null,
      })),
    topOrigins: [...originMap.values()]
      .sort((a, b) => b.count - a.count || a.origin.localeCompare(b.origin))
      .slice(0, 10),
    topRoutes: [...routeMap.values()]
      .sort((a, b) => b.count - a.count || a.route.localeCompare(b.route))
      .slice(0, 10)
      .map((entry) => ({
        origin: entry.origin,
        destination: entry.destination,
        route: entry.route,
        count: entry.count,
        avgBudgetInr: entry.budgetCount ? Math.round(entry.budgetSum / entry.budgetCount) : null,
      })),
    destinationPins: [...pinMap.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 30)
      .map((entry) => ({
        destination: entry.destination,
        lat: entry.lat,
        lng: entry.lng,
        count: entry.count,
        avgBudgetInr: entry.budgetCount ? Math.round(entry.budgetSum / entry.budgetCount) : null,
      })),
    travelStyles: [...styleMap.values()]
      .sort((a, b) => b.count - a.count)
      .map((entry) => ({
        style: entry.style,
        count: entry.count,
        avgBudgetInr: entry.budgetCount ? Math.round(entry.budgetSum / entry.budgetCount) : null,
      })),
    partySizes: Object.entries(partyBuckets).map(([label, count]) => ({ label, count })),
    durationBuckets: Object.entries(durationBuckets).map(([label, count]) => ({ label, count })),
    budgetAnalysis: {
      nonInrTrips,
      totalPlannedBudgetInr: budgets.reduce((sum, n) => sum + n, 0),
      totalEstimatedCostInr: Math.round(costs.reduce((sum, n) => sum + n, 0)),
      avgBudgetInr: budgets.length ? Math.round(avgOf(budgets)) : null,
      medianBudgetInr: median(budgets),
      avgEstimatedCostInr: costs.length ? Math.round(avgOf(costs)) : null,
      avgUtilizationPct: round1(avgOf(utilizations)),
      avgHotelSharePct: round1(avgOf(hotelShares)),
      avgFlightSharePct: round1(avgOf(flightShares)),
      avgBufferSharePct: round1(avgOf(bufferShares)),
      bands: Object.entries(budgetBands).map(([label, count]) => ({ label, count })),
    },
    priceSourceCoverage: {
      liveHotels,
      estimatedHotels,
      liveFlights,
      estimatedFlights,
      liveHotelPct: pct(liveHotels, totalHotelRecs),
      liveFlightPct: pct(liveFlights, totalFlightRecs),
      liveOverallPct: pct(liveHotels + liveFlights, totalRecs),
    },
    planningHealth: {
      avgAttemptsToPlan: attemptsForPlanned.length ? round1(avgOf(attemptsForPlanned)) : null,
      firstAttemptSuccessRate: pct(firstAttemptSuccesses, attemptsForPlanned.length),
      avgLatencyMs: latencies.length ? Math.round(avgOf(latencies)) : null,
      p50LatencyMs: percentile(latencies, 50),
      p95LatencyMs: percentile(latencies, 95),
      geocodedTrips,
      geocodedCoveragePct: pct(geocodedTrips, plannedTrips),
      topMissingFields: [...missingFieldCounts.entries()]
        .map(([field, count]) => ({ field, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 6),
      failureReasons: [...failureReasonCounts.entries()]
        .map(([reason, count]) => ({ reason, count }))
        .sort((a, b) => b.count - a.count),
    },
  };
}

export async function getFeedbackAnalytics() {
  const insiders = await insiderIds();
  const feedback = await Feedback.find({ userId: { $nin: insiders } })
    .sort({ createdAt: -1 })
    .limit(LIST_LIMIT)
    .select({ _id: 0, rating: 1, message: 1, page: 1, category: 1, createdAt: 1 })
    .lean();

  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const categoryCounts = new Map();
  const pageCounts = new Map();
  let ratingSum = 0;

  const normalized = feedback.map((item) => {
    const category = item.category || "general";
    if (item.rating >= 1 && item.rating <= 5) {
      distribution[item.rating] += 1;
      ratingSum += item.rating;
    }
    categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);
    if (item.page) {
      const existing = pageCounts.get(item.page) ?? { page: item.page, count: 0, ratingSum: 0 };
      existing.count += 1;
      existing.ratingSum += item.rating;
      pageCounts.set(item.page, existing);
    }
    return {
      rating: item.rating,
      message: item.message,
      page: item.page,
      category,
      createdAt: item.createdAt,
    };
  });

  const total = normalized.length;

  return {
    feedback: normalized,
    summary: {
      total,
      averageRating: total ? round1(ratingSum / total) : null,
      npsProxy: npsFromDistribution(distribution, total),
      distribution,
      byCategory: [...categoryCounts.entries()]
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count),
      byPage: [...pageCounts.values()]
        .map((row) => ({
          page: row.page,
          count: row.count,
          avgRating: round1(row.ratingSum / row.count),
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8),
    },
  };
}

export async function getRetentionAnalytics(weeks = 8) {
  const insiders = await insiderIds();
  const now = Date.now();
  const dayAgo = new Date(now - DAY_MS);
  const weekAgo = new Date(now - WEEK_MS);
  const monthAgo = new Date(now - 30 * DAY_MS);
  const cohortSince = new Date(now - weeks * WEEK_MS);

  const [cohortUsers, cohortEvents, dauVisitors, wauVisitors, mauVisitors, activeUsers7d] =
    await Promise.all([
      User.find({ _id: { $nin: insiders }, createdAt: { $gte: cohortSince } })
        .select({ _id: 1, createdAt: 1 })
        .lean(),
      Event.find({
        userId: { $nin: insiders, $ne: null },
        createdAt: { $gte: cohortSince },
      })
        .select({ _id: 0, userId: 1, createdAt: 1 })
        .lean(),
      Event.distinct("visitorHash", {
        userId: { $nin: insiders },
        createdAt: { $gte: dayAgo },
      }),
      Event.distinct("visitorHash", {
        userId: { $nin: insiders },
        createdAt: { $gte: weekAgo },
      }),
      Event.distinct("visitorHash", {
        userId: { $nin: insiders },
        createdAt: { $gte: monthAgo },
      }),
      Event.distinct("userId", {
        userId: { $nin: insiders, $ne: null },
        createdAt: { $gte: weekAgo },
      }),
    ]);

  const activeUserDocs = activeUsers7d.length
    ? await User.find({ _id: { $in: activeUsers7d } }).select({ _id: 1, createdAt: 1 }).lean()
    : [];
  let returningUsers7d = 0;
  let newUsers7d = 0;
  for (const user of activeUserDocs) {
    if (new Date(user.createdAt).getTime() < weekAgo.getTime()) returningUsers7d += 1;
    else newUsers7d += 1;
  }

  // Group events by userId for fast cohort week lookups.
  const eventsByUser = new Map();
  for (const event of cohortEvents) {
    const uid = String(event.userId);
    if (!eventsByUser.has(uid)) eventsByUser.set(uid, []);
    eventsByUser.get(uid).push(new Date(event.createdAt).getTime());
  }

  const cohorts = [];
  for (let w = weeks - 1; w >= 0; w -= 1) {
    const startMs = now - (w + 1) * WEEK_MS;
    const endMs = now - w * WEEK_MS;
    const members = cohortUsers.filter((user) => {
      const joined = new Date(user.createdAt).getTime();
      return joined >= startMs && joined < endMs;
    });

    const retention = [0, 1, 2, 3, 4].map((offset) => {
      const winStart = startMs + offset * WEEK_MS;
      const winEnd = winStart + WEEK_MS;
      if (winStart > now) return null;
      if (members.length === 0) return 0;
      if (offset === 0) return 100;
      let retained = 0;
      for (const member of members) {
        const timestamps = eventsByUser.get(String(member._id)) ?? [];
        if (timestamps.some((ts) => ts >= winStart && ts < winEnd)) {
          retained += 1;
        }
      }
      return Math.round((retained / members.length) * 100);
    });

    cohorts.push({
      weekStart: dayKey(new Date(startMs)),
      size: members.length,
      retention,
    });
  }

  const dau = dauVisitors.length;
  const wau = wauVisitors.length;
  const mau = mauVisitors.length;

  return {
    weeks,
    cohorts,
    stickiness: {
      dau,
      wau,
      mau,
      dauWauRatio: pct(dau, wau),
      wauMauRatio: pct(wau, mau),
    },
    userSplit7d: {
      newUsers: newUsers7d,
      returningUsers: returningUsers7d,
      returningPct: pct(returningUsers7d, newUsers7d + returningUsers7d),
    },
  };
}
