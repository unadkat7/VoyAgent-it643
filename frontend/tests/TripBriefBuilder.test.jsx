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
});
