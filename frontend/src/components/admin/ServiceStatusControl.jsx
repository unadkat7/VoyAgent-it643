"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Clock, Power } from "lucide-react";
import toast from "react-hot-toast";
import { useServiceStatus } from "@/components/status/ServiceStatusProvider";
import {
  formatCountdown,
  formatResetTime,
  localDatetimeToIso,
  nextUtcMidnight,
  providerLabel,
  toLocalDatetimeInput,
} from "@/lib/serviceStatus";
import { updateServiceStatus } from "@/services/status.service";

const PRESETS = [
  { id: "utc", label: "Next 00:00 UTC", getDate: () => nextUtcMidnight() },
  { id: "1h", label: "+1 hr", getDate: () => new Date(Date.now() + 60 * 60 * 1000) },
  { id: "6h", label: "+6 hr", getDate: () => new Date(Date.now() + 6 * 60 * 60 * 1000) },
  { id: "24h", label: "+24 hr", getDate: () => new Date(Date.now() + 24 * 60 * 60 * 1000) },
];

function previewResume(groqLocal, cloudflareLocal) {
  const groqIso = localDatetimeToIso(groqLocal);
  const cfIso = localDatetimeToIso(cloudflareLocal);
  if (!groqIso && !cfIso) return null;
  if (groqIso && cfIso) {
    const g = new Date(groqIso).getTime();
    const c = new Date(cfIso).getTime();
    if (g < c) return { iso: groqIso, provider: "groq" };
    if (c < g) return { iso: cfIso, provider: "cloudflare" };
    return { iso: groqIso, provider: "both" };
  }
  return groqIso ? { iso: groqIso, provider: "groq" } : { iso: cfIso, provider: "cloudflare" };
}

export default function ServiceStatusControl() {
  const { status, remainingMs, setStatus } = useServiceStatus();
  const [expanded, setExpanded] = useState(false);
  const [groqInput, setGroqInput] = useState(() => toLocalDatetimeInput(nextUtcMidnight()));
  const [cloudflareInput, setCloudflareInput] = useState(() =>
    toLocalDatetimeInput(nextUtcMidnight())
  );
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);

  const resumePreview = useMemo(
    () => previewResume(groqInput, cloudflareInput),
    [groqInput, cloudflareInput]
  );

  const applyPresetToBoth = (getDate) => {
    const formatted = toLocalDatetimeInput(getDate());
    setGroqInput(formatted);
    setCloudflareInput(formatted);
    setFormError(null);
  };

  const handlePublish = async (event) => {
    event.preventDefault();
    setFormError(null);

    const groqResetAt = localDatetimeToIso(groqInput);
    const cloudflareResetAt = localDatetimeToIso(cloudflareInput);
    const now = Date.now();

    if (groqResetAt && new Date(groqResetAt).getTime() <= now) {
      setFormError("Groq reset time must be in the future.");
      return;
    }
    if (cloudflareResetAt && new Date(cloudflareResetAt).getTime() <= now) {
      setFormError("Cloudflare Workers AI reset time must be in the future.");
      return;
    }

    setSaving(true);
    try {
      const updated = await updateServiceStatus({
        isDown: true,
        groqResetAt,
        cloudflareResetAt,
        message: message.trim() || null,
      });
      setStatus(updated);
      toast.success("Downtime notice published");
    } catch (err) {
      const errMsg = err.response?.data?.message || "Could not publish downtime notice.";
      setFormError(errMsg);
      toast.error(errMsg);
    } finally {
      setSaving(false);
    }
  };

  const handleRestore = async () => {
    setFormError(null);
    setSaving(true);
    try {
      const updated = await updateServiceStatus({ isDown: false });
      setStatus(updated);
      setExpanded(false);
      setMessage("");
      toast.success("Service restored — AI planning is live");
    } catch (err) {
      const errMsg = err.response?.data?.message || "Could not restore service.";
      setFormError(errMsg);
      toast.error(errMsg);
    } finally {
      setSaving(false);
    }
  };

  const isDown = Boolean(status?.isDown);

  return (
    <section
      aria-label="AI Service Availability Control"
      className={`rounded-2xl border bg-white p-4 sm:p-5 transition-colors ${
        isDown ? "border-warning/50 bg-warning-light/30" : "border-border"
      }`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3 sm:items-center">
          {isDown ? (
            <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-warning-light text-warning sm:mt-0">
              <AlertTriangle className="h-5 w-5" aria-hidden />
            </span>
          ) : (
            <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-success-light text-success sm:mt-0">
              <CheckCircle2 className="h-5 w-5" aria-hidden />
            </span>
          )}
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-lg font-semibold text-ink">
                AI Planner Availability
              </h2>
              {isDown ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-warning-light px-2.5 py-0.5 text-label font-semibold text-warning">
                  <Clock className="h-3.5 w-3.5" aria-hidden />
                  Downtime Published · {formatCountdown(remainingMs)}
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full bg-success-light px-2.5 py-0.5 text-label font-semibold text-success">
                  Operational (Groq + Cloudflare)
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-muted">
              {isDown
                ? `Auto-resumes when ${providerLabel(status.resumingProvider)} resets (${formatResetTime(status.availableAt)}). Saved & shared trips stay readable.`
                : "Publish a site-wide countdown banner when both Groq and Cloudflare Workers AI hit their API limits."}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {isDown && (
            <button
              type="button"
              disabled={saving}
              onClick={handleRestore}
              className="inline-flex min-h-tap items-center gap-1.5 rounded-xl bg-success px-3.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              <Power className="h-4 w-4" aria-hidden />
              Restore Service Now
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              if (!expanded) {
                if (isDown) {
                  if (status.groqResetAt) setGroqInput(toLocalDatetimeInput(status.groqResetAt));
                  if (status.cloudflareResetAt) {
                    setCloudflareInput(toLocalDatetimeInput(status.cloudflareResetAt));
                  }
                  setMessage(status.message ?? "");
                } else {
                  const midnight = toLocalDatetimeInput(nextUtcMidnight());
                  setGroqInput(midnight);
                  setCloudflareInput(midnight);
                }
              }
              setExpanded((value) => !value);
            }}
            className="inline-flex min-h-tap items-center gap-1.5 rounded-xl border border-border bg-bg px-3.5 text-sm font-semibold text-ink hover:bg-bg-subtle"
          >
            {isDown ? "Edit Notice" : "Publish Downtime"}
            {expanded ? (
              <ChevronUp className="h-4 w-4" aria-hidden />
            ) : (
              <ChevronDown className="h-4 w-4" aria-hidden />
            )}
          </button>
        </div>
      </div>

      {expanded && (
        <form onSubmit={handlePublish} className="mt-4 space-y-4 border-t border-border pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-label font-semibold uppercase tracking-wide text-muted">
              Quick reset presets:
            </span>
            {PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => applyPresetToBoth(preset.getDate)}
                className="rounded-lg border border-border bg-bg px-2.5 py-1 text-xs font-medium text-ink-soft hover:border-primary/40 hover:text-primary"
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="groq-reset-input" className="block text-sm font-semibold text-ink">
                Groq API Limit Reset
              </label>
              <input
                id="groq-reset-input"
                type="datetime-local"
                value={groqInput}
                onChange={(event) => setGroqInput(event.target.value)}
                className="w-full rounded-xl border border-border bg-surface-warm px-3 py-2.5 text-sm text-ink focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
              />
              <p className="text-label text-muted">
                Daily RPD/TPD quotas reset at 00:00 UTC (05:30 IST).
              </p>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="cloudflare-reset-input" className="block text-sm font-semibold text-ink">
                Cloudflare Workers AI Reset
              </label>
              <input
                id="cloudflare-reset-input"
                type="datetime-local"
                value={cloudflareInput}
                onChange={(event) => setCloudflareInput(event.target.value)}
                className="w-full rounded-xl border border-border bg-surface-warm px-3 py-2.5 text-sm text-ink focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
              />
              <p className="text-label text-muted">
                Free 10,000 daily neurons reset at 00:00 UTC (05:30 IST).
              </p>
            </div>
          </div>

          {resumePreview && (
            <p className="rounded-xl border border-border bg-bg px-3.5 py-2 text-xs text-ink-soft">
              AI planning will automatically resume at{" "}
              <strong className="font-semibold text-ink">
                {formatResetTime(resumePreview.iso)}
              </strong>{" "}
              — as soon as{" "}
              <strong className="font-semibold text-ink">
                {providerLabel(resumePreview.provider)}
              </strong>{" "}
              becomes active.
            </p>
          )}

          <div className="space-y-1.5">
            <label htmlFor="downtime-message-input" className="block text-sm font-semibold text-ink">
              Banner message <span className="font-normal text-muted">(optional)</span>
            </label>
            <textarea
              id="downtime-message-input"
              rows={2}
              maxLength={280}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="AI trip planning is temporarily paused because both Groq and Cloudflare Workers AI have reached their API limits. You can still view your saved and shared trips."
              className="w-full resize-none rounded-xl border border-border bg-surface-warm px-3 py-2 text-sm text-ink placeholder-faint focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
            />
          </div>

          {formError && (
            <p role="alert" className="rounded-xl bg-danger-light px-3 py-2 text-xs font-medium text-danger">
              {formError}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="min-h-tap rounded-xl border border-border px-4 text-sm font-semibold text-ink-soft hover:bg-bg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="min-h-tap rounded-xl bg-warning px-4 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Saving..." : isDown ? "Update Downtime Notice" : "Publish Downtime Notice"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
