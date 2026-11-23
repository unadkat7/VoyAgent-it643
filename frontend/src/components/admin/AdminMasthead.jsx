"use client";

import { useEffect, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
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

const RANGES = [7, 30, 90];

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
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [menuOpen]);

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
      accent: "text-[#F29674]",
    },
    {
      label: "Live Pricing",
      value: formatPercent(trips.priceSourceCoverage.liveOverallPct),
      accent: "text-[#FCD34D]",
    },
    {
      label: "Feedback Avg",
      value: stats.averageRating ? `${stats.averageRating} ★` : "—",
      accent: "text-[#FAF8F4]",
    },
  ];

  return (
    <section className="relative bg-atlas-dark text-[#FAF8F4] rounded-2xl sm:rounded-3xl p-4 sm:p-7 shadow-[0_24px_54px_-28px_rgba(24,20,17,0.5)] border border-[#2C2520]">
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-5">
        <div className="space-y-2.5">
          <div className="hidden sm:flex flex-wrap items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#F29674]">
              Telemetry &amp; Intelligence
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[#D6CCC0] bg-white/8 border border-white/10 px-2.5 py-0.5 rounded-full">
              <ShieldCheck className="w-3 h-3 text-[#4ADE80]" aria-hidden />
              Outside users only · Emails masked · No full IPs
            </span>
          </div>

          <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-[#FAF8F4]">
            Admin Command Center
          </h1>

          <p className="text-xs sm:text-sm text-[#C7BDB2] max-w-2xl">
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
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                  days === range
                    ? "bg-[#CE532D] text-white shadow-xs"
                    : "text-[#D6CCC0] hover:text-white"
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
            className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-white/10 hover:bg-white/16 border border-white/12 text-[#FAF8F4] transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} aria-hidden />
          </button>

          <div className="static sm:relative" ref={menuRef}>
            <button
              type="button"
              disabled={refreshing}
              onClick={() => setMenuOpen((prev) => !prev)}
              aria-expanded={menuOpen}
              className="inline-flex items-center gap-1.5 text-xs font-semibold bg-[#FAF8F4] text-[#181411] hover:bg-[#F2EDE4] px-3.5 py-2 rounded-xl transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-[#CE532D]" aria-hidden />
              Export
              <ChevronDown className="w-3.5 h-3.5 text-[#73685E]" aria-hidden />
            </button>

            {menuOpen && !refreshing && (
              <div className="absolute inset-x-3 top-full sm:inset-x-auto sm:right-0 mt-2 sm:w-60 bg-white text-[#181411] border border-[#E7E0D5] rounded-2xl shadow-2xl p-1.5 z-40">
                <button
                  type="button"
                  onClick={handleCopyEvidence}
                  className="w-full flex items-center gap-2.5 text-left px-3 py-2 rounded-xl text-xs font-medium hover:bg-[#FAF8F4] transition-colors"
                >
                  {copiedMd ? (
                    <Check className="w-3.5 h-3.5 text-[#15803D]" aria-hidden />
                  ) : (
                    <ClipboardCopy className="w-3.5 h-3.5 text-[#CE532D]" aria-hidden />
                  )}
                  Copy Usage Evidence (.md)
                </button>
                <button
                  type="button"
                  onClick={handleDownloadUsersCsv}
                  className="w-full flex items-center gap-2.5 text-left px-3 py-2 rounded-xl text-xs font-medium hover:bg-[#FAF8F4] transition-colors"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-[#15803D]" aria-hidden />
                  Export Users CSV
                </button>
                <button
                  type="button"
                  onClick={handleDownloadDailyCsv}
                  className="w-full flex items-center gap-2.5 text-left px-3 py-2 rounded-xl text-xs font-medium hover:bg-[#FAF8F4] transition-colors"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-[#B45309]" aria-hidden />
                  Export Daily Traffic CSV
                </button>
                <button
                  type="button"
                  onClick={handleDownloadJson}
                  className="w-full flex items-center gap-2.5 text-left px-3 py-2 rounded-xl text-xs font-medium hover:bg-[#FAF8F4] transition-colors"
                >
                  <FileJson className="w-3.5 h-3.5 text-[#3B342E]" aria-hidden />
                  Download Full Snapshot (.json)
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Live Health Strip */}
      <div className="hidden sm:grid sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-white/10">
        {healthItems.map((item) => (
          <div
            key={item.label}
            className="rounded-2xl bg-white/6 border border-white/10 px-3 py-3 flex flex-wrap items-baseline justify-between gap-2"
          >
            <span className="text-[11px] uppercase tracking-wider text-[#C7BDB2] font-medium">
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
