"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Building2,
  Calendar,
  CheckCircle2,
  Compass,
  IndianRupee,
  Loader2,
  MapPin,
  Plane,
} from "lucide-react";

// Mirrors the three parallel branches in ai-service/graph/builder.py
const PARALLEL_NODES = [
  {
    id: "hotels",
    label: "Stays",
    icon: Building2,
    accent: "#B45309",
    bg: "#FEF7E6",
    border: "#F59E0B",
    doing: "Searching stays within 50%/night cap...",
    done: "Eligible stays shortlisted",
  },
  {
    id: "flights",
    label: "Flights",
    icon: Plane,
    accent: "#0369A1",
    bg: "#F0F9FF",
    border: "#38BDF8",
    doing: "Checking IATA codes & fares...",
    done: "Routes & fares checked",
  },
  {
    id: "itinerary",
    label: "Itinerary",
    icon: Calendar,
    accent: "#15803D",
    bg: "#ECFDF3",
    border: "#22C55E",
    doing: "Drafting day-by-day Activities...",
    done: "Daily schedule drafted",
  },
];

function BranchLines({ active, direction = "out" }) {
  const paths =
    direction === "out"
      ? [
          { d: "M 200 0 Q 200 18 68 36", len: 160 },
          { d: "M 200 0 L 200 36", len: 40 },
          { d: "M 200 0 Q 200 18 332 36", len: 160 },
        ]
      : [
          { d: "M 68 0 Q 68 18 200 36", len: 160 },
          { d: "M 200 0 L 200 36", len: 40 },
          { d: "M 332 0 Q 332 18 200 36", len: 160 },
        ];

  return (
    <div className="w-full h-8 my-0.5 hidden sm:block" aria-hidden="true">
      <svg viewBox="0 0 400 36" className="w-full h-full" preserveAspectRatio="none">
        {paths.map((item, index) => (
          <motion.path
            key={item.d}
            d={item.d}
            stroke="#CE532D"
            strokeWidth="1.5"
            strokeLinecap="round"
            fill="none"
            strokeDasharray={item.len}
            initial={{ strokeDashoffset: item.len, opacity: 0.15 }}
            animate={
              active
                ? { strokeDashoffset: 0, opacity: 0.55 }
                : { strokeDashoffset: item.len, opacity: 0.15 }
            }
            transition={{ duration: 0.5, delay: index * 0.08 }}
          />
        ))}
      </svg>
    </div>
  );
}

// Visualizes the real LangGraph Planning Engine stages while awaiting /api/trips/plan:
// 1. understand -> 2. parallel (hotels, flights, itinerary) -> 3. budget_check -> 4. locate & compose
export default function AgentProgressCard({ loading }) {
  const [phase, setPhase] = useState(1);

  useEffect(() => {
    if (!loading) return;
    const t1 = setTimeout(() => setPhase(2), 1100);
    const t2 = setTimeout(() => setPhase(3), 5500);
    const t3 = setTimeout(() => setPhase(4), 8000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [loading]);

  if (!loading) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      role="status"
      aria-live="polite"
      className="w-full bg-white border border-border rounded-3xl p-4 sm:p-6 my-2"
    >
      {/* Masthead */}
      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse" aria-hidden />
          <span className="font-display text-base font-semibold text-ink">
            Planning Engine Active
          </span>
        </div>
        <span className="hidden sm:inline font-mono text-label uppercase tracking-wider text-muted bg-bg border border-border px-2.5 py-1 rounded-full">
          3-Way Parallel Graph
        </span>
      </div>

      {/* Stage 1: Understand Trip Request */}
      <div
        className={`flex items-center gap-3 p-3.5 rounded-2xl border transition-colors ${
          phase >= 1 ? "border-primary/30 bg-primary-light/65" : "border-border bg-bg"
        }`}
      >
        <div className="w-8 h-8 rounded-xl bg-white border border-border flex items-center justify-center shrink-0">
          {phase >= 2 ? (
            <CheckCircle2 className="w-4 h-4 text-success" aria-hidden />
          ) : (
            <Compass className="w-4 h-4 text-primary" aria-hidden />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-ink">01 · Understand Trip Request</p>
          <p className="text-xs text-muted">
            {phase >= 2
              ? "Required fields parsed — fanning out to 3 specialists"
              : "Reading Origin, Destination, Days, Party Size, Budget & Style..."}
          </p>
        </div>
        {phase === 1 && <Loader2 className="w-4 h-4 text-primary animate-spin shrink-0" />}
        {phase >= 2 && <CheckCircle2 className="w-4 h-4 text-success shrink-0" />}
      </div>

      <BranchLines active={phase >= 2} direction="out" />

      {/* Stage 2: Parallel Specialist Nodes */}
      <div className="grid grid-cols-3 gap-2 mt-2 sm:gap-2.5 sm:mt-0">
        {PARALLEL_NODES.map((node, idx) => {
          const Icon = node.icon;
          const isActive = phase >= 2;
          const isDone = phase >= 3;

          return (
            <motion.div
              key={node.id}
              initial={{ opacity: 0.4, scale: 0.98 }}
              animate={isActive ? { opacity: 1, scale: 1 } : { opacity: 0.4, scale: 0.98 }}
              transition={{ delay: idx * 0.1, duration: 0.25 }}
              className="p-2.5 sm:p-3.5 rounded-2xl border transition-colors"
              style={{
                borderColor: isActive ? `${node.border}55` : "#E7E0D5",
                backgroundColor: isActive ? node.bg : "#FAF8F4",
              }}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span
                  className="text-xs font-bold flex items-center gap-1.5"
                  style={{ color: isActive ? node.accent : "#73685E" }}
                >
                  <Icon className="w-3.5 h-3.5" aria-hidden />
                  {node.label}
                </span>
                {isActive && !isDone && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: node.accent }} />
                )}
                {isDone && <CheckCircle2 className="w-3.5 h-3.5 text-success" />}
              </div>
              <p className="hidden sm:block text-label leading-relaxed text-ink-soft/85">
                {!isActive ? "Queued..." : isDone ? node.done : node.doing}
              </p>
              {isActive && !isDone && (
                <div
                  className="mt-2.5 h-1 rounded-full overflow-hidden"
                  style={{ backgroundColor: `${node.border}28` }}
                >
                  <motion.div
                    className="h-full rounded-full w-1/2"
                    style={{ backgroundColor: node.border }}
                    animate={{ x: ["-100%", "200%"] }}
                    transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
                  />
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      <BranchLines active={phase >= 3} direction="in" />

      {/* Stage 3: Deterministic Budget Check */}
      <div
        className={`mt-2 sm:mt-0 flex items-center gap-3 p-3.5 rounded-2xl border transition-all ${
          phase >= 3
            ? "border-success/30 bg-success-light/70 opacity-100"
            : "border-border bg-bg opacity-50"
        }`}
      >
        <div className="w-8 h-8 rounded-xl bg-white border border-border flex items-center justify-center shrink-0">
          <IndianRupee
            className={`w-4 h-4 ${phase >= 3 ? "text-success" : "text-muted"}`}
            aria-hidden
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-ink">03 · INR Budget Feasibility Check</p>
          <p className="text-xs text-muted">
            {phase >= 4
              ? "Budget Caps verified — Trip is Feasible"
              : phase === 3
              ? "Verifying nightly stay cap & total Estimated Cost in INR..."
              : "Waiting for parallel searches to join..."}
          </p>
        </div>
        {phase === 3 && <Loader2 className="w-4 h-4 text-success animate-spin shrink-0" />}
        {phase >= 4 && <CheckCircle2 className="w-4 h-4 text-success shrink-0" />}
      </div>

      {/* Stage 4: Locate Coordinates & Compose Plan */}
      {phase >= 4 && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-2.5 flex items-center gap-3 p-3.5 rounded-2xl border border-ink/20 bg-ink text-bg"
        >
          <div className="w-8 h-8 rounded-xl bg-bg/10 flex items-center justify-center shrink-0">
            <MapPin className="w-4 h-4 text-primary-soft" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold">04 · Locate Pins &amp; Compose Trip Plan</p>
            <p className="text-xs text-bg/65">
              Geocoding Coordinates for your Trip Map and writing travel tips...
            </p>
          </div>
          <Loader2 className="w-4 h-4 text-primary-soft animate-spin shrink-0" />
        </motion.div>
      )}
    </motion.div>
  );
}
