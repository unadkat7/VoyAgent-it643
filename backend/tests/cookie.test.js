import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.doUnmock("../src/config/env.js");
  vi.resetModules();
});

describe("auth cookie", () => {
  it("is a first-party Secure, SameSite=Lax cookie in production", async () => {
    vi.doMock("../src/config/env.js", () => ({ env: { isProduction: true } }));
    const { getAuthCookieOptions } = await import("../src/utils/generateToken.js");

    expect(getAuthCookieOptions()).toEqual({ httpOnly: true, secure: true, sameSite: "lax" });
  });
});
