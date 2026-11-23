import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import SegmentedControl from "@/components/ui/SegmentedControl";

const OPTIONS = [
  { value: 7, label: "7 days" },
  { value: 30, label: "30 days" },
  { value: 90, label: "90 days" },
];

function Harness() {
  const [value, setValue] = useState(30);
  return <SegmentedControl label="Period" options={OPTIONS} value={value} onChange={setValue} />;
}

describe("SegmentedControl", () => {
  it("marks only the selected option as pressed", () => {
    render(<Harness />);
    expect(screen.getByRole("group", { name: "Period" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "30 days" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "7 days" })).toHaveAttribute("aria-pressed", "false");
  });

  it("selects an option on tap", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "90 days" }));
    expect(screen.getByRole("button", { name: "90 days" })).toHaveAttribute("aria-pressed", "true");
  });

  it("moves selection and focus with the arrow keys, wrapping at the ends", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    screen.getByRole("button", { name: "30 days" }).focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("button", { name: "90 days" })).toHaveFocus();
    expect(screen.getByRole("button", { name: "90 days" })).toHaveAttribute("aria-pressed", "true");
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("button", { name: "7 days" })).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("button", { name: "90 days" })).toHaveFocus();
  });
});
