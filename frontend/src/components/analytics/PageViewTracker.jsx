"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { sendPageview } from "@/services/event.service";

function externalReferrer() {
  if (typeof document === "undefined" || typeof window === "undefined") return null;
  const raw = document.referrer;
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    if (parsed.host && parsed.host !== window.location.host) {
      return raw;
    }
  } catch {
    return null;
  }
  return null;
}

// Our own page-view log, so the admin page can show visitors next to sign-ups.
export default function PageViewTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) return;
    const ref = externalReferrer();
    const request = ref ? sendPageview(pathname, ref) : sendPageview(pathname);
    request.catch((error) => {
      // Counting a view must never break the page, but a failure should still be visible.
      console.warn("Page view not recorded:", error.message);
    });
  }, [pathname]);

  return null;
}
