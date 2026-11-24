"use client";

import { Clock, AlertTriangle } from "lucide-react";
import { formatCountdown, formatResetTime } from "@/lib/serviceStatus";
import { useServiceStatus } from "./ServiceStatusProvider";

export default function ServiceStatusBanner() {
  const { status, remainingMs } = useServiceStatus();

  if (!status?.isDown) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="service-status-banner"
      className="relative z-40 border-b border-warning/30 bg-atlas-dark text-bg"
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-2.5 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
        <div className="flex items-start gap-2.5 sm:items-center">
          <span className="mt-0.5 inline-flex shrink-0 items-center gap-1.5 rounded-full border border-warning/40 bg-warning/20 px-2.5 py-0.5 text-label font-semibold text-[#FCD34D] sm:mt-0">
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
            AI Planner Paused
          </span>
          <p className="text-xs leading-relaxed text-bg/90 sm:text-sm">
            {status.message}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:shrink-0">
          {status.availableAt && (
            <div className="inline-flex items-center gap-2 rounded-xl border border-bg/15 bg-bg/10 px-3 py-1.5 text-xs sm:text-sm">
              <Clock className="h-4 w-4 text-[#FCD34D]" aria-hidden />
              <span className="text-bg/80">Resumes in</span>
              <span
                data-testid="service-status-countdown"
                className="font-mono font-semibold tabular-nums text-[#FCD34D]"
              >
                {formatCountdown(remainingMs)}
              </span>
              <span className="hidden text-label text-bg/65 sm:inline">
                ({formatResetTime(status.availableAt)})
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
