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

export function planStops(plan) {
  if (plan?.stops?.length) return plan.stops;
  if (!plan) return [];
  return [{
    city: plan.request?.destination, days: plan.request?.duration_days,
    check_in: plan.check_in, check_out: plan.check_out, nights: plan.nights,
    hotels: plan.hotels ?? [], coordinates: plan.destination_coordinates,
  }];
}

export function tripRouteLabel(trip) {
  const origin = trip?.plan?.request?.origin?.trim();
  const stops = trip?.plan?.stops;
  if (stops?.length > 1) return [origin, ...stops.map((s) => s.city)].filter(Boolean).join(" → ");
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

// Day views frame activities only. The whole-trip view includes base cities and stays.
export function mapPoints(plan, day) {
  const points = [];
  const stops = day === "all" ? planStops(plan) : [];
  stops.forEach((stop, index) => {
    if (hasPoint(stop.coordinates)) {
      points.push({ key: `destination-${index}`, kind: "destination",
        title: stop.city ?? "Destination", ...stop.coordinates });
    }
    for (const [hotelIndex, hotel] of (stop.hotels ?? []).entries()) {
      if (!hasPoint(hotel.coordinates)) continue;
      points.push({ key: `hotel-${index}-${hotelIndex}`, kind: "hotel", title: hotel.name,
        detail: `${formatInr(hotel.price_per_night)} / night`, ...hotel.coordinates });
    }
  });
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

// The way to travel that is counted: the owner's pick if the plan has it, else the plan's default.
export function chosenTravel(plan, travelMode) {
  const options = plan?.travel_options ?? [];
  const mode = travelMode ?? plan?.estimated_cost?.travel_mode;
  return options.find((option) => option.mode === mode) ?? options[0] ?? null;
}

// Compute INR Budget allocation proportions for visual feasibility bars.
// Plans made before activities, daily spend or travel options were counted have 0 for them,
// and older plans priced travel as flight_total.
export function budgetBreakdown(plan, travelMode = null) {
  const cost = plan?.estimated_cost ?? {};
  const budget = Number(plan?.request?.budget) || 0;
  const partySize = Number(plan?.request?.party_size) || 0;
  const hotelTotal = Number(cost.hotel_total) || 0;
  const travel = chosenTravel(plan, travelMode);
  const travelTotal = travel
    ? travel.total + (cost.legs_total ?? 0)
    : Number(cost.travel_total ?? cost.flight_total) || 0;
  const activitiesTotal = Number(cost.activities_total) || 0;
  const dailySpendTotal = Number(cost.daily_spend_total) || 0;
  // Recomputed rather than read, so picking another way to travel moves the total.
  const total = hotelTotal + travelTotal + activitiesTotal + dailySpendTotal;
  const perPerson = partySize > 0 ? Math.round(total / partySize) : 0;
  const budgetGuessed = Boolean(plan?.assumed_fields?.includes("budget"));
  const base = {
    budget,
    budgetGuessed,
    hotelTotal,
    travel,
    travelTotal,
    activitiesTotal,
    dailySpendTotal,
    total,
    perPerson,
    rooms: Number(cost.rooms) || 1,
  };

  if (budget <= 0) {
    return { ...base, budget: 0, remaining: 0, overBy: 0, usedPercent: 0, segments: [] };
  }

  // Each part's share of the bar, in order, never filling past 100% together.
  let left = 100;
  const segments = [
    ["hotel", hotelTotal],
    ["travel", travelTotal],
    ["activities", activitiesTotal],
    ["daily", dailySpendTotal],
  ].map(([key, amount]) => {
    const percent = Math.min(left, Math.round((amount / budget) * 100));
    left -= percent;
    return { key, percent };
  });

  return {
    ...base,
    remaining: Math.max(0, budget - total),
    overBy: Math.max(0, total - budget),
    usedPercent: Math.round((total / budget) * 100),
    segments,
  };
}

export function fareRange(option) {
  if (!option) return "—";
  const { per_person_low: low, per_person_high: high } = option;
  return low === high ? formatInr(low) : `${formatInr(low)}–${formatInr(high)}`;
}

export function stayLabel(nights, rooms) {
  const nightText = `${nights} ${nights === 1 ? "night" : "nights"}`;
  return rooms > 1 ? `${nightText} · ${rooms} rooms` : nightText;
}

export function daysAndNights(plan) {
  const days = Number(plan?.request?.duration_days);
  const nights = Number(plan?.nights);
  const parts = [];
  if (days > 0) parts.push(`${days} ${days === 1 ? "day" : "days"}`);
  if (nights > 0) parts.push(`${nights} ${nights === 1 ? "night" : "nights"}`);
  return parts.join(", ");
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
