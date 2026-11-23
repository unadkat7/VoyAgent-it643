import Link from "next/link";
import {
  ArrowRight,
  Building2,
  Calendar,
  Compass,
  IndianRupee,
  MapPin,
  Plane,
  ShieldCheck,
} from "lucide-react";
import BrandLogo from "@/components/layout/BrandLogo";
import LandingStickyCta from "@/components/layout/LandingStickyCta";

const PIPELINE_STEPS = [
  {
    num: "01",
    title: "Conversation & Brief",
    desc: "Share Origin, Destination, Duration, Party Size, Budget in INR, and Travel Style. If anything is missing, VoyAgent asks a crisp Clarification.",
  },
  {
    num: "02",
    title: "3-Way Parallel Research",
    desc: "Stays, Flights (with strict IATA airport checks), and Day-by-Day Activities run simultaneously—never sequentially.",
  },
  {
    num: "03",
    title: "Deterministic INR Caps",
    desc: "Pure budget arithmetic enforces Stays ≤ 50%/night and Flights ≤ 35% + 15% grace so every Trip Plan is Feasible before composing.",
  },
  {
    num: "04",
    title: "Geocoded Trip Map",
    desc: "OpenStreetMap Nominatim pins every verified stay and activity by day—never invented coordinates—with clear Live vs. Estimated Cost labels.",
  },
];

const TRUST_PILLARS = [
  {
    icon: IndianRupee,
    tag: "Rule 2 & 3 · Budget Math",
    title: "Hard INR Feasibility, Not LLM Guesswork",
    desc: "Budget caps live in deterministic domain rules. If no stay fits your nightly cap, VoyAgent tells you honestly and quotes the lowest rate found instead of faking a plan.",
  },
  {
    icon: ShieldCheck,
    tag: "Price Source Transparency",
    title: "Live Prices vs. Estimated Cost",
    desc: "Every stay and flight Recommendation clearly shows its Price Source—Live price from provider search or Estimated Cost from AI—and never claims fake reservations.",
  },
  {
    icon: Compass,
    tag: "Rule 4 · Real Coordinates",
    title: "No Silent Swaps, No Invented Pins",
    desc: "Cities without a known Airport Code never silently fall back to another city. Map pins come strictly from geocoded Coordinates, plotted alongside your daily Itinerary.",
  },
];

// Static landing page — Server Component for instant first paint
export default function LandingPage() {
  return (
    <div className="min-h-screen bg-bg text-ink font-sans">
      {/* ── Sticky Editorial Navbar ── */}
      <nav className="sticky top-0 z-30 bg-bg/88 backdrop-blur-md border-b border-border">
        <div className="max-w-6xl mx-auto px-5 sm:px-6 h-16 flex items-center justify-between gap-4">
          <BrandLogo href="/" />

          <div className="hidden md:flex items-center gap-7 text-sm font-medium text-muted">
            <a href="#how-it-works" className="inline-flex min-h-tap items-center hover:text-ink transition-colors">
              How it works
            </a>
            <a href="#why-voyagent" className="inline-flex min-h-tap items-center hover:text-ink transition-colors">
              Honest Travel Math
            </a>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <Link
              href="/login"
              className="whitespace-nowrap inline-flex min-h-tap items-center text-sm font-semibold text-ink-soft hover:text-ink px-3 rounded-xl transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              className="whitespace-nowrap inline-flex min-h-tap items-center gap-1.5 text-sm font-semibold text-white bg-ink hover:bg-ink-hover px-4 rounded-xl transition-all shadow-sm"
            >
              Get Started
              <ArrowRight className="w-3.5 h-3.5 shrink-0" aria-hidden />
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Asymmetric Editorial Split Hero ── */}
      <section className="relative overflow-hidden bg-atlas-grid border-b border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-9 pb-10 lg:pt-20 lg:pb-24">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-7 lg:gap-10 items-center">
            {/* Left Copy Column */}
            <div className="lg:col-span-6 space-y-4 lg:space-y-6">
              <h1 className="font-display text-[clamp(2.7rem,6vw,4.5rem)] font-semibold text-ink leading-[1.02] tracking-tight">
                Your next trip, <span className="italic text-primary-hover">within budget.</span>
              </h1>
              <p className="max-w-lg text-base sm:text-lg text-muted leading-relaxed">
                Tell us where you want to go and what you want to spend. Get stays, flights, and a day-by-day itinerary in rupees.
              </p>

              <div id="hero-cta" className="flex flex-wrap items-center gap-3 pt-1">
                <Link
                  href="/signup"
                  className="inline-flex min-h-12 items-center gap-2 bg-primary hover:bg-primary-hover text-white font-semibold text-base px-6 rounded-2xl shadow-lg shadow-primary/20 transition-all"
                >
                  Start planning for free
                  <ArrowRight className="w-4 h-4" aria-hidden />
                </Link>
              </div>
            </div>

            {/* Right Interactive-Feel Editorial Trip Dossier Showcase */}
            <div className="lg:col-span-6">
              <div className="relative rounded-3xl bg-white border border-border shadow-[0_24px_60px_-28px_rgba(24,20,17,0.22)] overflow-hidden">
                {/* Top Dark Espresso Dossier Masthead */}
                <div className="bg-atlas-dark text-bg px-5 sm:px-6 py-5">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <span className="font-mono text-label uppercase tracking-widest text-primary-soft whitespace-nowrap">
                      Sample Trip Plan · Planned
                    </span>
                    <span className="inline-flex items-center gap-1 text-label font-medium text-[#86EFAC] bg-success/25 border border-[#86EFAC]/25 px-2.5 py-0.5 rounded-full whitespace-nowrap">
                      Feasible in Budget
                    </span>
                  </div>
                  <div className="flex flex-wrap items-end justify-between gap-4">
                    <div>
                      <p className="font-mono text-label text-bg/55 mb-1">
                        AHMEDABAD → GOA · 10 DEC – 13 DEC
                      </p>
                      <h2 className="font-display text-3xl font-semibold tracking-tight">
                        Goa
                      </h2>
                    </div>
                    <div className="text-left sm:text-right">
                      <p className="text-label text-bg/55">Estimated Cost</p>
                      <p className="font-mono text-2xl font-semibold text-bg">
                        ₹17,500
                      </p>
                      <p className="text-label text-bg/50">of ₹40,000 Budget</p>
                    </div>
                  </div>
                </div>

                {/* Body preview: Budget bar + 3 parallel agent strips + mini map pins */}
                <div className="p-4 sm:p-6 space-y-4">
                  {/* Budget Feasibility Bar */}
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="font-semibold text-ink-soft">INR Budget Allocation</span>
                      <span className="font-mono text-label text-success">
                        44% used · ₹22,500 buffer
                      </span>
                    </div>
                    <div className="h-2.5 rounded-full bg-bg-subtle overflow-hidden flex">
                      <div className="bg-primary h-full" style={{ width: "19%" }} />
                      <div className="bg-ink h-full" style={{ width: "25%" }} />
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-label text-muted">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-primary" aria-hidden />
                        Stays ₹7,500
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-ink" aria-hidden />
                        Flights ₹10,000
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-border" aria-hidden />
                        Activities & Food
                      </span>
                    </div>
                  </div>

                  {/* Three Specialist Cards */}
                  <p className="sm:hidden text-sm text-ink-soft"><strong>Day 1</strong> · Baga Beach and Fort Aguada</p>
                    <div className="hidden sm:grid sm:grid-cols-3 gap-2.5">
                    <div className="rounded-2xl bg-surface-warm border border-border p-3.5">
                      <div className="flex items-center justify-between mb-2">
                        <span className="w-7 h-7 rounded-lg bg-warning-light text-warning flex items-center justify-center">
                          <Building2 className="w-3.5 h-3.5" aria-hidden />
                        </span>
                        <span className="text-label font-semibold text-success bg-success-light px-1.5 py-0.5 rounded">
                          Live price
                        </span>
                      </div>
                      <p className="text-xs font-bold text-ink truncate">Sea Breeze Resort</p>
                      <p className="font-mono text-label text-muted mt-0.5">₹3,200 / night</p>
                    </div>

                    <div className="rounded-2xl bg-surface-warm border border-border p-3.5">
                      <div className="flex items-center justify-between mb-2">
                        <span className="w-7 h-7 rounded-lg bg-[#E0F2FE] text-[#0369A1] flex items-center justify-center">
                          <Plane className="w-3.5 h-3.5" aria-hidden />
                        </span>
                        <span className="font-mono text-label text-muted">Non-stop</span>
                      </div>
                      <p className="text-xs font-bold text-ink">AMD → GOI</p>
                      <p className="font-mono text-label text-muted mt-0.5">₹5,000 / traveler</p>
                    </div>

                    <div className="rounded-2xl bg-surface-warm border border-border p-3.5">
                      <div className="flex items-center justify-between mb-2">
                        <span className="w-7 h-7 rounded-lg bg-success-light text-success flex items-center justify-center">
                          <Calendar className="w-3.5 h-3.5" aria-hidden />
                        </span>
                        <span className="font-mono text-label text-primary">3 Days</span>
                      </div>
                      <p className="text-xs font-bold text-ink truncate">Baga · Aguada</p>
                      <p className="text-label text-muted mt-0.5 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-primary" aria-hidden />
                        Pinned on Map
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── How the Planning Engine Works ── */}
      <section id="how-it-works" className="bg-white border-b border-border py-12 lg:py-24 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="max-w-2xl mb-8 lg:mb-12">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-primary mb-2.5">
              Planning Engine Pipeline
            </p>
            <h2 className="font-display text-3xl sm:text-4xl font-semibold text-ink tracking-tight mb-3">
              Four deliberate stages from chat to Trip Plan.
            </h2>
            <p className="text-sm sm:text-base text-muted leading-relaxed">
              Every request moves through a deterministic LangGraph workflow—no black-box
              hallucinated prices or silent airport fallbacks.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {PIPELINE_STEPS.map((step) => (
              <div
                key={step.num}
                className="rounded-2xl bg-bg border border-border p-6 flex flex-col justify-between hover:border-border-strong transition-colors"
              >
                <div>
                  <span className="inline-block font-mono text-xs font-semibold text-primary bg-primary-light border border-primary-border px-2.5 py-1 rounded-lg mb-5">
                    STEP {step.num}
                  </span>
                  <h3 className="font-display text-xl font-semibold text-ink mb-2.5">
                    {step.title}
                  </h3>
                  <p className="text-sm text-muted leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Honest Travel Math Bento ── */}
      <section id="why-voyagent" className="py-12 lg:py-24 px-4 sm:px-6 bg-bg">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8 lg:mb-12">
            <div className="max-w-xl">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-primary mb-2.5">
                Designed for Trust
              </p>
              <h2 className="font-display text-3xl sm:text-4xl font-semibold text-ink tracking-tight">
                Built on honest travel math.
              </h2>
            </div>
            <p className="text-sm text-muted max-w-sm">
              LLMs write itineraries and summaries—never budget checks, never fake GPS coordinates.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {TRUST_PILLARS.map((pillar) => {
              const Icon = pillar.icon;
              return (
                <article
                  key={pillar.title}
                  className="bg-white border border-border rounded-2xl p-6 sm:p-7 shadow-[0_8px_24px_-18px_rgba(24,20,17,0.16)]"
                >
                  <div className="w-11 h-11 rounded-xl bg-primary-light text-primary flex items-center justify-center mb-5">
                    <Icon className="w-5 h-5" aria-hidden />
                  </div>
                  <p className="font-mono text-label uppercase tracking-wider text-muted mb-2">
                    {pillar.tag}
                  </p>
                  <h3 className="font-display text-xl font-semibold text-ink mb-2.5">
                    {pillar.title}
                  </h3>
                  <p className="text-sm text-muted leading-relaxed">{pillar.desc}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Dark Espresso Editorial CTA Strip ── */}
      <section id="final-cta" className="bg-atlas-dark text-bg py-14 sm:py-20 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto text-center">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary-soft mb-3">
            Ready When You Are
          </p>
          <h2 className="font-display text-3xl sm:text-5xl font-semibold tracking-tight mb-4">
            Where are you headed next?
          </h2>
          <p className="text-sm sm:text-base text-bg/65 mb-9 max-w-md mx-auto leading-relaxed">
            Create a free account to build, save, and map complete INR-budgeted Trip Plans in
            seconds.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 bg-primary hover:bg-primary-hover text-white font-semibold text-sm px-7 py-3.5 rounded-2xl shadow-lg shadow-primary/25 transition-all"
            >
              Start planning for free
              <ArrowRight className="w-4 h-4" aria-hidden />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 text-sm font-semibold text-bg/85 hover:text-white border border-bg/18 hover:border-bg/35 px-6 py-3.5 rounded-2xl transition-all"
            >
              Sign in
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-[#120F0D] border-t border-bg/8 px-5 sm:px-6 py-7">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <BrandLogo theme="dark" size="sm" />
          <p className="text-xs text-bg/45">
            {`© ${new Date().getFullYear()} VoyAgent · Built with Next.js, LangGraph & OpenStreetMap.`}
          </p>
        </div>
      </footer>
      <LandingStickyCta />
    </div>
  );
}
