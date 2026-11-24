import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import ItineraryList from "@/components/trip/ItineraryList";
import { planStops, tripRouteLabel } from "@/lib/tripView";
import { PLAN } from "./fixtures";

it("uses the existing dates and stays for a legacy plan", () => {
  expect(planStops(PLAN)).toEqual([expect.objectContaining({
    city: PLAN.request.destination, hotels: PLAN.hotels, nights: PLAN.nights, check_out: PLAN.check_out,
  })]);
});

it("shows city day ranges and preserves the route order", () => {
  const stops = [{city: "Paris", days: 2}, {city: "Berlin", days: 2}];
  const days = [0, 0, 1, 1].map((stop, i) => ({stop, day: i+1, title: "Walk", activities: []}));
  render(<ItineraryList days={days} stops={stops} />);
  expect(screen.getByText("Paris · Days 1–2")).toBeInTheDocument();
  expect(screen.getByText("Berlin · Days 3–4")).toBeInTheDocument();
  expect(tripRouteLabel({plan: {request: {origin: "Mumbai"}, stops}})).toBe("Mumbai → Paris → Berlin");
});
