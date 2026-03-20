// ============================================================
// Tax Calculation Engine
// Pure functions — no hardcoded tax values, no side effects.
// All regulatory values come from the TaxConfig parameter.
// ============================================================

import type { TaxBracket, TaxConfig } from './types';

/**
 * Calculate progressive annual tax for a given annual income.
 * Uses only the brackets from the provided config.
 */
export function calculateProgressiveTax(annualIncome: number, config: TaxConfig): number {
  let tax = 0;
  for (const bracket of config.brackets) {
    if (annualIncome <= bracket.min) break;
    const top = bracket.max !== null ? bracket.max : Infinity;
    const taxableInBracket = Math.min(annualIncome, top) - bracket.min;
    tax += taxableInBracket * bracket.rate;
  }
  return tax;
}

/**
 * Annual tax credit from credit points.
 * Credit points reduce the tax liability, not the gross income.
 */
export function calculateAnnualTaxCredit(creditPoints: number, config: TaxConfig): number {
  return creditPoints * config.creditPointMonthlyValue * 12;
}

/**
 * Surtax (mas yesharim) — applied only when annual income exceeds threshold.
 */
export function calculateSurtax(annualIncome: number, config: TaxConfig): number {
  if (annualIncome <= config.surtaxThreshold) return 0;
  return (annualIncome - config.surtaxThreshold) * config.surtaxRate;
}

/**
 * Pension deduction from taxable income.
 * Only the employee contribution portion is relevant here.
 * pensionContributionPct: 0–100
 */
export function calculatePensionDeduction(
  monthlyGross: number,
  pensionContributionPct: number,
  config: TaxConfig,
): number {
  const annualPensionContrib = (monthlyGross * pensionContributionPct) / 100 * 12;
  return annualPensionContrib * config.pensionExemptionRate;
}

/**
 * Find which bracket an income falls into.
 * Returns the bracket index (0-based).
 */
export function findBracketIndex(annualIncome: number, config: TaxConfig): number {
  for (let i = config.brackets.length - 1; i >= 0; i--) {
    if (annualIncome > config.brackets[i].min) return i;
  }
  return 0;
}

/**
 * Get the ceiling (annual NIS) for a given bracket index.
 * Returns null if the selected bracket is the last one (no ceiling).
 */
export function getBracketCeiling(bracketIndex: number, config: TaxConfig): number | null {
  return config.brackets[bracketIndex]?.max ?? null;
}

/**
 * Calculate annual income room to the selected bracket's ceiling.
 * Positive = room remaining; negative = already exceeded.
 */
export function calculateAnnualRoomToThreshold(
  annualTaxableIncome: number,
  targetBracketIndex: number,
  config: TaxConfig,
): number {
  const ceiling = getBracketCeiling(targetBracketIndex, config);
  if (ceiling === null) return Infinity; // No ceiling on last bracket
  return ceiling - annualTaxableIncome;
}

export function getBracketByIndex(index: number, config: TaxConfig): TaxBracket {
  return config.brackets[Math.min(index, config.brackets.length - 1)];
}
