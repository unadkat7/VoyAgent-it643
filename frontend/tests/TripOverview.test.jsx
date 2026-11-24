import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import TripOverview from "@/components/trip/TripOverview";
import { PLAN } from "./fixtures";

describe("TripOverview", () => {
  it("shows the summary and every important tip from the plan", () => {
    render(<TripOverview plan={PLAN} />);

    expect(screen.getByText(PLAN.summary)).toBeInTheDocument();
    for (const tip of PLAN.important_tips) {
      expect(screen.getByText(tip)).toBeInTheDocument();
    }
  });

  it("shows the Estimated Cost total and its parts in INR", () => {
    render(<TripOverview plan={PLAN} />);

    expect(screen.getByTestId("estimated-total")).toHaveTextContent("₹17,500");
    expect(screen.getByText(/₹7,500/)).toBeInTheDocument();
    expect(screen.getByText(/₹10,000/)).toBeInTheDocument();
  });

  it("shows the planner's notes", () => {
    render(<TripOverview plan={PLAN} />);

    expect(screen.getByText(PLAN.notes[0])).toBeInTheDocument();
  });

  it("shows the Estimated Cost total and its parts in USD when the plan is in USD", () => {
    const usdPlan = {
      ...PLAN,
      request: { ...PLAN.request, budget: 1000, currency: "USD" },
      estimated_cost: {
        ...PLAN.estimated_cost,
        currency: "USD",
        hotel_total: 300,
        travel_total: 300,
        total: 600,
        per_person: 600,
      },
    };
    render(<TripOverview plan={usdPlan} />);

    expect(screen.getByTestId("estimated-total")).toHaveTextContent("$600");
    expect(screen.getByText(/\$300/)).toBeInTheDocument();
  });

  it("has no tips section when the plan has no tips", () => {
    render(<TripOverview plan={{ ...PLAN, important_tips: [] }} />);

    expect(screen.queryByText("Travel tips")).not.toBeInTheDocument();
  });
});
