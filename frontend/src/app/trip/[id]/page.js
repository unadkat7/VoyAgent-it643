"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Link2, ShieldAlert, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { deleteTrip, getTripById, shareTrip } from "@/services/trip.service";
import FeedbackWidget from "@/components/feedback/FeedbackWidget";
import AppHeader from "@/components/layout/AppHeader";
import BrandLogo from "@/components/layout/BrandLogo";
import PageWrapper from "@/components/layout/PageWrapper";
import TripPlanView from "@/components/trip/TripPlanView";
import ConfirmModal from "@/components/ui/ConfirmModal";
import Skeleton from "@/components/ui/Skeleton";

function errorMessage(status) {
  if (status === 401) return null;
  if (status === 403) return "This Trip belongs to another account.";
  if (status === 404 || status === 400) return "This Trip does not exist any more.";
  return "Could not load this Trip. Please try again.";
}

export default function TripDetailPage() {
  const { id: tripId } = useParams();
  const router = useRouter();

  const [trip, setTrip] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showConfirm, setShowConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    // Ignore a late answer if the user has already moved to another Trip.
    let cancelled = false;
    getTripById(tripId)
      .then((data) => {
        if (!cancelled) setTrip(data.trip);
      })
      .catch((err) => {
        if (cancelled) return;
        const message = errorMessage(err.response?.status);
        if (message === null) router.replace("/login");
        else setError(message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tripId, router]);

  const handleDelete = async () => {
    try {
      setDeleting(true);
      await deleteTrip(tripId);
      toast.success("Trip deleted");
      router.push("/dashboard");
    } catch {
      toast.error("Could not delete the Trip. Please try again.");
      setDeleting(false);
    }
  };

  const handleShare = async () => {
    try {
      setSharing(true);
      const { shareId } = await shareTrip(tripId);
      const link = `${window.location.origin}/share/${shareId}`;
      try {
        await navigator.clipboard.writeText(link);
        toast.success("Share link copied");
      } catch {
        // Clipboard can be blocked (e.g. insecure origin); still give the link.
        toast.success(`Share link: ${link}`, { duration: 8000 });
      }
    } catch {
      toast.error("Could not create a share link. Please try again.");
    } finally {
      setSharing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF8F4] font-sans">
        <div className="bg-[#FAF8F4]/90 border-b border-[#E7E0D5] px-6 h-16 flex items-center">
          <div className="max-w-6xl w-full mx-auto flex justify-between">
            <Skeleton className="w-24 h-6" />
            <Skeleton className="w-24 h-6" />
            <Skeleton className="w-20 h-7" />
          </div>
        </div>
        <div className="max-w-6xl mx-auto px-6 pt-8 space-y-5">
          <Skeleton className="w-72 h-10" />
          <Skeleton className="w-96 h-5" />
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-4">
            <Skeleton className="lg:col-span-7 h-96" />
            <Skeleton className="lg:col-span-5 h-96" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !trip?.plan) {
    return (
      <div className="min-h-screen bg-[#FAF8F4] flex flex-col items-center justify-center text-center p-8">
        <div className="bg-white border border-[#E7E0D5] rounded-3xl p-8 max-w-md w-full shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-[#FEF7E6] border border-[#D97706]/20 flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-6 h-6 text-[#B45309]" aria-hidden />
          </div>
          <h2 className="font-display text-2xl font-semibold text-[#181411] mb-2">
            {error ?? "This Trip is not planned yet"}
          </h2>
          <p className="text-sm text-[#73685E] mb-6">
            {error
              ? "Return to your Dashboard to view your saved Trips."
              : "Pick up the Conversation where you left off to finish planning."}
          </p>
          <div className="flex flex-col sm:flex-row gap-2.5 justify-center">
            {!error && trip && (
              <button
                type="button"
                onClick={() => router.push(`/trip/new?tripId=${trip._id}`)}
                className="bg-[#CE532D] hover:bg-[#B54320] text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
              >
                Continue planning
              </button>
            )}
            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              className="bg-[#181411] hover:bg-[#2C2520] text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <PageWrapper>
      <div className="min-h-screen bg-[#FAF8F4] font-sans pb-24">
        <AppHeader
          maxWidth="max-w-7xl"
          left={
            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#73685E] hover:text-[#181411] bg-white border border-[#E7E0D5] hover:border-[#D6CCC0] px-3 py-1.5 rounded-xl transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" aria-hidden />
              Dashboard
            </button>
          }
          center={<BrandLogo href="/dashboard" size="sm" />}
          right={
            <>
              <button
                type="button"
                onClick={handleShare}
                disabled={sharing}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#181411] bg-white hover:bg-[#F2EDE4]/70 px-3 py-1.5 rounded-xl border border-[#E7E0D5] transition-colors disabled:opacity-60"
              >
                <Link2 className="w-3.5 h-3.5" aria-hidden />
                Share
              </button>
              <button
                type="button"
                onClick={() => setShowConfirm(true)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#C82828] bg-[#FEF2F2] hover:bg-[#FEE2E2] px-3 py-1.5 rounded-xl border border-[#C82828]/15 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" aria-hidden />
                Delete
              </button>
            </>
          }
        />

        <TripPlanView trip={trip} />

        <ConfirmModal
          isOpen={showConfirm}
          title="Delete this Trip?"
          message="This permanently deletes the Trip Plan. It cannot be undone."
          confirmLabel="Delete"
          loading={deleting}
          onConfirm={handleDelete}
          onCancel={() => setShowConfirm(false)}
        />
        <FeedbackWidget page={`/trip/${trip._id}`} />
      </div>
    </PageWrapper>
  );
}
