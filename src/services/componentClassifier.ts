// ============================================================
// Component Auto-Classifier
// Maps Hebrew descriptions to ComponentType + taxability.
// ============================================================

import type { ComponentType, TaxableStatus, PayslipComponent } from '../models/types';

interface ClassificationRule {
  keywords: string[];
  type: ComponentType;
  incomeTaxable: TaxableStatus;
  nlTaxable: TaxableStatus;
  isCashPayment: boolean;
  includedInPayslipTotal: boolean;
}

const RULES: ClassificationRule[] = [
  // Direct pay
  {
    keywords: ['שכר משולב', 'שכר יסוד', 'שכר בסיס', 'שכר בסיסי', 'שי', 'ש.י', 'שכ.י', 'משכורת יסוד', 'משכורת'],
    type: 'direct_pay',
    incomeTaxable: true, nlTaxable: true,
    isCashPayment: true, includedInPayslipTotal: true,
  },
  // Overtime 125%
  {
    keywords: ['שעות נוספות 125', 'שע.נ 125', 'שע"נ 125', '125%'],
    type: 'overtime_125',
    incomeTaxable: true, nlTaxable: true,
    isCashPayment: true, includedInPayslipTotal: true,
  },
  // Overtime 150%
  {
    keywords: ['שעות נוספות 150', 'שע.נ 150', 'שע"נ 150', '150%'],
    type: 'overtime_150',
    incomeTaxable: true, nlTaxable: true,
    isCashPayment: true, includedInPayslipTotal: true,
  },
  // General overtime (no specific rate)
  {
    keywords: ['שעות נוספות', 'שע.נ', 'שע"נ', 'גמול שעות נוספות'],
    type: 'overtime_125',
    incomeTaxable: true, nlTaxable: true,
    isCashPayment: true, includedInPayslipTotal: true,
  },
  // Car allowance
  {
    keywords: ['חלף רכב', 'אחזקת רכב', 'החזר רכב', 'דמי נסיעה'],
    type: 'car_allowance',
    incomeTaxable: true, nlTaxable: true,
    isCashPayment: true, includedInPayslipTotal: true,
  },
  // Gross-up components (order before value_in_kind — "מגולם" / "מגלם")
  {
    keywords: ['גלום שווי', 'גילום שווי', 'גלום ר', 'גילום ר', 'גלום א', 'גלום ב'],
    type: 'grossed_up',
    incomeTaxable: true, nlTaxable: true,
    isCashPayment: false, includedInPayslipTotal: true,
  },
  // Grossed-up value (description contains "מגולם" or "מגלם")
  {
    keywords: ['מגולם', 'מגלם'],
    type: 'grossed_up',
    incomeTaxable: true, nlTaxable: true,
    isCashPayment: false, includedInPayslipTotal: true,
  },
  // Gross correction
  {
    keywords: ['תיקון שווי', 'תיקון גילום', 'תיקון מעל תקרה', 'הפחתת שווי', 'תיקון רכב'],
    type: 'gross_correction',
    incomeTaxable: 'uncertain', nlTaxable: 'uncertain',
    isCashPayment: false, includedInPayslipTotal: true,
  },
  // Value-in-kind (order after grossed_up check)
  {
    keywords: ['שווי ארוחות', 'שווי מונית', 'שווי נופש', 'שווי בוקר', 'שווי בריאות', 'שווי שח"ת', 'שווי רכב', 'שווי שימוש', 'זקיפת שווי', 'שווי'],
    type: 'value_in_kind',
    incomeTaxable: true, nlTaxable: true,
    isCashPayment: false, includedInPayslipTotal: true,
  },
  // Retro / adjustments
  {
    keywords: ['הפרש שכר', 'הפרש גילום', 'הפרשי שכר', 'הפרשי גילום', 'רטרו', 'רטרואקטיב', 'הפרשים'],
    type: 'retro',
    incomeTaxable: 'uncertain', nlTaxable: 'uncertain',
    isCashPayment: true, includedInPayslipTotal: true,
  },
  // Tax deductions
  {
    keywords: ['מס הכנסה', 'ניכוי מס'],
    type: 'deduction_income_tax',
    incomeTaxable: false, nlTaxable: false,
    isCashPayment: false, includedInPayslipTotal: false,
  },
  {
    keywords: ['ביטוח לאומי', 'ב.ל', 'ביט. לאומי', 'ביטוח-לאומי'],
    type: 'deduction_nl',
    incomeTaxable: false, nlTaxable: false,
    isCashPayment: false, includedInPayslipTotal: false,
  },
  {
    keywords: ['ביטוח בריאות', 'ב.ב', 'בריאות'],
    type: 'deduction_health',
    incomeTaxable: false, nlTaxable: false,
    isCashPayment: false, includedInPayslipTotal: false,
  },
  {
    keywords: ['פנסיה', 'קרן פנסיה', 'ק. פנסיה', 'קה"ש', 'קרן השתלמות', 'ועד', 'ביטוח מנהלים', 'אובדן כושר'],
    type: 'deduction_social',
    incomeTaxable: false, nlTaxable: false,
    isCashPayment: false, includedInPayslipTotal: false,
  },
];

export function classifyComponent(description: string): Omit<ClassificationRule, 'keywords'> {
  const desc = description.toLowerCase();
  for (const rule of RULES) {
    if (rule.keywords.some(kw => desc.includes(kw.toLowerCase()))) {
      const { keywords: _kw, ...result } = rule;
      return result;
    }
  }
  // Default: unknown payment, uncertain taxability
  return {
    type: 'other',
    incomeTaxable: 'uncertain',
    nlTaxable: 'uncertain',
    isCashPayment: true,
    includedInPayslipTotal: true,
  };
}

/** Create a new component with auto-classification */
export function createComponent(
  description: string,
  amount: number,
  source: PayslipComponent['source'] = 'manual',
  overrides: Partial<PayslipComponent> = {},
): PayslipComponent {
  const { type, ...rest } = classifyComponent(description);
  return {
    id: crypto.randomUUID(),
    description,
    amount,
    source,
    note: '',
    componentType: type,
    ...rest,
    ...overrides,
  };
}

/** Labels for component types in Hebrew */
export const COMPONENT_TYPE_LABELS: Record<string, string> = {
  direct_pay: 'שכר ישיר',
  overtime_125: 'שעות נוספות 125%',
  overtime_150: 'שעות נוספות 150%',
  car_allowance: 'חלף רכב',
  value_in_kind: 'זקיפת שווי',
  grossed_up: 'גילום',
  gross_correction: 'תיקון שווי',
  retro: 'הפרש / רטרו',
  other_payment: 'תשלום אחר',
  deduction_income_tax: 'ניכוי מס הכנסה',
  deduction_nl: 'ניכוי ביטוח לאומי',
  deduction_health: 'ניכוי ביטוח בריאות',
  deduction_social: 'ניכוי סוציאלי',
  deduction_other: 'ניכוי אחר',
  other: 'אחר',
};
