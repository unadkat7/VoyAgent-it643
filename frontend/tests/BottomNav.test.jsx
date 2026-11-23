import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import BottomNav from "@/components/layout/BottomNav";

const pathname = vi.hoisted(() => ({ value: "/dashboard" }));
vi.mock("next/navigation", () => ({ usePathname: () => pathname.value }));
vi.mock("@/services/feedback.service", () => ({ sendFeedback: vi.fn() }));

describe("BottomNav", () => {
  it("marks the current page", () => {
    render(<BottomNav page="/dashboard" />);
    const nav = screen.getByRole("navigation", { name: "Main" });
    expect(nav).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Trips" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Plan" })).not.toHaveAttribute("aria-current");
  });

  it("shows Admin only to admins", () => {
    const { rerender } = render(<BottomNav page="/dashboard" />);
    expect(screen.queryByRole("link", { name: "Admin" })).not.toBeInTheDocument();
    rerender(<BottomNav page="/dashboard" isAdmin />);
    expect(screen.getByRole("link", { name: "Admin" })).toHaveAttribute("href", "/admin");
  });

  it("opens the feedback sheet", async () => {
    const user = userEvent.setup();
    render(<BottomNav page="/dashboard" />);
    await user.click(screen.getByRole("button", { name: "Feedback" }));
    expect(screen.getByRole("dialog", { name: "How was this experience?" })).toBeInTheDocument();
  });
});
