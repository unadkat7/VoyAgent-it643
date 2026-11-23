import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import TripPlanView from "@/components/trip/TripPlanView";
import FlightList from "@/components/trip/FlightList";
import HotelList from "@/components/trip/HotelList";
import { PLAN } from "./fixtures";

vi.mock("next/dynamic", () => ({ default: () => () => <div aria-label="Rendered map" /> }));
vi.mock("@/services/event.service", () => ({ trackInteraction: vi.fn() }));

afterEach(() => vi.unstubAllGlobals());

describe("Trip plan layout", () => {
  it("switches sections with one tab group", async () => {
    const user = userEvent.setup();
    render(<TripPlanView trip={{ plan: PLAN }} />);
    const tabs = screen.getByRole("group", { name: "Trip sections" });
    expect(screen.getByRole("button", { name: /Itinerary/ })).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: /Stays/ }));
    expect(tabs).toBeInTheDocument();
    expect(screen.getByTestId("hotel-Sea Breeze Resort")).toBeInTheDocument();
  });

  it("shows dates, nights and party size on one line", () => {
    render(<TripPlanView trip={{ plan: PLAN }} />);
    expect(screen.getByText(/3 nights · 2 travelers/)).toBeInTheDocument();
  });

  it("opens the summary from the cost chip, with the overview before the cost", async () => {
    const user = userEvent.setup();
    render(<TripPlanView trip={{ plan: PLAN }} />);
    await user.click(screen.getByRole("button", { name: /Estimated cost ₹17,500/ }));
    const overview = screen.getByText(PLAN.summary);
    const total = screen.getByTestId("estimated-total");
    expect(overview.compareDocumentPosition(total) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe("Empty recommendations", () => {
  it("explain why there are no flights right where the list would be", () => {
    render(<FlightList flights={[]} notes={["Flight search is unavailable right now."]} />);
    expect(screen.getByText(/No flights to suggest/)).toBeInTheDocument();
    expect(screen.getByText("Flight search is unavailable right now.")).toBeInTheDocument();
    expect(screen.queryByText(/Summary tab/)).not.toBeInTheDocument();
  });

  it("explain why there are no stays right where the list would be", () => {
    render(<HotelList hotels={[]} notes={["No stays fit your nightly cap."]} />);
    expect(screen.getByText("No stays fit your nightly cap.")).toBeInTheDocument();
  });
});
