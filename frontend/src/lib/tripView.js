// Pure helpers for showing Trips. No React here, so they are easy to test.

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export function formatInr(amount) {
  return Number.isFinite(amount) ? inr.format(amount) : "—";
}

const TITLE_LENGTH = 40;

export function tripTitle(trip) {
  if (trip?.destination) return trip.destination;
  const first = trip?.conversation?.find((turn) => turn.role === "traveler")?.content;
  if (!first) return "New Trip";
  return first.length > TITLE_LENGTH ? `${first.slice(0, TITLE_LENGTH).trimEnd()}…` : first;
}

export function tripRouteLabel(trip) {
  const origin = trip?.plan?.request?.origin?.trim();
  const destination = (trip?.plan?.request?.destination || trip?.destination)?.trim();
  if (origin && destination) return `${origin} → ${destination}`;
  return null;
}

const STATUS = {
  planned: { label: "Planned", action: "View plan", tone: "success" },
  draft: { label: "Needs details", action: "Continue", tone: "warning" },
  planning_failed: { label: "Planning failed", action: "Try again", tone: "danger" },
};

export function statusInfo(status) {
  return STATUS[status] ?? STATUS.draft;
}

export function tripLink(trip) {
  return trip.status === "planned" ? `/trip/${trip._id}` : `/trip/new?tripId=${trip._id}`;
}

const hasPoint = (coordinates) =>
  Number.isFinite(coordinates?.lat) && Number.isFinite(coordinates?.lng);

// Pins for the Trip map. `day` is "all" or a day number; Destination and Hotels always show.
export function mapPoints(plan, day) {
  const points = [];
  if (hasPoint(plan?.destination_coordinates)) {
    points.push({
      key: "destination",
      kind: "destination",
      title: plan.request?.destination ?? "Destination",
      ...plan.destination_coordinates,
    });
  }
  for (const hotel of plan?.hotels ?? []) {
    if (!hasPoint(hotel.coordinates)) continue;
    points.push({
      key: `hotel-${hotel.name}`,
      kind: "hotel",
      title: hotel.name,
      detail: `${formatInr(hotel.price_per_night)} / night`,
      ...hotel.coordinates,
    });
  }
  for (const itineraryDay of plan?.itinerary ?? []) {
    if (day !== "all" && itineraryDay.day !== day) continue;
    itineraryDay.activities.forEach((activity, index) => {
      if (!hasPoint(activity.coordinates)) return;
      points.push({
        key: `activity-${itineraryDay.day}-${index}`,
        kind: "activity",
        title: activity.title,
        detail: `Day ${itineraryDay.day} · ${activity.time}`,
        cost: activity.estimated_cost,
        day: itineraryDay.day,
        order: index + 1,
        ...activity.coordinates,
      });
    });
  }
  return points;
}

export function mapDays(plan) {
  return (plan?.itinerary ?? [])
    .filter((itineraryDay) => itineraryDay.activities.some((a) => hasPoint(a.coordinates)))
    .map((itineraryDay) => itineraryDay.day);
}

export function formatDateRange(checkIn, checkOut) {
  const options = { day: "numeric", month: "short", year: "numeric" };
  const start = new Date(checkIn).toLocaleDateString("en-IN", options);
  const end = new Date(checkOut).toLocaleDateString("en-IN", options);
  return `${start} – ${end}`;
}

// Compute INR Budget allocation proportions for visual feasibility bars.
export function budgetBreakdown(plan) {
  const budget = Number(plan?.request?.budget) || 0;
  const hotelTotal = Number(plan?.estimated_cost?.hotel_total) || 0;
  const flightTotal = Number(plan?.estimated_cost?.flight_total) || 0;
  const total = Number(plan?.estimated_cost?.total) || hotelTotal + flightTotal;

  if (budget <= 0) {
    return {
      budget: 0,
      hotelTotal,
      flightTotal,
      total,
      remaining: 0,
      usedPercent: 0,
      hotelPercent: 0,
      flightPercent: 0,
    };
  }

  const remaining = Math.max(0, budget - total);
  const usedPercent = Math.min(100, Math.round((total / budget) * 100));
  const hotelPercent = Math.min(100, Math.round((hotelTotal / budget) * 100));
  const flightPercent = Math.min(100 - hotelPercent, Math.round((flightTotal / budget) * 100));

  return {
    budget,
    hotelTotal,
    flightTotal,
    total,
    remaining,
    usedPercent,
    hotelPercent,
    flightPercent,
  };
}

// Train and road helpers. Train times are local "YYYY-MM-DDTHH:MM" strings with no time zone,
// so they are read as text, never through Date parsing that could shift them.
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function dayParts(isoDate) {
  const [year, month, day] = isoDate.slice(0, 10).split("-").map(Number);
  return { year, month, day, weekday: new Date(Date.UTC(year, month - 1, day)).getUTCDay() };
}

function daysBetween(fromIso, toIso) {
  const from = dayParts(fromIso);
  const to = dayParts(toIso);
  return Math.round(
    (Date.UTC(to.year, to.month - 1, to.day) - Date.UTC(from.year, from.month - 1, from.day)) /
      86_400_000
  );
}

export function formatShortDate(isoDate) {
  const { year, month, day } = dayParts(isoDate);
  return `${day} ${MONTHS[month - 1]} ${year}`;
}

export function formatTrainDeparture(iso) {
  const { month, day, weekday } = dayParts(iso);
  return `${WEEKDAYS[weekday]} ${day} ${MONTHS[month - 1]}, ${iso.slice(11, 16)}`;
}

// A clock time, with "+1 day" when it falls after the day the journey starts.
export function formatTrainTime(iso, startIso) {
  const later = daysBetween(startIso, iso);
  const suffix = later > 0 ? ` +${later} ${later === 1 ? "day" : "days"}` : "";
  return `${iso.slice(11, 16)}${suffix}`;
}

export function formatMinutes(total) {
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  if (hours === 0) return `${minutes} min`;
  return minutes === 0 ? `${hours} h` : `${hours} h ${minutes} min`;
}

export function formatRunningDays(days) {
  if (!days?.length) return null;
  return days.length === 7 ? "Runs daily" : `Runs ${days.join(", ")}`;
}

export function formatRoadSummary(route) {
  const km = Number(route.distance_km).toLocaleString("en-IN");
  return `${km} km · about ${route.hours_low}–${route.hours_high} h`;
}

export function roadEndNote(route) {
  if (route.road_ends_km_before == null) return null;
  return `The road ends about ${route.road_ends_km_before} km before ${route.to_place}; the rest is on foot or by other transport.`;
}

// Turn structured Guided Trip Brief fields into a natural-language prompt for the Planning Engine.
export function composeBriefPrompt(brief) {
  const parts = [];
  const days = Number(brief?.duration_days);
  const destination = brief?.destination?.trim();
  const origin = brief?.origin?.trim();
  const partySize = Number(brief?.party_size);
  const budget = Number(String(brief?.budget ?? "").replace(/[^\d]/g, ""));
  const style = brief?.travel_style?.trim();

  if (days > 0 && destination) {
    parts.push(`${days} ${days === 1 ? "day" : "days"} in ${destination}`);
  } else if (destination) {
    parts.push(`Trip to ${destination}`);
  } else if (days > 0) {
    parts.push(`${days} ${days === 1 ? "day" : "days"} trip`);
  }

  if (origin) parts.push(`from ${origin}`);
  if (partySize > 0) parts.push(`${partySize} ${partySize === 1 ? "traveler" : "travelers"}`);
  if (budget > 0) parts.push(`total budget ${formatInr(budget)}`);
  if (style) parts.push(`${style.toLowerCase()} travel style`);

  return parts.join(", ");
}
