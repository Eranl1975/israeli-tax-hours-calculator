// ============================================================
// EDITABLE INCOME TAX CONFIGURATION — Monthly brackets
// ============================================================
// These are APPROXIMATE defaults. Verify with the Israel Tax Authority
// annually. Update the brackets object for each new tax year.
// All amounts in NIS monthly income.
// ============================================================

import type { IncomeTaxConfig } from '../models/types';

// Monthly brackets are annual brackets ÷ 12
// Annual: 84,120 / 120,720 / 193,800 / 269,280 / 558,240 / 721,560
export const INCOME_TAX_CONFIG_2025: IncomeTaxConfig = {
  id: 'income-tax-2025',
  name: 'מדרגות מס הכנסה 2025',
  year: 2025,
  notes: 'ערכי ברירת מחדל לשנת 2025 — יש לאמת מול רשות המסים.',
  brackets: [
    { min: 0,      max: 7010,   rate: 0.10, label: '10%' },
    { min: 7010,   max: 10060,  rate: 0.14, label: '14%' },
    { min: 10060,  max: 16150,  rate: 0.20, label: '20%' },
    { min: 16150,  max: 22440,  rate: 0.31, label: '31%' },
    { min: 22440,  max: 46520,  rate: 0.35, label: '35%' },
    { min: 46520,  max: 60130,  rate: 0.47, label: '47%' },
    { min: 60130,  max: null,   rate: 0.50, label: '50%' },
  ],
  creditPointMonthlyValue: 235,   // NIS per credit point per month (approx 2025)
  surtaxMonthlyThreshold: 60130,  // Monthly income above which 3% surtax applies
  surtaxRate: 0.03,
};

// Proposed 2026 brackets (provisional — update when legislated)
export const INCOME_TAX_CONFIG_2026: IncomeTaxConfig = {
  id: 'income-tax-2026',
  name: 'מדרגות מס הכנסה 2026 (הצעה)',
  year: 2026,
  notes: 'הצעה בלבד — טרם אושרה בחקיקה. עדכן כשיתפרסמו הנתונים הרשמיים.',
  brackets: [
    { min: 0,      max: 7010,   rate: 0.10, label: '10%' },
    { min: 7010,   max: 10060,  rate: 0.14, label: '14%' },
    { min: 10060,  max: 16150,  rate: 0.20, label: '20%' },
    { min: 16150,  max: 26920,  rate: 0.31, label: '31%' },  // expanded
    { min: 26920,  max: 46520,  rate: 0.35, label: '35%' },
    { min: 46520,  max: 60130,  rate: 0.47, label: '47%' },
    { min: 60130,  max: null,   rate: 0.50, label: '50%' },
  ],
  creditPointMonthlyValue: 242,   // Estimated 2026 value
  surtaxMonthlyThreshold: 60130,
  surtaxRate: 0.03,
};

export const ALL_INCOME_TAX_CONFIGS = [INCOME_TAX_CONFIG_2025, INCOME_TAX_CONFIG_2026];

export function getIncomeTaxConfigByYear(year: number): IncomeTaxConfig {
  return ALL_INCOME_TAX_CONFIGS.find(c => c.year === year) ?? INCOME_TAX_CONFIG_2025;
}
