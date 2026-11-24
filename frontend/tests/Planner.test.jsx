import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TripPlanner from "@/app/trip/new/page";
import { planTrip } from "@/services/trip.service";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/services/auth.service", () => ({ getCurrentUser: async () => ({ user: { name: "Alex" } }) }));
vi.mock("@/services/event.service", () => ({ trackInteraction: vi.fn() }));
vi.mock("@/services/trip.service", () => ({ getTripById: vi.fn(), planTrip: vi.fn() }));

// jsdom has no layout, so scrolling the chat to the newest message is a no-op here.
beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => vi.restoreAllMocks());

describe("Trip planner", () => {
  it("points to the brief builder where it actually is", async () => {
    render(<TripPlanner />);
    expect(await screen.findByText(/brief builder above/i)).toBeInTheDocument();
    expect(screen.queryByText(/below/i)).not.toBeInTheDocument();
  });

  it("grows the message box as the traveler types", async () => {
    vi.spyOn(HTMLTextAreaElement.prototype, "scrollHeight", "get").mockReturnValue(96);
    const user = userEvent.setup();
    render(<TripPlanner />);
    const prompt = await screen.findByRole("textbox", { name: /describe your trip/i });
    await user.type(prompt, "Goa");
    expect(prompt.style.height).toBe("96px");
  });

  it("asks for missing details with full-size fields", async () => {
    planTrip.mockResolvedValue({
      trip: { _id: "t1", status: "draft", clarification: { question: "Where from?", missingFields: ["origin"] } },
    });
    const user = userEvent.setup();
    render(<TripPlanner />);
    await user.type(await screen.findByRole("textbox", { name: /describe your trip/i }), "Goa trip");
    await user.click(screen.getByRole("button", { name: "Send message" }));

    const origin = await screen.findByRole("textbox", { name: "Origin" });
    expect(origin.className).toMatch(/min-h-tap/);
    expect(origin.className).toMatch(/text-base/);
  });

  it("fills the suggested budget when its quick-fill chip is tapped", async () => {
    planTrip.mockResolvedValue({
      trip: {
        _id: "t1",
        status: "draft",
        clarification: { question: "Too low", missingFields: ["budget"], suggestions: { budget: 110000 } },
      },
    });
    const user = userEvent.setup();
    render(<TripPlanner />);
    const prompt = await screen.findByRole("textbox", { name: /describe your trip/i });
    await user.type(prompt, "Europe trip");
    await user.click(screen.getByRole("button", { name: "Send message" }));

    await user.click(await screen.findByRole("button", { name: "Use ₹1,10,000" }));

    expect(screen.getByRole("textbox", { name: "Budget (INR)" })).toHaveValue("110000");
    expect(prompt).toHaveValue("");
  });

  it("fills the default budget example when there is no suggestion", async () => {
    planTrip.mockResolvedValue({
      trip: {
        _id: "t1",
        status: "draft",
        clarification: { question: "What is your budget?", missingFields: ["budget"] },
      },
    });
    const user = userEvent.setup();
    render(<TripPlanner />);
    const prompt = await screen.findByRole("textbox", { name: /describe your trip/i });
    await user.type(prompt, "Goa trip");
    await user.click(screen.getByRole("button", { name: "Send message" }));

    await user.click(await screen.findByRole("button", { name: "Budget (INR)" }));

    expect(screen.getByRole("textbox", { name: "Budget (INR)" })).toHaveValue("30000");
    expect(prompt).toHaveValue("");
  });

});
