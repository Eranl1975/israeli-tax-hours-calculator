// ============================================================
// Component Auto-Classifier
// Maps Hebrew descriptions → ComponentType + taxability.
// Rules are checked in order — more specific rules come first.
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

// ---- Code-range hints for deduction detection (Israeli payslips) ----
// Codes 450-799 are typically deductions; 800+ may be loans/advances.
export const DEDUCTION_CODE_MIN = 450;
export const DEDUCTION_CODE_MAX = 899;

export function isDeductionCode(code: string | undefined): boolean {
  if (!code) return false;
  const n = parseInt(code, 10);
  return !isNaN(n) && n >= DEDUCTION_CODE_MIN && n <= DEDUCTION_CODE_MAX;
}

const RULES: ClassificationRule[] = [
  // ── Direct pay ──────────────────────────────────────────────
  {
    keywords: [
      'שכר משולב', 'שכר יסוד', 'שכר בסיס', 'שכר בסיסי', 'שכר חודשי', 'שכר קבוע',
      'שי ', 'ש.י', 'שכ.י', 'שכ"י', 'ש"י',
      'משכורת יסוד', 'משכורת בסיס', 'משכורת',
      'שכר (ב)', 'שכר ב ', 'קצובת שכר',
    ],
    type: 'direct_pay',
    incomeTaxable: true, nlTaxable: true,
    isCashPayment: true, includedInPayslipTotal: true,
  },

  // ── Overtime 125% ────────────────────────────────────────────
  {
    keywords: [
      'שעות נוספות 125', 'ש. נוספות 125', 'שע.נ 125', 'שע"נ 125',
      'נוספות 125', 'שעות נוסף 125',
    ],
    type: 'overtime_125',
    incomeTaxable: true, nlTaxable: true,
    isCashPayment: true, includedInPayslipTotal: true,
  },

  // ── Overtime 150% ────────────────────────────────────────────
  {
    keywords: [
      'שעות נוספות 150', 'ש. נוספות 150', 'שע.נ 150', 'שע"נ 150',
      'נוספות 150', 'שעות נוסף 150',
    ],
    type: 'overtime_150',
    incomeTaxable: true, nlTaxable: true,
    isCashPayment: true, includedInPayslipTotal: true,
  },

  // ── Overtime (general, no specific rate) ─────────────────────
  {
    keywords: [
      'שעות נוספות', 'ש. נוספות', 'שע.נ', 'שע"נ',
      'גמול שעות נוספות', 'גמול שע. נוספות', 'תוספת שעות נוספות',
    ],
    type: 'overtime_125',
    incomeTaxable: true, nlTaxable: true,
    isCashPayment: true, includedInPayslipTotal: true,
  },

  // ── Car / travel allowance ───────────────────────────────────
  {
    keywords: [
      'חלף רכב', 'אחזקת רכב', 'החזר רכב', 'קצובת רכב',
      'דמי נסיעה', 'נסיעות', 'נסיעה', 'הוצאות נסיעה',
    ],
    type: 'car_allowance',
    incomeTaxable: true, nlTaxable: true,
    isCashPayment: true, includedInPayslipTotal: true,
  },

  // ── Grossed-up (גילום) — must come BEFORE value_in_kind ──────
  // Specific keyword patterns first
  {
    keywords: [
      'גלום שווי', 'גילום שווי',
      'גלום ש', 'גילום ש',
      'גלום א', 'גלום ב', 'גלום ר',
    ],
    type: 'grossed_up',
    incomeTaxable: true, nlTaxable: true,
    isCashPayment: false, includedInPayslipTotal: true,
  },
  // "מגולם" / "מגלם" anywhere in description
  {
    keywords: ['מגולם', 'מגלם'],
    type: 'grossed_up',
    incomeTaxable: true, nlTaxable: true,
    isCashPayment: false, includedInPayslipTotal: true,
  },
  // Specific gross-up descriptors
  {
    keywords: [
      'גלום טיפול', 'גילום טיפול',
      'ש.ל.מ.ד', 'שלמד',
      'גלום בריאות', 'גילום בריאות',
      'גלום שיניים', 'גילום שיניים',
      'גלום סקר', 'גילום סקר',
    ],
    type: 'grossed_up',
    incomeTaxable: true, nlTaxable: true,
    isCashPayment: false, includedInPayslipTotal: true,
  },

  // ── Gross correction / over-ceiling fix ──────────────────────
  {
    keywords: [
      'תיקון שווי', 'תיקון גילום', 'תיקון מעל תקרה', 'תיקון מעל',
      'הפחתת שווי', 'תיקון רכב', 'תיקון ש', 'קיזוז שווי',
    ],
    type: 'gross_correction',
    incomeTaxable: 'uncertain', nlTaxable: 'uncertain',
    isCashPayment: false, includedInPayslipTotal: true,
  },

  // ── Value-in-kind / זקיפת שווי ──────────────────────────────
  // Specific types first (more reliable classification)
  {
    keywords: [
      'שווי ארוחות', 'ארוחות', 'ארוחת',
      'שווי בוקר', 'ארוחת בוקר',
    ],
    type: 'value_in_kind',
    incomeTaxable: true, nlTaxable: true,
    isCashPayment: false, includedInPayslipTotal: true,
  },
  {
    keywords: [
      'שווי מונית', 'מונית טבע', 'שווי מונית טבע',
      'שווי נסיעה', 'שווי הסעה',
    ],
    type: 'value_in_kind',
    incomeTaxable: true, nlTaxable: true,
    isCashPayment: false, includedInPayslipTotal: true,
  },
  {
    keywords: [
      'שווי נופש', 'נופש',
      'שווי שח"ת', 'שח"ת חגים', 'שח"ת', 'שחת',
      'שווי טיול', 'טיול',
    ],
    type: 'value_in_kind',
    incomeTaxable: true, nlTaxable: true,
    isCashPayment: false, includedInPayslipTotal: true,
  },
  {
    keywords: [
      'שווי רכב', 'שווי שימוש ברכב',
      'שווי ליסינג', 'ליסינג',
    ],
    type: 'value_in_kind',
    incomeTaxable: true, nlTaxable: true,
    isCashPayment: false, includedInPayslipTotal: true,
  },
  {
    keywords: [
      'שווי בריאות', 'ביטוח בריאות קיבוצי',
      'בדיקות סקר', 'סקר מג', 'בדיקות',
    ],
    type: 'value_in_kind',
    incomeTaxable: 'uncertain', nlTaxable: 'uncertain',
    isCashPayment: false, includedInPayslipTotal: true,
  },
  {
    keywords: [
      'שווי שיניים', 'בשיניים', 'שיניים',
      'טיפול שיניים',
    ],
    type: 'value_in_kind',
    incomeTaxable: 'uncertain', nlTaxable: 'uncertain',
    isCashPayment: false, includedInPayslipTotal: true,
  },
  // Generic שווי / זקיפה catch-all
  {
    keywords: ['זקיפת שווי', 'זקיפה', 'שווי שימוש', 'שווי'],
    type: 'value_in_kind',
    incomeTaxable: true, nlTaxable: true,
    isCashPayment: false, includedInPayslipTotal: true,
  },

  // ── Bonus / incentive ────────────────────────────────────────
  {
    keywords: [
      'בונוס', 'פרמיה', 'מענק', 'תגמול', 'מענק מיוחד',
      'פרמיית ביצועים', 'גמול מיוחד', 'דמי הצלחה',
    ],
    type: 'other_payment',
    incomeTaxable: true, nlTaxable: true,
    isCashPayment: true, includedInPayslipTotal: true,
  },

  // ── Retro / adjustments ──────────────────────────────────────
  {
    keywords: [
      'הפרש שכר', 'הפרש גילום', 'הפרשי שכר', 'הפרשי גילום',
      'רטרו', 'רטרואקטיב', 'הפרשים',
      'הפרש ', // trailing space to avoid matching standalone prefix
    ],
    type: 'retro',
    incomeTaxable: 'uncertain', nlTaxable: 'uncertain',
    isCashPayment: true, includedInPayslipTotal: true,
  },

  // ── Standalone גילום/גלום (catch-all, after specific rules) ──
  {
    keywords: ['גילום', 'גלום'],
    type: 'grossed_up',
    incomeTaxable: true, nlTaxable: true,
    isCashPayment: false, includedInPayslipTotal: true,
  },

  // ── Deductions ───────────────────────────────────────────────
  {
    keywords: ['מס הכנסה', 'ניכוי מס', 'מ.ה', 'מ"ה'],
    type: 'deduction_income_tax',
    incomeTaxable: false, nlTaxable: false,
    isCashPayment: false, includedInPayslipTotal: false,
  },
  {
    keywords: [
      'ביטוח לאומי', 'ב"ל', 'ב.ל', 'ביט. לאומי', 'ביטוח-לאומי',
      'ל. לאומי',
    ],
    type: 'deduction_nl',
    incomeTaxable: false, nlTaxable: false,
    isCashPayment: false, includedInPayslipTotal: false,
  },
  {
    keywords: ['ביטוח בריאות', 'ב.ב', 'קופ"ח', 'דמי בריאות'],
    type: 'deduction_health',
    incomeTaxable: false, nlTaxable: false,
    isCashPayment: false, includedInPayslipTotal: false,
  },
  {
    keywords: [
      'פנסיה', 'קרן פנסיה', 'ק. פנסיה', 'ק.פ',
      'קה"ש', 'קרן השתלמות', 'קרן ה',
      'ביטוח מנהלים', 'אובדן כושר', 'נכות',
      'ועד', 'ועד עובדים', 'ארגון עובדים',
    ],
    type: 'deduction_social',
    incomeTaxable: false, nlTaxable: false,
    isCashPayment: false, includedInPayslipTotal: false,
  },
  {
    keywords: ['הלוואה', 'הלוואת', 'אשראי', 'קרן', 'מקדמה', 'חוב'],
    type: 'deduction_other',
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
