"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import {
  ExternalLink,
  Layers,
  LocateFixed,
  Map as MapIcon,
  Maximize2,
  Minimize2,
  MousePointerClick,
} from "lucide-react";
import { formatInr, mapDays, mapPoints } from "@/lib/tripView";
import useWideLayout from "@/lib/useWideLayout";
import SegmentedControl from "@/components/ui/SegmentedControl";
import Sheet from "@/components/ui/Sheet";
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

const STYLE_OPTIONS = Object.values(MAP_STYLES).map(({ id, label }) => ({ value: id, label }));

const BED_SVG =
  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M2 19v-9M22 19v-5H2M6 14v-3h6v3"/></svg>';

const PIN_STYLE = {
  activity: "background:#ce532d;color:#fff;border-radius:9999px;border:2px solid #fff",
  hotel: "background:#181411;color:#fff;border-radius:9px;border:2px solid #fff",
  destination: "background:#fff;color:#ce532d;border:2.5px solid #ce532d;border-radius:9999px",
};

const FLOATING_BUTTON =
  "flex size-tap items-center justify-center rounded-xl border border-border bg-surface/95 text-ink shadow-lg backdrop-blur-md transition-colors hover:border-primary/40 hover:text-primary";

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

// The page keeps the mouse wheel until the map is clicked, so scrolling past the map never gets stuck.
function WheelZoomAfterClick() {
  const map = useMapEvents({
    click: () => map.scrollWheelZoom.enable(),
    mouseout: () => map.scrollWheelZoom.disable(),
  });
  return null;
}

function StopBadge({ stop, active }) {
  return (
    <span
      className={`flex size-6 shrink-0 items-center justify-center rounded-full font-mono text-label font-bold ${
        stop.kind === "hotel" ? (active ? "bg-bg text-ink" : "bg-ink text-bg") : "bg-primary text-white"
      }`}
      aria-hidden
    >
      {stop.kind === "hotel" ? "H" : stop.order}
    </span>
  );
}

function LayerToggle({ pressed, onClick, swatch, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      className={`flex min-h-tap items-center gap-2 rounded-xl px-3 text-sm transition-all ${
        pressed ? "font-medium text-ink" : "text-muted line-through opacity-60"
      }`}
    >
      <span className={`size-3 ${swatch}`} aria-hidden />
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
  belowButton = false,
}) {
  const [internalDay, setInternalDay] = useState("all");
  const [mapStyle, setMapStyle] = useState("atlas");
  const [showActivities, setShowActivities] = useState(true);
  const [showStays, setShowStays] = useState(true);
  const [localFocusKey, setLocalFocusKey] = useState(null);
  const [fitTrigger, setFitTrigger] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);

  const wide = useWideLayout();
  const phone = !wide && !compact && !expanded;
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

  // Auto-open the marker's popup whenever a stop is focused from the Itinerary or the places list.
  useEffect(() => {
    if (!activeFocusKey) return;
    // Wait a frame: on first mount the popup is bound to its marker after this effect runs.
    const frame = requestAnimationFrame(() => markerRefs.current[activeFocusKey]?.openPopup?.());
    return () => cancelAnimationFrame(frame);
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
  const pinSummary = `${activityCount} ${activityCount === 1 ? "activity" : "activities"}${
    stayCount > 0 ? ` · ${stayCount} ${stayCount === 1 ? "stay" : "stays"}` : ""
  }`;

  const handleResetView = () => {
    setLocalFocusKey(null);
    onClearFocus?.();
    setFitTrigger((n) => n + 1);
    onTrack?.("map_reset_view");
  };

  const handleSelectQuickStop = (key, kind) => {
    onClearFocus?.();
    setLocalFocusKey(key);
    setOptionsOpen(false);
    onTrack?.("map_pin_focused", kind || "activity");
  };

  const handleStyleChange = (styleId) => {
    setMapStyle(styleId);
    onTrack?.("map_style_changed", styleId);
  };

  const toggleActivities = () => {
    setShowActivities((v) => !v);
    onTrack?.("map_layer_toggled", "activities");
  };

  const toggleStays = () => {
    setShowStays((v) => !v);
    onTrack?.("map_layer_toggled", "stays");
  };

  const handleToggleFullscreen = () => {
    setExpanded((prev) => {
      if (!prev) onTrack?.("map_fullscreen_opened");
      return !prev;
    });
  };

  const dayOptions = [
    { value: "all", label: "All days" },
    ...days.map((d) => ({ value: d, label: `Day ${d}` })),
  ];

  const layerToggles = (
    <>
      <LayerToggle pressed={showActivities} onClick={toggleActivities} swatch="rounded-full bg-primary">
        Activities (numbered by day)
      </LayerToggle>
      <LayerToggle pressed={showStays} onClick={toggleStays} swatch="rounded bg-ink">
        Stays
      </LayerToggle>
    </>
  );

  const placeButton = (stop) => {
    const active = activeFocusKey === stop.key;
    return (
      <button
        key={stop.key}
        type="button"
        onClick={() => handleSelectQuickStop(stop.key, stop.kind)}
        aria-pressed={active}
        className={`inline-flex min-h-tap shrink-0 items-center gap-2 rounded-xl border px-3 text-left text-sm font-medium transition-all ${
          active
            ? "border-ink bg-ink text-bg"
            : "border-border bg-surface text-ink-soft hover:border-primary/50 hover:text-primary"
        }`}
      >
        <StopBadge stop={stop} active={active} />
        <span className="min-w-0">{stop.title}</span>
        {stop.kind === "activity" && <span className={active ? "text-bg/70" : "text-muted"}>Day {stop.day}</span>}
      </button>
    );
  };

  const canvasHeight = expanded
    ? "flex-1 min-h-0"
    : phone
    ? belowButton
      ? "h-[calc(100dvh-18.5rem-env(safe-area-inset-bottom))] min-h-64"
      : "h-[calc(100dvh-15rem-env(safe-area-inset-bottom))] min-h-72"
    : compact
    ? "h-[calc(100vh-14.5rem)] min-h-[440px]"
    : "h-[70vh] min-h-[440px]";

  const mapBody = (
    <div
      className={
        expanded
          ? "fixed inset-3 z-50 flex flex-col gap-3 rounded-3xl border border-border bg-bg p-3 shadow-2xl sm:inset-5 sm:p-4"
          : "space-y-3"
      }
    >
      {/* Day filter + pin counter */}
      <div className="flex items-center justify-between gap-2">
        {days.length > 0 && (
          <SegmentedControl
            label="Show day on map"
            options={dayOptions}
            value={day}
            onChange={setDay}
            className="min-w-0 flex-1"
          />
        )}
        {!phone && <span className="shrink-0 font-mono text-label text-muted">{pinSummary}</span>}
        {expanded && (
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="inline-flex min-h-tap shrink-0 items-center gap-1 rounded-full bg-ink px-4 text-sm font-semibold text-bg hover:bg-ink-hover"
          >
            <Minimize2 className="h-4 w-4" aria-hidden />
            Exit
          </button>
        )}
      </div>

      {/* Map canvas with floating controls */}
      <div
        className={`relative isolate overflow-hidden rounded-2xl border border-border bg-[#EFEAE1] ${
          mapStyle === "atlas" ? "atlas-map-tiles" : ""
        } ${canvasHeight}`}
      >
        <MapContainer
          center={[framed[0].lat, framed[0].lng]}
          zoom={12}
          zoomSnap={0.5}
          wheelPxPerZoomLevel={90}
          scrollWheelZoom={false}
          className="z-0 h-full w-full"
        >
          <TileLayer
            key={tileStyle.id}
            url={tileStyle.url}
            attribution={tileStyle.attribution}
            maxZoom={tileStyle.maxZoom}
          />
          <WheelZoomAfterClick />
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
                      className={`inline-block rounded-full px-2 py-0.5 font-mono text-label font-semibold uppercase tracking-wider ${
                        point.kind === "hotel"
                          ? "bg-ink text-bg"
                          : point.kind === "activity"
                          ? "bg-primary-light text-primary-hover"
                          : "bg-bg-subtle text-ink-soft"
                      }`}
                    >
                      {point.kind === "hotel"
                        ? "Stay"
                        : point.kind === "activity"
                        ? `Stop #${point.order}`
                        : "Destination"}
                    </span>
                    <p className="text-sm font-semibold leading-snug text-ink">{point.title}</p>
                    {point.detail && <p className="text-sm text-muted">{point.detail}</p>}
                    {point.kind === "activity" && (
                      <p className="text-sm font-semibold text-success">
                        {point.cost > 0 ? `Est. ${formatInr(point.cost)} per traveller` : "Free"}
                      </p>
                    )}
                    <a
                      href={mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => onTrack?.("map_google_maps_opened", point.kind)}
                      className="inline-flex min-h-tap items-center gap-1 text-sm font-semibold text-primary hover:underline"
                    >
                      Open in Google Maps
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                    </a>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>

        {/* Map style switcher (wide screens; phones use the options sheet) */}
        {!phone && (
          <div className="absolute right-3 top-3 z-[1001] rounded-full border border-border bg-surface/95 p-1 shadow-lg backdrop-blur-md">
            <SegmentedControl label="Map style" options={STYLE_OPTIONS} value={mapStyle} onChange={handleStyleChange} />
          </div>
        )}

        {/* Phone: one button opens style, layers and the places list */}
        {phone && (
          <button
            type="button"
            onClick={() => setOptionsOpen(true)}
            className="absolute bottom-3 left-3 z-[1001] inline-flex min-h-tap items-center gap-2 rounded-full border border-border bg-surface/95 px-4 text-sm font-semibold text-ink shadow-lg backdrop-blur-md"
          >
            <Layers className="h-4 w-4" aria-hidden />
            Map options
          </button>
        )}

        <div className="absolute bottom-8 right-3 z-[1001] flex flex-col gap-2">
          <button type="button" onClick={handleResetView} aria-label="Fit all pins in view" className={FLOATING_BUTTON}>
            <LocateFixed className="h-5 w-5" aria-hidden />
          </button>
          <button
            type="button"
            onClick={handleToggleFullscreen}
            aria-label={expanded ? "Close fullscreen map" : "Expand immersive fullscreen map"}
            className={FLOATING_BUTTON}
          >
            {expanded ? <Minimize2 className="h-5 w-5" aria-hidden /> : <Maximize2 className="h-5 w-5" aria-hidden />}
          </button>
        </div>

        {!phone && (
          <div className="pointer-events-none absolute bottom-3 left-3 z-[1001] inline-flex items-center gap-1.5 rounded-full bg-ink/80 px-3 py-1 text-label text-bg shadow-md">
            <MousePointerClick className="h-3.5 w-3.5 text-primary-soft" aria-hidden />
            Click the map, then scroll to zoom
          </div>
        )}
      </div>

      {/* Wide screens: places strip and layer legend under the map */}
      {!phone && (showQuickStrip || expanded) && quickStops.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1" aria-label="Jump to pinned place">
          {quickStops.map(placeButton)}
        </div>
      )}
      {!phone && (
        <div className="flex flex-wrap items-center gap-1 rounded-xl border border-border bg-surface px-2">
          {layerToggles}
          <span className="flex min-h-tap items-center gap-2 px-3 text-sm text-muted">
            <span className="size-3 rounded-full border-2 border-primary bg-surface" aria-hidden />
            Destination
          </span>
        </div>
      )}

      {phone && (
        <Sheet open={optionsOpen} onClose={() => setOptionsOpen(false)} title="Map options" description={pinSummary}>
          <div className="space-y-5">
            <div>
              <p className="mb-2 text-sm font-semibold text-ink-soft">Map style</p>
              <SegmentedControl label="Map style" options={STYLE_OPTIONS} value={mapStyle} onChange={handleStyleChange} />
            </div>
            <div>
              <p className="mb-1 text-sm font-semibold text-ink-soft">Show</p>
              <div className="-mx-3 flex flex-wrap">{layerToggles}</div>
            </div>
            {quickStops.length > 0 && (
              <div>
                <p className="mb-2 text-sm font-semibold text-ink-soft">Places</p>
                <div className="flex flex-col gap-2">{quickStops.map(placeButton)}</div>
              </div>
            )}
          </div>
        </Sheet>
      )}
    </div>
  );

  if (expanded) {
    return (
      <>
        <div
          className="fixed inset-0 z-40 bg-ink/45 backdrop-blur-xs"
          onClick={() => setExpanded(false)}
          aria-hidden="true"
        />
        {mapBody}
      </>
    );
  }

  return mapBody;
}
