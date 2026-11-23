import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminPage from "@/components/admin/AdminDashboard";
import { getAdminOverview } from "@/services/admin.service";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, push: vi.fn() }) }));
vi.mock("next/dynamic", () => ({ default: () => () => <div data-testid="destinations-map" /> }));
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

    expect(await screen.findByTestId("stat-outside-accounts")).toHaveTextContent("2");
    const section = screen.getByRole("combobox", { name: "Analytics section" });
    await userEvent.selectOptions(section, "users");
    expect(screen.getByText("Planned my Goa trip in minutes")).toBeInTheDocument();
    expect(screen.getAllByText("as***@example.com").length).toBeGreaterThan(0);
    await userEvent.selectOptions(section, "audience");
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

  it("supports switching timeframes, workspace tabs, and filtering outside users", async () => {
    const user = userEvent.setup();
    getAdminOverview.mockResolvedValue({
      ...OVERVIEW,
      activity: {
        ...OVERVIEW.activity,
        featureEngagement: {
          tripMap: {
            totalInteractions: 14,
            uniqueVisitors: 4,
            adoptionRatePct: 80,
            styles: [
              { style: "atlas", count: 8 },
              { style: "satellite", count: 6 },
              { style: "terrain", count: 0 },
            ],
            pinFocuses: [{ kind: "activity", count: 5 }],
            dayFilters: 3,
            fullscreenOpens: 2,
            layerToggles: [],
            resetViews: 1,
            googleMapsClicks: 3,
          },
          dossierTabs: [{ tab: "hotels", views: 4, visitors: 3 }],
          hotelOutbound: { bookingUrlClicks: 2, googleMapsClicks: 1, totalClicks: 3, staysTabViews: 4, staysTabCtrPct: 75 },
          creationFlow: { briefBuilderSubmitted: 5, briefBuilderPrefilled: 1, starterDashboard: 2, starterStudio: 1, clarificationInlineSubmitted: 2 },
        },
      },
      trips: {
        days: 30,
        totalTrips: 4,
        plannedTrips: 3,
        draftTrips: 1,
        failedTrips: 0,
        topDestinations: [{ destination: "Manali", count: 2, avgBudgetInr: 35000, avgDays: 3 }],
        topOrigins: [{ origin: "Delhi", count: 2 }],
        topRoutes: [{ origin: "Delhi", destination: "Manali", route: "Delhi → Manali", count: 2, avgBudgetInr: 35000 }],
        destinationPins: [{ destination: "Manali", lat: 32.24, lng: 77.19, count: 2, avgBudgetInr: 35000 }],
        travelStyles: [{ style: "adventure", count: 2, avgBudgetInr: 35000 }],
        partySizes: [{ label: "Couple (2)", count: 2 }],
        durationBuckets: [{ label: "3–4 days", count: 2 }],
        budgetAnalysis: {
          totalPlannedBudgetInr: 70000,
          avgBudgetInr: 35000,
          medianBudgetInr: 35000,
          avgEstimatedCostInr: 21000,
          avgUtilizationPct: 60,
          avgHotelSharePct: 35,
          avgFlightSharePct: 25,
          avgBufferSharePct: 40,
          bands: [{ label: "₹30k–₹60k", count: 2 }],
        },
        priceSourceCoverage: { liveHotels: 2, estimatedHotels: 1, liveFlights: 1, estimatedFlights: 2, liveHotelPct: 66.7, liveFlightPct: 33.3, liveOverallPct: 50 },
        planningHealth: { avgAttemptsToPlan: 1.2, firstAttemptSuccessRate: 80, avgLatencyMs: 2100, p50LatencyMs: 1900, p95LatencyMs: 3100, geocodedTrips: 2, geocodedCoveragePct: 66.7, topMissingFields: [{ field: "budget", count: 1 }], failureReasons: [] },
      },
      retention: {
        weeks: 8,
        cohorts: [{ weekStart: "2026-11-16", size: 2, retention: [100, 50, null, null, null] }],
        stickiness: { dau: 2, wau: 5, mau: 9, dauWauRatio: 40, wauMauRatio: 55.6 },
        userSplit7d: { newUsers: 1, returningUsers: 1, returningPct: 50 },
      },
    });

    render(<AdminPage />);

    expect(await screen.findByText("Admin Command Center")).toBeInTheDocument();

    // Switch timeframe to 7 days
    await user.click(screen.getByRole("button", { name: "7 days" }));
    await vi.waitFor(() => expect(getAdminOverview).toHaveBeenCalledWith(7));

    // Switch to TripMap & Product tab
    await user.click(screen.getByRole("button", { name: /tripmap & product/i }));
    expect(screen.getByText(/interactive map usage & styles/i)).toBeInTheDocument();
    expect(screen.getByText("80%")).toBeInTheDocument();

    // Switch to Travel Intelligence tab and verify Destinations Map renders
    await user.click(screen.getByRole("button", { name: /travel intelligence/i }));
    expect(screen.getByTestId("destinations-map")).toBeInTheDocument();
    expect(screen.getByText("Manali")).toBeInTheDocument();

    // Switch to Users & Feedback tab and test search filter
    await user.click(screen.getByRole("button", { name: /users & feedback/i }));
    await user.type(screen.getByLabelText(/search outside users/i), "no-match-xyz");
    expect(screen.getByText(/no outside users match/i)).toBeInTheDocument();
  });
});
