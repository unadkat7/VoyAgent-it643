import { describe, expect, it } from "vitest";
import { budgetPresets, convertBudget, CURRENCIES } from "@/lib/currencies";

describe("currencies", () => {
  it("offers INR first and the other supported currencies", () => {
    expect(CURRENCIES[0]).toBe("INR");
    expect(CURRENCIES).toEqual(expect.arrayContaining(["USD", "EUR", "GBP", "JPY"]));
  });

  it("converts a budget to a rounded amount in the new currency", () => {
    expect(convertBudget(40000, "INR", "USD")).toBe(480);
    expect(convertBudget(480, "USD", "INR")).toBe(40000);
    expect(convertBudget(40000, "INR", "JPY")).toBe(71000);
  });

  it("keeps an amount exactly when the currency does not change", () => {
    expect(convertBudget(71234, "INR", "INR")).toBe(71234);
  });

  it("sizes the preset buttons for each currency", () => {
    expect(budgetPresets("INR")).toEqual([20000, 35000, 50000, 80000]);
    expect(budgetPresets("USD")).toEqual([240, 420, 600, 950]);
  });
});
