import { describe, expect, it } from "vitest";
import {
  DEFAULT_DOWNTIME_MESSAGE,
  computeAvailability,
  nextUtcMidnight,
  resolveServiceStatus,
} from "../../src/domain/serviceStatus.js";

describe("serviceStatus domain", () => {
  it("computes the next 00:00 UTC boundary", () => {
    const midDay = new Date("2026-11-24T12:30:00.000Z");
    expect(nextUtcMidnight(midDay).toISOString()).toBe("2026-11-25T00:00:00.000Z");

    const rightAtMidnight = new Date("2026-11-24T00:00:00.000Z");
    expect(nextUtcMidnight(rightAtMidnight).toISOString()).toBe("2026-11-25T00:00:00.000Z");
  });

  it("picks the earliest provider reset time as availableAt", () => {
    const groqEarlier = computeAvailability({
      groqResetAt: "2026-11-25T00:00:00.000Z",
      cloudflareResetAt: "2026-11-25T06:00:00.000Z",
    });
    expect(groqEarlier.availableAt.toISOString()).toBe("2026-11-25T00:00:00.000Z");
    expect(groqEarlier.resumingProvider).toBe("groq");

    const cfEarlier = computeAvailability({
      groqResetAt: "2026-11-25T04:00:00.000Z",
      cloudflareResetAt: "2026-11-25T00:00:00.000Z",
    });
    expect(cfEarlier.availableAt.toISOString()).toBe("2026-11-25T00:00:00.000Z");
    expect(cfEarlier.resumingProvider).toBe("cloudflare");

    const equal = computeAvailability({
      groqResetAt: "2026-11-25T00:00:00.000Z",
      cloudflareResetAt: "2026-11-25T00:00:00.000Z",
    });
    expect(equal.availableAt.toISOString()).toBe("2026-11-25T00:00:00.000Z");
    expect(equal.resumingProvider).toBe("both");
  });

  it("auto-expires downtime once now reaches the earliest reset time", () => {
    const record = {
      isDown: true,
      message: "",
      groqResetAt: new Date("2026-11-25T00:00:00.000Z"),
      cloudflareResetAt: new Date("2026-11-25T02:00:00.000Z"),
    };

    const beforeReset = resolveServiceStatus(record, new Date("2026-11-24T23:59:59.000Z"));
    expect(beforeReset.isDown).toBe(true);
    expect(beforeReset.expired).toBe(false);
    expect(beforeReset.message).toBe(DEFAULT_DOWNTIME_MESSAGE);
    expect(beforeReset.resumingProvider).toBe("groq");

    const atReset = resolveServiceStatus(record, new Date("2026-11-25T00:00:00.000Z"));
    expect(atReset.isDown).toBe(false);
    expect(atReset.expired).toBe(true);
    expect(atReset.availableAt).toBeNull();
  });
});
