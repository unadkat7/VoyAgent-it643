"use client";

import { useState } from "react";
import { Building2, ExternalLink, MapPin, Star } from "lucide-react";
import { formatInr } from "@/lib/tripView";
import EmptyState from "./EmptyState";
import PriceSourceBadge from "./PriceSourceBadge";

const MAX_AMENITIES = 4;

function HotelCard({ hotel, nights }) {
  const [imgFailed, setImgFailed] = useState(false);
  const showImage = Boolean(hotel.image_url) && !imgFailed;
  const visibleAmenities = hotel.amenities?.slice(0, MAX_AMENITIES) ?? [];
  const extraAmenities = Math.max(0, (hotel.amenities?.length ?? 0) - MAX_AMENITIES);
  const totalForStay =
    Number.isFinite(nights) && nights > 0 && Number.isFinite(hotel.price_per_night)
      ? hotel.price_per_night * nights
      : null;

  return (
    <article
      data-testid={`hotel-${hotel.name}`}
      className="bg-white border border-[#E7E0D5] hover:border-[#D6CCC0] hover:shadow-[0_16px_36px_-24px_rgba(24,20,17,0.24)] rounded-2xl overflow-hidden flex flex-col transition-all"
    >
      {showImage && (
        <div className="h-40 w-full bg-[#F2EDE4] overflow-hidden border-b border-[#E7E0D5]">
          {/* External provider thumbnail URLs vary by host, so use standard img with graceful error fallback. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={hotel.image_url}
            alt={hotel.name}
            loading="lazy"
            onError={() => setImgFailed(true)}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      <div className="p-5 flex-1 flex flex-col">
        <div className="flex items-center justify-between gap-2 mb-3">
          <PriceSourceBadge source={hotel.price_source} />
          {hotel.rating != null && (
            <span className="inline-flex items-center gap-1 text-xs font-mono font-semibold text-[#B45309] bg-[#FEF7E6] border border-[#B45309]/15 px-2 py-0.5 rounded-full">
              <Star className="w-3 h-3 fill-[#D97706] text-[#D97706]" aria-hidden />
              {hotel.rating}
            </span>
          )}
        </div>

        <h4 className="font-display text-lg font-semibold text-[#181411] leading-snug">
          {hotel.name}
        </h4>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#73685E] mt-1 mb-4">
          <span className="inline-flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5 text-[#CE532D] shrink-0" aria-hidden />
            {hotel.location}
          </span>
          {hotel.hotel_class && (
            <span className="text-[11px] text-[#3B342E] bg-[#FAF8F4] border border-[#E7E0D5] px-2 py-0.5 rounded-md">
              {hotel.hotel_class}
            </span>
          )}
        </div>

        <div className="rounded-xl bg-[#FAF8F4] border border-[#E7E0D5] px-3.5 py-2.5 mb-4">
          <p className="font-mono text-base font-semibold text-[#15803D]">
            {`${formatInr(hotel.price_per_night)} / night`}
          </p>
          {totalForStay != null && (
            <p className="text-[11px] text-[#73685E] mt-0.5">
              Est. {formatInr(totalForStay)} for {nights} {nights === 1 ? "night" : "nights"}
            </p>
          )}
        </div>

        {visibleAmenities.length > 0 && (
          <ul className="flex flex-wrap gap-1.5 mb-5">
            {visibleAmenities.map((amenity) => (
              <li
                key={amenity}
                className="text-[11px] bg-[#FDFBF7] border border-[#E7E0D5] px-2.5 py-0.5 rounded-lg text-[#3B342E]"
              >
                {amenity}
              </li>
            ))}
            {extraAmenities > 0 && (
              <li className="text-[11px] font-mono text-[#73685E] px-1.5 py-0.5">
                +{extraAmenities} more
              </li>
            )}
          </ul>
        )}

        <a
          href={
            hotel.booking_url ||
            `https://www.google.com/maps/search/${encodeURIComponent(`${hotel.name} ${hotel.location}`)}`
          }
          target="_blank"
          rel="noopener noreferrer"
          className="mt-auto inline-flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl text-xs font-semibold text-white bg-[#181411] hover:bg-[#CE532D] transition-colors"
        >
          {hotel.booking_url ? "View deal" : "Find on map"}
          <ExternalLink className="w-3.5 h-3.5" aria-hidden />
        </a>
      </div>
    </article>
  );
}

export default function HotelList({ hotels, nights }) {
  if (!hotels?.length) {
    return (
      <EmptyState icon={Building2}>
        No stays to suggest for this Trip. The Summary tab explains why.
      </EmptyState>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      {hotels.map((hotel) => (
        <HotelCard key={hotel.name} hotel={hotel} nights={nights} />
      ))}
    </div>
  );
}
