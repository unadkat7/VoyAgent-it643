import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import TripPlanView from "@/components/trip/TripPlanView";
import TripPlanner from "@/app/trip/new/page";
import TrafficTrendChart from "@/components/admin/TrafficTrendChart";
import { LOCATED_PLAN } from "./fixtures";

const navigation = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => navigation, useSearchParams: () => new URLSearchParams() }));
vi.mock("next/dynamic", () => ({ default: () => ({ focusedPointKey }) => <div aria-label="Rendered map">{focusedPointKey}</div> }));
vi.mock("@/services/auth.service", () => ({ getCurrentUser: async () => ({ user: { name: "Alex" } }) }));
vi.mock("@/services/event.service", () => ({ trackInteraction: vi.fn() }));

function viewport(width) {
  vi.stubGlobal("matchMedia", (query) => ({
    matches: query.includes("min-width") && width >= 1024,
    addEventListener() {},
    removeEventListener() {},
  }));
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Responsive trip and analytics interactions", () => {
  it.each([320, 390, 768])("restores the itinerary stop after opening its map at %i px", async (width) => {
    viewport(width);
    const user = userEvent.setup();
    render(<TripPlanView trip={{ plan: LOCATED_PLAN }} />);
    await user.click(screen.getByRole("button", { name: "Day 2" }));
    await user.click(screen.getByRole("button", { name: "Locate on map" }));
    expect(screen.getByLabelText("Rendered map")).toHaveTextContent("activity-2-0");
    await user.click(screen.getByRole("button", { name: "Back to itinerary stop" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Locate on map" })).toHaveFocus());
    expect(screen.getByRole("button", { name: "Day 2" })).toHaveAttribute("aria-pressed", "true");
  });

  it("keeps the itinerary beside the focused map on a large screen", async () => {
    viewport(1440);
    render(<TripPlanView trip={{ plan: LOCATED_PLAN }} />);
    const map = screen.getByRole("complementary", { name: "Synced Trip Map" });
    await userEvent.click(screen.getAllByRole("button", { name: "Locate on map" })[0]);
    expect(map).toHaveTextContent("activity-1-0");
    expect(screen.getByText("Baga Beach")).toBeVisible();
  });

  it("preserves both drafts when switching planning methods", async () => {
    viewport(390);
    const user = userEvent.setup();
    render(<TripPlanner />);
    const prompt = await screen.findByRole("textbox", { name: /describe your trip/i });
    await user.type(prompt, "Two days in Goa");
    await user.click(screen.getByRole("button", { name: "Use the brief builder" }));
    const origin = await screen.findByRole("textbox", { name: /origin city/i });
    await user.type(origin, "Pune");
    expect(prompt).not.toBeVisible();
    await user.click(screen.getByRole("button", { name: "Describe your trip" }));
    expect(prompt).toHaveValue("Two days in Goa");
    await user.click(screen.getByRole("button", { name: "Use the brief builder" }));
    expect(origin).toBeVisible();
    expect(origin).toHaveValue("Pune");
  });

  it("inspects exact daily counts with touch and keyboard controls", async () => {
    viewport(390);
    const daily = [{ day: "2026-11-20", visitors: 17 }, { day: "2026-11-21", visitors: 9 }];
    const { container, rerender } = render(<TrafficTrendChart daily={daily} />);
    const chart = screen.getByRole("img", { name: "Daily Visitors" });
    vi.spyOn(chart, "getBoundingClientRect").mockReturnValue({ left: 0, width: 300 });
    fireEvent.pointerDown(chart, { clientX: 10, pointerType: "touch" });
    const readout = container.querySelector("[aria-live]");
    expect(readout).toHaveTextContent("Visitors 17");
    const next = screen.getByRole("button", { name: "Next day" });
    next.focus();
    await userEvent.keyboard("{Enter}");
    expect(readout).toHaveTextContent("Visitors 9");
    rerender(<TrafficTrendChart daily={[daily[0]]} />);
    expect(within(readout).getByText("2026-11-20")).toBeVisible();
    expect(next).toBeDisabled();
  });
});
