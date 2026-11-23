import crypto from "node:crypto";
import net from "node:net";
import { UAParser } from "ua-parser-js";
import { env } from "../config/env.js";
import Event from "../models/event.model.js";

const BOT_PATTERN = /bot|crawl|spider|slurp|headless|lighthouse/i;

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
export async function recordEvent(req, type, { userId, tripId, path } = {}) {
  const userAgent = req.get("user-agent") ?? "";
  try {
    await Event.create({
      type,
      userId: userId ?? req.user?._id,
      tripId,
      path,
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
