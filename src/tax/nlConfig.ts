// ============================================================
// EDITABLE BITUACH LEUMI + HEALTH INSURANCE CONFIGURATION
// ============================================================
// Approximate 2025 employee rates. Update annually.
// Employee rates only (employer rates not shown here).
// ============================================================

import type { NLConfig } from '../models/types';

export const NL_CONFIG_2025: NLConfig = {
  year: 2025,
  notes: 'ערכי ברירת מחדל לשנת 2025 — יש לאמת מול הביטוח הלאומי.',
  // 60% of average wage (~₪12,537) = ~₪7,522
  lowerThreshold: 7522,
  // 5× average wage ceiling for NL contributions
  ceiling: 49030,
  // Below lower threshold: reduced rates
  blRateLow: 0.004,      // 0.4%
  healthRateLow: 0.031,  // 3.1%
  // Above lower threshold (up to ceiling): full rates
  blRateHigh: 0.07,      // 7%
  healthRateHigh: 0.05,  // 5%
};
