import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import PageViewTracker from "@/components/analytics/PageViewTracker";
import { sendPageview } from "@/services/event.service";

let pathname = "/dashboard";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));
vi.mock("@/services/event.service", () => ({ sendPageview: vi.fn(() => Promise.resolve()) }));

describe("PageViewTracker", () => {
  it("sends one page view per route", () => {
    const { rerender } = render(<PageViewTracker />);
    pathname = "/trip/new";
    rerender(<PageViewTracker />);

    expect(sendPageview.mock.calls).toEqual([["/dashboard"], ["/trip/new"]]);
  });
});
