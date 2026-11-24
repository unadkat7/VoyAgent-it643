import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SharedTripPage from "@/components/trip/SharedTrip";
import { getSharedTrip } from "@/services/trip.service";
import { PLAN } from "./fixtures";

vi.mock("next/navigation", () => ({
  useParams: () => ({ shareId: "abcdefghijklmnop" }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
vi.mock("next/dynamic", () => ({ default: () => () => null }));
vi.mock("@/services/trip.service", () => ({ getSharedTrip: vi.fn() }));

beforeEach(() => vi.clearAllMocks());

describe("Shared Trip page", () => {
  it("shows the shared plan read-only with a way to plan your own", async () => {
    getSharedTrip.mockResolvedValue({ trip: { destination: "Goa", plan: PLAN } });

    render(<SharedTripPage />);

    expect(await screen.findByRole("heading", { name: "Goa" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /plan your own trip/i }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /delete/i })).toBeNull();
    // Only the owner can chat about or lock the plan.
    expect(screen.queryByRole("button", { name: "Ask or change" })).toBeNull();
    expect(screen.queryByRole("group", { name: "Plan stage" })).toBeNull();
    expect(getSharedTrip).toHaveBeenCalledWith("abcdefghijklmnop");
  });

  it("explains when the link no longer works", async () => {
    getSharedTrip.mockRejectedValue({ response: { status: 404 } });

    render(<SharedTripPage />);

    expect(await screen.findByText(/no longer shared/i)).toBeInTheDocument();
  });
});
