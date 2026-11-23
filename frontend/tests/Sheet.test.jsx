import { useState } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import Sheet from "@/components/ui/Sheet";

function Harness({ onClose = () => {} }) {
  const [open, setOpen] = useState(false);
  const close = () => {
    onClose();
    setOpen(false);
  };
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>Open actions</button>
      <Sheet open={open} onClose={close} title="Trip actions">
        <button type="button">Share</button>
        <button type="button">Delete trip</button>
      </Sheet>
    </>
  );
}

describe("Sheet", () => {
  it("opens as a labelled dialog and moves focus inside", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Open actions" }));
    const dialog = screen.getByRole("dialog", { name: "Trip actions" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    await waitFor(() => expect(dialog).toContainElement(document.activeElement));
  });

  it("closes on Escape and returns focus to the trigger", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    const trigger = screen.getByRole("button", { name: "Open actions" });
    await user.click(trigger);
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });

  it("closes when the backdrop is tapped", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    await user.click(screen.getByRole("button", { name: "Open actions" }));
    await user.click(screen.getByTestId("sheet-backdrop"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("keeps Tab focus inside the sheet", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Open actions" }));
    const last = screen.getByRole("button", { name: "Delete trip" });
    last.focus();
    await user.tab();
    expect(screen.getByRole("dialog")).toContainElement(document.activeElement);
  });
});
