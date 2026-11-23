import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import DashboardPage from "@/app/dashboard/page";
import { getUserTrips } from "@/services/trip.service";
import { EXAMPLE_TRIPS } from "@/lib/exampleTrips";
import { PLAN } from "./fixtures";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/dashboard",
}));
vi.mock("@/services/auth.service", () => ({
  getCurrentUser: async () => ({ user: { name: "Alex Rao" } }),
  logout: vi.fn(),
}));
vi.mock("@/services/trip.service", () => ({ getUserTrips: vi.fn(), deleteTrip: vi.fn() }));
vi.mock("@/services/event.service", () => ({ trackInteraction: vi.fn() }));
vi.mock("@/services/feedback.service", () => ({ sendFeedback: vi.fn() }));

describe("Dashboard", () => {
  it("offers one way to start planning and two examples until asked for more", async () => {
    getUserTrips.mockResolvedValue({ trips: [] });
    const user = userEvent.setup();
    render(<DashboardPage />);

    expect(await screen.findByRole("button", { name: /plan a new trip/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /open trip planner/i })).not.toBeInTheDocument();
    expect(screen.getByText(EXAMPLE_TRIPS[1].title)).toBeInTheDocument();
    expect(screen.queryByText(EXAMPLE_TRIPS[2].title)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "See more examples" }));
    for (const trip of EXAMPLE_TRIPS) expect(screen.getByText(trip.title)).toBeInTheDocument();
  });

  it("sums up a planned trip on one line", async () => {
    getUserTrips.mockResolvedValue({
      trips: [{ _id: "t1", status: "planned", destination: "Goa", createdAt: "2026-11-20", plan: PLAN }],
    });
    render(<DashboardPage />);

    expect(await screen.findByText(/3 nights · 2 travelers · ₹17,500/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Goa" })).toHaveAttribute("href", "/trip/t1");
  });
});
