"use client";

import { useEffect, useMemo, useState } from "react";
import L from "leaflet";
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { Map as MapIcon } from "lucide-react";
import { formatInr, mapDays, mapPoints } from "@/lib/tripView";
import EmptyState from "./EmptyState";

const TILES = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const BED_SVG =
  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M2 19v-9M22 19v-5H2M6 14v-3h6v3"/></svg>';

const PIN_STYLE = {
  activity: "background:#ce532d;color:#fff;border-radius:9999px;border:2px solid #fff",
  hotel: "background:#181411;color:#fff;border-radius:8px;border:2px solid #fff",
  destination: "background:#fff;color:#ce532d;border:2px solid #ce532d;border-radius:9999px",
};

// Leaflet's default marker images break under bundlers, so pins are plain HTML.
function pinIcon(point, focused) {
  const label = point.kind === "activity" ? point.order : point.kind === "hotel" ? BED_SVG : "★";
  const size = focused ? 34 : 28;
  const ring = focused
    ? "box-shadow:0 0 0 4px rgba(206,83,45,0.28),0 4px 12px rgba(24,20,17,0.35);transform:scale(1.06)"
    : "box-shadow:0 2px 8px rgba(24,20,17,0.28)";
  return L.divIcon({
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -(size / 2)],
    html: `<div style="${PIN_STYLE[point.kind]};width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;font:700 12px system-ui;${ring}">${label}</div>`,
  });
}

// A region's centre (e.g. "Goa") can be far inland, so frame the stops and stays instead.
function framedPoints(points) {
  const stops = points.filter((p) => p.kind !== "destination");
  return stops.length > 0 ? stops : points;
}

function FitToPins({ points, focusedPoint }) {
  const map = useMap();
  useEffect(() => {
    if (focusedPoint) {
      if (typeof map.flyTo === "function") {
        map.flyTo([focusedPoint.lat, focusedPoint.lng], 14, { duration: 0.65 });
      } else {
        map.setView([focusedPoint.lat, focusedPoint.lng], 14);
      }
      return;
    }
    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 12);
    } else if (points.length > 1) {
      const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng]));
      map.fitBounds(bounds, { padding: [44, 44], maxZoom: 14 });
    }
  }, [map, points, focusedPoint]);
  return null;
}

function DayChip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
        active
          ? "bg-[#CE532D] border-[#CE532D] text-white shadow-xs"
          : "bg-white border-[#E7E0D5] text-[#73685E] hover:text-[#181411] hover:border-[#D6CCC0]"
      }`}
    >
      {children}
    </button>
  );
}

export default function TripMap({
  plan,
  selectedDay,
  onDayChange,
  focusedPointKey = null,
  compact = false,
}) {
  const [internalDay, setInternalDay] = useState("all");
  const day = selectedDay ?? internalDay;
  const setDay = onDayChange ?? setInternalDay;

  const days = useMemo(() => mapDays(plan), [plan]);
  const allPoints = useMemo(() => mapPoints(plan, "all"), [plan]);
  const points = useMemo(() => mapPoints(plan, day), [plan, day]);
  const framed = useMemo(() => framedPoints(points), [points]);
  const focusedPoint = useMemo(
    () => (focusedPointKey ? points.find((p) => p.key === focusedPointKey) ?? null : null),
    [points, focusedPointKey]
  );
  const route = useMemo(
    () => (day === "all" ? [] : points.filter((p) => p.kind === "activity").map((p) => [p.lat, p.lng])),
    [points, day]
  );

  if (allPoints.length === 0) {
    return (
      <EmptyState icon={MapIcon}>
        No map pins for this Trip yet. Trips planned from now on get them automatically.
      </EmptyState>
    );
  }

  const activityCount = points.filter((p) => p.kind === "activity").length;
  const stayCount = points.filter((p) => p.kind === "hotel").length;

  return (
    <div className="space-y-3">
      {/* Header / Day Filter Strip */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {days.length > 0 && (
          <div className="flex flex-wrap gap-1.5" aria-label="Show day on map">
            <DayChip active={day === "all"} onClick={() => setDay("all")}>
              All days
            </DayChip>
            {days.map((d) => (
              <DayChip key={d} active={day === d} onClick={() => setDay(d)}>
                {`Day ${d}`}
              </DayChip>
            ))}
          </div>
        )}
        <span className="font-mono text-[11px] text-[#73685E]">
          {activityCount} {activityCount === 1 ? "activity" : "activities"}
          {stayCount > 0 ? ` · ${stayCount} ${stayCount === 1 ? "stay" : "stays"}` : ""}
        </span>
      </div>

      {/* isolate keeps Leaflet's high z-index panes under the sticky page header */}
      <div
        className={`isolate rounded-2xl overflow-hidden border border-[#E7E0D5] bg-white shadow-[0_12px_32px_-22px_rgba(24,20,17,0.22)] ${
          compact ? "h-[calc(100vh-14.5rem)] min-h-[420px]" : "h-[64vh] min-h-[380px]"
        }`}
      >
        <MapContainer
          center={[framed[0].lat, framed[0].lng]}
          zoom={11}
          scrollWheelZoom={false}
          className="h-full w-full"
        >
          <TileLayer url={TILES} attribution={ATTRIBUTION} maxZoom={19} />
          <FitToPins points={framed} focusedPoint={focusedPoint} />
          {route.length > 1 && (
            <Polyline
              positions={route}
              pathOptions={{ color: "#ce532d", weight: 3, dashArray: "6 8", opacity: 0.85 }}
            />
          )}
          {points.map((point) => (
            <Marker
              key={point.key}
              position={[point.lat, point.lng]}
              icon={pinIcon(point, focusedPointKey === point.key)}
            >
              <Popup>
                <p className="font-semibold text-[#181411] text-sm">{point.title}</p>
                {point.detail && <p className="text-xs text-[#73685E] mt-0.5">{point.detail}</p>}
                {point.kind === "activity" && (
                  <p className="text-xs font-semibold text-[#15803D] mt-1">
                    {point.cost > 0 ? `Est. ${formatInr(point.cost)} per traveller` : "Free"}
                  </p>
                )}
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {/* Editorial Legend */}
      <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-[#73685E] bg-white border border-[#E7E0D5] rounded-xl px-3.5 py-2.5">
        <li className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-[#CE532D]" aria-hidden />
          Activity (numbered by day)
        </li>
        <li className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-[#181411]" aria-hidden />
          Stay
        </li>
        <li className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full border-2 border-[#CE532D] bg-white" aria-hidden />
          Destination
        </li>
      </ul>
    </div>
  );
}
