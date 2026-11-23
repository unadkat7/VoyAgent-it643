"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  Compass,
  Plus,
  RefreshCw,
  Send,
  Sparkles,
  User,
} from "lucide-react";
import { getCurrentUser } from "@/services/auth.service";
import { trackInteraction } from "@/services/event.service";
import { getTripById, planTrip } from "@/services/trip.service";
import AppHeader from "@/components/layout/AppHeader";
import BrandLogo from "@/components/layout/BrandLogo";
import AgentProgressCard from "@/components/trip/AgentProgressCard";
import TripBriefBuilder from "@/components/trip/TripBriefBuilder";

const WELCOME = {
  role: "assistant",
  content:
    "Hi! I'm VoyAgent. Tell me your Origin, Destination, Duration in days, Party Size, total INR Budget, and Travel Style—or fill out the Guided Trip Brief below.",
};

const STARTER_CARDS = [
  {
    route: "Ahmedabad → Goa",
    title: "North Goa Beaches",
    meta: "3 days · 2 Travelers · ₹40,000 · Relaxed",
    prompt: "3 days in Goa from Ahmedabad, 2 people, ₹40,000, relaxed beach trip",
  },
  {
    route: "Delhi → Manali",
    title: "Manali Mountain Escape",
    meta: "3 days · 4 Travelers · ₹30,000 · Adventure",
    prompt: "Weekend in Manali from Delhi, 4 friends, ₹30,000, adventure",
  },
  {
    route: "Mumbai → Kerala",
    title: "Kerala Backwaters",
    meta: "4 days · Family of 4 · ₹60,000 · Relaxed",
    prompt: "4 days Kerala backwaters from Mumbai, family of 4, ₹60,000, relaxed",
  },
  {
    route: "Delhi → Jaipur",
    title: "Royal Rajasthan",
    meta: "5 days · 2 Travelers · ₹50,000 · Culture",
    prompt: "5-day Rajasthan tour from Delhi, 2 people, ₹50,000, culture",
  },
];

const FIELD_META = {
  origin: { label: "Origin", placeholder: "e.g. Pune", quick: "Starting from Mumbai" },
  destination: { label: "Destination", placeholder: "e.g. Goa", quick: "Going to Goa" },
  duration_days: { label: "Duration", placeholder: "e.g. 3 days", quick: "For 3 days" },
  budget: { label: "Budget (INR)", placeholder: "e.g. ₹35,000", quick: "Total Budget ₹30,000" },
  party_size: { label: "Party Size", placeholder: "e.g. 2 people", quick: "2 people" },
  travel_style: { label: "Travel Style", placeholder: "e.g. relaxed", quick: "Relaxed style" },
};

const MAX_PROMPT_LENGTH = 2000;

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
    <div className="h-dvh bg-[#FAF8F4] flex flex-col font-sans">
      <AppHeader
        maxWidth="max-w-4xl"
        left={
          <>
            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              aria-label="Back to dashboard"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#73685E] hover:text-[#181411] bg-white border border-[#E7E0D5] hover:border-[#D6CCC0] px-3 py-1.5 rounded-xl transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" aria-hidden />
              <span className="hidden sm:inline">Dashboard</span>
            </button>
            <span className="h-4 w-px bg-[#E7E0D5] hidden sm:block" aria-hidden />
            <BrandLogo size="sm" subtitle="Trip Studio" />
          </>
        }
        right={
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={loading || !ready}
              onClick={startNewTrip}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#73685E] hover:text-[#181411] bg-white border border-[#E7E0D5] hover:border-[#D6CCC0] px-3 py-1.5 rounded-xl transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" aria-hidden />
              New trip
            </button>
          </div>
        }
      />

      {/* Conversation Stream */}
      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-5" aria-live="polite">
          {!hasStarted && (
            <div className="space-y-4">
              <h1 className="font-display text-3xl sm:text-4xl font-semibold text-ink">Plan your trip</h1>
              <div role="group" aria-label="Planning method" className="inline-flex rounded-2xl border border-border bg-white p-1">
                {["Describe your trip", "Use the brief builder"].map((label, index) => (
                  <button key={label} type="button" aria-pressed={showBrief === Boolean(index)}
                    onClick={() => setShowBrief(Boolean(index))}
                    className="min-h-11 rounded-xl px-3 text-sm font-semibold text-muted aria-pressed:bg-ink aria-pressed:text-white">
                    {label}
                  </button>
                ))}
              </div>
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
                  className={`flex items-start gap-3 ${mine ? "flex-row-reverse" : "flex-row"}`}
                >
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                      mine
                        ? "bg-[#181411] text-[#FAF8F4]"
                        : "bg-[#CE532D] text-white shadow-sm shadow-[#CE532D]/20"
                    }`}
                  >
                    {mine ? (
                      <User className="w-4 h-4" aria-hidden />
                    ) : (
                      <Compass className="w-4 h-4" aria-hidden />
                    )}
                  </div>

                  <div
                    className={`max-w-[82%] sm:max-w-[76%] px-4 py-3.5 rounded-2xl text-sm leading-relaxed whitespace-pre-line ${
                      mine
                        ? "bg-[#181411] text-[#FAF8F4] rounded-tr-sm shadow-sm"
                        : "bg-white border border-[#E7E0D5] text-[#181411] rounded-tl-sm shadow-[0_6px_18px_-14px_rgba(24,20,17,0.18)]"
                    }`}
                  >
                    {message.content}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {/* Guided Trip Brief + Curated Starters before first user turn */}
          {ready && !hasStarted && !loading && (
            <div className="space-y-6 pt-1">
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
                <p className="text-xs font-semibold text-muted mb-2.5 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#CE532D]" aria-hidden />
                  Start from an example
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {STARTER_CARDS.map((card) => (
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
                      className="group text-left p-4 rounded-2xl bg-white border border-[#E7E0D5] hover:border-[#CE532D]/50 hover:shadow-sm transition-all"
                    >
                      <p className="font-mono text-[10px] uppercase tracking-wider text-[#CE532D]">
                        {card.route}
                      </p>
                      <p className="font-display text-base font-semibold text-[#181411] group-hover:text-[#CE532D] transition-colors mt-0.5">
                        {card.title}
                      </p>
                      <p className="text-xs text-[#73685E] mt-1">{card.meta}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Real-Pipeline Progress Visualizer */}
          {loading && <AgentProgressCard loading={loading} />}

          {/* Interactive Clarification Card for Missing Required Fields */}
          {missingFields.length > 0 && !loading && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="sm:ml-11 bg-white border border-[#F3CFC0] rounded-2xl p-4 sm:p-5 max-w-xl shadow-sm space-y-4"
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-bold text-[#181411]">
                    Complete missing Trip details
                  </p>
                  <p className="text-[11px] text-[#73685E]">
                    Type your own values below or tap a quick-fill chip.
                  </p>
                </div>
                <span className="font-mono text-[10px] font-semibold text-[#B45309] bg-[#FEF7E6] px-2 py-0.5 rounded-full">
                  {missingFields.length} needed
                </span>
              </div>

              <form onSubmit={submitClarificationInline} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {missingFields.map((field) => {
                    const meta = FIELD_META[field] ?? { label: field, placeholder: `Enter ${field}` };
                    return (
                      <label key={field} className="flex flex-col gap-1">
                        <span className="text-[11px] font-semibold text-[#3B342E]">
                          {meta.label}
                        </span>
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
                          className="bg-[#FDFBF7] border border-[#E7E0D5] focus:bg-white focus:border-[#CE532D] rounded-xl px-3 py-2 text-xs text-[#181411] placeholder-[#A89E94] focus:outline-none transition-all"
                        />
                      </label>
                    );
                  })}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <div className="flex flex-wrap gap-1.5">
                    {missingFields.map((field) => (
                      <button
                        key={field}
                        type="button"
                        onClick={() => addQuickAnswer(field)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#FAF8F4] border border-[#E7E0D5] hover:border-[#CE532D]/40 text-[11px] font-medium text-[#3B342E] hover:text-[#CE532D] transition-colors"
                      >
                        <Plus className="w-3 h-3" aria-hidden />
                        {FIELD_META[field]?.label ?? field}
                      </button>
                    ))}
                  </div>
                  <button
                    type="submit"
                    disabled={!hasInlineClarificationValues}
                    className="inline-flex items-center gap-1.5 bg-[#CE532D] hover:bg-[#B54320] disabled:opacity-40 text-white text-xs font-semibold px-3.5 py-2 rounded-xl transition-colors"
                  >
                    Send details
                    <Send className="w-3 h-3" aria-hidden />
                  </button>
                </div>
              </form>
            </motion.div>
          )}

          <div ref={bottomRef} />
        </div>
      </main>

      {/* Editorial Chat Composer Footer */}
      <footer hidden={showBrief && !hasStarted} className="safe-footer bg-white/95 backdrop-blur-md border-t border-[#E7E0D5] px-4 py-3.5 shrink-0">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            send(prompt);
          }}
          className="max-w-4xl mx-auto"
        >
          <div className="flex items-end gap-2.5 bg-[#FDFBF7] border border-[#E7E0D5] focus-within:bg-white focus-within:border-[#CE532D] focus-within:ring-2 focus-within:ring-[#CE532D]/15 rounded-2xl p-2 transition-all">
            <label htmlFor="trip-prompt" className="sr-only">
              Describe your Trip
            </label>
            <textarea
              ref={inputRef}
              id="trip-prompt"
              rows={1}
              placeholder="e.g. 3 days in Goa from Pune, 2 Travelers, ₹30,000, relaxed"
              value={prompt}
              maxLength={MAX_PROMPT_LENGTH}
              onChange={(event) => setPrompt(event.target.value)}
              onKeyDown={handleComposerKeyDown}
              disabled={loading}
              className="flex-1 min-w-0 bg-transparent px-2.5 py-2 text-sm text-[#181411] placeholder-[#A89E94] focus:outline-none resize-none max-h-32 leading-relaxed"
            />
            <button
              type="submit"
              aria-label="Send message"
              disabled={!ready || loading || !prompt.trim()}
              className="inline-flex items-center gap-1.5 bg-[#CE532D] hover:bg-[#B54320] disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-xs px-4 py-2.5 rounded-xl transition-all shrink-0"
            >
              <Send className="w-3.5 h-3.5" aria-hidden />
              <span className="hidden sm:inline">Send</span>
            </button>
          </div>
          <div className="flex items-center justify-between mt-1.5 px-1 text-[11px] text-[#73685E]">
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
    <Suspense fallback={<div className="h-dvh bg-[#FAF8F4]" />}>
      <TripPlanner />
    </Suspense>
  );
}
