import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import TravelPanel from "@/components/trip/TravelPanel";
import TripPlanView from "@/components/trip/TripPlanView";
import { PLAN } from "./fixtures";

vi.mock("next/dynamic", () => ({ default: () => () => null }));
vi.mock("@/services/event.service", () => ({ trackInteraction: vi.fn() }));

const leg = (number, name, from, to, departs, arrives) => ({
  train_number: number,
  train_name: name,
  from_code: from.slice(0, 2).toUpperCase(),
  from_station: from,
  to_code: to.slice(0, 2).toUpperCase(),
  to_station: to,
  departs,
  arrives,
});

const TRAVEL_PLAN = {
  ...PLAN,
  flights: [],
  notes: ["No flights were skipped."],
  trains_out: [
    {
      legs: [leg("12911", "Bl Haridwar Exp", "Surat", "Haridwar Jn", "2026-12-15T16:15", "2026-12-16T14:30")],
      departs: "2026-12-15T16:15",
      arrives: "2026-12-16T14:30",
      duration_minutes: 1335,
      change_at: null,
      wait_minutes: null,
      runs_on: ["Tue"],
    },
    {
      legs: [
        leg("19019", "Bdts Hw Exp", "Surat", "Haridwar Jn", "2026-12-14T04:35", "2026-12-15T07:50"),
        leg("54483", "Hw Rksh Passenger", "Haridwar Jn", "Rishikesh", "2026-12-15T10:40", "2026-12-15T11:45"),
      ],
      departs: "2026-12-14T04:35",
      arrives: "2026-12-15T11:45",
      duration_minutes: 1870,
      change_at: "Haridwar Jn",
      wait_minutes: 170,
      runs_on: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    },
  ],
  trains_back: [
    {
      legs: [leg("12912", "Hw Bl Exp", "Haridwar Jn", "Surat", "2026-12-22T06:00", "2026-12-23T04:00")],
      departs: "2026-12-22T06:00",
      arrives: "2026-12-23T04:00",
      duration_minutes: 1320,
      change_at: null,
      wait_minutes: null,
      runs_on: ["Tue"],
    },
  ],
  road_route: {
    from_place: "Surat",
    to_place: "Kedarnath",
    distance_km: 1650,
    hours_low: 26.5,
    hours_high: 35,
    road_ends_km_before: 10,
  },
  road_leg: {
    from_place: "Haridwar Jn",
    to_place: "Badrinath",
    distance_km: 319,
    hours_low: 9.5,
    hours_high: 12.5,
    road_ends_km_before: null,
  },
  timetable_as_of: "2026-08-30",
};

describe("Travel panel", () => {
  it("shows the web fare found for a train, and nothing for a train without one", () => {
    const [priced, unpriced] = TRAVEL_PLAN.trains_out;
    const plan = {
      ...TRAVEL_PLAN,
      trains_out: [{ ...priced, ac3: { low: 1800, high: 2100 }, sleeper: { low: 650, high: 650 } }, unpriced],
    };

    render(<TravelPanel plan={plan} />);

    const cards = within(screen.getByRole("region", { name: "Getting there by train" })).getAllByRole("listitem");
    expect(cards[0]).toHaveTextContent("Sleeper ₹650 · 3AC ₹1,800–₹2,100 one way per person");
    expect(cards[1]).not.toHaveTextContent("one way per person");
  });

  it("lists trains there with times, next-day arrival, duration and running days", () => {
    render(<TravelPanel plan={TRAVEL_PLAN} />);

    const there = screen.getByRole("region", { name: "Getting there by train" });
    const direct = within(there).getAllByRole("listitem")[0];
    expect(direct).toHaveTextContent("12911 Bl Haridwar Exp");
    expect(direct).toHaveTextContent("Surat");
    expect(direct).toHaveTextContent("Tue 15 Dec, 16:15");
    expect(direct).toHaveTextContent("14:30 +1 day");
    expect(direct).toHaveTextContent("22 h 15 min");
    expect(direct).toHaveTextContent("Runs Tue");
  });

  it("shows where to change trains and how long the wait is", () => {
    render(<TravelPanel plan={TRAVEL_PLAN} />);

    expect(screen.getByText("Change at Haridwar Jn · wait 2 h 50 min")).toBeInTheDocument();
    expect(screen.getByText(/31 h 10 min · Runs daily/)).toBeInTheDocument();
  });

  it("lists trains back", () => {
    render(<TravelPanel plan={TRAVEL_PLAN} />);

    const back = screen.getByRole("region", { name: "Coming back by train" });
    expect(back).toHaveTextContent("12912 Hw Bl Exp");
  });

  it("shows the drive from the railhead after the trains", () => {
    render(<TravelPanel plan={TRAVEL_PLAN} />);

    const there = screen.getByRole("region", { name: "Getting there by train" });
    expect(there).toHaveTextContent("Then by road: Haridwar Jn → Badrinath");
    expect(there).toHaveTextContent("319 km · about 9.5–12.5 h");
  });

  it("shows the whole way by road with where the road ends", () => {
    render(<TravelPanel plan={TRAVEL_PLAN} />);

    const road = screen.getByRole("region", { name: "By road" });
    expect(road).toHaveTextContent("Surat → Kedarnath");
    expect(road).toHaveTextContent("1,650 km · about 26.5–35 h");
    expect(road).toHaveTextContent("The road ends about 10 km before Kedarnath");
  });

  it("sends travellers to IRCTC for fares and says how old the timetable is", () => {
    render(<TravelPanel plan={TRAVEL_PLAN} />);

    expect(screen.getByRole("link", { name: /check fares and seats on irctc/i })).toHaveAttribute(
      "href",
      "https://www.irctc.co.in/nget/train-search"
    );
    expect(screen.getByText(/Timetable as of 30 Aug 2026/)).toBeInTheDocument();
  });

  it("points to the trains when there are no flights", () => {
    render(<TravelPanel plan={TRAVEL_PLAN} />);

    expect(screen.getByText(/No flights for this trip\. Trains and road options are below\./)).toBeInTheDocument();
  });

  it("points only to the road when there are no trains either", () => {
    render(<TravelPanel plan={{ ...TRAVEL_PLAN, trains_out: [], trains_back: [] }} />);

    expect(screen.getByText("No flights or trains for this trip. The road route is below.")).toBeInTheDocument();
  });

  it("keeps older plans without trains or roads looking as before", () => {
    render(<TravelPanel plan={PLAN} />);

    expect(screen.getByText("IndiGo")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: /by train/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /irctc/i })).not.toBeInTheDocument();
  });

  it("is the Travel tab of the trip page", async () => {
    const user = userEvent.setup();
    render(<TripPlanView trip={{ plan: TRAVEL_PLAN }} />);

    await user.click(screen.getByRole("button", { name: "Travel" }));

    expect(screen.getByRole("region", { name: "Getting there by train" })).toBeInTheDocument();
  });
});
