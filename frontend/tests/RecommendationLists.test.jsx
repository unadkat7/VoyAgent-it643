import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import FlightList from "@/components/trip/FlightList";
import HotelList from "@/components/trip/HotelList";
import { PLAN } from "./fixtures";

describe("HotelList", () => {
  it("shows each stay with its nightly price and where the price came from", () => {
    render(<HotelList hotels={PLAN.hotels} />);

    const live = screen.getByTestId("hotel-Sea Breeze Resort");
    expect(within(live).getByText("₹3,200 / night")).toBeInTheDocument();
    expect(within(live).getByText("Live price")).toBeInTheDocument();

    const estimated = screen.getByTestId("hotel-Palm Grove Stay");
    expect(within(estimated).getByText("Estimated Cost")).toBeInTheDocument();
  });

  it("leads with the whole stay's price, rooms included, and keeps the nightly price below", () => {
    render(<HotelList hotels={PLAN.hotels} nights={3} rooms={2} />);

    const card = screen.getByTestId("hotel-Sea Breeze Resort");
    expect(within(card).getByText("₹19,200 for 3 nights · 2 rooms")).toBeInTheDocument();
    expect(within(card).getByText("₹3,200 a night per room")).toBeInTheDocument();
  });

  it("never invents a rating or amenities that the plan does not have", () => {
    render(<HotelList hotels={[PLAN.hotels[1]]} />);

    const card = screen.getByTestId("hotel-Palm Grove Stay");
    expect(within(card).queryByText(/★|4\.5/)).not.toBeInTheDocument();
    expect(within(card).queryByText("Free Wi-Fi")).not.toBeInTheDocument();
  });

  it("explains an empty list instead of showing made-up stays", () => {
    render(<HotelList hotels={[]} />);

    expect(screen.getByText(/No stays to suggest/)).toBeInTheDocument();
  });
});

describe("FlightList", () => {
  it("shows airline, stops and the fare per Traveler", () => {
    render(<FlightList flights={PLAN.flights} />);

    expect(screen.getByText("IndiGo")).toBeInTheDocument();
    expect(screen.getByText(/Non-stop/)).toBeInTheDocument();
    expect(screen.getByText("₹5,000")).toBeInTheDocument();
    expect(screen.getByText("per traveller")).toBeInTheDocument();
  });

  it("explains an empty list instead of showing a placeholder flight", () => {
    render(<FlightList flights={[]} />);

    expect(screen.getByText(/No flights to suggest/)).toBeInTheDocument();
    expect(screen.queryByText(/Air India/)).not.toBeInTheDocument();
  });
});
