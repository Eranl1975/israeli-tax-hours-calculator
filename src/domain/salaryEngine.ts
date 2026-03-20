// ============================================================
// Salary & Income Composition Engine
// Builds taxable income from all components.
// ============================================================

import type { UserInputs, TaxConfig } from './types';
import {
  calculateProgressiveTax,
  calculateAnnualTaxCredit,
  calculateSurtax,
  calculatePensionDeduction,
} from './taxEngine';

export interface TaxableIncomeBreakdown {
  hourlyRate: number;
  monthlyTaxableIncome: number;
  annualTaxableIncome: number;
  annualTaxBeforeCredits: number;
  annualTaxCredit: number;
  annualSurtax: number;
  annualTaxAfterCredits: number;
  monthlyTaxAfterCredits: number;
  netMonthlyIncome: number;
  effectiveTaxRate: number;
}

export function computeTaxableIncome(inputs: UserInputs, config: TaxConfig): TaxableIncomeBreakdown {
  // Derive hourly rate if not overridden
  const hourlyRate =
    inputs.hourlyRateOverride > 0
      ? inputs.hourlyRateOverride
      : inputs.plannedMonthlyHours > 0
        ? inputs.baseMonthlyGross / inputs.plannedMonthlyHours
        : 0;

  // Monthly taxable income from all components
  const monthlyTaxableIncome =
    inputs.baseMonthlyGross +
    inputs.additionalTaxableMonthly +
    inputs.overtimeIncome +
    inputs.bonusIncome +
    inputs.secondEmployerIncome;

  // Annual taxable before pension deduction
  const annualGross = monthlyTaxableIncome * 12;

  // Pension deduction (reduces taxable income)
  const pensionDeduction = calculatePensionDeduction(
    inputs.baseMonthlyGross,
    inputs.pensionContributionPct,
    config,
  );

  const annualTaxableIncome = Math.max(0, annualGross - pensionDeduction);

  // Progressive tax
  const annualTaxBeforeCredits = calculateProgressiveTax(annualTaxableIncome, config);

  // Credit points reduce the tax liability
  const annualTaxCredit = calculateAnnualTaxCredit(inputs.creditPoints, config);

  // Surtax on top
  const annualSurtax = calculateSurtax(annualTaxableIncome, config);

  const annualTaxAfterCredits = Math.max(
    0,
    annualTaxBeforeCredits - annualTaxCredit + annualSurtax,
  );

  const monthlyTaxAfterCredits = annualTaxAfterCredits / 12;
  const netMonthlyIncome = monthlyTaxableIncome - monthlyTaxAfterCredits;
  const effectiveTaxRate =
    annualTaxableIncome > 0 ? annualTaxAfterCredits / annualTaxableIncome : 0;

  return {
    hourlyRate,
    monthlyTaxableIncome,
    annualTaxableIncome,
    annualTaxBeforeCredits,
    annualTaxCredit,
    annualSurtax,
    annualTaxAfterCredits,
    monthlyTaxAfterCredits,
    netMonthlyIncome,
    effectiveTaxRate,
  };
}
