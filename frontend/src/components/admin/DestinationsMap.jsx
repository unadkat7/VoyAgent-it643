"use client";

import { useEffect, useMemo } from "react";
import L from "leaflet";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { Map as MapIcon } from "lucide-react";
import { formatInr } from "@/lib/tripView";

function clusterIcon(count, maxCount) {
  const ratio = maxCount > 1 ? count / maxCount : 0.5;
  const size = Math.round(26 + ratio * 16);
  return L.divIcon({
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -(size / 2) - 2],
    html: `<div style="width:${size}px;height:${size}px;border-radius:9999px;background:#ce532d;color:#fff;border:2.5px solid #fff;box-shadow:0 4px 12px rgba(24,20,17,0.32);display:flex;align-items:center;justify-content:center;font:700 11px ui-monospace,monospace;">${count}</div>`,
  });
}

function FitDestinations({ pins }) {
  const map = useMap();
  useEffect(() => {
    map.invalidateSize?.(false);
    if (pins.length === 1) {
      map.setView([pins[0].lat, pins[0].lng], 6, { animate: false });
    } else if (pins.length > 1) {
      const bounds = L.latLngBounds(pins.map((p) => [p.lat, p.lng]));
      if (bounds?.isValid?.() !== false) {
        map.fitBounds(bounds, { padding: [36, 36], maxZoom: 7, animate: false });
      }
    }
  }, [map, pins]);
  return null;
}

export default function DestinationsMap({ pins = [] }) {
  const validPins = useMemo(
    () => pins.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng)),
    [pins]
  );

  if (validPins.length === 0) {
    return (
      <div className="h-64 rounded-2xl border border-[#E7E0D5] bg-[#FAF8F4] flex flex-col items-center justify-center text-center p-6">
        <MapIcon className="w-6 h-6 text-[#A89E94] mb-2" aria-hidden />
        <p className="text-sm font-medium text-[#3B342E]">No geocoded destinations yet</p>
        <p className="text-xs text-[#73685E] mt-0.5">
          Planned Trips with coordinates will appear pinned across the atlas automatically.
        </p>
      </div>
    );
  }

  const maxCount = Math.max(1, ...validPins.map((p) => p.count));

  return (
    <div className="relative isolate h-72 sm:h-80 rounded-2xl overflow-hidden border border-[#E7E0D5] bg-[#EFEAE1] atlas-map-tiles">
      <MapContainer
        center={[validPins[0].lat, validPins[0].lng]}
        zoom={5}
        scrollWheelZoom={false}
        className="h-full w-full z-0"
      >
        <TileLayer
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          maxZoom={18}
        />
        <FitDestinations pins={validPins} />
        {validPins.map((pin) => (
          <Marker
            key={`${pin.destination}-${pin.lat}-${pin.lng}`}
            position={[pin.lat, pin.lng]}
            icon={clusterIcon(pin.count, maxCount)}
          >
            <Popup>
              <div className="min-w-[150px] space-y-1">
                <p className="font-display font-semibold text-sm text-[#181411]">
                  {pin.destination}
                </p>
                <p className="text-xs text-[#3B342E]">
                  <strong className="font-mono">{pin.count}</strong> planned{" "}
                  {pin.count === 1 ? "Trip" : "Trips"}
                </p>
                {pin.avgBudgetInr && (
                  <p className="text-xs text-[#15803D] font-mono font-semibold">
                    Avg budget {formatInr(pin.avgBudgetInr)}
                  </p>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
