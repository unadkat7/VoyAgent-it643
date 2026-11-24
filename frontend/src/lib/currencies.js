// Rough rates for sizing budget inputs only. Keep in sync with ai-service/domain/money.py.
const INR_PER_UNIT = {
  INR: 1,
  USD: 84,
  EUR: 90,
  GBP: 107,
  AED: 22.9,
  SAR: 22.4,
  QAR: 23.1,
  SGD: 63,
  MYR: 18.8,
  THB: 2.45,
  IDR: 0.0053,
  JPY: 0.56,
  CNY: 11.6,
  HKD: 10.8,
  AUD: 55,
  NZD: 50,
  CAD: 60,
  CHF: 95,
  ZAR: 4.6,
  NPR: 0.625,
  LKR: 0.28,
};

export const CURRENCIES = Object.keys(INR_PER_UNIT);

const INR_PRESETS = [20000, 35000, 50000, 80000];

// Two significant figures, so a converted budget reads like a number a person would type.
function roundNicely(value) {
  const step = 10 ** Math.max(0, Math.floor(Math.log10(value)) - 1);
  return Math.max(1, Math.round(value / step) * step);
}

export function convertBudget(amount, from, to) {
  if (from === to) return amount;
  return roundNicely((amount * INR_PER_UNIT[from]) / INR_PER_UNIT[to]);
}

export const budgetPresets = (currency) =>
  INR_PRESETS.map((amount) => convertBudget(amount, "INR", currency));
