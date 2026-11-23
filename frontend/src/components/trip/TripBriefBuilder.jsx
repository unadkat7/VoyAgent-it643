"use client";

import { useState } from "react";
import {
  ArrowRight,
  Calendar,
  Compass,
  IndianRupee,
  MapPin,
  Minus,
  Navigation,
  Plus,
  Sparkles,
  Users,
} from "lucide-react";
import { composeBriefPrompt } from "@/lib/tripView";

const TRAVEL_STYLES = ["Relaxed", "Adventure", "Culture", "Family", "Luxury", "Budget"];
const BUDGET_PRESETS = [20000, 35000, 50000, 80000];
const DAY_PRESETS = [2, 3, 4, 5, 7];

export default function TripBriefBuilder({ onSubmitPrompt, onPrefillPrompt, disabled = false }) {
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [durationDays, setDurationDays] = useState(3);
  const [partySize, setPartySize] = useState(2);
  const [budget, setBudget] = useState("40000");
  const [travelStyle, setTravelStyle] = useState("Relaxed");

  const numericBudget = Number(String(budget).replace(/[^\d]/g, ""));
  const filledCount = [
    origin.trim().length > 0,
    destination.trim().length > 0,
    durationDays > 0,
    partySize > 0,
    numericBudget > 0,
    travelStyle.trim().length > 0,
  ].filter(Boolean).length;

  const brief = {
    origin,
    destination,
    duration_days: durationDays,
    party_size: partySize,
    budget: numericBudget,
    travel_style: travelStyle,
  };

  const composed = composeBriefPrompt(brief);
  const canLaunch = filledCount === 6 && !disabled;

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!composed || disabled) return;
    onSubmitPrompt?.(composed);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white border border-border rounded-3xl p-5 sm:p-6 shadow-[0_14px_36px_-26px_rgba(24,20,17,0.22)] space-y-5"
    >
      {/* Header + 6/6 Rule-1 Readiness Tracker */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-bg-subtle">
        <div className="flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-xl bg-primary-light text-primary flex items-center justify-center shrink-0">
            <Compass className="w-4 h-4" aria-hidden />
          </span>
          <div>
            <h2 className="font-display text-lg font-semibold text-ink leading-tight">
              Guided Trip Brief
            </h2>
            <p className="text-xs text-muted">
              Fill all 6 required fields for an instant Trip Plan without back-and-forth.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1" aria-hidden="true">
            {[1, 2, 3, 4, 5, 6].map((slot) => (
              <span
                key={slot}
                className={`h-1.5 w-3.5 rounded-full transition-colors ${
                  slot <= filledCount ? "bg-success" : "bg-border"
                }`}
              />
            ))}
          </div>
          <span
            data-testid="brief-readiness"
            className={`font-mono text-[11px] font-semibold px-2 py-0.5 rounded-full ${
              filledCount === 6
                ? "bg-success-light text-success"
                : "bg-warning-light text-warning"
            }`}
          >
            {filledCount}/6 ready
          </span>
        </div>
      </div>

      {/* Row 1: Origin + Destination */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-soft flex items-center gap-1.5">
            <Navigation className="w-3 h-3 text-primary" aria-hidden />
            Origin city
          </span>
          <input
            type="text"
            value={origin}
            onChange={(e) => setOrigin(e.target.value)}
            placeholder="e.g. Ahmedabad, Mumbai, Delhi"
            className="bg-surface-warm border border-border focus:bg-white focus:border-primary focus:ring-2 focus:ring-primary/15 rounded-xl px-3.5 py-2.5 text-sm text-ink placeholder-faint focus:outline-none transition-all"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-soft flex items-center gap-1.5">
            <MapPin className="w-3 h-3 text-primary" aria-hidden />
            Destination
          </span>
          <input
            type="text"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            placeholder="e.g. Goa, Manali, Jaipur, Kerala"
            className="bg-surface-warm border border-border focus:bg-white focus:border-primary focus:ring-2 focus:ring-primary/15 rounded-xl px-3.5 py-2.5 text-sm text-ink placeholder-faint focus:outline-none transition-all"
          />
        </label>
      </div>

      {/* Row 2: Duration + Party Size + Budget */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        {/* Duration */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-soft flex items-center gap-1.5">
            <Calendar className="w-3 h-3 text-primary" aria-hidden />
            Duration (days)
          </span>
          <div className="flex items-center gap-1.5">
            {DAY_PRESETS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDurationDays(d)}
                aria-pressed={durationDays === d}
                className={`flex-1 py-2 rounded-xl font-mono text-xs font-semibold border transition-all ${
                  durationDays === d
                    ? "bg-ink border-ink text-bg"
                    : "bg-surface-warm border-border text-ink-soft hover:border-border-strong"
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>

        {/* Party Size */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-soft flex items-center gap-1.5">
            <Users className="w-3 h-3 text-primary" aria-hidden />
            Party Size
          </span>
          <div className="flex items-center justify-between bg-surface-warm border border-border rounded-xl px-2 py-1.5">
            <button
              type="button"
              aria-label="Decrease Party Size"
              onClick={() => setPartySize((n) => Math.max(1, n - 1))}
              className="w-7 h-7 rounded-lg bg-white border border-border flex items-center justify-center text-ink-soft hover:border-primary hover:text-primary transition-colors"
            >
              <Minus className="w-3.5 h-3.5" aria-hidden />
            </button>
            <span className="font-mono text-sm font-semibold text-ink">
              {partySize} {partySize === 1 ? "Traveler" : "Travelers"}
            </span>
            <button
              type="button"
              aria-label="Increase Party Size"
              onClick={() => setPartySize((n) => Math.min(12, n + 1))}
              className="w-7 h-7 rounded-lg bg-white border border-border flex items-center justify-center text-ink-soft hover:border-primary hover:text-primary transition-colors"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden />
            </button>
          </div>
        </div>

        {/* Total Budget in INR */}
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="brief-budget"
            className="text-[11px] font-semibold uppercase tracking-wider text-ink-soft flex items-center gap-1.5"
          >
            <IndianRupee className="w-3 h-3 text-primary" aria-hidden />
            Total Budget (INR)
          </label>
          <input
            id="brief-budget"
            type="number"
            min={5000}
            step={1000}
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            placeholder="40000"
            className="bg-surface-warm border border-border focus:bg-white focus:border-primary focus:ring-2 focus:ring-primary/15 rounded-xl px-3.5 py-2 font-mono text-sm text-ink focus:outline-none transition-all"
          />
          <div className="flex flex-wrap gap-1">
            {BUDGET_PRESETS.map((amount) => (
              <button
                key={amount}
                type="button"
                onClick={() => setBudget(String(amount))}
                className={`font-mono text-[10px] px-2 py-0.5 rounded-md border transition-colors ${
                  numericBudget === amount
                    ? "bg-primary-light border-primary/40 text-primary-hover font-semibold"
                    : "bg-bg border-border text-muted hover:text-ink"
                }`}
              >
                ₹{(amount / 1000).toFixed(0)}k
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Row 3: Travel Style Pills */}
      <div className="flex flex-col gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-soft flex items-center gap-1.5">
          <Sparkles className="w-3 h-3 text-primary" aria-hidden />
          Travel Style
        </span>
        <div className="flex flex-wrap gap-2">
          {TRAVEL_STYLES.map((style) => {
            const active = travelStyle === style;
            return (
              <button
                key={style}
                type="button"
                onClick={() => setTravelStyle(style)}
                aria-pressed={active}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                  active
                    ? "bg-primary border-primary text-white shadow-xs"
                    : "bg-bg border-border text-ink-soft hover:border-border-strong"
                }`}
              >
                {style}
              </button>
            );
          })}
        </div>
      </div>

      {/* Live Preview + Actions */}
      <div className="pt-4 border-t border-bg-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="text-xs text-muted truncate">
          <span className="font-semibold text-ink-soft">Brief: </span>
          {composed || "Enter your Origin and Destination to preview"}
        </p>
        <div className="flex items-center gap-2 shrink-0">
          {onPrefillPrompt && (
            <button
              type="button"
              disabled={!composed || disabled}
              onClick={() => onPrefillPrompt(composed)}
              className="px-3.5 py-2.5 rounded-xl border border-border text-xs font-semibold text-ink-soft hover:bg-bg disabled:opacity-40 transition-colors"
            >
              Edit in chat
            </button>
          )}
          <button
            type="submit"
            disabled={!canLaunch}
            className="inline-flex items-center gap-1.5 bg-primary hover:bg-primary-hover disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-sm transition-all"
          >
            Start Planning
            <ArrowRight className="w-3.5 h-3.5" aria-hidden />
          </button>
        </div>
      </div>
    </form>
  );
}
