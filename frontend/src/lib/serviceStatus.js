// Pure formatting and time helpers for the Groq & Cloudflare Workers AI downtime timer.

export const PROVIDER_LABELS = {
  groq: "Groq",
  cloudflare: "Cloudflare Workers AI",
  both: "Groq & Cloudflare Workers AI",
};

export function providerLabel(provider) {
  return PROVIDER_LABELS[provider] ?? "AI providers";
}

export function nextUtcMidnight(now = new Date()) {
  const base = now instanceof Date ? now : new Date(now);
  return new Date(
    Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate() + 1, 0, 0, 0, 0)
  );
}

export function formatCountdown(ms) {
  const totalSeconds = Math.max(0, Math.floor((ms ?? 0) / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n) => String(n).padStart(2, "0");
  const clock = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  return days > 0 ? `${days}d ${clock}` : clock;
}

export function formatResetTime(isoString) {
  if (!isoString) return "";
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Convert a Date or ISO string to an `<input type="datetime-local">` value in the browser's local time.
export function toLocalDatetimeInput(value) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

export function localDatetimeToIso(localValue) {
  if (!localValue) return null;
  const date = new Date(localValue);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
