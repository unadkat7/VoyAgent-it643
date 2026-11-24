"use client";

import { useState } from "react";
import { Building2, ExternalLink, MapPin, Star } from "lucide-react";
import { formatInr, stayLabel } from "@/lib/tripView";
import EmptyState from "./EmptyState";
import PriceSourceBadge from "./PriceSourceBadge";

const MAX_AMENITIES = 3;

function HotelCard({ hotel, nights, rooms, onTrack }) {
  const [imgFailed, setImgFailed] = useState(false);
  const showImage = Boolean(hotel.image_url) && !imgFailed;
  const visibleAmenities = hotel.amenities?.slice(0, MAX_AMENITIES) ?? [];
  const extraAmenities = Math.max(0, (hotel.amenities?.length ?? 0) - MAX_AMENITIES);
  const totalForStay =
    Number.isFinite(nights) && nights > 0 && Number.isFinite(hotel.price_per_night)
      ? hotel.price_per_night * nights * rooms
      : null;

  return (
    <article
      data-testid={`hotel-${hotel.name}`}
      className="flex flex-col overflow-hidden rounded-2xl border border-border bg-surface"
    >
      {showImage && (
        <div className="aspect-[16/9] max-h-44 w-full overflow-hidden bg-bg-subtle">
          {/* External provider thumbnail URLs vary by host, so use standard img with graceful error fallback. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={hotel.image_url}
            alt={hotel.name}
            loading="lazy"
            onError={() => setImgFailed(true)}
            className="h-full w-full object-cover"
          />
        </div>
      )}

      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-display text-lg font-semibold leading-snug text-ink">{hotel.name}</h3>
          {hotel.rating != null && (
            <span className="inline-flex shrink-0 items-center gap-1 font-mono text-sm font-semibold text-warning">
              <Star className="h-4 w-4 fill-star text-star" aria-hidden />
              {hotel.rating}
            </span>
          )}
        </div>

        <p className="mt-1 flex items-center gap-1 text-sm text-muted">
          <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
          {hotel.location}
          {hotel.hotel_class && <span className="text-ink-soft"> · {hotel.hotel_class}</span>}
        </p>

        <div className="mt-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <p className="font-mono text-lg font-semibold text-success">
            {totalForStay != null
              ? `${formatInr(totalForStay)} for ${stayLabel(nights, rooms)}`
              : `${formatInr(hotel.price_per_night)} / night`}
          </p>
          <PriceSourceBadge source={hotel.price_source} />
        </div>
        {totalForStay != null && (
          <p className="text-sm text-muted">
            {formatInr(hotel.price_per_night)} a night{rooms > 1 ? " per room" : ""}
          </p>
        )}

        {visibleAmenities.length > 0 && (
          <p className="mt-3 text-sm text-ink-soft">
            {visibleAmenities.join(" · ")}
            {extraAmenities > 0 && <span className="text-muted"> · +{extraAmenities} more</span>}
          </p>
        )}

        <a
          href={
            hotel.booking_url ||
            `https://www.google.com/maps/search/${encodeURIComponent(`${hotel.name} ${hotel.location}`)}`
          }
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => onTrack?.("hotel_deal_clicked", hotel.booking_url ? "booking_url" : "google_maps")}
          className="mt-4 inline-flex min-h-tap items-center justify-center gap-1.5 rounded-xl bg-ink px-4 text-sm font-semibold text-white transition-colors hover:bg-primary sm:mt-auto"
        >
          {hotel.booking_url ? "View deal" : "Find on map"}
          <ExternalLink className="h-4 w-4" aria-hidden />
        </a>
      </div>
    </article>
  );
}

export default function HotelList({ hotels, nights, rooms = 1, notes = [], onTrack = null }) {
  if (!hotels?.length) {
    return (
      <EmptyState icon={Building2} notes={notes}>
        No stays to suggest for this Trip.
      </EmptyState>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {hotels.map((hotel) => (
        <HotelCard key={hotel.name} hotel={hotel} nights={nights} rooms={rooms} onTrack={onTrack} />
      ))}
    </div>
  );
}
