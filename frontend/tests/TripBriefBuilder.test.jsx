import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import TripBriefBuilder from "@/components/trip/TripBriefBuilder";

describe("TripBriefBuilder", () => {
  it("tracks the 6 required fields and submits a composed natural-language prompt", async () => {
    const user = userEvent.setup();
    const onSubmitPrompt = vi.fn();

    render(<TripBriefBuilder onSubmitPrompt={onSubmitPrompt} />);

    // Defaults provide duration (3), party size (2), budget (40000), and style (Relaxed) = 4/6 ready.
    expect(screen.getByTestId("brief-readiness")).toHaveTextContent("4/6 ready");
    expect(screen.getByRole("button", { name: /start planning/i })).toBeDisabled();

    await user.type(screen.getByPlaceholderText(/ahmedabad/i), "Pune");
    await user.type(screen.getByPlaceholderText(/goa/i), "Jaipur");
    await user.click(screen.getByRole("button", { name: "Culture" }));

    expect(screen.getByTestId("brief-readiness")).toHaveTextContent("6/6 ready");
    const submitButton = screen.getByRole("button", { name: /start planning/i });
    expect(submitButton).toBeEnabled();

    await user.click(submitButton);

    expect(onSubmitPrompt).toHaveBeenCalledWith(
      "3 days in Jaipur, from Pune, 2 travelers, total budget ₹40,000, culture travel style"
    );
  });

  it("says which fields are still missing next to the disabled button", async () => {
    const user = userEvent.setup();
    render(<TripBriefBuilder onSubmitPrompt={vi.fn()} />);

    expect(screen.getByText("2 fields left: Origin city, Destination")).toBeInTheDocument();
    await user.type(screen.getByRole("textbox", { name: /origin city/i }), "Pune");
    expect(screen.getByText("1 field left: Destination")).toBeInTheDocument();
    await user.type(screen.getByRole("textbox", { name: /destination/i }), "Goa");
    expect(screen.queryByText(/left:/)).not.toBeInTheDocument();
  });

  it("takes the budget on a number keypad and shows it grouped in rupees", async () => {
    const user = userEvent.setup();
    const onSubmitPrompt = vi.fn();
    render(<TripBriefBuilder onSubmitPrompt={onSubmitPrompt} />);

    const budget = screen.getByRole("textbox", { name: /total budget/i });
    expect(budget).toHaveAttribute("inputmode", "numeric");
    expect(budget).toHaveValue("40,000");
    await user.clear(budget);
    await user.type(budget, "75000");
    expect(budget).toHaveValue("75,000");

    await user.type(screen.getByRole("textbox", { name: /origin city/i }), "Pune");
    await user.type(screen.getByRole("textbox", { name: /destination/i }), "Goa");
    await user.click(screen.getByRole("button", { name: /start planning/i }));
    expect(onSubmitPrompt).toHaveBeenCalledWith(expect.stringContaining("total budget ₹75,000"));
  });

  it("lets the traveler pick USD and composes the prompt in dollars", async () => {
    const user = userEvent.setup();
    const onSubmitPrompt = vi.fn();
    render(<TripBriefBuilder onSubmitPrompt={onSubmitPrompt} />);

    await user.selectOptions(screen.getByRole("combobox", { name: /currency/i }), "USD");
    const budget = screen.getByRole("textbox", { name: /total budget/i });
    await user.clear(budget);
    await user.type(budget, "1500");

    await user.type(screen.getByRole("textbox", { name: /origin city/i }), "Los Angeles");
    await user.type(screen.getByRole("textbox", { name: /destination/i }), "New York");
    await user.click(screen.getByRole("button", { name: /start planning/i }));

    expect(onSubmitPrompt).toHaveBeenCalledWith(expect.stringContaining("total budget $1,500"));
  });
});
