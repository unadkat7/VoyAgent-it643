import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TripDetailPage from "@/app/trip/[id]/page";
import { chatAboutTrip, shareTrip, updateTrip } from "@/services/trip.service";
import { PLAN } from "./fixtures";

// One router for the whole test, as in Next: a new one per render would re-load the Trip.
const router = vi.hoisted(() => ({ push: () => {}, replace: () => {} }));
vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "trip-1" }),
  useRouter: () => router,
  usePathname: () => "/trip/trip-1",
}));
vi.mock("next/dynamic", () => ({ default: () => () => null }));
vi.mock("@/services/event.service", () => ({ trackInteraction: vi.fn() }));
vi.mock("@/services/feedback.service", () => ({ sendFeedback: vi.fn() }));

const GUESSED = {
  ...PLAN,
  assumptions: ["3 days, since you didn't say how long."],
  follow_up: "Tell me your number of days and I'll fine-tune this plan.",
  travel_options: [
    { mode: "train", label: "Train · 3AC", per_person_low: 3000, per_person_high: 4000, total: 7000 },
    {
      mode: "flight",
      label: "Flight · IndiGo",
      per_person_low: 6000,
      per_person_high: 6000,
      total: 12000,
      source: "live",
      over_budget: true,
    },
  ],
  estimated_cost: { hotel_total: 7500, travel_total: 7000, travel_mode: "train", total: 14500 },
};
const TRIP = {
  _id: "trip-1",
  destination: "Goa",
  status: "planned",
  finalized: false,
  plan: GUESSED,
  conversation: [
    { role: "traveler", content: "Goa trip" },
    { role: "assistant", content: GUESSED.follow_up },
  ],
};

vi.mock("@/services/trip.service", () => ({
  getTripById: vi.fn(async () => ({ trip: structuredClone(TRIP) })),
  shareTrip: vi.fn(async () => ({ shareId: "abcdefghijklmnop" })),
  deleteTrip: vi.fn(),
  chatAboutTrip: vi.fn(),
  updateTrip: vi.fn(async (_id, changes) => ({ trip: { ...structuredClone(TRIP), ...changes } })),
}));

beforeEach(() => {
  vi.clearAllMocks();
  // jsdom has no layout, so scrolling the chat to its newest message is a no-op here.
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => vi.unstubAllGlobals());

describe("Trip page actions", () => {
  it("says what it assumed and opens the chat to add details", async () => {
    const user = userEvent.setup();
    render(<TripDetailPage />);

    expect(await screen.findByText("I filled in a few things")).toBeInTheDocument();
    expect(screen.getByText(GUESSED.assumptions[0])).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /add details/i }));

    const chat = screen.getByRole("dialog", { name: "Ask or change your plan" });
    expect(within(chat).getByText(GUESSED.follow_up)).toBeInTheDocument();
  });

  it("sends a chat message and shows the updated plan and the reply", async () => {
    chatAboutTrip.mockResolvedValue({
      outcome: "updated",
      trip: {
        ...structuredClone(TRIP),
        plan: { ...GUESSED, summary: "Four beach days." },
        conversation: [
          ...TRIP.conversation,
          { role: "traveler", content: "make it 4 days" },
          { role: "assistant", content: "Updated the plan for 4 days." },
        ],
      },
    });
    const user = userEvent.setup();
    render(<TripDetailPage />);
    await user.click(await screen.findByRole("button", { name: "Ask or change" }));
    const chat = screen.getByRole("dialog", { name: "Ask or change your plan" });

    await user.type(within(chat).getByRole("textbox"), "make it 4 days");
    await user.click(within(chat).getByRole("button", { name: "Send" }));

    expect(chatAboutTrip).toHaveBeenCalledWith("trip-1", "make it 4 days");
    expect(await within(chat).findByText(/Updated the plan for 4 days\./)).toBeInTheDocument();
    expect(within(chat).getByText("Plan updated")).toBeInTheDocument();
  });

  it("sends the chat message on Enter and adds a new line on Shift+Enter", async () => {
    chatAboutTrip.mockResolvedValue({ outcome: "answered", trip: structuredClone(TRIP) });
    const user = userEvent.setup();
    render(<TripDetailPage />);
    await user.click(await screen.findByRole("button", { name: "Ask or change" }));
    const chat = screen.getByRole("dialog", { name: "Ask or change your plan" });

    await user.type(within(chat).getByRole("textbox"), "redraw{Shift>}{Enter}{/Shift}the trip{Enter}");

    expect(chatAboutTrip).toHaveBeenCalledWith("trip-1", "redraw\nthe trip");
  });

  it("keeps the message and says so when the planner is down", async () => {
    chatAboutTrip.mockRejectedValue({ response: { status: 503 } });
    const user = userEvent.setup();
    render(<TripDetailPage />);
    await user.click(await screen.findByRole("button", { name: "Ask or change" }));
    const chat = screen.getByRole("dialog", { name: "Ask or change your plan" });

    await user.type(within(chat).getByRole("textbox"), "4 days");
    await user.click(within(chat).getByRole("button", { name: "Send" }));

    expect(await within(chat).findByRole("alert")).toHaveTextContent(/unavailable/i);
    expect(within(chat).getByRole("textbox")).toHaveValue("4 days");
  });

  it("locks the plan when switched to Final: no chat until it is a Draft again", async () => {
    const user = userEvent.setup();
    render(<TripDetailPage />);
    await screen.findByRole("button", { name: "Ask or change" });

    await user.click(screen.getByRole("button", { name: "Final" }));

    expect(updateTrip).toHaveBeenCalledWith("trip-1", { finalized: true });
    expect(screen.queryByRole("button", { name: "Ask or change" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /add details/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Draft" }));
    expect(await screen.findByRole("button", { name: "Ask or change" })).toBeInTheDocument();
  });

  it("lets the owner pick the way to travel, and the total follows", async () => {
    const user = userEvent.setup();
    render(<TripDetailPage />);
    const masthead = await screen.findByText("Estimated cost");
    expect(masthead.closest("button")).toHaveTextContent("₹14,500");

    await user.click(screen.getByRole("button", { name: "Travel" }));
    expect(screen.getAllByText("Over your flight budget").length).toBeGreaterThan(0);
    await user.click(screen.getByRole("radio", { name: /use flight · indigo/i }));

    expect(updateTrip).toHaveBeenCalledWith("trip-1", { travelMode: "flight" });
    await waitFor(() => expect(masthead.closest("button")).toHaveTextContent("₹19,500"));
  });

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
