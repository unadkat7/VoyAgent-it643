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

  it("forwards external document.referrer when present", () => {
    sendPageview.mockClear();
    pathname = "/";
    const original = Object.getOwnPropertyDescriptor(document, "referrer");
    Object.defineProperty(document, "referrer", {
      value: "https://google.com/search?q=voyagent",
      configurable: true,
    });
    try {
      render(<PageViewTracker />);
      expect(sendPageview).toHaveBeenCalledWith("/", "https://google.com/search?q=voyagent");
    } finally {
      if (original) Object.defineProperty(document, "referrer", original);
      else Object.defineProperty(document, "referrer", { value: "", configurable: true });
    }
  });
});
