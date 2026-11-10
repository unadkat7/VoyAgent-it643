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
