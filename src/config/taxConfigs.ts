// ============================================================
// EDITABLE TAX CONFIGURATIONS
// ============================================================
// These are editable defaults only.
// Tax rules change annually — verify with a certified tax advisor.
// To update for a new year: clone the nearest config and update values.
// The calculation engine never reads these directly — it receives a
// TaxConfig object at runtime, so these are purely initialization data.
// ============================================================

import type { TaxConfig } from '../domain/types';

// ---------------------------------------------------------------------------
// Israeli tax brackets — approximate 2025 defaults
// Source: Israel Tax Authority guidelines (subject to annual change)
// All amounts in NIS annual income
// ---------------------------------------------------------------------------
export const TAX_CONFIG_REGULAR_2025: TaxConfig = {
  id: 'regular-2025',
  name: 'מדרגות מס 2025',
  year: 2025,
  isDefault: true,
  notes: 'ברירת מחדל לשנת 2025. יש לאמת מול רשות המסים לפני שימוש.',
  brackets: [
    { min: 0,       max: 84120,   rate: 0.10, label: '10%' },
    { min: 84120,   max: 120720,  rate: 0.14, label: '14%' },
    { min: 120720,  max: 193800,  rate: 0.20, label: '20%' },
    { min: 193800,  max: 269280,  rate: 0.31, label: '31%' },
    { min: 269280,  max: 558240,  rate: 0.35, label: '35%' },
    { min: 558240,  max: 721560,  rate: 0.47, label: '47%' },
    { min: 721560,  max: null,    rate: 0.50, label: '50%' },
  ],
  creditPointMonthlyValue: 235,   // NIS per credit point per month (approx. 2025)
  surtaxThreshold: 721560,        // Annual income above which 3% surtax applies
  surtaxRate: 0.03,               // Surtax rate
  pensionExemptionRate: 0.35,     // 35% of employee pension contribution reduces taxable income
};

// ---------------------------------------------------------------------------
// Expanded 2026 bracket proposal — PROVISIONAL DEFAULTS
// This reflects a proposed reform. Values are uncertain until legislated.
// Annotated as provisional so users understand these may change.
// ---------------------------------------------------------------------------
export const TAX_CONFIG_EXPANDED_2026: TaxConfig = {
  id: 'expanded-2026',
  name: 'מדרגות מס מורחבות 2026 (הצעת חוק)',
  year: 2026,
  notes: 'ערכים מוצעים בלבד — טרם אושרו בחקיקה. יש לעדכן כשיאושרו.',
  brackets: [
    // NOTE: These are placeholder estimates pending official 2026 legislation.
    // Update this object when the final brackets are published.
    { min: 0,       max: 84120,   rate: 0.10, label: '10%' },
    { min: 84120,   max: 120720,  rate: 0.14, label: '14%' },
    { min: 120720,  max: 193800,  rate: 0.20, label: '20%' },
    { min: 193800,  max: 323040,  rate: 0.31, label: '31%' },  // expanded upper bound
    { min: 323040,  max: 558240,  rate: 0.35, label: '35%' },
    { min: 558240,  max: 721560,  rate: 0.47, label: '47%' },
    { min: 721560,  max: null,    rate: 0.50, label: '50%' },
  ],
  creditPointMonthlyValue: 242,   // Estimated 2026 credit point value (provisional)
  surtaxThreshold: 721560,
  surtaxRate: 0.03,
  pensionExemptionRate: 0.35,
};

// All available configs (used to populate selector)
export const ALL_TAX_CONFIGS: TaxConfig[] = [
  TAX_CONFIG_REGULAR_2025,
  TAX_CONFIG_EXPANDED_2026,
];

export function getTaxConfigById(id: string): TaxConfig {
  return ALL_TAX_CONFIGS.find(c => c.id === id) ?? TAX_CONFIG_REGULAR_2025;
}
