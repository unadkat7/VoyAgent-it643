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
  Marker: ({ children, title, eventHandlers }) => (
    <div data-testid="pin">
      <button aria-label={title} onClick={eventHandlers?.click} />
      {children}
    </div>
  ),
  Popup: ({ children }) => <div>{children}</div>,
  Polyline: () => <div data-testid="route" />,
  useMap: () => ({ fitBounds: vi.fn(), setView: vi.fn(), whenReady: fn => fn(), off: vi.fn(),
    invalidateSize: vi.fn(), getContainer: () => document.body }),
  useMapEvents: () => null,
}));

describe("TripMap", () => {
  it("opens numbered activities when a day marker is selected", async () => {
    render(<TripMap plan={LOCATED_PLAN} />);

    expect(screen.getAllByTestId("pin")).toHaveLength(3);
    expect(screen.queryByText("Destination")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show Day 2 activities" })).toBeInTheDocument();
    expect(screen.getByText(/₹3,200 \/ night/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Show Day 1 activities" }));
    expect(screen.getAllByTestId("pin")).toHaveLength(2);
    expect(screen.getByText("Baga Beach")).toBeVisible();
    expect(screen.getByText("Tito\'s Lane")).toBeVisible();
  });

  it("filters to one day and draws its route", async () => {
    render(<TripMap plan={LOCATED_PLAN} />);

    await userEvent.click(screen.getByRole("button", { name: "Day 1" }));

    expect(screen.getAllByTestId("pin")).toHaveLength(2);
    expect(screen.queryByText("Fort Aguada")).not.toBeInTheDocument();
    expect(screen.getByTestId("route")).toBeInTheDocument();
  });

  it("restores stays and all pins when leaving the selected day", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
    const { rerender } = render(<TripMap plan={LOCATED_PLAN} selectedDay={2} />);
    expect(screen.getAllByTestId("pin")).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "Stays" })).not.toBeInTheDocument();

    rerender(<TripMap plan={LOCATED_PLAN} selectedDay="all" />);
    expect(screen.getAllByTestId("pin")).toHaveLength(3);
    expect(screen.getByRole("button", { name: "Stays" })).toBeInTheDocument();
    vi.unstubAllGlobals();
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
    await user.click(screen.getByRole("button", { name: "Day 2 · Forts" }));
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
