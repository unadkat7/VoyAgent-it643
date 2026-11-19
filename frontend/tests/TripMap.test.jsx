import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import TripMap from "@/components/trip/TripMap";
import { LOCATED_PLAN, PLAN } from "./fixtures";

// jsdom cannot draw tiles, so Leaflet is replaced by plain elements that keep the pin text.
vi.mock("leaflet", () => ({ default: { divIcon: () => ({}), latLngBounds: () => ({}) } }));
vi.mock("react-leaflet", () => ({
  MapContainer: ({ children }) => <div>{children}</div>,
  TileLayer: () => null,
  Marker: ({ children }) => <div data-testid="pin">{children}</div>,
  Popup: ({ children }) => <div>{children}</div>,
  Polyline: () => <div data-testid="route" />,
  useMap: () => ({ fitBounds: vi.fn(), setView: vi.fn() }),
}));

describe("TripMap", () => {
  it("pins every located place with its details", () => {
    render(<TripMap plan={LOCATED_PLAN} />);

    expect(screen.getAllByTestId("pin")).toHaveLength(5);
    expect(screen.getByText("Fort Aguada")).toBeInTheDocument();
    expect(screen.getByText(/₹3,200 \/ night/)).toBeInTheDocument();
  });

  it("filters to one day and draws its route", async () => {
    render(<TripMap plan={LOCATED_PLAN} />);

    await userEvent.click(screen.getByRole("button", { name: "Day 1" }));

    expect(screen.getAllByTestId("pin")).toHaveLength(4);
    expect(screen.queryByText("Fort Aguada")).not.toBeInTheDocument();
    expect(screen.getByTestId("route")).toBeInTheDocument();
  });

  it("explains an empty map for plans without Locations", () => {
    render(<TripMap plan={PLAN} />);

    expect(screen.queryByTestId("pin")).not.toBeInTheDocument();
    expect(screen.getByText(/no map locations/i)).toBeInTheDocument();
  });
});
