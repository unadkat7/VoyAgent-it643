"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Compass, Map, MessageSquareHeart } from "lucide-react";
import FeedbackSheet from "@/components/feedback/FeedbackSheet";

const ITEM = "flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-xs font-semibold";

// Thumb-reach navigation for signed-in pages on phones and tablets.
export default function BottomNav({ page, isAdmin = false }) {
  const pathname = usePathname();
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  const links = [
    { href: "/dashboard", label: "Trips", icon: Map },
    { href: "/trip/new", label: "Plan", icon: Compass },
    ...(isAdmin ? [{ href: "/admin", label: "Admin", icon: BarChart3 }] : []),
  ];

  return (
    <>
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
      >
        <div className="mx-auto flex max-w-lg">
          {links.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`${ITEM} ${active ? "text-primary" : "text-muted hover:text-ink"}`}
              >
                <Icon className="h-5 w-5" aria-hidden />
                {label}
              </Link>
            );
          })}
          <button type="button" onClick={() => setFeedbackOpen(true)} className={`${ITEM} text-muted hover:text-ink`}>
            <MessageSquareHeart className="h-5 w-5" aria-hidden />
            Feedback
          </button>
        </div>
      </nav>
      <FeedbackSheet open={feedbackOpen} onClose={() => setFeedbackOpen(false)} page={page} />
    </>
  );
}
