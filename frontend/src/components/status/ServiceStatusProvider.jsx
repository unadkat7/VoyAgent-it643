"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { getServiceStatus } from "@/services/status.service";

const DEFAULT_STATUS = {
  isDown: false,
  message: null,
  groqResetAt: null,
  cloudflareResetAt: null,
  availableAt: null,
  resumingProvider: null,
  updatedAt: null,
};

const FALLBACK_CONTEXT = {
  status: DEFAULT_STATUS,
  remainingMs: 0,
  groqRemainingMs: null,
  cloudflareRemainingMs: null,
  refreshStatus: async () => DEFAULT_STATUS,
  setStatus: () => {},
};

const ServiceStatusContext = createContext(FALLBACK_CONTEXT);

function computeRemaining(iso, nowMs) {
  if (!iso) return null;
  const target = new Date(iso).getTime();
  if (Number.isNaN(target)) return null;
  return Math.max(0, target - nowMs);
}

export function ServiceStatusProvider({ children, initialStatus = null }) {
  const [status, setStatusState] = useState(initialStatus ?? DEFAULT_STATUS);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const autoClearedRef = useRef(false);

  const setStatus = useCallback((next) => {
    autoClearedRef.current = false;
    setStatusState(next ?? DEFAULT_STATUS);
    setNowMs(Date.now());
  }, []);

  const refreshStatus = useCallback(async () => {
    try {
      const latest = await getServiceStatus();
      setStatus(latest);
      return latest;
    } catch {
      return null;
    }
  }, [setStatus]);

  useEffect(() => {
    if (initialStatus !== null) return;
    let cancelled = false;
    getServiceStatus()
      .then((latest) => {
        if (!cancelled && latest) {
          setStatus(latest);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [initialStatus, setStatus]);

  // Tick every second only while downtime is active.
  useEffect(() => {
    if (!status?.isDown || !status?.availableAt) return undefined;
    const interval = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [status?.isDown, status?.availableAt]);

  const remainingMs = status?.isDown ? (computeRemaining(status.availableAt, nowMs) ?? 0) : 0;
  const groqRemainingMs = status?.isDown ? computeRemaining(status.groqResetAt, nowMs) : null;
  const cloudflareRemainingMs = status?.isDown
    ? computeRemaining(status.cloudflareResetAt, nowMs)
    : null;

  // Automatically clear and re-sync with the server the moment the earliest provider resets.
  useEffect(() => {
    if (!status?.isDown || !status?.availableAt) return;
    if (remainingMs > 0 || autoClearedRef.current) return;
    autoClearedRef.current = true;
    setStatusState(DEFAULT_STATUS);
    refreshStatus();
  }, [status?.isDown, status?.availableAt, remainingMs, refreshStatus]);

  const value = useMemo(
    () => ({
      status,
      remainingMs,
      groqRemainingMs,
      cloudflareRemainingMs,
      refreshStatus,
      setStatus,
    }),
    [status, remainingMs, groqRemainingMs, cloudflareRemainingMs, refreshStatus, setStatus]
  );

  return <ServiceStatusContext.Provider value={value}>{children}</ServiceStatusContext.Provider>;
}

export function useServiceStatus() {
  return useContext(ServiceStatusContext);
}
