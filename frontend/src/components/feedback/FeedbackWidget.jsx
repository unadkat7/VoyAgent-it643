"use client";

import { useState } from "react";
import { MessageSquareHeart } from "lucide-react";
import FeedbackSheet from "./FeedbackSheet";

// Floating trigger for wide screens; on phones the bottom nav opens the same sheet.
export default function FeedbackWidget({ page }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-40 hidden min-h-tap items-center gap-2 rounded-full bg-ink px-5 text-sm font-semibold text-bg shadow-lg shadow-ink/20 hover:bg-ink-hover lg:flex"
      >
        <MessageSquareHeart className="h-4 w-4 text-primary-soft" aria-hidden />
        Feedback
      </button>
      <FeedbackSheet open={open} onClose={() => setOpen(false)} page={page} />
    </>
  );
}
