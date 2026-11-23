"use client";

import { useState } from "react";
import {
  Check,
  ClipboardCopy,
  Download,
  FileJson,
  FileSpreadsheet,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  buildDailyCsv,
  buildUsageEvidenceMarkdown,
  buildUsersCsv,
  formatLatency,
  formatPercent,
  triggerFileDownload,
} from "@/lib/adminAnalytics";
import Sheet from "@/components/ui/Sheet";

const RANGES = [7, 30, 90];
const EXPORT_ITEM = "flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-base font-medium text-ink hover:bg-bg";

export default function AdminMasthead({
  data,
  days,
  onDaysChange,
  onRefresh,
  refreshing,
  lastUpdatedAt,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [copiedMd, setCopiedMd] = useState(false);

  const dateStamp = new Date().toISOString().slice(0, 10);

  const handleCopyEvidence = async () => {
    const md = buildUsageEvidenceMarkdown(data);
    try {
      await navigator.clipboard.writeText(md);
      setCopiedMd(true);
      toast.success("Usage evidence Markdown copied");
      setTimeout(() => setCopiedMd(false), 2000);
    } catch {
      triggerFileDownload(md, `voyagent-evidence-${dateStamp}.md`, "text/markdown;charset=utf-8");
      toast.success("Usage evidence Markdown downloaded");
    }
    setMenuOpen(false);
  };

  const handleDownloadJson = () => {
    triggerFileDownload(
      JSON.stringify(data, null, 2),
      `voyagent-analytics-${days}d-${dateStamp}.json`,
      "application/json;charset=utf-8"
    );
    toast.success("Analytics snapshot downloaded");
    setMenuOpen(false);
  };

  const handleDownloadUsersCsv = () => {
    triggerFileDownload(
      buildUsersCsv(data.users),
      `voyagent-users-${dateStamp}.csv`,
      "text/csv;charset=utf-8"
    );
    toast.success("Masked users CSV downloaded");
    setMenuOpen(false);
  };

  const handleDownloadDailyCsv = () => {
    triggerFileDownload(
      buildDailyCsv(data.activity.daily),
      `voyagent-traffic-${days}d-${dateStamp}.csv`,
      "text/csv;charset=utf-8"
    );
    toast.success("Daily traffic CSV downloaded");
    setMenuOpen(false);
  };

  const updatedLabel = lastUpdatedAt
    ? new Date(lastUpdatedAt).toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Kolkata",
      })
    : null;

  const { stats, trips } = data;
  const healthItems = [
    {
      label: "Plan Success",
      value: formatPercent(stats.planSuccessRate),
      accent: "text-[#4ADE80]",
    },
    {
      label: "Avg Latency",
      value: formatLatency(trips.planningHealth.avgLatencyMs ?? stats.avgPlanningLatencyMs),
      accent: "text-primary-soft",
    },
    {
      label: "Live Pricing",
      value: formatPercent(trips.priceSourceCoverage.liveOverallPct),
      accent: "text-[#FCD34D]",
    },
    {
      label: "Feedback Avg",
      value: stats.averageRating ? `${stats.averageRating} ★` : "—",
      accent: "text-bg",
    },
  ];

  return (
    <section className="relative bg-atlas-dark text-bg rounded-2xl sm:rounded-3xl p-4 sm:p-7 shadow-[0_24px_54px_-28px_rgba(24,20,17,0.5)] border border-ink-hover">
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-5">
        <div className="space-y-2.5">
          <div className="hidden sm:flex flex-wrap items-center gap-2">
            <span className="font-mono text-label uppercase tracking-[0.2em] text-primary-soft">
              Telemetry &amp; Intelligence
            </span>
            <span className="inline-flex items-center gap-1 text-label font-medium text-border-strong bg-white/8 border border-white/10 px-2.5 py-0.5 rounded-full">
              <ShieldCheck className="w-3 h-3 text-[#4ADE80]" aria-hidden />
              Outside users only · Emails masked · No full IPs
            </span>
          </div>

          <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-bg">
            Admin Command Center
          </h1>

          <p className="text-sm text-[#C7BDB2] max-w-2xl">
            Usage from outside accounts.
            {updatedLabel ? ` Synced at ${updatedLabel} IST.` : ""}
          </p>
        </div>

        {/* Controls: Timeframe + Refresh + Export */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div
            className="flex gap-1 bg-white/10 border border-white/12 rounded-xl p-1"
            role="group"
            aria-label="Analytics timeframe"
          >
            {RANGES.map((range) => (
              <button
                key={range}
                type="button"
                onClick={() => onDaysChange(range)}
                aria-pressed={days === range}
                className={`min-h-tap text-sm font-semibold px-3 rounded-lg transition-colors ${
                  days === range
                    ? "bg-primary text-white shadow-xs"
                    : "text-border-strong hover:text-white"
                }`}
              >
                {range} days
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            aria-label="Refresh analytics"
            title="Refresh analytics"
            className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-white/10 hover:bg-white/16 border border-white/12 text-bg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} aria-hidden />
          </button>

          <button
            type="button"
            disabled={refreshing}
            onClick={() => setMenuOpen(true)}
            className="inline-flex min-h-tap items-center gap-1.5 rounded-xl bg-bg px-4 text-sm font-semibold text-ink transition-colors hover:bg-bg-subtle disabled:opacity-50"
          >
            <Download className="h-4 w-4 text-primary" aria-hidden />
            Export
          </button>
        </div>
      </div>

      <Sheet open={menuOpen && !refreshing} onClose={() => setMenuOpen(false)} title="Export analytics" description={`Last ${days} days · outside users only`}>
        <div className="-mx-2 flex flex-col">
          <button type="button" onClick={handleCopyEvidence} className={EXPORT_ITEM}>
            {copiedMd ? (
              <Check className="h-5 w-5 text-success" aria-hidden />
            ) : (
              <ClipboardCopy className="h-5 w-5 text-primary" aria-hidden />
            )}
            Copy Usage Evidence (.md)
          </button>
          <button type="button" onClick={handleDownloadUsersCsv} className={EXPORT_ITEM}>
            <FileSpreadsheet className="h-5 w-5 text-success" aria-hidden />
            Export Users CSV
          </button>
          <button type="button" onClick={handleDownloadDailyCsv} className={EXPORT_ITEM}>
            <FileSpreadsheet className="h-5 w-5 text-warning" aria-hidden />
            Export Daily Traffic CSV
          </button>
          <button type="button" onClick={handleDownloadJson} className={EXPORT_ITEM}>
            <FileJson className="h-5 w-5 text-ink-soft" aria-hidden />
            Download Full Snapshot (.json)
          </button>
        </div>
      </Sheet>

      {/* Live Health Strip */}
      <div className="grid grid-cols-2 gap-2 mt-5 pt-4 border-t border-white/10 sm:grid-cols-4 sm:gap-3 sm:mt-6 sm:pt-5">
        {healthItems.map((item) => (
          <div
            key={item.label}
            className="rounded-2xl bg-white/6 border border-white/10 px-3 py-2.5 flex flex-col gap-0.5 sm:flex-row sm:flex-wrap sm:items-baseline sm:justify-between sm:gap-2"
          >
            <span className="text-label uppercase tracking-wider text-[#C7BDB2] font-medium">
              {item.label}
            </span>
            <span className={`font-mono text-base font-semibold ${item.accent}`}>
              {item.value}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
