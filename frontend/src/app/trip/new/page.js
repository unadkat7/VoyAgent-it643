"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Compass, Plus, RefreshCw, Send, Sparkles, User } from "lucide-react";
import { getCurrentUser } from "@/services/auth.service";
import { trackInteraction } from "@/services/event.service";
import { getTripById, planTrip } from "@/services/trip.service";
import AppHeader from "@/components/layout/AppHeader";
import BrandLogo from "@/components/layout/BrandLogo";
import AgentProgressCard from "@/components/trip/AgentProgressCard";
import TripBriefBuilder from "@/components/trip/TripBriefBuilder";
import SegmentedControl from "@/components/ui/SegmentedControl";
import { EXAMPLE_TRIPS } from "@/lib/exampleTrips";

const WELCOME = {
  role: "assistant",
  content:
    "Hi! I'm VoyAgent. Tell me your Origin, Destination, how many days, Party Size, total INR Budget and Travel Style. Or switch to the brief builder above.",
};

const FIELD_META = {
  origin: { label: "Origin", placeholder: "e.g. Pune", quick: "Starting from Mumbai" },
  destination: { label: "Destination", placeholder: "e.g. Goa", quick: "Going to Goa" },
  duration_days: { label: "Duration", placeholder: "e.g. 3 days", quick: "For 3 days" },
  budget: { label: "Budget (INR)", placeholder: "e.g. ₹35,000", quick: "Total Budget ₹30,000" },
  party_size: { label: "Party Size", placeholder: "e.g. 2 people", quick: "2 people" },
  travel_style: { label: "Travel Style", placeholder: "e.g. relaxed", quick: "Relaxed style" },
};

const PLANNING_METHODS = [
  { value: "chat", label: "Describe your trip" },
  { value: "brief", label: "Use the brief builder" },
];

const MAX_PROMPT_LENGTH = 2000;
// About five lines; past that the message box scrolls.
const MAX_COMPOSER_HEIGHT = 160;

const HEADER_BUTTON =
  "inline-flex min-h-tap min-w-tap items-center justify-center gap-1.5 rounded-xl text-sm font-semibold text-ink-soft hover:bg-bg-subtle hover:text-ink disabled:opacity-50";

function errorReply(error) {
  const status = error.response?.status;
  if (status === 409) return "This Trip is already planned. Start a new Trip to plan something else.";
  if (status === 429) return "You have reached the planning limit for now. Please try again in an hour.";
  if (status === 400) return "Please write a shorter message (up to 2,000 characters).";
  return "The planner is unavailable right now. Please send your message again in a minute.";
}

function TripPlanner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  const initialPrompt = searchParams.get("prompt") ?? "";
  const [tripId, setTripId] = useState(searchParams.get("tripId"));
  const [messages, setMessages] = useState([WELCOME]);
  const [missingFields, setMissingFields] = useState([]);
  const [clarificationDraft, setClarificationDraft] = useState({});
  const [prompt, setPrompt] = useState(initialPrompt);
  const [briefVersion, setBriefVersion] = useState(0);
  const [showBrief, setShowBrief] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  const resume = useCallback(async () => {
    try {
      const auth = await getCurrentUser();
      if (!auth?.user) return router.replace("/login");
      if (!tripId) return;

      const { trip } = await getTripById(tripId);
      if (trip.status === "planned") return router.replace(`/trip/${trip._id}`);
      setMessages([WELCOME, ...trip.conversation]);
      setMissingFields(trip.status === "draft" ? (trip.clarification?.missingFields ?? []) : []);
      setShowBrief(false);
    } catch {
      setTripId(null);
      router.replace("/trip/new");
    } finally {
      setReady(true);
    }
    // Only on first load; later tripId changes come from our own replies.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  useEffect(() => {
    resume();
  }, [resume]);

  useEffect(() => {
    if (messages.length > 1 || loading) bottomRef.current?.scrollIntoView({ block: "nearest" });
  }, [messages, loading]);

  // Grow the message box with its text, including text filled in by chips or the brief builder.
  useEffect(() => {
    const box = inputRef.current;
    if (!box) return;
    box.style.height = "auto";
    if (!prompt) return;
    if (box.scrollHeight > 0) box.style.height = `${Math.min(box.scrollHeight, MAX_COMPOSER_HEIGHT)}px`;
  }, [prompt]);

  const send = async (text) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    setMessages((prev) => [...prev, { role: "traveler", content: trimmed }]);
    setPrompt("");
    setMissingFields([]);
    setClarificationDraft({});
    setShowBrief(false);
    setLoading(true);

    try {
      const { trip } = await planTrip({ prompt: trimmed, tripId: tripId ?? undefined });
      setTripId(trip._id);
      router.replace(`/trip/new?tripId=${trip._id}`, { scroll: false });

      if (trip.status === "planned") {
        router.push(`/trip/${trip._id}`);
      } else {
        setMessages((prev) => [...prev, { role: "assistant", content: trip.clarification.question }]);
        setMissingFields(trip.clarification.missingFields ?? []);
      }
    } catch (error) {
      if (error.response?.status === 401) return router.replace("/login");
      // A failed planning attempt is still saved, so the next message continues the same Trip.
      const failedTripId = error.response?.data?.tripId;
      if (failedTripId) {
        setTripId(failedTripId);
        router.replace(`/trip/new?tripId=${failedTripId}`, { scroll: false });
      }
      setPrompt(trimmed);
      setMessages((prev) => [...prev, { role: "assistant", content: errorReply(error) }]);
    } finally {
      setLoading(false);
    }
  };

  const startNewTrip = () => {
    setTripId(null);
    setBriefVersion((version) => version + 1);
    setMessages([WELCOME]);
    setMissingFields([]);
    setClarificationDraft({});
    setPrompt("");
    setShowBrief(false);
    router.replace("/trip/new");
  };

  const addQuickAnswer = (field) => {
    const answer = FIELD_META[field]?.quick;
    if (answer) {
      setPrompt((prev) => (prev ? `${prev}, ${answer}` : answer));
      inputRef.current?.focus();
    }
  };

  const submitClarificationInline = (event) => {
    event.preventDefault();
    const entries = missingFields
      .map((field) => {
        const val = clarificationDraft[field]?.trim();
        if (!val) return null;
        const label = FIELD_META[field]?.label ?? field;
        return `${label}: ${val}`;
      })
      .filter(Boolean);
    if (entries.length === 0) return;
    trackInteraction("clarification_inline_submitted", {
      tripId: tripId ?? undefined,
      path: "/trip/new",
    });
    send(entries.join(", "));
  };

  const handleComposerKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing && !window.matchMedia?.("(pointer: coarse)").matches) {
      event.preventDefault();
      send(prompt);
    }
  };

  const hasStarted = messages.length > 1;
  const hasInlineClarificationValues = missingFields.some(
    (field) => clarificationDraft[field]?.trim().length > 0
  );

  return (
    <div className="flex h-dvh flex-col bg-bg font-sans">
      <AppHeader
        maxWidth="max-w-4xl"
        left={
          <>
            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              aria-label="Back to dashboard"
              className={`${HEADER_BUTTON} sm:px-3`}
            >
              <ArrowLeft className="h-5 w-5" aria-hidden />
              <span className="hidden sm:inline">Trips</span>
            </button>
            <BrandLogo size="sm" subtitle="Trip Studio" />
          </>
        }
        right={
          <button type="button" disabled={loading || !ready} onClick={startNewTrip} className={`${HEADER_BUTTON} px-3`}>
            <RefreshCw className="h-4 w-4" aria-hidden />
            New trip
          </button>
        }
      />

      {/* Conversation */}
      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl space-y-5 px-4 py-5 sm:px-6 sm:py-6" aria-live="polite">
          {!hasStarted && (
            <div className="space-y-4">
              <h1 className="font-display text-3xl font-semibold text-ink sm:text-4xl">Plan your trip</h1>
              <SegmentedControl
                label="Planning method"
                options={PLANNING_METHODS}
                value={showBrief ? "brief" : "chat"}
                onChange={(method) => setShowBrief(method === "brief")}
              />
            </div>
          )}
          <AnimatePresence initial={false}>
            {messages.filter((_, index) => index > 0 || (!showBrief && !hasStarted)).map((message, index) => {
              const mine = message.role === "traveler";
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className={`flex items-start gap-2.5 ${mine ? "flex-row-reverse" : "flex-row"}`}
                >
                  <div
                    className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl ${
                      mine ? "bg-ink text-bg" : "bg-primary text-white"
                    }`}
                  >
                    {mine ? <User className="h-4 w-4" aria-hidden /> : <Compass className="h-4 w-4" aria-hidden />}
                  </div>
                  <div
                    className={`max-w-[85%] whitespace-pre-line rounded-2xl px-4 py-3 text-body sm:max-w-[76%] ${
                      mine ? "rounded-tr-sm bg-ink text-bg" : "rounded-tl-sm border border-border bg-surface text-ink"
                    }`}
                  >
                    {message.content}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {/* Brief builder or examples, before the first message */}
          {ready && !hasStarted && !loading && (
            <div className="space-y-6">
              <div hidden={!showBrief}>
                <TripBriefBuilder
                  key={briefVersion}
                  disabled={loading}
                  onSubmitPrompt={(composed) => {
                    trackInteraction("brief_builder_submitted", { path: "/trip/new" });
                    send(composed);
                  }}
                  onPrefillPrompt={(composed) => {
                    trackInteraction("brief_builder_prefilled", { path: "/trip/new" });
                    setPrompt(composed);
                    setShowBrief(false);
                    requestAnimationFrame(() => inputRef.current?.focus());
                  }}
                />
              </div>

              <div hidden={showBrief}>
                <p className="mb-2.5 flex items-center gap-1.5 text-sm font-semibold text-ink-soft">
                  <Sparkles className="h-4 w-4 text-primary" aria-hidden />
                  Start from an example
                </p>
                <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0">
                  {EXAMPLE_TRIPS.map((card) => (
                    <button
                      key={card.title}
                      type="button"
                      onClick={() => {
                        trackInteraction("starter_trip_selected", {
                          value: "studio",
                          path: "/trip/new",
                        });
                        send(card.prompt);
                      }}
                      className="group w-64 shrink-0 snap-start rounded-2xl border border-border bg-surface p-4 text-left transition-all hover:border-primary/50 sm:w-auto"
                    >
                      <p className="text-label font-semibold uppercase tracking-wider text-primary">{card.route}</p>
                      <p className="mt-0.5 font-display text-lg font-semibold text-ink group-hover:text-primary">
                        {card.title}
                      </p>
                      <p className="mt-1 text-sm text-muted">{card.meta}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {loading && <AgentProgressCard loading={loading} />}

          {/* Missing Trip details */}
          {missingFields.length > 0 && !loading && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-xl space-y-4 rounded-2xl border border-primary-border bg-surface p-4 sm:ml-11 sm:p-5"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-base font-semibold text-ink">Complete missing Trip details</p>
                  <p className="text-sm text-muted">Type your own values or tap a quick-fill chip.</p>
                </div>
                <span className="shrink-0 rounded-full bg-warning-light px-2.5 py-0.5 text-sm font-semibold text-warning">
                  {missingFields.length} needed
                </span>
              </div>

              <form onSubmit={submitClarificationInline} className="space-y-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {missingFields.map((field) => {
                    const meta = FIELD_META[field] ?? { label: field, placeholder: `Enter ${field}` };
                    return (
                      <label key={field} className="flex flex-col gap-1">
                        <span className="text-sm font-semibold text-ink-soft">{meta.label}</span>
                        <input
                          type="text"
                          value={clarificationDraft[field] ?? ""}
                          onChange={(e) =>
                            setClarificationDraft((prev) => ({
                              ...prev,
                              [field]: e.target.value,
                            }))
                          }
                          placeholder={meta.placeholder}
                          className="min-h-tap rounded-xl border border-border bg-surface-warm px-3 text-base text-ink placeholder-faint focus:border-primary focus:bg-surface focus:outline-none"
                        />
                      </label>
                    );
                  })}
                </div>

                <div className="flex flex-wrap gap-2">
                  {missingFields.map((field) => (
                    <button
                      key={field}
                      type="button"
                      onClick={() => addQuickAnswer(field)}
                      className="inline-flex min-h-tap items-center gap-1 rounded-xl border border-border bg-bg px-3 text-sm font-medium text-ink-soft hover:border-primary/40 hover:text-primary"
                    >
                      <Plus className="h-4 w-4" aria-hidden />
                      {FIELD_META[field]?.label ?? field}
                    </button>
                  ))}
                </div>
                <button
                  type="submit"
                  disabled={!hasInlineClarificationValues}
                  className="inline-flex min-h-tap w-full items-center justify-center gap-1.5 rounded-xl bg-primary px-4 text-base font-semibold text-white hover:bg-primary-hover disabled:opacity-40 sm:w-auto"
                >
                  Send details
                  <Send className="h-4 w-4" aria-hidden />
                </button>
              </form>
            </motion.div>
          )}

          <div ref={bottomRef} />
        </div>
      </main>

      {/* Message box */}
      <footer hidden={showBrief && !hasStarted} className="safe-footer shrink-0 border-t border-border bg-surface px-4 pt-3">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            send(prompt);
          }}
          className="mx-auto max-w-4xl"
        >
          <div className="flex items-end gap-2 rounded-2xl border border-border bg-surface-warm p-1.5 transition-all focus-within:border-primary focus-within:bg-surface focus-within:ring-2 focus-within:ring-primary/15">
            <label htmlFor="trip-prompt" className="sr-only">
              Describe your Trip
            </label>
            <textarea
              ref={inputRef}
              id="trip-prompt"
              rows={1}
              enterKeyHint="send"
              placeholder="e.g. 3 days in Goa for 2, ₹30,000"
              value={prompt}
              maxLength={MAX_PROMPT_LENGTH}
              onChange={(event) => setPrompt(event.target.value)}
              onKeyDown={handleComposerKeyDown}
              disabled={loading}
              className="min-h-tap min-w-0 flex-1 resize-none bg-transparent px-2.5 py-2.5 text-base leading-6 text-ink placeholder-faint focus:outline-none"
            />
            <button
              type="submit"
              aria-label="Send message"
              disabled={!ready || loading || !prompt.trim()}
              className="inline-flex size-tap shrink-0 items-center justify-center rounded-xl bg-primary text-white transition-all hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto sm:gap-1.5 sm:px-4"
            >
              <Send className="h-4 w-4" aria-hidden />
              <span className="hidden text-sm font-semibold sm:inline">Send</span>
            </button>
          </div>
          <div className="mt-1 flex items-center justify-between px-1 text-label text-muted">
            <span className="hidden sm:inline">Press Enter to send · Shift+Enter for new line</span>
            {prompt.length > 1400 && (
              <span className="font-mono">
                {prompt.length}/{MAX_PROMPT_LENGTH}
              </span>
            )}
          </div>
        </form>
      </footer>
    </div>
  );
}

export default function NewTripPage() {
  // useSearchParams needs a Suspense boundary in the App Router.
  return (
    <Suspense fallback={<div className="h-dvh bg-bg" />}>
      <TripPlanner />
    </Suspense>
  );
}
