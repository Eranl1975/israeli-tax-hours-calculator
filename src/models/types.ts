// ============================================================
// Core domain types — Israeli Payslip Analyzer
// ============================================================

/** All component types that can appear on an Israeli payslip */
export type ComponentType =
  | 'direct_pay'          // שכר ישיר / שכר משולב / שכר יסוד
  | 'overtime_125'        // שעות נוספות 125%
  | 'overtime_150'        // שעות נוספות 150%
  | 'car_allowance'       // חלף רכב / אחזקת רכב
  | 'value_in_kind'       // זקיפת שווי (ארוחות, מונית, נופש, רכב, בריאות)
  | 'grossed_up'          // גילום — תוספת ברוטו לכיסוי המס על השווי
  | 'gross_correction'    // תיקון שווי / תיקון גילום / תיקון מעל תקרה
  | 'retro'               // הפרשים / רטרואקטיביים
  | 'other_payment'       // תשלום אחר
  | 'deduction_income_tax'  // ניכוי מס הכנסה
  | 'deduction_nl'          // ניכוי ביטוח לאומי
  | 'deduction_health'      // ניכוי ביטוח בריאות
  | 'deduction_social'      // ניכוי סוציאלי (פנסיה, קה"ש, ועד)
  | 'deduction_other'       // ניכוי אחר
  | 'other';                // אחר / לא ידוע

/** Whether a component is taxable — 'uncertain' when auto-classified from OCR */
export type TaxableStatus = true | false | 'uncertain';

export interface PayslipComponent {
  id: string;
  code?: string;                   // קוד רכיב / סמל
  description: string;             // תיאור הרכיב
  quantity?: number;               // כמות / שעות
  rate?: number;                   // תעריף (₪ ליחידה)
  percentage?: number;             // אחוז (למשל 125 לשע"נ)
  amount: number;                  // סכום: חיובי=תשלום, שלילי=ניכוי
  componentType: ComponentType;
  incomeTaxable: TaxableStatus;    // חייב במס הכנסה?
  nlTaxable: TaxableStatus;        // חייב בביטוח לאומי?
  isCashPayment: boolean;          // משולם כמזומן לעובד?
  includedInPayslipTotal: boolean; // נכנס לסך כל התשלומים בתלוש?
  note?: string;
  source: 'ocr' | 'manual' | 'mock';
}

export interface PayslipHeader {
  taxYear: number;
  taxMonth: number;   // 1–12
  employerName?: string;
  creditPoints: number;
  employeePensionPct: number; // % הפרשת עובד לפנסיה (מפחית בסיס מס)
}

/** Actual figures as they appear on the payslip (user-entered) */
export interface PayslipActuals {
  totalPayments: number;              // סך כל התשלומים
  totalMandatoryTaxDeductions: number;// סך ניכויי חובה מסים
  actualIncomeTax: number;            // מס הכנסה בפועל
  actualNL: number;                   // ביטוח לאומי בפועל
  actualHealth: number;               // ביטוח בריאות בפועל
  actualSocialDeductions: number;     // ניכויים סוציאליים
  actualNetToBank: number;            // נטו לבנק
}

export interface PayslipData {
  header: PayslipHeader;
  components: PayslipComponent[];
  actuals: PayslipActuals;
}

// ---- Tax Configuration ----

export interface MonthlyTaxBracket {
  min: number;        // Lower bound (monthly NIS)
  max: number | null; // Upper bound (null = unlimited)
  rate: number;       // Tax rate (0–1)
  label: string;      // e.g. "10%"
}

export interface IncomeTaxConfig {
  id: string;
  name: string;
  year: number;
  brackets: MonthlyTaxBracket[];
  creditPointMonthlyValue: number; // NIS per credit point per month
  surtaxMonthlyThreshold: number;  // Monthly income above which surtax kicks in
  surtaxRate: number;
  notes?: string;
}

export interface NLConfig {
  year: number;
  lowerThreshold: number;   // 60% of avg wage (reduced rates below this)
  ceiling: number;          // NL is not paid above this income
  blRateLow: number;        // BL employee rate on income below threshold
  blRateHigh: number;       // BL employee rate on income above threshold
  healthRateLow: number;    // Health employee rate below threshold
  healthRateHigh: number;   // Health employee rate above threshold
  notes?: string;
}

// ---- Calculation Results ----

export interface BracketBreakdown {
  bracketLabel: string;
  bracketMin: number;
  bracketMax: number | null;
  incomeInBracket: number;
  taxInBracket: number;
  rate: number;
  isHighestReached: boolean;
}

export interface ReconciliationNote {
  type: 'info' | 'warning' | 'alert';
  title: string;
  message: string;
  componentIds?: string[];
}

export interface CalculationResults {
  // Income breakdown
  directPayTotal: number;        // שכר ישיר + שעות נוספות + חלף רכב
  valueInKindTotal: number;      // זקיפות שווי (לא מזומן)
  grossedUpTotal: number;        // גילום
  correctionTotal: number;       // תיקונים + הפרשים (חיובי + שלילי)
  totalPaymentsCalc: number;     // סך תשלומים מחושב

  // Tax bases
  incomeTaxBase: number;         // בסיס חייב במס הכנסה (ודאי)
  incomeTaxBaseWithUncertain: number; // כולל רכיבים "לא ודאי"
  nlBase: number;                // בסיס חייב לביטוח לאומי
  pensionDeduction: number;      // ניכוי פנסיה מבסיס המס

  // Income tax
  taxBeforeCredits: number;
  creditPointsReduction: number;
  theoreticalIncomeTax: number;
  surtax: number;
  effectiveTaxRate: number;
  marginalBracketLabel: string;
  bracketBreakdown: BracketBreakdown[];

  // NL + Health
  theoreticalNL: number;
  theoreticalHealth: number;

  // Net
  grossCashPay: number;          // ברוטו מזומן בלבד
  theoreticalNetToBank: number;

  // Reconciliation
  incomeTaxDifference: number;   // theoretical − actual (positive = פחות מוטל ממה שמחושב)
  nlDifference: number;
  reconciliationNotes: ReconciliationNote[];
  suspiciousComponentIds: string[];
  hasUncertainComponents: boolean;
}

// ---- File Upload ----

export interface UploadedFile {
  id: string;
  file: File;
  preview?: string;
  isPdf: boolean;
  status: 'pending' | 'processing' | 'done' | 'error';
  ocrText?: string;
  errorMessage?: string;
}

// ---- App State ----

export type AppMode = 'manual' | 'upload';
export type ResultTab = 'summary' | 'brackets' | 'components' | 'reconciliation';
