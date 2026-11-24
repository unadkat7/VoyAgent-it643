import {
  DEFAULT_DOWNTIME_MESSAGE,
  nextUtcMidnight,
  resolveServiceStatus,
} from "../domain/serviceStatus.js";
import ServiceStatus from "../models/serviceStatus.model.js";
import { HttpError } from "../utils/httpError.js";

const GLOBAL_KEY = "global";

function toPublicStatus(resolved) {
  const { expired: _expired, ...publicFields } = resolved;
  return publicFields;
}

export async function getServiceStatus(now = new Date()) {
  const record = await ServiceStatus.findOne({ key: GLOBAL_KEY }).lean();
  const resolved = resolveServiceStatus(record, now);

  // Lazily clear expired downtime in MongoDB so the stored document stays consistent.
  if (record?.isDown && resolved.expired) {
    try {
      await ServiceStatus.updateOne(
        { key: GLOBAL_KEY },
        {
          $set: {
            isDown: false,
            message: null,
            groqResetAt: null,
            cloudflareResetAt: null,
          },
        }
      );
    } catch (error) {
      console.error("Failed to clear expired service status:", error.message);
    }
  }

  return toPublicStatus(resolved);
}

export async function updateServiceStatus(
  { isDown, groqResetAt = null, cloudflareResetAt = null, message = null, adminId = null },
  now = new Date()
) {
  if (!isDown) {
    const updated = await ServiceStatus.findOneAndUpdate(
      { key: GLOBAL_KEY },
      {
        $set: {
          key: GLOBAL_KEY,
          isDown: false,
          message: null,
          groqResetAt: null,
          cloudflareResetAt: null,
          updatedBy: adminId,
        },
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    ).lean();
    return toPublicStatus(resolveServiceStatus(updated, now));
  }

  let groqDate = groqResetAt ? new Date(groqResetAt) : null;
  let cloudflareDate = cloudflareResetAt ? new Date(cloudflareResetAt) : null;

  // If the admin didn't override either provider, default both to the next 00:00 UTC reset.
  if (!groqDate && !cloudflareDate) {
    const midnight = nextUtcMidnight(now);
    groqDate = midnight;
    cloudflareDate = midnight;
  }

  const nowMs = now.getTime();
  if (groqDate && (Number.isNaN(groqDate.getTime()) || groqDate.getTime() <= nowMs)) {
    throw new HttpError(400, "Groq reset time must be in the future.");
  }
  if (cloudflareDate && (Number.isNaN(cloudflareDate.getTime()) || cloudflareDate.getTime() <= nowMs)) {
    throw new HttpError(400, "Cloudflare Workers AI reset time must be in the future.");
  }

  const trimmedMessage = typeof message === "string" ? message.trim() : "";

  const updated = await ServiceStatus.findOneAndUpdate(
    { key: GLOBAL_KEY },
    {
      $set: {
        key: GLOBAL_KEY,
        isDown: true,
        message: trimmedMessage || DEFAULT_DOWNTIME_MESSAGE,
        groqResetAt: groqDate,
        cloudflareResetAt: cloudflareDate,
        updatedBy: adminId,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();

  return toPublicStatus(resolveServiceStatus(updated, now));
}
