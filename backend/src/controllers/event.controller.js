import { isBot, recordEvent } from "../services/telemetry.service.js";

export const recordPageview = async (req, res) => {
  if (!isBot(req.get("user-agent"))) {
    await recordEvent(req, "pageview", {
      path: req.body.path,
      referrer: req.body.referrer,
    });
  }
  res.status(204).end();
};

export const recordInteraction = async (req, res) => {
  if (!isBot(req.get("user-agent"))) {
    const { action, value, path, tripId } = req.body;
    await recordEvent(req, "feature_interaction", {
      tripId,
      path,
      meta: { action, ...(value ? { value } : {}) },
    });
  }
  res.status(204).end();
};
