import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TripDetailPage from "@/app/trip/[id]/page";
import { shareTrip } from "@/services/trip.service";
import { PLAN } from "./fixtures";

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "trip-1" }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/trip/trip-1",
}));
vi.mock("next/dynamic", () => ({ default: () => () => null }));
vi.mock("@/services/event.service", () => ({ trackInteraction: vi.fn() }));
vi.mock("@/services/feedback.service", () => ({ sendFeedback: vi.fn() }));
vi.mock("@/services/trip.service", () => ({
  getTripById: async () => ({ trip: { _id: "trip-1", destination: "Goa", status: "planned", plan: PLAN } }),
  shareTrip: vi.fn(async () => ({ shareId: "abcdefghijklmnop" })),
  deleteTrip: vi.fn(),
}));

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.unstubAllGlobals());

describe("Trip page actions", () => {
  it("opens the trip actions as a sheet and asks before deleting", async () => {
    const user = userEvent.setup();
    render(<TripDetailPage />);
    await user.click(await screen.findByRole("button", { name: "More trip actions" }));
    const sheet = screen.getByRole("dialog", { name: "Trip actions" });
    expect(sheet).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Delete trip" }));
    expect(await screen.findByRole("dialog", { name: "Delete this Trip?" })).toBeInTheDocument();
  });

  it("uses the phone's share sheet when there is one", async () => {
    const share = vi.fn(async () => {});
    vi.stubGlobal("navigator", { ...navigator, share });
    const user = userEvent.setup();
    render(<TripDetailPage />);
    await user.click(await screen.findByRole("button", { name: "Share" }));
    await waitFor(() => expect(share).toHaveBeenCalledWith(expect.objectContaining({ url: expect.stringContaining("/share/abcdefghijklmnop") })));
    expect(shareTrip).toHaveBeenCalledWith("trip-1");
  });
});
