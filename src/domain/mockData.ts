// ============================================================
// Sample payslip data — based on user's complex payslip example
// ============================================================

import type { PayslipData } from '../models/types';
import { createComponent } from '../services/componentClassifier';

export function createMockPayslip(): PayslipData {
  return {
    header: {
      taxYear: 2025,
      taxMonth: 3,
      employerName: 'חברה לדוגמה בע"מ',
      creditPoints: 2.25,
      employeePensionPct: 6,
    },
    components: [
      // --- תשלומים ישירים ---
      createComponent('שכר משולב', 20987.00, 'mock', { code: '101' }),
      createComponent('שעות נוספות 125%', 2525.36, 'mock', { code: '110', quantity: 15, rate: 168.36 }),
      createComponent('שעות נוספות 150%', 114.16, 'mock', { code: '111', quantity: 1, rate: 114.16 }),
      createComponent('חלף רכב', 3800.00, 'mock', { code: '200' }),

      // --- זקיפות שווי (לא מזומן) ---
      createComponent('שווי ארוחות', 600.00, 'mock', { code: '310' }),
      createComponent('שווי מונית', 448.54, 'mock', { code: '320' }),
      createComponent('שווי בריאות', 500.00, 'mock', { code: '330' }),
      createComponent('שווי שח"ת חגים', 500.00, 'mock', { code: '340' }),

      // --- גילום ---
      createComponent('שווי ארוחות מגולם', 923.08, 'mock', { code: '311' }),
      createComponent('גלום שווי רכב', 565.69, 'mock', { code: '410' }),

      // --- תיקון שווי ---
      createComponent('תיקון שווי מעל תקרה', -474.54, 'mock', { code: '450' }),

      // --- ניכויים ---
      createComponent('מס הכנסה', -6574.00, 'mock', { code: '501' }),
      createComponent('ביטוח לאומי', -1805.00, 'mock', { code: '502' }),
      createComponent('ביטוח בריאות', -1492.00, 'mock', { code: '503' }),
      createComponent('פנסיה עובד 6%', -1259.22, 'mock', { code: '601' }),
      createComponent('קרן השתלמות', -629.61, 'mock', { code: '602' }),
      createComponent('ועד עובדים', -50.00, 'mock', { code: '700' }),
    ],
    actuals: {
      totalPayments: 28873.52,
      totalMandatoryTaxDeductions: 9871.00,
      actualIncomeTax: 6574.00,
      actualNL: 1805.00,
      actualHealth: 1492.00,
      actualSocialDeductions: 1938.83,
      actualNetToBank: 17124.69,
    },
  };
}
