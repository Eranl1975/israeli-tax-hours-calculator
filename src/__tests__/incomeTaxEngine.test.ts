import { describe, it, expect } from 'vitest';
import { calculateIncomeTax, calculateProgressiveTax } from '../tax/incomeTaxEngine';
import { INCOME_TAX_CONFIG_2025 } from '../tax/incomeTaxConfig';

describe('calculateProgressiveTax', () => {
  const cfg = INCOME_TAX_CONFIG_2025;

  it('zero income → zero tax', () => {
    const { tax } = calculateProgressiveTax(0, cfg);
    expect(tax).toBe(0);
  });

  it('income entirely in first bracket (10%)', () => {
    const { tax } = calculateProgressiveTax(5000, cfg);
    expect(tax).toBeCloseTo(500, 1); // 5000 * 10%
  });

  it('income spanning first two brackets', () => {
    // 7010 * 10% + (9000 - 7010) * 14%
    const { tax } = calculateProgressiveTax(9000, cfg);
    const expected = 7010 * 0.10 + (9000 - 7010) * 0.14;
    expect(tax).toBeCloseTo(expected, 1);
  });

  it('income in 31% bracket', () => {
    const income = 20000;
    const expected =
      7010 * 0.10 +
      (10060 - 7010) * 0.14 +
      (16150 - 10060) * 0.20 +
      (income - 16150) * 0.31;
    const { tax } = calculateProgressiveTax(income, cfg);
    expect(tax).toBeCloseTo(expected, 1);
  });

  it('very high income (above top bracket)', () => {
    // 7010*10% + 3050*14% + 6090*20% + 6290*31% + 24080*35% + 13610*47% + 39870*50% ≈ 39055
    const { tax } = calculateProgressiveTax(100000, cfg);
    expect(tax).toBeGreaterThan(35000);
    expect(tax).toBeCloseTo(39055.6, 0);
  });
});

describe('calculateIncomeTax', () => {
  const cfg = INCOME_TAX_CONFIG_2025;

  it('credit points reduce tax', () => {
    const noCredits = calculateIncomeTax(20000, 0, cfg);
    const withCredits = calculateIncomeTax(20000, 2.25, cfg);
    expect(withCredits.netTax).toBeLessThan(noCredits.netTax);
    expect(withCredits.creditReduction).toBeCloseTo(2.25 * cfg.creditPointMonthlyValue, 1);
  });

  it('surtax kicks in above threshold', () => {
    const below = calculateIncomeTax(59000, 0, cfg);
    const above = calculateIncomeTax(70000, 0, cfg);
    expect(below.surtax).toBe(0);
    expect(above.surtax).toBeGreaterThan(0);
  });

  it('net tax never negative', () => {
    // Lots of credit points but small income
    const result = calculateIncomeTax(1000, 10, cfg);
    expect(result.netTax).toBeGreaterThanOrEqual(0);
  });

  it('effective rate is between 0 and 1', () => {
    const result = calculateIncomeTax(30000, 2.25, cfg);
    expect(result.effectiveRate).toBeGreaterThan(0);
    expect(result.effectiveRate).toBeLessThan(1);
  });

  it('bracket breakdown sums match tax', () => {
    const result = calculateIncomeTax(25000, 0, cfg);
    const sumFromBreakdowns = result.breakdowns.reduce((s, b) => s + b.taxInBracket, 0);
    expect(sumFromBreakdowns).toBeCloseTo(result.taxBeforeCredits, 1);
  });
});
