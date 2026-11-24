import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ServiceStatusControl from "@/components/admin/ServiceStatusControl";
import ServiceStatusBanner from "@/components/status/ServiceStatusBanner";
import { ServiceStatusProvider } from "@/components/status/ServiceStatusProvider";
import { getServiceStatus, updateServiceStatus } from "@/services/status.service";

vi.mock("@/services/status.service", () => ({
  getServiceStatus: vi.fn(),
  updateServiceStatus: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("ServiceStatusBanner and ServiceStatusControl", () => {
  it("renders a live countdown banner when downtime is active and auto-clears at zero", async () => {
    vi.useFakeTimers();
    const now = new Date("2026-11-24T23:59:58.000Z");
    vi.setSystemTime(now);

    const activeStatus = {
      isDown: true,
      message: "Both Groq and Cloudflare limits reached.",
      groqResetAt: "2026-11-25T00:00:00.000Z",
      cloudflareResetAt: "2026-11-25T01:00:00.000Z",
      availableAt: "2026-11-25T00:00:00.000Z",
      resumingProvider: "groq",
    };
    getServiceStatus.mockResolvedValue({ isDown: false, availableAt: null });

    render(
      <ServiceStatusProvider initialStatus={activeStatus}>
        <ServiceStatusBanner />
      </ServiceStatusProvider>
    );

    expect(screen.getByTestId("service-status-banner")).toBeInTheDocument();
    expect(screen.getByText("Both Groq and Cloudflare limits reached.")).toBeInTheDocument();
    expect(screen.getByTestId("service-status-countdown")).toHaveTextContent("00:00:02");

    await act(async () => {
      vi.advanceTimersByTime(2500);
    });

    expect(screen.queryByTestId("service-status-banner")).not.toBeInTheDocument();
    expect(getServiceStatus).toHaveBeenCalled();
  });

  it("lets an admin publish downtime and restore service early", async () => {
    const published = {
      isDown: true,
      message: "Daily quota exhausted",
      groqResetAt: new Date(Date.now() + 3600_000).toISOString(),
      cloudflareResetAt: new Date(Date.now() + 3600_000).toISOString(),
      availableAt: new Date(Date.now() + 3600_000).toISOString(),
      resumingProvider: "both",
    };
    updateServiceStatus
      .mockResolvedValueOnce(published)
      .mockResolvedValueOnce({ isDown: false, availableAt: null });

    render(
      <ServiceStatusProvider initialStatus={{ isDown: false, availableAt: null }}>
        <ServiceStatusBanner />
        <ServiceStatusControl />
      </ServiceStatusProvider>
    );

    expect(screen.queryByTestId("service-status-banner")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /publish downtime/i }));
    await userEvent.click(screen.getByRole("button", { name: /publish downtime notice/i }));

    expect(updateServiceStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        isDown: true,
      })
    );
    expect(await screen.findByTestId("service-status-banner")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /restore service now/i }));

    expect(updateServiceStatus).toHaveBeenLastCalledWith({ isDown: false });
    expect(screen.queryByTestId("service-status-banner")).not.toBeInTheDocument();
  });
});
