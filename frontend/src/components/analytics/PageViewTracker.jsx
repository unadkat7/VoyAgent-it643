"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { sendPageview } from "@/services/event.service";

// Our own page-view log, so the admin page can show visitors next to sign-ups.
export default function PageViewTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) return;
    sendPageview(pathname).catch((error) => {
      // Counting a view must never break the page, but a failure should still be visible.
      console.warn("Page view not recorded:", error.message);
    });
  }, [pathname]);

  return null;
}
