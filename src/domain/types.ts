// ============================================================
// Core domain types for the Israeli Salary & Hours Calculator
// ============================================================

export interface TaxBracket {
  min: number;        // Annual income lower bound (inclusive, NIS)
  max: number | null; // Annual income upper bound (null = unlimited)
  rate: number;       // Marginal tax rate (0–1)
  label: string;      // Display label, e.g. "10%"
}

/**
 * A complete, self-contained tax configuration.
 * The calculation engine never hardcodes tax values — it always
 * receives a TaxConfig object. To update for a new year, clone
 * and update this object without touching the engine.
 */
export interface TaxConfig {
  id: string;
  name: string;                   // Hebrew display name
  year: number;
  brackets: TaxBracket[];
  creditPointMonthlyValue: number; // NIS per credit point per month
  surtaxThreshold: number;         // Annual income at which surtax begins (NIS)
  surtaxRate: number;              // Additional surtax rate (0–1)
  pensionExemptionRate: number;    // Fraction of employee pension contribution deducted from taxable income
  isDefault?: boolean;
  notes?: string;                  // Annotation for uncertain or provisional values
}

export interface UserInputs {
  baseMonthlyGross: number;
  plannedMonthlyHours: number;
  workdaysInMonth: number;
  creditPoints: number;
  targetBracketIndex: number;      // Index into taxConfig.brackets[]
  hourlyRateOverride: number;      // 0 = derive from salary/hours
  additionalTaxableMonthly: number;
  overtimeIncome: number;
  bonusIncome: number;
  secondEmployerIncome: number;
  pensionContributionPct: number;  // Employee pension % (0–100)
  scenarioName: string;
  taxConfigId: string;
}

export interface CalculationResults {
  // Income
  hourlyRate: number;
  monthlyTaxableIncome: number;
  annualTaxableIncome: number;

  // Tax
  annualTaxBeforeCredits: number;
  annualTaxAfterCredits: number;
  annualSurtax: number;
  monthlyTaxAfterCredits: number;
  effectiveTaxRate: number;
  netMonthlyIncome: number;

  // Bracket status
  currentBracketIndex: number;
  currentBracketLabel: string;
  currentBracketRate: number;

  // Threshold analysis
  selectedBracketCeiling: number | null; // null if last bracket (no ceiling)
  annualRoomToThreshold: number;          // Positive = room left, negative = exceeded
  monthlyRoomToThreshold: number;
  maxExtraMonthlyHours: number;           // > 0 only when room exists
  maxAvgDailyHours: number;               // Total allowed daily hours (not extra)
  reductionNeededMonthly: number;         // > 0 only when exceeded
  reductionMonthlyHours: number;
  reductionDailyHours: number;
  thresholdPct: number;                   // % of bracket ceiling currently used
  thresholdStatus: ThresholdStatus;
}

export type ThresholdStatus = 'safe' | 'warning85' | 'warning90' | 'warning95' | 'exceeded';

export interface ScenarioResult {
  name: string;
  inputs: UserInputs;
  results: CalculationResults;
  configName: string;
}

export interface ComparisonResult {
  configA: { config: TaxConfig; results: CalculationResults };
  configB: { config: TaxConfig; results: CalculationResults };
  taxDifference: number;          // Positive = A costs more tax
  roomDifference: number;         // Positive = B has more room
  hoursDifference: number;
}
