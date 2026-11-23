import { isBot, recordEvent } from "../services/telemetry.service.js";

export const recordPageview = async (req, res) => {
  if (!isBot(req.get("user-agent"))) {
    await recordEvent(req, "pageview", { path: req.body.path });
  }
  res.status(204).end();
};
