"use client";

import { useState } from "react";
import { ArrowRight, Calendar, MapPin, Minus, Navigation, Plus, Sparkles, Users, Wallet } from "lucide-react";
import { composeBriefPrompt, formatMoney } from "@/lib/tripView";
import StickyActionBar from "@/components/ui/StickyActionBar";

const TRAVEL_STYLES = ["Relaxed", "Adventure", "Culture", "Family", "Luxury", "Budget"];
const CURRENCIES = [
  "INR", "USD", "EUR", "GBP", "AED", "SAR", "QAR",
  "SGD", "MYR", "THB", "IDR", "JPY", "CNY", "HKD",
  "AUD", "NZD", "CAD", "CHF", "ZAR", "NPR", "LKR",
];
const BUDGET_PRESETS = [20000, 35000, 50000, 80000];
const DAY_PRESETS = [2, 3, 4, 5, 7];
const MAX_BUDGET_DIGITS = 8;

const LABEL = "flex items-center gap-1.5 text-sm font-semibold text-ink-soft";
const INPUT =
  "min-h-tap w-full rounded-xl border border-border bg-surface-warm px-3.5 text-base text-ink placeholder-faint transition-all focus:border-primary focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/15";
const CHIP = "min-h-tap rounded-xl border px-3 text-sm font-semibold transition-colors";
const CHIP_ON = "border-ink bg-ink text-bg";
const CHIP_OFF = "border-border bg-surface-warm text-ink-soft hover:border-border-strong";

const groupedAmount = (digits, currency) =>
  digits ? Number(digits).toLocaleString(currency === "INR" ? "en-IN" : "en-US") : "";

export default function TripBriefBuilder({ onSubmitPrompt, onPrefillPrompt, disabled = false }) {
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [durationDays, setDurationDays] = useState(3);
  const [partySize, setPartySize] = useState(2);
  const [budget, setBudget] = useState("40000");
  const [currency, setCurrency] = useState("INR");
  const [travelStyle, setTravelStyle] = useState("Relaxed");

  const numericBudget = Number(budget);
  const currencyPrefix = formatMoney(0, currency).replace(/[\d.,\s]/g, "");
  const missing = [
    !origin.trim() && "Origin city",
    !destination.trim() && "Destination",
    !(durationDays > 0) && "Duration",
    !(partySize > 0) && "Party size",
    !(numericBudget > 0) && "Budget",
    !travelStyle.trim() && "Travel style",
  ].filter(Boolean);
  const filledCount = 6 - missing.length;

  const composed = composeBriefPrompt({
    origin,
    destination,
    duration_days: durationDays,
    party_size: partySize,
    budget: numericBudget,
    currency,
    travel_style: travelStyle,
  });
  const canLaunch = missing.length === 0 && !disabled;
  const missingHint =
    missing.length > 0
      ? `${missing.length} ${missing.length === 1 ? "field" : "fields"} left: ${missing.join(", ")}`
      : null;

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!canLaunch) return;
    onSubmitPrompt?.(composed);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5 sm:rounded-3xl sm:border sm:border-border sm:bg-surface sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold leading-tight text-ink">Guided Trip Brief</h2>
          <p className="text-sm text-muted">Fill all 6 fields to get a plan straight away.</p>
        </div>
        <span
          data-testid="brief-readiness"
          className={`rounded-full px-2.5 py-0.5 font-mono text-sm font-semibold ${
            filledCount === 6 ? "bg-success-light text-success" : "bg-warning-light text-warning"
          }`}
        >
          {filledCount}/6 ready
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className={LABEL}>
            <Navigation className="h-4 w-4 text-primary" aria-hidden />
            Origin city
          </span>
          <input
            type="text"
            value={origin}
            onChange={(e) => setOrigin(e.target.value)}
            placeholder="e.g. Ahmedabad, Mumbai, Delhi"
            autoComplete="address-level2"
            enterKeyHint="next"
            className={INPUT}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className={LABEL}>
            <MapPin className="h-4 w-4 text-primary" aria-hidden />
            Destination
          </span>
          <input
            type="text"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            placeholder="e.g. Goa, Manali, Jaipur, Kerala"
            enterKeyHint="next"
            className={INPUT}
          />
        </label>
      </div>

      <fieldset className="flex flex-col gap-1.5">
        <legend className={`${LABEL} mb-1.5`}>
          <Calendar className="h-4 w-4 text-primary" aria-hidden />
          Duration (days)
        </legend>
        <div className="flex gap-2">
          {DAY_PRESETS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDurationDays(d)}
              aria-pressed={durationDays === d}
              className={`flex-1 font-mono ${CHIP} ${durationDays === d ? CHIP_ON : CHIP_OFF}`}
            >
              {d}d
            </button>
          ))}
        </div>
      </fieldset>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <span className={LABEL}>
            <Users className="h-4 w-4 text-primary" aria-hidden />
            Party size
          </span>
          <div className="flex items-center justify-between rounded-xl border border-border bg-surface-warm p-1">
            <button
              type="button"
              aria-label="Decrease Party Size"
              onClick={() => setPartySize((n) => Math.max(1, n - 1))}
              className="flex size-tap items-center justify-center rounded-lg bg-surface text-ink-soft hover:text-primary"
            >
              <Minus className="h-4 w-4" aria-hidden />
            </button>
            <span className="font-mono text-base font-semibold text-ink" aria-live="polite">
              {partySize} {partySize === 1 ? "Traveler" : "Travelers"}
            </span>
            <button
              type="button"
              aria-label="Increase Party Size"
              onClick={() => setPartySize((n) => Math.min(12, n + 1))}
              className="flex size-tap items-center justify-center rounded-lg bg-surface text-ink-soft hover:text-primary"
            >
              <Plus className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="brief-budget" className={LABEL}>
            <Wallet className="h-4 w-4 text-primary" aria-hidden />
            Total budget
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-base text-muted" aria-hidden>
                {currencyPrefix}
              </span>
              <input
                id="brief-budget"
                type="text"
                inputMode="numeric"
                enterKeyHint="done"
                value={groupedAmount(budget, currency)}
                onChange={(e) => setBudget(e.target.value.replace(/\D/g, "").slice(0, MAX_BUDGET_DIGITS))}
                placeholder="40,000"
                className={`${INPUT} ${currencyPrefix.length > 2 ? "pl-14" : "pl-8"} font-mono`}
              />
            </div>
            <select
              aria-label="Currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="min-h-tap shrink-0 rounded-xl border border-border bg-surface-warm px-2.5 font-mono text-sm font-semibold text-ink focus:border-primary focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/15"
            >
              {CURRENCIES.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
            {BUDGET_PRESETS.map((amount) => (
              <button
                key={amount}
                type="button"
                onClick={() => setBudget(String(amount))}
                aria-label={`Budget ${formatMoney(amount, currency)}`}
                aria-pressed={numericBudget === amount}
                className={`flex-1 font-mono ${CHIP} ${numericBudget === amount ? CHIP_ON : CHIP_OFF}`}
              >
                {formatMoney(amount, currency)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <fieldset>
        <legend className={`${LABEL} mb-2`}>
          <Sparkles className="h-4 w-4 text-primary" aria-hidden />
          Travel style
        </legend>
        <div className="flex flex-wrap gap-2">
          {TRAVEL_STYLES.map((style) => (
            <button
              key={style}
              type="button"
              onClick={() => setTravelStyle(style)}
              aria-pressed={travelStyle === style}
              className={`rounded-full px-4 ${CHIP} ${travelStyle === style ? "border-primary bg-primary text-white" : CHIP_OFF}`}
            >
              {style}
            </button>
          ))}
        </div>
      </fieldset>

      {composed && (
        <p className="text-sm text-muted">
          <span className="font-semibold text-ink-soft">Brief: </span>
          {composed}
        </p>
      )}

      <StickyActionBar hint={missingHint} className="sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:pt-0 sm:backdrop-blur-none">
        {onPrefillPrompt && (
          <button
            type="button"
            disabled={!composed || disabled}
            onClick={() => onPrefillPrompt(composed)}
            className="min-h-tap rounded-xl border border-border px-4 text-sm font-semibold text-ink-soft hover:bg-bg disabled:opacity-40"
          >
            Edit in chat
          </button>
        )}
        <button
          type="submit"
          disabled={!canLaunch}
          className="inline-flex min-h-tap flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary px-4 text-base font-semibold text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none"
        >
          Start planning
          <ArrowRight className="h-4 w-4" aria-hidden />
        </button>
      </StickyActionBar>
    </form>
  );
}
