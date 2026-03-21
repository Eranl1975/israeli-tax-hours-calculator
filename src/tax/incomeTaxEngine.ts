// ============================================================
// Income Tax Engine — Monthly progressive tax calculation
// Pure functions, no hardcoded values.
// ============================================================

import type { IncomeTaxConfig, BracketBreakdown } from '../models/types';

/** Calculate progressive income tax on monthly taxable income */
export function calculateProgressiveTax(
  monthlyIncome: number,
  config: IncomeTaxConfig,
): { tax: number; breakdowns: BracketBreakdown[] } {
  if (monthlyIncome <= 0) return { tax: 0, breakdowns: [] };

  let tax = 0;
  const breakdowns: BracketBreakdown[] = [];
  let highestReachedIdx = -1;

  for (let i = 0; i < config.brackets.length; i++) {
    const bracket = config.brackets[i];
    if (monthlyIncome <= bracket.min) break;
    highestReachedIdx = i;
    const top = bracket.max !== null ? bracket.max : Infinity;
    const incomeInBracket = Math.min(monthlyIncome, top) - bracket.min;
    const taxInBracket = incomeInBracket * bracket.rate;
    tax += taxInBracket;
    breakdowns.push({
      bracketLabel: bracket.label,
      bracketMin: bracket.min,
      bracketMax: bracket.max,
      incomeInBracket,
      taxInBracket,
      rate: bracket.rate,
      isHighestReached: false,
    });
  }

  if (highestReachedIdx >= 0) {
    breakdowns[highestReachedIdx].isHighestReached = true;
  }

  return { tax, breakdowns };
}

/** Calculate credit points reduction (monthly) */
export function calculateCreditPointsReduction(
  creditPoints: number,
  config: IncomeTaxConfig,
): number {
  return creditPoints * config.creditPointMonthlyValue;
}

/** Calculate surtax (מס יסף) — applies to monthly income above threshold */
export function calculateSurtax(monthlyIncome: number, config: IncomeTaxConfig): number {
  if (monthlyIncome <= config.surtaxMonthlyThreshold) return 0;
  return (monthlyIncome - config.surtaxMonthlyThreshold) * config.surtaxRate;
}

/** Full monthly income tax calculation */
export function calculateIncomeTax(
  monthlyTaxableIncome: number,
  creditPoints: number,
  config: IncomeTaxConfig,
): {
  taxBeforeCredits: number;
  creditReduction: number;
  surtax: number;
  netTax: number;
  effectiveRate: number;
  breakdowns: BracketBreakdown[];
  marginalBracketLabel: string;
} {
  const { tax, breakdowns } = calculateProgressiveTax(monthlyTaxableIncome, config);
  const creditReduction = calculateCreditPointsReduction(creditPoints, config);
  const surtax = calculateSurtax(monthlyTaxableIncome, config);
  const netTax = Math.max(0, tax - creditReduction + surtax);
  const effectiveRate = monthlyTaxableIncome > 0 ? netTax / monthlyTaxableIncome : 0;
  const highestBracket = breakdowns.find(b => b.isHighestReached);
  const marginalBracketLabel = highestBracket?.bracketLabel ?? '—';

  return {
    taxBeforeCredits: tax,
    creditReduction,
    surtax,
    netTax,
    effectiveRate,
    breakdowns,
    marginalBracketLabel,
  };
}
