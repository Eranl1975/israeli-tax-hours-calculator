// ============================================================
// Threshold & Hours Analysis Engine
// Forward calculation (how much room?) and
// Reverse calculation (how much to reduce?).
// ============================================================

import type { UserInputs, CalculationResults, ThresholdStatus, TaxConfig } from './types';
import { computeTaxableIncome } from './salaryEngine';
import {
  findBracketIndex,
  getBracketCeiling,
  calculateAnnualRoomToThreshold,
} from './taxEngine';

export function calculateResults(inputs: UserInputs, config: TaxConfig): CalculationResults {
  const income = computeTaxableIncome(inputs, config);

  const currentBracketIndex = findBracketIndex(income.annualTaxableIncome, config);
  const currentBracket = config.brackets[currentBracketIndex];

  const selectedBracketCeiling = getBracketCeiling(inputs.targetBracketIndex, config);

  const annualRoomToThreshold = calculateAnnualRoomToThreshold(
    income.annualTaxableIncome,
    inputs.targetBracketIndex,
    config,
  );

  const monthlyRoomToThreshold =
    annualRoomToThreshold === Infinity ? Infinity : annualRoomToThreshold / 12;

  const hourlyRate = income.hourlyRate;

  // Forward: how much more can the user earn/work?
  let maxExtraMonthlyHours = 0;
  let maxAvgDailyHours = 0;

  if (monthlyRoomToThreshold > 0 && hourlyRate > 0) {
    maxExtraMonthlyHours = monthlyRoomToThreshold / hourlyRate;
    const totalAllowedMonthlyHours = inputs.plannedMonthlyHours + maxExtraMonthlyHours;
    maxAvgDailyHours =
      inputs.workdaysInMonth > 0 ? totalAllowedMonthlyHours / inputs.workdaysInMonth : 0;
  } else if (hourlyRate > 0 && inputs.workdaysInMonth > 0) {
    // Already at or below threshold — current allowed daily hours
    maxAvgDailyHours = inputs.plannedMonthlyHours / inputs.workdaysInMonth;
  }

  // Reverse: how much must the user reduce?
  let reductionNeededMonthly = 0;
  let reductionMonthlyHours = 0;
  let reductionDailyHours = 0;

  if (monthlyRoomToThreshold < 0) {
    reductionNeededMonthly = Math.abs(monthlyRoomToThreshold);
    if (hourlyRate > 0) {
      reductionMonthlyHours = reductionNeededMonthly / hourlyRate;
      reductionDailyHours =
        inputs.workdaysInMonth > 0 ? reductionMonthlyHours / inputs.workdaysInMonth : 0;
    }
  }

  // Threshold percentage
  let thresholdPct = 0;
  if (selectedBracketCeiling !== null && selectedBracketCeiling > 0) {
    thresholdPct = (income.annualTaxableIncome / selectedBracketCeiling) * 100;
  }

  const thresholdStatus = deriveThresholdStatus(thresholdPct);

  return {
    hourlyRate,
    monthlyTaxableIncome: income.monthlyTaxableIncome,
    annualTaxableIncome: income.annualTaxableIncome,
    annualTaxBeforeCredits: income.annualTaxBeforeCredits,
    annualTaxAfterCredits: income.annualTaxAfterCredits,
    annualSurtax: income.annualSurtax,
    monthlyTaxAfterCredits: income.monthlyTaxAfterCredits,
    effectiveTaxRate: income.effectiveTaxRate,
    netMonthlyIncome: income.netMonthlyIncome,
    currentBracketIndex,
    currentBracketLabel: currentBracket.label,
    currentBracketRate: currentBracket.rate,
    selectedBracketCeiling,
    annualRoomToThreshold,
    monthlyRoomToThreshold,
    maxExtraMonthlyHours,
    maxAvgDailyHours,
    reductionNeededMonthly,
    reductionMonthlyHours,
    reductionDailyHours,
    thresholdPct: Math.min(thresholdPct, 200), // Cap for display
    thresholdStatus,
  };
}

function deriveThresholdStatus(pct: number): ThresholdStatus {
  if (pct >= 100) return 'exceeded';
  if (pct >= 95) return 'warning95';
  if (pct >= 90) return 'warning90';
  if (pct >= 85) return 'warning85';
  return 'safe';
}
