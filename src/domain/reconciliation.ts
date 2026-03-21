// ============================================================
// Reconciliation Engine
// Compares theoretical calculation vs. actual payslip figures.
// ============================================================

import type {
  PayslipData,
  ReconciliationNote,
  IncomeTaxConfig,
} from '../models/types';

interface ReconciliationInput {
  data: PayslipData;
  theoreticalIncomeTax: number;
  theoreticalNL: number;
  theoreticalHealth: number;
  incomeTaxBase: number;
  incomeTaxBaseWithUncertain: number;
  config: IncomeTaxConfig;
}

interface ReconciliationOutput {
  incomeTaxDifference: number;
  nlDifference: number;
  reconciliationNotes: ReconciliationNote[];
  suspiciousComponentIds: string[];
  hasUncertainComponents: boolean;
}

const SIGNIFICANT_DIFF = 200; // NIS — flag if difference exceeds this
const PCT_DIFF_THRESHOLD = 0.05; // 5% — flag if percentage difference exceeds this

export function buildReconciliation(input: ReconciliationInput): ReconciliationOutput {
  const { data, theoreticalIncomeTax, theoreticalNL, theoreticalHealth, incomeTaxBase, incomeTaxBaseWithUncertain } = input;
  const { components, actuals } = data;

  const notes: ReconciliationNote[] = [];
  const suspiciousIds: string[] = [];

  // Has uncertain components?
  const uncertainComponents = components.filter(c =>
    c.incomeTaxable === 'uncertain' || c.nlTaxable === 'uncertain',
  );
  const hasUncertainComponents = uncertainComponents.length > 0;

  // Differences
  const incomeTaxDiff = theoreticalIncomeTax - actuals.actualIncomeTax;
  const nlDiff = theoreticalNL + theoreticalHealth - (actuals.actualNL + actuals.actualHealth);

  // 1. Uncertain components note
  if (hasUncertainComponents) {
    const diffIfUncertain = incomeTaxBaseWithUncertain - incomeTaxBase;
    notes.push({
      type: 'warning',
      title: 'רכיבים לא ודאיים',
      message: `${uncertainComponents.length} רכיבים סווגו כ"לא ודאי" לצורך מיסוי. אם ייסווגו כחייבים, בסיס המס יעלה ב-₪${diffIfUncertain.toFixed(0)}.`,
      componentIds: uncertainComponents.map(c => c.id),
    });
    suspiciousIds.push(...uncertainComponents.map(c => c.id));
  }

  // 2. Income tax difference
  if (actuals.actualIncomeTax > 0) {
    const absDiff = Math.abs(incomeTaxDiff);
    const pctDiff = Math.abs(incomeTaxDiff) / actuals.actualIncomeTax;

    if (absDiff > SIGNIFICANT_DIFF || pctDiff > PCT_DIFF_THRESHOLD) {
      if (incomeTaxDiff > 0) {
        notes.push({
          type: 'info',
          title: 'מס הכנסה: ניכוי נמוך מהתיאורטי',
          message: `ניכוי בפועל (₪${actuals.actualIncomeTax.toFixed(0)}) נמוך ב-₪${absDiff.toFixed(0)} מהחישוב התיאורטי (₪${theoreticalIncomeTax.toFixed(0)}). סיבות אפשריות: הפרשי שנה קודמת, תיאום מס, ניכויי פנסיה שלא דווחו, הטבות מס לא מחושבות.`,
        });
      } else {
        notes.push({
          type: 'info',
          title: 'מס הכנסה: ניכוי גבוה מהתיאורטי',
          message: `ניכוי בפועל (₪${actuals.actualIncomeTax.toFixed(0)}) גבוה ב-₪${absDiff.toFixed(0)} מהחישוב התיאורטי (₪${theoreticalIncomeTax.toFixed(0)}). ייתכן שיש רכיבים חייבים שלא סווגו כהלכה, הכנסה ממעסיק נוסף, או רכיבי הפרש שוטפים.`,
        });
      }
    } else {
      notes.push({
        type: 'info',
        title: 'מס הכנסה: התאמה טובה',
        message: `הפרש של ₪${absDiff.toFixed(0)} (${(pctDiff * 100).toFixed(1)}%) — בגבולות סביר.`,
      });
    }
  }

  // 3. NL difference
  const actualTotalNL = actuals.actualNL + actuals.actualHealth;
  const theoreticalTotalNL = theoreticalNL + theoreticalHealth;
  const absNLDiff = Math.abs(nlDiff);
  if (actualTotalNL > 0 && absNLDiff > SIGNIFICANT_DIFF) {
    notes.push({
      type: 'warning',
      title: 'ביטוח לאומי: פער משמעותי',
      message: `בל + בריאות תיאורטי: ₪${theoreticalTotalNL.toFixed(0)} | בפועל: ₪${actualTotalNL.toFixed(0)} | פער: ₪${absNLDiff.toFixed(0)}. ייתכן שבסיס הביטוח הלאומי שונה מבסיס מס ההכנסה (שעות נוספות, גמלאות, רכיבי שווי מסוימים).`,
    });
  }

  // 4. Value-in-kind / grossed-up components
  const vkComponents = components.filter(c =>
    c.componentType === 'value_in_kind' || c.componentType === 'grossed_up',
  );
  if (vkComponents.length > 0) {
    notes.push({
      type: 'info',
      title: 'זקיפות ורכיבי גילום',
      message: `${vkComponents.length} רכיבי שווי/גילום (₪${vkComponents.reduce((s,c) => s + c.amount, 0).toFixed(0)}) מגדילים את בסיס המס אך אינם תשלום מזומן. זה עשוי להסביר פערים בין ברוטו לנטו.`,
      componentIds: vkComponents.map(c => c.id),
    });
  }

  // 5. Retro / correction components
  const retroComponents = components.filter(c =>
    c.componentType === 'retro' || c.componentType === 'gross_correction',
  );
  if (retroComponents.length > 0) {
    notes.push({
      type: 'warning',
      title: 'רכיבי הפרש ותיקון',
      message: `${retroComponents.length} רכיבי הפרש/תיקון (₪${retroComponents.reduce((s,c) => s + c.amount, 0).toFixed(0)}) עשויים להשפיע על חישוב המס בדרכים שאינן לינאריות (למשל חישוב מדרגות מס מיוחד להפרשים).`,
      componentIds: retroComponents.map(c => c.id),
    });
    suspiciousIds.push(...retroComponents.map(c => c.id));
  }

  // 6. Total payments reconciliation
  if (actuals.totalPayments > 0) {
    const calcTotal = components
      .filter(c => !['deduction_income_tax', 'deduction_nl', 'deduction_health', 'deduction_social', 'deduction_other'].includes(c.componentType))
      .reduce((s, c) => s + c.amount, 0);
    const totalDiff = Math.abs(calcTotal - actuals.totalPayments);
    if (totalDiff > 10) {
      notes.push({
        type: 'info',
        title: 'סך תשלומים: פער עם התלוש',
        message: `סך תשלומים מחושב: ₪${calcTotal.toFixed(0)} | לפי התלוש: ₪${actuals.totalPayments.toFixed(0)} | פער: ₪${totalDiff.toFixed(0)}. ייתכן שחסרים רכיבים או שחלק מרכיבי הזקיפה אינם נכנסים לסך התשלומים בתלוש.`,
      });
    }
  }

  return {
    incomeTaxDifference: incomeTaxDiff,
    nlDifference: nlDiff,
    reconciliationNotes: notes,
    suspiciousComponentIds: [...new Set(suspiciousIds)],
    hasUncertainComponents,
  };
}
