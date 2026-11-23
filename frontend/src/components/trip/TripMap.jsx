"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import {
  Compass,
  ExternalLink,
  Layers,
  LocateFixed,
  Map as MapIcon,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { formatInr, mapDays, mapPoints } from "@/lib/tripView";
import EmptyState from "./EmptyState";

// Free, zero-API-key tile styles. Atlas uses OpenStreetMap with a warm CSS tint.
const MAP_STYLES = {
  atlas: {
    id: "atlas",
    label: "Atlas",
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  },
  satellite: {
    id: "satellite",
    label: "Satellite",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics",
    maxZoom: 18,
  },
  terrain: {
    id: "terrain",
    label: "Terrain",
    url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    attribution:
      'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, <a href="https://opentopomap.org">OpenTopoMap</a>',
    maxZoom: 17,
  },
};

const BED_SVG =
  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M2 19v-9M22 19v-5H2M6 14v-3h6v3"/></svg>';

const PIN_STYLE = {
  activity: "background:#ce532d;color:#fff;border-radius:9999px;border:2px solid #fff",
  hotel: "background:#181411;color:#fff;border-radius:9px;border:2px solid #fff",
  destination: "background:#fff;color:#ce532d;border:2.5px solid #ce532d;border-radius:9999px",
};

// Leaflet's default marker images break under bundlers, so pins are plain HTML.
function pinIcon(point, focused) {
  const label = point.kind === "activity" ? point.order : point.kind === "hotel" ? BED_SVG : "★";
  const size = focused ? 36 : 30;
  const pulseClass = focused ? "voyagent-pin-pulse" : "";
  const shadow = focused
    ? "box-shadow:0 0 0 4px rgba(206,83,45,0.28),0 4px 14px rgba(24,20,17,0.38)"
    : "box-shadow:0 3px 10px rgba(24,20,17,0.28)";
  return L.divIcon({
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -(size / 2) - 2],
    html: `<div class="${pulseClass}" style="${PIN_STYLE[point.kind]};width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;font:700 12px system-ui;${shadow};transition:transform .15s ease">${label}</div>`,
  });
}

// Spread identical coordinates slightly (~20m) so co-located stops stay individually clickable.
function spreadOverlapping(points) {
  const groups = new Map();
  for (const point of points) {
    const key = `${point.lat.toFixed(5)},${point.lng.toFixed(5)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(point);
  }
  return points.map((point) => {
    const key = `${point.lat.toFixed(5)},${point.lng.toFixed(5)}`;
    const siblings = groups.get(key);
    if (!siblings || siblings.length <= 1) {
      return { ...point, displayLat: point.lat, displayLng: point.lng };
    }
    const idx = siblings.indexOf(point);
    const angle = (2 * Math.PI * idx) / siblings.length;
    const radius = 0.00018;
    return {
      ...point,
      displayLat: point.lat + Math.cos(angle) * radius,
      displayLng: point.lng + Math.sin(angle) * radius,
    };
  });
}

// A region's centre (e.g. "Goa") can be far inland, so frame the stops and stays instead.
function framedPoints(points) {
  const stops = points.filter((p) => p.kind !== "destination");
  return stops.length > 0 ? stops : points;
}

function MapViewportController({ points, focusedPoint, fitTrigger, expanded }) {
  const map = useMap();

  useEffect(() => {
    map.stop?.();
    map.invalidateSize?.(false);

    if (
      focusedPoint &&
      Number.isFinite(focusedPoint.lat) &&
      Number.isFinite(focusedPoint.lng)
    ) {
      map.setView([focusedPoint.lat, focusedPoint.lng], 15, { animate: false });
      return;
    }

    map.closePopup?.();
    const valid = points.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
    if (valid.length === 1) {
      map.setView([valid[0].lat, valid[0].lng], 13, { animate: false });
    } else if (valid.length > 1) {
      const bounds = L.latLngBounds(valid.map((p) => [p.lat, p.lng]));
      if (bounds?.isValid?.() !== false) {
        map.fitBounds(bounds, { padding: [48, 48], maxZoom: 14, animate: false });
      }
    }
  }, [map, points, focusedPoint, fitTrigger, expanded]);

  return null;
}

function DayChip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all whitespace-nowrap ${
        active
          ? "bg-[#CE532D] border-[#CE532D] text-white shadow-xs"
          : "bg-white/95 border-[#E7E0D5] text-[#3B342E] hover:text-[#181411] hover:border-[#D6CCC0]"
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
  onClearFocus = null,
  compact = false,
  showQuickStrip = false,
  onTrack = null,
}) {
  const [internalDay, setInternalDay] = useState("all");
  const [mapStyle, setMapStyle] = useState("atlas");
  const [showActivities, setShowActivities] = useState(true);
  const [showStays, setShowStays] = useState(true);
  const [localFocusKey, setLocalFocusKey] = useState(null);
  const [fitTrigger, setFitTrigger] = useState(0);
  const [expanded, setExpanded] = useState(false);

  const markerRefs = useRef({});

  const day = selectedDay ?? internalDay;
  const setDay = (nextDay) => {
    setLocalFocusKey(null);
    onTrack?.("map_day_filtered", nextDay === "all" ? "all" : "day");
    if (onDayChange) onDayChange(nextDay);
    else setInternalDay(nextDay);
  };

  const activeFocusKey = focusedPointKey ?? localFocusKey;
  const days = useMemo(() => mapDays(plan), [plan]);
  const allPoints = useMemo(() => mapPoints(plan, "all"), [plan]);
  const dayPoints = useMemo(() => mapPoints(plan, day), [plan, day]);

  const points = useMemo(
    () =>
      spreadOverlapping(
        dayPoints.filter((p) => {
          if (p.kind === "activity" && !showActivities) return false;
          if (p.kind === "hotel" && !showStays) return false;
          return true;
        })
      ),
    [dayPoints, showActivities, showStays]
  );

  const framed = useMemo(() => {
    const candidate = framedPoints(points);
    return candidate.length > 0 ? candidate : framedPoints(allPoints);
  }, [points, allPoints]);

  const focusedPoint = useMemo(
    () => (activeFocusKey ? points.find((p) => p.key === activeFocusKey) ?? null : null),
    [points, activeFocusKey]
  );

  const route = useMemo(
    () =>
      day === "all" || !showActivities
        ? []
        : points.filter((p) => p.kind === "activity").map((p) => [p.lat, p.lng]),
    [points, day, showActivities]
  );

  // Auto-open the marker's popup whenever a stop is focused from the Itinerary or quick strip.
  useEffect(() => {
    if (!activeFocusKey) return;
    const marker = markerRefs.current[activeFocusKey];
    if (marker && typeof marker.openPopup === "function") {
      marker.openPopup();
    }
  }, [activeFocusKey]);

  // Allow Escape key to exit fullscreen immersive mode.
  useEffect(() => {
    if (!expanded) return;
    const onKeyDown = (event) => {
      if (event.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [expanded]);

  if (allPoints.length === 0) {
    return (
      <EmptyState icon={MapIcon}>
        No map pins for this Trip yet. Trips planned from now on get them automatically.
      </EmptyState>
    );
  }

  const tileStyle = MAP_STYLES[mapStyle] ?? MAP_STYLES.atlas;
  const activityCount = points.filter((p) => p.kind === "activity").length;
  const stayCount = points.filter((p) => p.kind === "hotel").length;
  const quickStops = points.filter((p) => p.kind !== "destination");

  const handleResetView = () => {
    setLocalFocusKey(null);
    onClearFocus?.();
    setFitTrigger((n) => n + 1);
    onTrack?.("map_reset_view");
  };

  const handleSelectQuickStop = (key, kind) => {
    onClearFocus?.();
    setLocalFocusKey(key);
    onTrack?.("map_pin_focused", kind || "activity");
  };

  const handleStyleChange = (styleId) => {
    setMapStyle(styleId);
    onTrack?.("map_style_changed", styleId);
  };

  const handleToggleFullscreen = () => {
    setExpanded((prev) => {
      if (!prev) onTrack?.("map_fullscreen_opened");
      return !prev;
    });
  };

  const mapBody = (
    <div
      className={
        expanded
          ? "fixed inset-3 sm:inset-5 z-50 bg-[#FAF8F4] border border-[#E7E0D5] rounded-3xl shadow-2xl p-3 sm:p-4 flex flex-col gap-3"
          : "space-y-3"
      }
    >
      {/* Top Bar: Day Filter Chips + Pin Counter + Fullscreen Close */}
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
        <div className="flex items-center gap-2 ml-auto">
          <span className="font-mono text-[11px] text-[#73685E]">
            {activityCount} {activityCount === 1 ? "activity" : "activities"}
            {stayCount > 0 ? ` · ${stayCount} ${stayCount === 1 ? "stay" : "stays"}` : ""}
          </span>
          {expanded && (
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="inline-flex items-center gap-1 text-xs font-semibold bg-[#181411] text-[#FAF8F4] px-3 py-1.5 rounded-full hover:bg-[#2C2520] transition-colors"
            >
              <Minimize2 className="w-3.5 h-3.5" aria-hidden />
              Exit
            </button>
          )}
        </div>
      </div>

      {/* Interactive Map Canvas with Floating Glassmorphic Controls */}
      <div
        className={`relative isolate rounded-2xl overflow-hidden border border-[#E7E0D5] bg-[#EFEAE1] shadow-[0_14px_36px_-22px_rgba(24,20,17,0.24)] ${
          mapStyle === "atlas" ? "atlas-map-tiles" : ""
        } ${
          expanded
            ? "flex-1 min-h-0"
            : compact
            ? "h-[calc(100vh-14.5rem)] min-h-[440px]"
            : "h-[60dvh] min-h-64 sm:h-[70vh] sm:min-h-[440px]"
        }`}
      >
        <MapContainer
          center={[framed[0].lat, framed[0].lng]}
          zoom={12}
          zoomSnap={0.5}
          wheelPxPerZoomLevel={90}
          scrollWheelZoom={true}
          className="h-full w-full z-0"
        >
          <TileLayer
            key={tileStyle.id}
            url={tileStyle.url}
            attribution={tileStyle.attribution}
            maxZoom={tileStyle.maxZoom}
          />
          <MapViewportController
            points={framed}
            focusedPoint={focusedPoint}
            fitTrigger={fitTrigger}
            expanded={expanded}
          />
          {route.length > 1 && (
            <Polyline
              positions={route}
              pathOptions={{ color: "#ce532d", weight: 3.5, dashArray: "7 8", opacity: 0.9 }}
            />
          )}
          {points.map((point) => {
            const isFocused = activeFocusKey === point.key;
            const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
              `${point.lat},${point.lng}`
            )}`;
            return (
              <Marker
                key={point.key}
                ref={(node) => {
                  if (node) markerRefs.current[point.key] = node;
                  else delete markerRefs.current[point.key];
                }}
                position={[point.displayLat ?? point.lat, point.displayLng ?? point.lng]}
                icon={pinIcon(point, isFocused)}
                zIndexOffset={isFocused ? 1000 : 0}
                eventHandlers={{
                  click: () => handleSelectQuickStop(point.key, point.kind),
                }}
              >
                <Popup>
                  <div className="min-w-[180px] space-y-1.5">
                    <span
                      className={`inline-block font-mono text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                        point.kind === "hotel"
                          ? "bg-[#181411] text-[#FAF8F4]"
                          : point.kind === "activity"
                          ? "bg-[#FCEEE8] text-[#B54320]"
                          : "bg-[#F2EDE4] text-[#3B342E]"
                      }`}
                    >
                      {point.kind === "hotel"
                        ? "Stay"
                        : point.kind === "activity"
                        ? `Stop #${point.order}`
                        : "Destination"}
                    </span>
                    <p className="font-semibold text-[#181411] text-sm leading-snug">
                      {point.title}
                    </p>
                    {point.detail && <p className="text-xs text-[#73685E]">{point.detail}</p>}
                    {point.kind === "activity" && (
                      <p className="text-xs font-semibold text-[#15803D]">
                        {point.cost > 0 ? `Est. ${formatInr(point.cost)} per traveller` : "Free"}
                      </p>
                    )}
                    <a
                      href={mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => onTrack?.("map_google_maps_opened", point.kind)}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#CE532D] hover:underline pt-1"
                    >
                      Open in Google Maps
                      <ExternalLink className="w-3 h-3" aria-hidden />
                    </a>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>

        {/* Top-Right Floating Map Style Switcher (above Leaflet's z-1000 controls) */}
        <div
          className="absolute top-3 right-3 z-[1001] flex items-center gap-1 bg-white/95 backdrop-blur-md border border-[#E7E0D5] rounded-full p-1 shadow-lg"
          role="group"
          aria-label="Map style"
        >
          <Layers className="w-3.5 h-3.5 text-[#73685E] ml-2 mr-0.5 hidden sm:block" aria-hidden />
          {Object.values(MAP_STYLES).map((styleOption) => {
            const active = mapStyle === styleOption.id;
            return (
              <button
                key={styleOption.id}
                type="button"
                onClick={() => handleStyleChange(styleOption.id)}
                aria-pressed={active}
                className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all ${
                  active
                    ? "bg-[#181411] text-[#FAF8F4] shadow-xs"
                    : "text-[#73685E] hover:text-[#181411]"
                }`}
              >
                {styleOption.label}
              </button>
            );
          })}
        </div>

        {/* Bottom-Right Floating Action Dock (Fit All + Fullscreen) */}
        <div className="absolute bottom-8 right-3 z-[1001] flex flex-col gap-1.5">
          <button
            type="button"
            onClick={handleResetView}
            title="Fit all pins in view"
            aria-label="Fit all pins in view"
            className="w-9 h-9 rounded-xl bg-white/95 backdrop-blur-md border border-[#E7E0D5] text-[#181411] hover:text-[#CE532D] hover:border-[#CE532D]/40 shadow-lg flex items-center justify-center transition-colors"
          >
            <LocateFixed className="w-4 h-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={handleToggleFullscreen}
            title={expanded ? "Close fullscreen map" : "Expand immersive fullscreen map"}
            aria-label={expanded ? "Close fullscreen map" : "Expand immersive fullscreen map"}
            className="w-9 h-9 rounded-xl bg-white/95 backdrop-blur-md border border-[#E7E0D5] text-[#181411] hover:text-[#CE532D] hover:border-[#CE532D]/40 shadow-lg flex items-center justify-center transition-colors"
          >
            {expanded ? (
              <Minimize2 className="w-4 h-4" aria-hidden />
            ) : (
              <Maximize2 className="w-4 h-4" aria-hidden />
            )}
          </button>
        </div>

        {/* Subtle Scroll-to-Zoom Hint Pill (bottom-left) */}
        <div className="pointer-events-none absolute bottom-3 left-3 z-[1001] hidden sm:inline-flex items-center gap-1.5 bg-[#181411]/82 backdrop-blur-sm text-[#FAF8F4] text-[10px] font-mono px-2.5 py-1 rounded-full shadow-md">
          <Compass className="w-3 h-3 text-[#F29674]" aria-hidden />
          Scroll to zoom · Drag to pan
        </div>
      </div>

      {/* Quick-Jump Place Strip in Full Map Tab or Fullscreen Immersive Mode */}
      {(showQuickStrip || expanded) && quickStops.length > 0 && (
        <div
          className="flex items-center gap-2 overflow-x-auto pb-1"
          aria-label="Jump to pinned place"
        >
          {quickStops.map((stop) => {
            const active = activeFocusKey === stop.key;
            return (
              <button
                key={stop.key}
                type="button"
                onClick={() => handleSelectQuickStop(stop.key, stop.kind)}
                className={`shrink-0 inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all ${
                  active
                    ? "bg-[#181411] border-[#181411] text-[#FAF8F4] shadow-xs"
                    : "bg-white border-[#E7E0D5] text-[#3B342E] hover:border-[#CE532D]/50 hover:text-[#CE532D]"
                }`}
              >
                <span
                  className={`w-4 h-4 rounded-full font-mono text-[10px] font-bold flex items-center justify-center ${
                    stop.kind === "hotel"
                      ? active
                        ? "bg-[#FAF8F4] text-[#181411]"
                        : "bg-[#181411] text-[#FAF8F4]"
                      : "bg-[#CE532D] text-white"
                  }`}
                >
                  {stop.kind === "hotel" ? "H" : stop.order}
                </span>
                <span className="max-w-[160px] truncate">{stop.title}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Interactive Filterable Editorial Legend */}
      <ul className="flex flex-wrap items-center gap-2 text-xs text-[#73685E] bg-white border border-[#E7E0D5] rounded-xl px-3.5 py-2">
        <li>
          <button
            type="button"
            onClick={() => {
              setShowActivities((v) => !v);
              onTrack?.("map_layer_toggled", "activities");
            }}
            aria-pressed={showActivities}
            className={`flex items-center gap-1.5 px-2 py-0.5 rounded-lg transition-all ${
              showActivities ? "text-[#181411] font-medium" : "opacity-45 line-through"
            }`}
          >
            <span className="w-3 h-3 rounded-full bg-[#CE532D]" aria-hidden />
            Activity (numbered by day)
          </button>
        </li>
        <li>
          <button
            type="button"
            onClick={() => {
              setShowStays((v) => !v);
              onTrack?.("map_layer_toggled", "stays");
            }}
            aria-pressed={showStays}
            className={`flex items-center gap-1.5 px-2 py-0.5 rounded-lg transition-all ${
              showStays ? "text-[#181411] font-medium" : "opacity-45 line-through"
            }`}
          >
            <span className="w-3 h-3 rounded bg-[#181411]" aria-hidden />
            Stay
          </button>
        </li>
        <li className="flex items-center gap-1.5 px-2 py-0.5">
          <span className="w-3 h-3 rounded-full border-2 border-[#CE532D] bg-white" aria-hidden />
          Destination
        </li>
      </ul>
    </div>
  );

  if (expanded) {
    return (
      <>
        <div
          className="fixed inset-0 z-40 bg-[#181411]/45 backdrop-blur-xs"
          onClick={() => setExpanded(false)}
          aria-hidden="true"
        />
        {mapBody}
      </>
    );
  }

  return mapBody;
}
