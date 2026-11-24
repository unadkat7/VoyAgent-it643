"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, MessageCircle, Send } from "lucide-react";
import { useServiceStatus } from "@/components/status/ServiceStatusProvider";
import Sheet from "@/components/ui/Sheet";
import { formatCountdown } from "@/lib/serviceStatus";
import { chatAboutTrip } from "@/services/trip.service";

const CHIPS = [
  { id: "cheaper", text: "Make it cheaper" },
  { id: "add_day", text: "Add one more day" },
  { id: "food", text: "Suggest good local food spots" },
  { id: "slower", text: "Make the days slower and more relaxed" },
];
const MAX_MESSAGE = 1000;

function errorReply(error) {
  const status = error.response?.status;
  if (status === 409) return "This plan is Final. Switch it to Draft to change it.";
  if (status === 429) return error.response?.data?.message || "You have reached the planning limit for now. Try again in an hour.";
  if (status === 503 && error.response?.data?.code === "AI_LIMIT_REACHED") {
    return error.response?.data?.message || "AI trip chat is temporarily paused until provider limits reset.";
  }
  return "The planner is unavailable right now. Please send it again in a minute.";
}

// Chat about a planned Trip: ask questions, or say what to change and the plan is edited in place.
export default function TripChat({ trip, open, onOpenChange, onTripChange, onTrack }) {
  const { status: serviceStatus, remainingMs, refreshStatus } = useServiceStatus();
  const isPaused = Boolean(serviceStatus?.isDown);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [lastOutcome, setLastOutcome] = useState(null);
  const bottomRef = useRef(null);
  const turns = trip.conversation ?? [];

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ block: "nearest" });
  }, [open, turns.length, sending, pending]);

  const send = async (text) => {
    const trimmed = text.trim();
    if (!trimmed || sending || isPaused) return;
    setSending(true);
    setError(null);
    setMessage("");
    setPending(trimmed);
    try {
      const { trip: updated, outcome } = await chatAboutTrip(trip._id, trimmed);
      setLastOutcome(outcome);
      onTripChange(updated);
    } catch (err) {
      if (err.response?.status === 503 && err.response?.data?.code === "AI_LIMIT_REACHED") {
        refreshStatus();
      }
      setMessage(trimmed);
      setError(errorReply(err));
    } finally {
      setPending(null);
      setSending(false);
    }
  };

  // Same as the new-trip composer: Enter sends, Shift+Enter (and Enter on touch keyboards) adds a line.
  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing && !window.matchMedia?.("(pointer: coarse)").matches) {
      event.preventDefault();
      send(message);
    }
  };

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => {
            onTrack?.("trip_chat_opened", "fab");
            onOpenChange(true);
          }}
          className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-4 z-30 inline-flex min-h-tap items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-white shadow-lg shadow-primary/30 hover:bg-primary-hover lg:bottom-20 lg:right-5"
        >
          <MessageCircle className="h-5 w-5" aria-hidden />
          Ask or change
        </button>
      )}

      <Sheet
        open={open}
        onClose={() => onOpenChange(false)}
        placement="side"
        title="Ask or change your plan"
        description="Ask anything about the trip, or say what to change."
        footer={
          <form
            onSubmit={(event) => {
              event.preventDefault();
              send(message);
            }}
            className="space-y-2"
          >
            {isPaused && (
              <div
                role="alert"
                className="flex flex-wrap items-center justify-between gap-1.5 rounded-xl border border-warning/30 bg-warning-light px-3 py-2 text-xs font-medium text-warning"
              >
                <span>AI edits paused while provider limits reset.</span>
                {serviceStatus.availableAt && (
                  <span className="font-mono font-semibold tabular-nums">
                    {formatCountdown(remainingMs)}
                  </span>
                )}
              </div>
            )}
            <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
              {CHIPS.map((chip) => (
                <button
                  key={chip.id}
                  type="button"
                  disabled={sending || isPaused}
                  onClick={() => {
                    onTrack?.("chat_chip_used", chip.id);
                    send(chip.text);
                  }}
                  className="shrink-0 rounded-full border border-border bg-bg px-3 py-1.5 text-sm text-ink-soft hover:border-primary/40 hover:text-primary disabled:opacity-50"
                >
                  {chip.text}
                </button>
              ))}
            </div>
            <div className="flex items-end gap-2 rounded-2xl border border-border bg-surface-warm p-1.5 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15">
              <label htmlFor="trip-chat-input" className="sr-only">
                Message about this trip
              </label>
              <textarea
                id="trip-chat-input"
                rows={1}
                value={message}
                maxLength={MAX_MESSAGE}
                disabled={sending || isPaused}
                onChange={(event) => setMessage(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isPaused ? "AI chat is temporarily paused" : "e.g. swap day 2 for a beach day"}
                className="min-h-tap max-h-32 min-w-0 flex-1 resize-none overflow-y-auto rounded-xl bg-transparent px-2.5 py-2.5 text-base leading-6 text-ink placeholder-faint focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
              />
              <button
                type="submit"
                aria-label="Send"
                disabled={sending || isPaused || !message.trim()}
                className="inline-flex size-tap shrink-0 items-center justify-center rounded-xl bg-primary text-white hover:bg-primary-hover disabled:opacity-40"
              >
                <Send className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </form>
        }
      >
        <ol className="space-y-3" aria-live="polite">
          {turns.map((turn, index) => {
            const mine = turn.role === "traveler";
            const isLatestReply = !mine && index === turns.length - 1;
            return (
              <li key={index} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] whitespace-pre-line rounded-2xl px-3.5 py-2.5 text-sm ${
                    mine ? "rounded-tr-sm bg-ink text-bg" : "rounded-tl-sm border border-border bg-bg text-ink"
                  }`}
                >
                  {turn.content}
                  {isLatestReply && lastOutcome === "updated" && (
                    <span className="mt-1.5 block text-label font-semibold text-success">
                      Plan updated
                    </span>
                  )}
                </div>
              </li>
            );
          })}
          {pending && (
            <li className="flex justify-end">
              <div className="max-w-[85%] whitespace-pre-line rounded-2xl rounded-tr-sm bg-ink px-3.5 py-2.5 text-sm text-bg">
                {pending}
              </div>
            </li>
          )}
          {sending && (
            <li className="flex items-center gap-2 text-sm text-muted">
              <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden />
              Working on it… changes to the plan can take up to 40 seconds.
            </li>
          )}
          {error && (
            <li role="alert" className="rounded-xl bg-warning-light px-3 py-2 text-sm text-warning">
              {error}
            </li>
          )}
        </ol>
        <div ref={bottomRef} />
      </Sheet>
    </>
  );
}
