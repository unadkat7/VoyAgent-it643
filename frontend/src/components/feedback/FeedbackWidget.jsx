"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MessageSquareHeart, Star, X } from "lucide-react";
import toast from "react-hot-toast";
import { sendFeedback } from "@/services/feedback.service";

const RATINGS = [
  { value: 1, label: "Needs work" },
  { value: 2, label: "Could be better" },
  { value: 3, label: "Decent" },
  { value: 4, label: "Great" },
  { value: 5, label: "Loved it" },
];

// Feedback is part of the project's evidence of outside use (see USAGE_EVIDENCE.md).
export default function FeedbackWidget({ page }) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const activeRating = hovered || rating;
  const activeLabel = RATINGS.find((r) => r.value === activeRating)?.label;

  const submit = async (event) => {
    event.preventDefault();
    if (!rating) return toast.error("Pick a rating first");
    try {
      setSending(true);
      await sendFeedback({ rating, message: message.trim(), page });
      toast.success("Thanks for the feedback!");
      setOpen(false);
      setRating(0);
      setHovered(0);
      setMessage("");
    } catch {
      toast.error("Could not send feedback. Please try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed bottom-5 right-5 z-40">
      <AnimatePresence mode="wait">
        {!open ? (
          <motion.button
            key="trigger"
            type="button"
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.92 }}
            onClick={() => setOpen(true)}
            className="flex items-center gap-2 bg-[#181411] hover:bg-[#2C2520] text-[#FAF8F4] text-xs font-semibold px-4 py-2.5 rounded-full shadow-lg shadow-[#181411]/20 border border-[#FAF8F4]/10 transition-colors"
          >
            <MessageSquareHeart className="w-3.5 h-3.5 text-[#F29674]" aria-hidden />
            Feedback
          </motion.button>
        ) : (
          <motion.form
            key="popover"
            onSubmit={submit}
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96 }}
            transition={{ duration: 0.18 }}
            className="w-[calc(100vw-2.5rem)] max-w-xs bg-white border border-[#E7E0D5] rounded-2xl shadow-2xl shadow-[#181411]/15 p-5"
          >
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="font-display text-base font-semibold text-[#181411]">
                  How was this experience?
                </p>
                <p className="text-[11px] text-[#73685E]">Helps us sharpen the Planning Engine</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close feedback"
                className="w-7 h-7 rounded-lg flex items-center justify-center text-[#73685E] hover:text-[#181411] hover:bg-[#FAF8F4] transition-colors"
              >
                <X className="w-4 h-4" aria-hidden />
              </button>
            </div>

            <div className="flex items-center justify-between mb-3">
              <div
                className="flex gap-1"
                role="radiogroup"
                aria-label="Rating"
                onMouseLeave={() => setHovered(0)}
              >
                {RATINGS.map(({ value }) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={rating === value}
                    aria-label={`${value} star${value > 1 ? "s" : ""}`}
                    onMouseEnter={() => setHovered(value)}
                    onClick={() => setRating(value)}
                    className="p-0.5 transition-transform hover:scale-110"
                  >
                    <Star
                      className={`w-6 h-6 transition-colors ${
                        value <= activeRating
                          ? "fill-[#D97706] text-[#D97706]"
                          : "text-[#D6CCC0]"
                      }`}
                      aria-hidden
                    />
                  </button>
                ))}
              </div>
              {activeLabel && (
                <span className="text-[11px] font-semibold text-[#B45309] bg-[#FEF7E6] px-2 py-0.5 rounded-full">
                  {activeLabel}
                </span>
              )}
            </div>

            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              maxLength={1000}
              rows={3}
              placeholder="What worked well, or what felt off? (optional)"
              className="w-full bg-[#FDFBF7] border border-[#E7E0D5] rounded-xl px-3 py-2.5 text-sm text-[#181411] placeholder-[#A89E94] mb-3 focus:outline-none focus:bg-white focus:border-[#CE532D] focus:ring-2 focus:ring-[#CE532D]/15 resize-none transition-all"
            />
            <button
              type="submit"
              disabled={sending}
              className="w-full bg-[#CE532D] hover:bg-[#B54320] disabled:opacity-50 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors"
            >
              {sending ? "Sending..." : "Send feedback"}
            </button>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}
