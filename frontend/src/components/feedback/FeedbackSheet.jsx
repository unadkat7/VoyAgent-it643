"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import toast from "react-hot-toast";
import Sheet from "@/components/ui/Sheet";
import { sendFeedback } from "@/services/feedback.service";

const RATINGS = [
  { value: 1, label: "Needs work" },
  { value: 2, label: "Could be better" },
  { value: 3, label: "Decent" },
  { value: 4, label: "Great" },
  { value: 5, label: "Loved it" },
];

const CATEGORIES = [
  { id: "general", label: "General" },
  { id: "planning", label: "Planning" },
  { id: "itinerary", label: "Itinerary" },
  { id: "budget", label: "Budget" },
  { id: "map", label: "Map" },
  { id: "bug", label: "Bug" },
  { id: "feature", label: "Idea" },
];

// Feedback is part of the project's evidence of outside use (see USAGE_EVIDENCE.md).
export default function FeedbackSheet({ open, onClose, page }) {
  const [rating, setRating] = useState(0);
  const [category, setCategory] = useState("general");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const activeLabel = RATINGS.find((r) => r.value === rating)?.label;

  const submit = async (event) => {
    event.preventDefault();
    if (!rating) return toast.error("Pick a rating first");
    try {
      setSending(true);
      await sendFeedback({ rating, message: message.trim(), page, category });
      toast.success("Thanks for the feedback!");
      setRating(0);
      setCategory("general");
      setMessage("");
      onClose();
    } catch {
      toast.error("Could not send feedback. Please try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="How was this experience?" description="Helps us sharpen the Planning Engine">
      <form onSubmit={submit} className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex" role="radiogroup" aria-label="Rating">
            {RATINGS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={rating === value}
                aria-label={`${value} star${value > 1 ? "s" : ""}, ${label}`}
                onClick={() => setRating(value)}
                className="flex size-tap items-center justify-center rounded-xl"
              >
                <Star className={`h-7 w-7 ${value <= rating ? "fill-star text-star" : "text-border-strong"}`} aria-hidden />
              </button>
            ))}
          </div>
          {activeLabel && <span className="text-sm font-semibold text-warning">{activeLabel}</span>}
        </div>

        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-ink-soft">Topic</legend>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setCategory(item.id)}
                aria-pressed={category === item.id}
                className="min-h-tap rounded-full border border-border px-4 text-sm font-medium text-ink-soft aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-bg"
              >
                {item.label}
              </button>
            ))}
          </div>
        </fieldset>

        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-ink-soft">Anything to add? (optional)</span>
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            maxLength={1000}
            rows={3}
            placeholder="What worked well, or what felt off?"
            className="w-full resize-none rounded-xl border border-border bg-surface-warm px-3 py-2.5 text-base text-ink placeholder-faint focus:border-primary focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/15"
          />
        </label>

        <button
          type="submit"
          disabled={sending}
          className="min-h-tap w-full rounded-xl bg-primary text-base font-semibold text-white hover:bg-primary-hover disabled:opacity-50"
        >
          {sending ? "Sending..." : "Send feedback"}
        </button>
      </form>
    </Sheet>
  );
}
