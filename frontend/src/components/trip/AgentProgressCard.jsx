"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Building2,
  Calendar,
  CheckCircle2,
  Compass,
  Loader2,
  MapPin,
  Route,
  Wallet,
} from "lucide-react";

// Mirrors the parallel branches in ai-service/graph/builder.py
const PARALLEL_NODES = [
  {
    id: "hotels",
    label: "Stays",
    icon: Building2,
    accent: "#B45309",
    bg: "#FEF7E6",
    border: "#F59E0B",
    doing: "Finding stays that fit your budget...",
    done: "Stays picked",
  },
  {
    id: "travel",
    label: "Travel",
    icon: Route,
    accent: "#0369A1",
    bg: "#F0F9FF",
    border: "#38BDF8",
    doing: "Checking flights, trains and the drive...",
    done: "Ways to get there checked",
  },
  {
    id: "itinerary",
    label: "Day plan",
    icon: Calendar,
    accent: "#15803D",
    bg: "#ECFDF3",
    border: "#22C55E",
    doing: "Planning each day...",
    done: "Days planned",
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

// Shows the Planning Engine's stages while awaiting /api/trips/plan. The timings are a guide,
// not live progress: 1. read the request -> 2. stays, travel, days -> 3. budget -> 4. map and tips
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
      <div className="mb-4">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse" aria-hidden />
          <span className="font-display text-base font-semibold text-ink">Planning your trip</span>
        </div>
        <p className="mt-0.5 pl-4 text-xs text-muted">Usually takes 20–40 seconds.</p>
      </div>

      {/* Stage 1: Read the request */}
      <div
        className={`flex items-center gap-3 p-3.5 rounded-2xl border transition-colors ${
          phase >= 1 ? "border-primary/30 bg-primary-light/65" : "border-border bg-bg"
        }`}
      >
        <div className="w-8 h-8 rounded-xl bg-white border border-border flex items-center justify-center shrink-0">
          <Compass className="w-4 h-4 text-primary" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-ink">Reading your request</p>
          <p className="text-xs text-muted">
            {phase >= 2 ? "Got it: where, how long, who and budget" : "Where, how long, who and budget..."}
          </p>
        </div>
        {phase === 1 && <Loader2 className="w-4 h-4 text-primary animate-spin shrink-0" />}
        {phase >= 2 && <CheckCircle2 className="w-4 h-4 text-success shrink-0" />}
      </div>

      <BranchLines active={phase >= 2} direction="out" />

      {/* Stage 2: Stays, travel and days, side by side */}
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
              className="min-w-0 p-2.5 sm:p-3.5 rounded-2xl border transition-colors"
              style={{
                borderColor: isActive ? `${node.border}55` : "#E7E0D5",
                backgroundColor: isActive ? node.bg : "#FAF8F4",
              }}
            >
              {/* Icon and status on top, so the label below gets the full width on a phone */}
              <div className="flex items-center justify-between">
                <Icon className="w-4 h-4" style={{ color: isActive ? node.accent : "#73685E" }} aria-hidden />
                {isActive && !isDone && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: node.accent }} />
                )}
                {isDone && <CheckCircle2 className="w-3.5 h-3.5 text-success" />}
              </div>
              <p
                className="mt-1.5 text-sm font-bold leading-tight"
                style={{ color: isActive ? node.accent : "#73685E" }}
              >
                {node.label}
              </p>
              <p className="hidden sm:block mt-1 text-label leading-relaxed text-ink-soft/85">
                {!isActive ? "Waiting..." : isDone ? node.done : node.doing}
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

      {/* Stage 3: Budget */}
      <div
        className={`mt-2 sm:mt-0 flex items-center gap-3 p-3.5 rounded-2xl border transition-all ${
          phase >= 3
            ? "border-success/30 bg-success-light/70 opacity-100"
            : "border-border bg-bg opacity-50"
        }`}
      >
        <div className="w-8 h-8 rounded-xl bg-white border border-border flex items-center justify-center shrink-0">
          <Wallet
            className={`w-4 h-4 ${phase >= 3 ? "text-success" : "text-muted"}`}
            aria-hidden
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-ink">Checking it fits your budget</p>
          <p className="text-xs text-muted">
            {phase >= 4
              ? "Costs added up"
              : phase === 3
              ? "Adding up stay, travel, activities and food..."
              : "Waiting for stays, travel and days..."}
          </p>
        </div>
        {phase === 3 && <Loader2 className="w-4 h-4 text-success animate-spin shrink-0" />}
        {phase >= 4 && <CheckCircle2 className="w-4 h-4 text-success shrink-0" />}
      </div>

      {/* Stage 4: Map and tips */}
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
            <p className="text-sm font-bold">Adding map pins and tips</p>
            <p className="text-xs text-bg/65">Almost done...</p>
          </div>
          <Loader2 className="w-4 h-4 text-primary-soft animate-spin shrink-0" />
        </motion.div>
      )}
    </motion.div>
  );
}
