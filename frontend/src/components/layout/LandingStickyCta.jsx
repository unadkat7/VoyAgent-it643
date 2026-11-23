"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

// Keeps "Start planning" in thumb reach on phones once the hero button has scrolled away.
export default function LandingStickyCta() {
  const [heroGone, setHeroGone] = useState(false);
  const [finalVisible, setFinalVisible] = useState(false);

  useEffect(() => {
    const hero = document.getElementById("hero-cta");
    const final = document.getElementById("final-cta");
    if (!hero || !final || !("IntersectionObserver" in window)) return;
    const heroWatch = new IntersectionObserver(([entry]) =>
      setHeroGone(!entry.isIntersecting && entry.boundingClientRect.top < 0)
    );
    const finalWatch = new IntersectionObserver(([entry]) => setFinalVisible(entry.isIntersecting));
    heroWatch.observe(hero);
    finalWatch.observe(final);
    return () => {
      heroWatch.disconnect();
      finalWatch.disconnect();
    };
  }, []);

  if (!heroGone || finalVisible) return null;
  return (
    <div className="safe-footer fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 px-4 pt-3 backdrop-blur-md md:hidden">
      <Link
        href="/signup"
        className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-primary text-base font-semibold text-white hover:bg-primary-hover"
      >
        Start planning for free
        <ArrowRight className="h-4 w-4" aria-hidden />
      </Link>
    </div>
  );
}
