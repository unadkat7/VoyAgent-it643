import crypto from "node:crypto";
import net from "node:net";
import { UAParser } from "ua-parser-js";
import { env } from "../config/env.js";
import Event from "../models/event.model.js";

const BOT_PATTERN = /bot|crawl|spider|slurp|headless|lighthouse/i;
const SAFE_SOURCE_TOKENS = new Set(["share_link", "direct"]);

function normalizeHost(raw) {
  if (!raw || typeof raw !== "string") return "";
  return raw.trim().toLowerCase().split(":")[0].replace(/^www\./, "");
}

// Keep only the external referrer hostname (never paths or query parameters).
export function referrerHost(rawReferrer, reqHost = "") {
  if (!rawReferrer || typeof rawReferrer !== "string") return null;
  const trimmed = rawReferrer.trim();
  if (!trimmed) return null;
  if (SAFE_SOURCE_TOKENS.has(trimmed.toLowerCase())) {
    return trimmed.toLowerCase();
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    const host = normalizeHost(parsed.hostname);
    if (!host) return null;
    const ownHost = normalizeHost(reqHost);
    if (ownHost && host === ownHost) return null;
    return host.slice(0, 120);
  } catch {
    return null;
  }
}

function ipv6Groups(ip) {
  const [head, tail] = ip.split("::");
  const left = head ? head.split(":") : [];
  const right = tail ? tail.split(":") : [];
  const fill = tail === undefined ? [] : Array(8 - left.length - right.length).fill("0");
  return [...left, ...fill, ...right];
}

// Keep the network, drop the host: an IPv4 /24 or an IPv6 /48.
export function ipPrefix(ip) {
  if (!ip) return null;
  const address = ip.startsWith("::ffff:") ? ip.slice(7) : ip;
  if (net.isIPv4(address)) {
    return `${address.split(".").slice(0, 3).join(".")}.0`;
  }
  if (net.isIPv6(address)) {
    return `${ipv6Groups(address).slice(0, 3).join(":")}::`;
  }
  return null;
}

export function deviceFrom(userAgent = "") {
  const { device, os, browser } = new UAParser(userAgent).getResult();
  return { type: device.type ?? "desktop", os: os.name, browser: browser.name };
}

export const isBot = (userAgent = "") => BOT_PATTERN.test(userAgent);

// Same person, same day, same hash; the salt stops anyone reversing it into an IP.
function visitorHash(ip, userAgent) {
  const day = new Date().toISOString().slice(0, 10);
  return crypto
    .createHash("sha256")
    .update(`${ip}|${userAgent}|${day}|${env.JWT_SECRET}`)
    .digest("hex");
}

function header(req, name) {
  const value = req.get(name);
  if (!value) return undefined;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

// Awaited so serverless functions finish the write, but never fails the request.
export async function recordEvent(
  req,
  type,
  { userId, tripId, path, referrer, durationMs, meta } = {}
) {
  const userAgent = req.get("user-agent") ?? "";
  const host = req.get("host") ?? "";
  const resolvedReferrer = referrerHost(referrer ?? req.get("referer"), host);
  const safeDuration =
    Number.isFinite(durationMs) && durationMs >= 0 ? Math.round(durationMs) : undefined;
  try {
    await Event.create({
      type,
      userId: userId ?? req.user?._id,
      tripId,
      path,
      referrer: resolvedReferrer ?? undefined,
      durationMs: safeDuration,
      meta: meta && Object.keys(meta).length > 0 ? meta : undefined,
      visitorHash: visitorHash(req.ip, userAgent),
      ipPrefix: ipPrefix(req.ip),
      country: header(req, "x-vercel-ip-country"),
      city: header(req, "x-vercel-ip-city"),
      device: deviceFrom(userAgent),
    });
  } catch (error) {
    console.error(`Could not record ${type} Event:`, error.message);
  }
}
