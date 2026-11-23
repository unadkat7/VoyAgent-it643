import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import DashboardPage from "@/app/dashboard/page";
import TripPlanner from "@/app/trip/new/page";
import { EXAMPLE_TRIPS } from "@/lib/exampleTrips";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/dashboard",
}));
vi.mock("@/services/auth.service", () => ({
  getCurrentUser: async () => ({ user: { name: "Alex Rao" } }),
  logout: vi.fn(),
}));
vi.mock("@/services/trip.service", () => ({
  getUserTrips: async () => ({ trips: [] }),
  deleteTrip: vi.fn(),
  getTripById: vi.fn(),
  planTrip: vi.fn(),
}));
vi.mock("@/services/event.service", () => ({ trackInteraction: vi.fn() }));

describe("Example trips", () => {
  it("are the same on the dashboard and the planner", async () => {
    const { unmount } = render(<DashboardPage />);
    await userEvent.click(await screen.findByRole("button", { name: "See more examples" }));
    for (const trip of EXAMPLE_TRIPS) expect(await screen.findByText(trip.title)).toBeInTheDocument();
    unmount();

    render(<TripPlanner />);
    for (const trip of EXAMPLE_TRIPS) expect(await screen.findByText(trip.title)).toBeInTheDocument();
  });
});
