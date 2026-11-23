import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminPage from "@/app/admin/page";
import { getAdminOverview } from "@/services/admin.service";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, push: vi.fn() }) }));
vi.mock("@/services/admin.service", () => ({ getAdminOverview: vi.fn() }));

const OVERVIEW = {
  stats: {
    accounts: 3,
    outsideAccounts: 2,
    signupsLast7Days: 2,
    trips: 4,
    plannedTrips: 3,
    outsidePlannedTrips: 3,
    feedbackCount: 1,
    averageRating: 4.5,
    uniqueVisitors7d: 9,
  },
  users: [
    {
      email: "as***@example.com",
      joinedAt: "2026-11-20T10:00:00.000Z",
      trips: 2,
      plannedTrips: 1,
      lastActiveAt: "2026-11-21T10:00:00.000Z",
      country: "IN",
      city: "Ahmedabad",
      device: { type: "mobile", os: "Android", browser: "Chrome" },
    },
  ],
  activity: {
    days: 2,
    daily: [
      { day: "2026-11-21", signups: 1, tripsPlanned: 0, pageviews: 4, visitors: 2 },
      { day: "2026-11-22", signups: 1, tripsPlanned: 2, pageviews: 6, visitors: 3 },
    ],
    countries: [{ country: "IN", visitors: 3 }],
    devices: [{ type: "mobile", visitors: 2 }],
    topShared: [{ destination: "Goa", shareViews: 5 }],
    recentEvents: [
      {
        type: "trip_planned",
        path: null,
        user: "as***@example.com",
        country: "IN",
        city: "Ahmedabad",
        device: { type: "mobile", os: "Android", browser: "Chrome" },
        createdAt: "2026-11-22T10:00:00.000Z",
      },
    ],
  },
  feedback: [{ rating: 5, message: "Planned my Goa trip in minutes", page: "/trip/1", createdAt: "2026-11-22T10:00:00.000Z" }],
};

beforeEach(() => vi.clearAllMocks());

describe("Admin page", () => {
  it("shows outside usage, the masked user list and the feedback log", async () => {
    getAdminOverview.mockResolvedValue(OVERVIEW);

    render(<AdminPage />);

    expect(await screen.findByText("Planned my Goa trip in minutes")).toBeInTheDocument();
    expect(screen.getByTestId("stat-outside-accounts")).toHaveTextContent("2");
    expect(screen.getAllByText("as***@example.com").length).toBeGreaterThan(0);
    expect(screen.getByText("Goa")).toBeInTheDocument();
  });

  it("tells a non-admin the page is for admins only", async () => {
    getAdminOverview.mockRejectedValue({ response: { status: 403 } });

    render(<AdminPage />);

    expect(await screen.findByText("Admins only")).toBeInTheDocument();
  });

  it("sends a signed-out visitor to the login page", async () => {
    getAdminOverview.mockRejectedValue({ response: { status: 401 } });

    render(<AdminPage />);

    await vi.waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
  });
});
