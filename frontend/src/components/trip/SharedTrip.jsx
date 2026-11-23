"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ShieldAlert, Sparkles } from "lucide-react";
import { getSharedTrip } from "@/services/trip.service";
import AppHeader from "@/components/layout/AppHeader";
import BrandLogo from "@/components/layout/BrandLogo";
import PageWrapper from "@/components/layout/PageWrapper";
import TripPlanView from "@/components/trip/TripPlanView";
import Skeleton from "@/components/ui/Skeleton";

const PLAN_YOUR_OWN =
  "inline-flex min-h-tap items-center gap-1.5 text-sm font-semibold text-white bg-primary hover:bg-primary-hover px-4 rounded-xl transition-colors";

// Public, read-only view of a Trip its owner chose to share. No account needed.
export default function SharedTripPage() {
  const { shareId } = useParams();
  const [trip, setTrip] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    getSharedTrip(shareId)
      .then((data) => {
        if (!cancelled) setTrip(data.trip);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(
          err.response?.status === 404
            ? "This Trip is no longer shared."
            : "Could not load this Trip. Please try again."
        );
      });
    return () => {
      cancelled = true;
    };
  }, [shareId]);

  const header = (
    <AppHeader
      maxWidth="max-w-7xl"
      left={<BrandLogo href="/" size="sm" />}
      right={
        <Link href="/signup?source=share" className={PLAN_YOUR_OWN}>
          <Sparkles className="w-3.5 h-3.5" aria-hidden />
          Plan your own trip
        </Link>
      }
    />
  );

  if (error) {
    return (
      <div className="min-h-screen bg-bg font-sans">
        {header}
        <div className="flex flex-col items-center justify-center text-center p-8 pt-24">
          <div className="bg-white border border-border rounded-3xl p-8 max-w-md w-full shadow-sm">
            <div className="w-12 h-12 rounded-2xl bg-warning-light border border-star/20 flex items-center justify-center mx-auto mb-4">
              <ShieldAlert className="w-6 h-6 text-warning" aria-hidden />
            </div>
            <h2 className="font-display text-2xl font-semibold text-ink mb-2">{error}</h2>
            <p className="text-sm text-muted">VoyAgent can plan a Trip like this for you too.</p>
          </div>
        </div>
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="min-h-screen bg-bg font-sans">
        {header}
        <div className="max-w-6xl mx-auto px-6 pt-8 space-y-5">
          <Skeleton className="w-72 h-10" />
          <Skeleton className="w-96 h-5" />
          <Skeleton className="w-full h-96" />
        </div>
      </div>
    );
  }

  return (
    <PageWrapper>
      <div className="min-h-screen bg-bg font-sans pb-24">
        {header}
        <TripPlanView trip={trip} />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-12">
          <div className="bg-white border border-border rounded-3xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <p className="text-sm text-ink-soft">
              Create your own itinerary with stays, flights, and a budget for your group.
            </p>
            <Link href="/signup?source=share" className={PLAN_YOUR_OWN}>
              Plan your own trip
            </Link>
          </div>
        </div>
      </div>
    </PageWrapper>
  );
}
