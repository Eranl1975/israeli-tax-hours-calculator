// Application-level defaults (non-tax values)
export const APP_CONFIG = {
  defaultCreditPoints: 2.25,         // Standard credit points for a single Israeli taxpayer
  defaultMonthlyHours: 182,
  defaultWorkdaysInMonth: 22,
  defaultPensionContributionPct: 6,  // Common employee pension contribution %
  thresholdWarnings: [85, 90, 95, 100] as const,
  currency: 'ILS' as const,
  locale: 'he-IL' as const,
};
