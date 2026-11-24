// Pure availability rules for AI planning downtime when both Groq and Cloudflare Workers AI
// have reached their API limits. Zero Express or Mongoose imports.

export const DEFAULT_DOWNTIME_MESSAGE =
  "AI trip planning is temporarily paused because both Groq and Cloudflare Workers AI have reached their API limits. You can still view your saved and shared trips.";

function toDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

// Both Groq daily RPD/TPD quotas and Cloudflare Workers AI daily 10,000 neurons reset at 00:00 UTC.
export function nextUtcMidnight(now = new Date()) {
  const base = toDate(now) ?? new Date();
  return new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate() + 1, 0, 0, 0, 0));
}

// Service automatically resumes as soon as either provider resets (earliest valid reset time).
export function computeAvailability({ groqResetAt = null, cloudflareResetAt = null } = {}) {
  const groq = toDate(groqResetAt);
  const cloudflare = toDate(cloudflareResetAt);

  if (groq && cloudflare) {
    if (groq.getTime() < cloudflare.getTime()) {
      return { availableAt: groq, resumingProvider: "groq" };
    }
    if (cloudflare.getTime() < groq.getTime()) {
      return { availableAt: cloudflare, resumingProvider: "cloudflare" };
    }
    return { availableAt: groq, resumingProvider: "both" };
  }
  if (groq) {
    return { availableAt: groq, resumingProvider: "groq" };
  }
  if (cloudflare) {
    return { availableAt: cloudflare, resumingProvider: "cloudflare" };
  }
  return { availableAt: null, resumingProvider: null };
}

export function resolveServiceStatus(record, now = new Date()) {
  const current = toDate(now) ?? new Date();
  const updatedAt = toDate(record?.updatedAt)?.toISOString() ?? null;

  if (!record || !record.isDown) {
    return {
      isDown: false,
      expired: false,
      message: null,
      groqResetAt: null,
      cloudflareResetAt: null,
      availableAt: null,
      resumingProvider: null,
      updatedAt,
    };
  }

  const groqResetAt = toDate(record.groqResetAt);
  const cloudflareResetAt = toDate(record.cloudflareResetAt);
  const { availableAt, resumingProvider } = computeAvailability({ groqResetAt, cloudflareResetAt });

  if (availableAt && availableAt.getTime() <= current.getTime()) {
    return {
      isDown: false,
      expired: true,
      message: null,
      groqResetAt: null,
      cloudflareResetAt: null,
      availableAt: null,
      resumingProvider: null,
      updatedAt,
    };
  }

  const trimmedMessage = typeof record.message === "string" ? record.message.trim() : "";

  return {
    isDown: true,
    expired: false,
    message: trimmedMessage || DEFAULT_DOWNTIME_MESSAGE,
    groqResetAt: groqResetAt?.toISOString() ?? null,
    cloudflareResetAt: cloudflareResetAt?.toISOString() ?? null,
    availableAt: availableAt?.toISOString() ?? null,
    resumingProvider,
    updatedAt,
  };
}
