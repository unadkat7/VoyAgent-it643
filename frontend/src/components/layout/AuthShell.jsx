"use client";

import Link from "next/link";
import { ArrowLeft, Building2, Calendar, Plane } from "lucide-react";
import BrandLogo from "./BrandLogo";
import PageWrapper from "./PageWrapper";

export default function AuthShell({
  eyebrow,
  headline,
  accentWord,
  description,
  title,
  subtitle,
  children,
  footer,
}) {
  return (
    <PageWrapper>
      <div className="min-h-screen bg-bg flex flex-col lg:flex-row">
        {/* Left editorial dark atlas column */}
        <aside className="hidden lg:flex flex-col justify-between w-[46%] xl:w-[44%] bg-atlas-dark text-bg p-12 xl:p-14 relative overflow-hidden">
          <div className="relative z-10 flex items-center justify-between">
            <BrandLogo href="/" theme="dark" />
            <span className="font-mono text-label uppercase tracking-widest text-bg/45 border border-bg/12 px-2.5 py-1 rounded-full">
              INR Budget-First
            </span>
          </div>

          <div className="relative z-10 my-auto py-10 space-y-8">
            <div className="space-y-4">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-primary">
                {eyebrow}
              </p>
              <h2 className="font-display text-4xl xl:text-[42px] font-medium leading-[1.12] tracking-tight text-bg">
                {headline}{" "}
                <span className="italic text-primary-soft">{accentWord}</span>
              </h2>
              <p className="text-sm text-bg/65 leading-relaxed max-w-sm">
                {description}
              </p>
            </div>

            {/* Miniature editorial Trip Dossier artifact */}
            <div className="rounded-2xl bg-bg/[0.05] border border-bg/12 p-5 backdrop-blur-sm max-w-sm">
              <div className="flex items-center justify-between text-label font-mono text-bg/55 mb-3">
                <span>AMD → GOI</span>
                <span className="text-[#86EFAC]">Feasible · In Budget</span>
              </div>
              <div className="flex items-baseline justify-between mb-4">
                <div>
                  <p className="font-display text-xl text-bg">North Goa</p>
                  <p className="text-xs text-bg/55">3 Nights · 2 Travelers · Relaxed</p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-base font-semibold text-bg">₹17,500</p>
                  <p className="text-label text-bg/50">Estimated Cost</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 pt-3 border-t border-bg/10 text-label text-bg/75">
                <span className="flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-primary-soft" aria-hidden />
                  Stays
                </span>
                <span className="flex items-center gap-1.5">
                  <Plane className="w-3.5 h-3.5 text-[#7DD3FC]" aria-hidden />
                  Flights
                </span>
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-[#86EFAC]" aria-hidden />
                  Itinerary
                </span>
              </div>
            </div>
          </div>

          <div className="relative z-10 flex items-center justify-between text-xs text-bg/40">
            <span>© {new Date().getFullYear()} VoyAgent</span>
            <span className="font-mono">LangGraph · OpenStreetMap</span>
          </div>
        </aside>

        {/* Right form panel */}
        <div className="flex-1 flex flex-col justify-between p-4 sm:p-8 lg:p-10 bg-atlas-grid">
          <div className="flex items-center justify-between max-w-md w-full mx-auto lg:max-w-none">
            <div className="lg:hidden">
              <BrandLogo href="/" size="sm" />
            </div>
            <Link
              href="/"
              className="inline-flex min-h-tap items-center gap-1.5 px-1 text-sm font-medium text-muted hover:text-ink transition-colors ml-auto lg:ml-0"
            >
              <ArrowLeft className="w-4 h-4" aria-hidden />
              Back to home
            </Link>
          </div>

          <div className="w-full max-w-[420px] mx-auto mt-4 mb-auto py-4 sm:my-auto">
            <div className="bg-white border border-border rounded-2xl p-4 sm:rounded-3xl sm:p-7 shadow-[0_14px_40px_-24px_rgba(24,20,17,0.18)]">
              <div className="mb-5">
                <h1 className="font-display text-3xl font-semibold text-ink tracking-tight mb-1">
                  {title}
                </h1>
                <p className="text-sm text-muted">{subtitle}</p>
              </div>
              {children}
              {footer && <div className="mt-5 pt-4 border-t border-bg-subtle">{footer}</div>}
            </div>
          </div>

          <p className="text-center text-label text-muted lg:hidden">
            {`© ${new Date().getFullYear()} VoyAgent`}
          </p>
        </div>
      </div>
    </PageWrapper>
  );
}
