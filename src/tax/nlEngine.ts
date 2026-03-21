// ============================================================
// Bituach Leumi + Health Insurance Engine — Monthly calculation
// Pure functions, no hardcoded values.
// ============================================================

import type { NLConfig } from '../models/types';

export interface NLResult {
  blAmount: number;
  healthAmount: number;
  total: number;
  aboveCeiling: boolean;
}

/** Calculate employee NL + health contributions on monthly income */
export function calculateNL(monthlyNLBase: number, config: NLConfig): NLResult {
  if (monthlyNLBase <= 0) {
    return { blAmount: 0, healthAmount: 0, total: 0, aboveCeiling: false };
  }

  const effectiveIncome = Math.min(monthlyNLBase, config.ceiling);
  const aboveCeiling = monthlyNLBase > config.ceiling;

  let blAmount = 0;
  let healthAmount = 0;

  if (effectiveIncome <= config.lowerThreshold) {
    // All income in the lower tier
    blAmount = effectiveIncome * config.blRateLow;
    healthAmount = effectiveIncome * config.healthRateLow;
  } else {
    // Lower tier contribution
    blAmount += config.lowerThreshold * config.blRateLow;
    healthAmount += config.lowerThreshold * config.healthRateLow;
    // Upper tier contribution
    const upperIncome = effectiveIncome - config.lowerThreshold;
    blAmount += upperIncome * config.blRateHigh;
    healthAmount += upperIncome * config.healthRateHigh;
  }

  return {
    blAmount,
    healthAmount,
    total: blAmount + healthAmount,
    aboveCeiling,
  };
}
