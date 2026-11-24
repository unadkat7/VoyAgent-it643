import { describe, expect, it } from "vitest";
import {
  buildDailyCsv,
  buildUsageEvidenceMarkdown,
  buildUsersCsv,
  formatCompactNumber,
  formatDelta,
  formatLatency,
  formatPercent,
  normalizeAdminOverview,
} from "@/lib/adminAnalytics";

describe("adminAnalytics helpers", () => {
  it("formats numbers, percentages, latency and deltas cleanly", () => {
    expect(formatCompactNumber(12500)).toBe("12.5k");
    expect(formatCompactNumber(420)).toBe("420");
    expect(formatPercent(66.66)).toBe("66.7%");
    expect(formatPercent(null)).toBe("—");
    expect(formatLatency(450)).toBe("450ms");
    expect(formatLatency(2450)).toBe("2.5s");
    expect(formatDelta(12.4)).toEqual({ label: "+12.4%", tone: "positive" });
    expect(formatDelta(-5)).toEqual({ label: "-5%", tone: "negative" });
  });

  it("neutralizes spreadsheet formula prefixes in CSV exports", () => {
    const csv = buildUsersCsv([
      {
        email: "=CMD('calc')@evil.test",
        joinedAt: "2026-11-20T10:00:00.000Z",
        trips: 2,
        plannedTrips: 1,
        city: "+Ahmedabad",
        country: "IN",
      },
    ]);
    expect(csv).toContain("'=CMD('calc')@evil.test");
    expect(csv).toContain("'+Ahmedabad, IN");
  });

  it("serializes daily traffic CSV and USAGE_EVIDENCE.md Markdown", () => {
    const dailyCsv = buildDailyCsv([
      { day: "2026-11-22", visitors: 5, pageviews: 12, signups: 2, tripsPlanned: 1 },
    ]);
    expect(dailyCsv).toContain("2026-11-22,5,12,2,0,1");

    const md = buildUsageEvidenceMarkdown({
      stats: { uniqueVisitors7d: 9, outsideAccounts: 2, outsidePlannedTrips: 3, feedbackCount: 1, averageRating: 4.5 },
      users: [{ email: "as***@example.com", joinedAt: "2026-11-20T10:00:00.000Z", trips: 2, plannedTrips: 1, country: "IN" }],
      activity: { countries: [{ country: "IN", visitors: 9 }] },
      feedback: [{ rating: 5, message: "Great | fast", createdAt: "2026-11-22T10:00:00.000Z" }],
    });
    expect(md).toContain("| 9 | 2 | 3 | 1 / 4.5★ | IN (9) |");
    expect(md).toContain("as***@example.com");
    expect(md).toContain("Great \\| fast");
  });

  it("hydrates safe defaults for minimal overview payloads", () => {
    const normalized = normalizeAdminOverview({ stats: { outsideAccounts: 3 } });
    expect(normalized.stats.outsideAccounts).toBe(3);
    expect(normalized.activity.featureEngagement.tripMap.totalInteractions).toBe(0);
    expect(normalized.trips.destinationPins).toEqual([]);
    expect(normalized.retention.cohorts).toEqual([]);
    expect(normalized.activity.featureEngagement.tripChat).toBeNull();
  });

  it("keeps trip chat stats from the activity payload", () => {
    const tripChat = {
      opens: 1,
      chipUses: 0,
      finalized: 1,
      backToDraft: 0,
      travelModePicks: { flight: 1 },
      edits: { answered: 1, updated: 2 },
    };

    const normalized = normalizeAdminOverview({
      activity: { featureEngagement: { tripChat } },
    });

    expect(normalized.activity.featureEngagement.tripChat).toEqual(tripChat);
  });
});
