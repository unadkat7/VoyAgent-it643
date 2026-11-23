import { Car } from "lucide-react";
import { formatRoadSummary, roadEndNote } from "@/lib/tripView";

// A drive between two places. Hours are a range: hill roads run slower than routing says.
export default function RoadRouteCard({ route, lead = null }) {
  const note = roadEndNote(route);
  return (
    <div className="flex gap-3 rounded-2xl border border-border bg-surface p-4">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-bg text-ink-soft" aria-hidden>
        <Car className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="text-base font-semibold text-ink">
          {lead}
          {route.from_place} → {route.to_place}
        </p>
        <p className="mt-0.5 text-sm text-muted">{formatRoadSummary(route)}</p>
        {note && <p className="mt-2 text-sm font-medium text-warning">{note}</p>}
      </div>
    </div>
  );
}
