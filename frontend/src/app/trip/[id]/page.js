"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Link2, MoreHorizontal, Share2, ShieldAlert, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { deleteTrip, getTripById, shareTrip } from "@/services/trip.service";
import FeedbackWidget from "@/components/feedback/FeedbackWidget";
import AppHeader from "@/components/layout/AppHeader";
import BottomNav from "@/components/layout/BottomNav";
import BrandLogo from "@/components/layout/BrandLogo";
import PageWrapper from "@/components/layout/PageWrapper";
import TripPlanView from "@/components/trip/TripPlanView";
import ConfirmModal from "@/components/ui/ConfirmModal";
import Sheet from "@/components/ui/Sheet";
import { tripTitle } from "@/lib/tripView";
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
  const [shareId, setShareId] = useState(null);
  const [showActions, setShowActions] = useState(false);

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

  const giveLink = async (link) => {
    if (navigator.share) {
      try {
        await navigator.share({ title: `${tripTitle(trip)} trip plan`, url: link });
        return;
      } catch (shareError) {
        if (shareError?.name === "AbortError") return;
        // Some browsers refuse the share sheet after a network wait; fall back to copying.
      }
    }
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Share link copied");
    } catch {
      // Clipboard can be blocked (e.g. insecure origin); still give the link.
      toast.success(`Share link: ${link}`, { duration: 8000 });
    }
  };

  const handleShare = async () => {
    setShowActions(false);
    try {
      setSharing(true);
      const id = shareId ?? (await shareTrip(tripId)).shareId;
      setShareId(id);
      await giveLink(`${window.location.origin}/share/${id}`);
    } catch {
      toast.error("Could not create a share link. Please try again.");
    } finally {
      setSharing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-bg font-sans">
        <div className="bg-bg/90 border-b border-border px-6 h-16 flex items-center">
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
      <div className="min-h-screen bg-bg flex flex-col items-center justify-center text-center p-8">
        <div className="bg-white border border-border rounded-3xl p-8 max-w-md w-full shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-warning-light border border-star/20 flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-6 h-6 text-warning" aria-hidden />
          </div>
          <h2 className="font-display text-2xl font-semibold text-ink mb-2">
            {error ?? "This Trip is not planned yet"}
          </h2>
          <p className="text-sm text-muted mb-6">
            {error
              ? "Return to your Dashboard to view your saved Trips."
              : "Pick up the Conversation where you left off to finish planning."}
          </p>
          <div className="flex flex-col sm:flex-row gap-2.5 justify-center">
            {!error && trip && (
              <button
                type="button"
                onClick={() => router.push(`/trip/new?tripId=${trip._id}`)}
                className="bg-primary hover:bg-primary-hover text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
              >
                Continue planning
              </button>
            )}
            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              className="bg-ink hover:bg-ink-hover text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
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
      <div className="min-h-screen bg-bg font-sans pb-nav">
        <AppHeader
          maxWidth="max-w-7xl"
          left={
            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              aria-label="Back to trips"
              className="inline-flex min-h-tap min-w-tap items-center justify-center gap-1.5 rounded-xl text-sm font-semibold text-ink-soft hover:bg-bg-subtle hover:text-ink sm:px-3"
            >
              <ArrowLeft className="h-5 w-5" aria-hidden />
              <span className="hidden sm:inline">Trips</span>
            </button>
          }
          center={<BrandLogo href="/dashboard" size="sm" />}
          right={
            <>
              <button
                type="button"
                onClick={handleShare}
                disabled={sharing}
                className="inline-flex min-h-tap items-center gap-1.5 rounded-xl border border-border bg-surface px-4 text-sm font-semibold text-ink hover:bg-bg-subtle disabled:opacity-60"
              >
                <Share2 className="h-4 w-4" aria-hidden />
                Share
              </button>
              <button
                type="button"
                onClick={() => setShowActions(true)}
                aria-label="More trip actions"
                className="flex size-tap items-center justify-center rounded-xl border border-border bg-surface text-ink hover:bg-bg-subtle"
              >
                <MoreHorizontal className="h-5 w-5" aria-hidden />
              </button>
            </>
          }
        />

        <TripPlanView trip={trip} />

        <Sheet open={showActions} onClose={() => setShowActions(false)} title="Trip actions">
          <div className="-mx-2 flex flex-col">
            <button
              type="button"
              onClick={handleShare}
              disabled={sharing}
              className="flex min-h-12 items-center gap-3 rounded-xl px-3 text-base font-semibold text-ink hover:bg-bg disabled:opacity-60"
            >
              <Link2 className="h-5 w-5 text-muted" aria-hidden />
              Share link
            </button>
            <button
              type="button"
              onClick={() => {
                setShowActions(false);
                setShowConfirm(true);
              }}
              className="flex min-h-12 items-center gap-3 rounded-xl px-3 text-base font-semibold text-danger hover:bg-danger-light"
            >
              <Trash2 className="h-5 w-5" aria-hidden />
              Delete trip
            </button>
          </div>
        </Sheet>

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
        <BottomNav page={`/trip/${trip._id}`} />
      </div>
    </PageWrapper>
  );
}
