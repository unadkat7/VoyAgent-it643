import { render, screen, waitFor } from "@testing-library/react";
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
  useMapEvents: () => null,
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

  it("explains an empty map for plans without Coordinates", () => {
    render(<TripMap plan={PLAN} />);

    expect(screen.queryByTestId("pin")).not.toBeInTheDocument();
    expect(screen.getByText(/no map pins/i)).toBeInTheDocument();
  });

  it("keeps map style, layers and places in an options sheet on phones", async () => {
    const user = userEvent.setup();
    render(<TripMap plan={LOCATED_PLAN} />);

    expect(screen.queryByRole("button", { name: "Satellite" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Map options" }));
    const sheet = screen.getByRole("dialog", { name: "Map options" });
    expect(sheet).toContainElement(screen.getByRole("button", { name: "Satellite" }));
    await user.click(screen.getByRole("button", { name: /Fort Aguada/ }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("reports map interactions when onTrack is provided", async () => {
    const onTrack = vi.fn();
    vi.stubGlobal("matchMedia", (query) => ({ matches: query.includes("min-width"), addEventListener() {}, removeEventListener() {} }));
    render(<TripMap plan={LOCATED_PLAN} onTrack={onTrack} />);

    await userEvent.click(screen.getByRole("button", { name: "Satellite" }));
    await userEvent.click(screen.getByRole("button", { name: "Day 1" }));
    await userEvent.click(screen.getByRole("button", { name: /expand immersive fullscreen map/i }));

    expect(onTrack).toHaveBeenCalledWith("map_style_changed", "satellite");
    expect(onTrack).toHaveBeenCalledWith("map_day_filtered", "day");
    expect(onTrack).toHaveBeenCalledWith("map_fullscreen_opened");
    vi.unstubAllGlobals();
  });
});
