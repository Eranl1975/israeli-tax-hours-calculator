// ============================================================
// Payslip Extractor — powered by LiteParse (local server)
//
// Files are sent to a local Express/LiteParse server on
// http://127.0.0.1:3001 (proxied via Vite as /api/parse).
// ALL processing happens on this machine — no data is ever
// transmitted to any external server or cloud service.
// ============================================================

import { isDeductionCode } from './componentClassifier';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single parsed row from a payslip component table */
export interface ExtractedRow {
  code?: string;          // סמל / קוד
  description: string;   // תיאור הרכיב
  quantity?: number;      // כמות / שעות
  rate?: number;          // תעריף
  amount: number;         // סכום (חיובי = תשלום, שלילי = ניכוי)
  rawLine: string;        // שורה גולמית מה-OCR (לניפוי שגיאות)
}

/** Summary fields extracted from payslip headers / totals */
export interface ExtractedSummary {
  taxYear?: number;
  taxMonth?: number;
  creditPoints?: number;
  pensionContributionPct?: number;
  totalPayments?: number;
  totalDeductions?: number;
  netToBank?: number;
}

export type OcrProgressCallback = (pct: number, status: string) => void;

// ---------------------------------------------------------------------------
// Step 1+2 (combined): Upload file → local LiteParse server → text
//
// The server runs on http://127.0.0.1:3001, proxied by Vite as /api/parse.
// No data leaves the machine at any point.
// ---------------------------------------------------------------------------
export async function parseViaServer(
  file: File,
  onProgress: OcrProgressCallback,
): Promise<string> {
  onProgress(10, 'שולח קובץ לשרת מקומי...');

  const formData = new FormData();
  formData.append('file', file);

  let response: Response;
  try {
    response = await fetch('/api/parse', {
      method: 'POST',
      body: formData,
    });
  } catch {
    throw new Error(
      'שרת LiteParse אינו זמין. הרץ: npm run dev (מפעיל גם את שרת הניתוח)',
    );
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
    throw new Error(`שגיאת ניתוח: ${body.error ?? response.statusText}`);
  }

  onProgress(80, 'מנתח תוצאות...');
  const { text } = (await response.json()) as { text: string };
  return text ?? '';
}

// ---------------------------------------------------------------------------
// Step 3a: Normalize + helpers
// ---------------------------------------------------------------------------

function normalize(s: string): string {
  return s
    .replace(/[""״]/g, '"')
    .replace(/['׳]/g, "'")
    .replace(/\r\n|\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/[\u200f\u200e\u202a-\u202e]/g, ''); // strip RTL marks
}

function cleanNum(s: string): number {
  // Handle both "1,234.56" and "1.234,56" (European format)
  const stripped = s.replace(/,/g, '');
  return parseFloat(stripped);
}

/** Extract all numeric tokens from a string (ignores percentages) */
function extractNums(s: string): number[] {
  // Strip percentages first so "125%" doesn't pollute amounts
  const noPct = s.replace(/\d+\.?\d*\s*%/g, ' ');
  const matches = noPct.match(/[\d,]+(?:\.\d+)?/g) ?? [];
  return matches
    .map(m => cleanNum(m))
    .filter(n => !isNaN(n) && n >= 0);
}

// Keywords that mark section headers / total lines (skip these)
const SKIP_LINE_PATTERNS = [
  /^סה[""']?כ/,     // סה"כ, סהכ
  /^סך\s*הכל/,
  /^ס[""']?ה\s/,
  /^סיכום/,
  /ברוטו\s*לתשלום/,
  /נטו\s*לתשלום/,
  /^תשלומים$/,
  /^ניכויים$/,
  /^רכיבי\s*שכר/,
  /סה[""']?כ\s*תשלומים/,
  /סה[""']?כ\s*ניכויים/,
];

// ── Noise detection ─────────────────────────────────────────────────────────

/**
 * Whole-line patterns that immediately disqualify a line as a component row.
 * These catch IDs, phone numbers, account numbers, and date strings.
 */
const NOISE_WHOLE_LINE: RegExp[] = [
  /\d{8,}/,                         // 8+ consecutive digits → ID / phone / account
  /\d{1,2}\/\d{1,2}\/20\d{2}/,      // Date: dd/mm/yyyy
  /\d{1,2}\/20\d{2}/,               // Date: mm/yyyy
  /^\s*[\d\s,.\-+]+\s*$/,           // Line is only digits / punctuation
  /^\s*[a-zA-Z\d\s@.\-]+\s*$/,      // Line is only English letters + digits (no Hebrew)
];

/**
 * Keywords that mark a description as organizational / personal / address info —
 * i.e. NOT a salary component.
 */
const NOISE_DESCRIPTION_WORDS = [
  // Municipalities and government
  'עיריית', 'עירייה', 'עיריה', 'עיריית', 'מועצה', 'מועצת', 'מועצה מקומית',
  'ממשלה', 'ממשלת', 'משרד הפנים', 'משרד הכלכלה', 'משרד',
  'רשות מקומית', 'אזור תעשייה',
  // Corporate / legal entity indicators
  'בע"מ', 'בעמ', "בע'מ", 'עמותה', 'אגודה שיתופית', 'אגודה',
  'מוסד', 'קיבוץ', 'מושב', 'קואופרטיב',
  // Personal info labels
  'שם עובד', 'שם המעסיק', 'שם מעסיק', 'מספר עובד', 'מס. עובד',
  'תעודת זהות', 'ת.ז',
  // Address
  'רחוב ', 'רח. ', 'ת.ד.', 'ד.נ.', 'מיקוד', 'פ.ת.',
  // Bank account (without salary context)
  'חשבון בנק', 'מספר חשבון', 'סניף בנק',
];

/**
 * Salary/deduction keywords that give HIGH confidence a line is a real row.
 * If a description contains any of these, it passes even without a valid code.
 */
const SALARY_CONFIDENCE_KEYWORDS = [
  'שכר', 'שעות', 'נוספות', 'חלף', 'שווי', 'גילום', 'גלום', 'מגולם', 'מגלם',
  'תיקון', 'פנסיה', 'קה"ש', 'קרן', 'ביטוח לאומי', 'ביטוח בריאות',
  'מס הכנסה', 'ועד', 'הלוואה', 'מענק', 'בונוס', 'פרמיה', 'תוספת',
  'הפרש', 'רטרו', 'זקיפה', 'שח"ת', 'ארוחות', 'נופש', 'מונית',
  'נסיעות', 'ניכוי', 'אובדן', 'מקדמה',
];

function isSkipLine(line: string): boolean {
  const l = line.trim();
  return l.length < 3 || SKIP_LINE_PATTERNS.some(rx => rx.test(l));
}

/** Reject line if it contains obvious non-payslip patterns */
function isNoiseLine(line: string): boolean {
  return NOISE_WHOLE_LINE.some(rx => rx.test(line));
}

/** Reject if description text flags city / org / personal / address */
function isNoiseDescription(desc: string): boolean {
  const d = desc.toLowerCase();
  return NOISE_DESCRIPTION_WORDS.some(kw => d.includes(kw.toLowerCase()));
}

/**
 * Returns true when the description clearly belongs to a salary component
 * (high confidence — passes even without a numeric code).
 */
function hasSalaryKeyword(desc: string): boolean {
  const d = desc.toLowerCase();
  return SALARY_CONFIDENCE_KEYWORDS.some(kw => d.includes(kw.toLowerCase()));
}

/**
 * Validate that an extracted code string is a plausible payslip component code.
 * Rejects: tax years (1990-2040), codes < 10 or > 9999.
 */
function isValidPayslipCode(code: string | undefined): boolean {
  if (!code) return false;
  const n = parseInt(code, 10);
  if (isNaN(n)) return false;
  if (n >= 1990 && n <= 2040) return false; // year, not a code
  return n >= 10 && n <= 9999;
}

// Keywords indicating a deduction description
const DEDUCTION_KEYWORDS = [
  'מס הכנסה', 'ניכוי מס', 'מ"ה', 'מ.ה',
  'ביטוח לאומי', 'ב"ל', 'ב.ל', 'ביט. לאומי',
  'ביטוח בריאות', 'ב.ב', 'קופ"ח',
  'פנסיה', 'קרן פנסיה', 'קה"ש', 'קרן השתלמות',
  'ביטוח מנהלים', 'אובדן כושר',
  'ועד', 'הלוואה', 'מקדמה', 'ניכוי',
];

function isDeductionDescription(desc: string): boolean {
  const d = desc.toLowerCase();
  return DEDUCTION_KEYWORDS.some(kw => d.includes(kw.toLowerCase()));
}

// ---------------------------------------------------------------------------
// Step 3b: Parse a single line into an ExtractedRow (or null)
// ---------------------------------------------------------------------------

/**
 * Try to parse one OCR line as a payslip component row.
 *
 * Israeli payslip columns (RTL layout, OCR may output LTR or RTL order):
 *   [CODE] [DESCRIPTION] [QUANTITY] [RATE] [AMOUNT]
 *
 * The code is a 2-4 digit integer (10-9999).
 * The amount is the rightmost / last "substantial" number.
 * Percentages (125%, 150%) are stripped before numeric extraction.
 */
function parseLine(line: string): ExtractedRow | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  if (isSkipLine(trimmed)) return null;

  // Reject lines that are clearly not payslip rows (IDs, dates, etc.)
  if (isNoiseLine(trimmed)) return null;

  // Must contain Hebrew characters
  if (!/[\u0590-\u05FF]/.test(trimmed)) return null;

  // Remove RTL/LTR markers and normalize spaces
  const clean = trimmed.replace(/[\u200f\u200e\u202a-\u202e]/g, '');

  // ── Extract code ──────────────────────────────────────────────────────────
  // Look for a 2-4 digit integer at the beginning OR end of the line
  let code: string | undefined;
  const codeStartMatch = clean.match(/^(\d{2,4})\s+/);
  const codeEndMatch   = clean.match(/\s+(\d{2,4})$/);
  if (codeStartMatch) {
    code = codeStartMatch[1];
  } else if (codeEndMatch) {
    code = codeEndMatch[1];
  }

  // Validate the extracted code — reject year-like numbers and out-of-range codes
  if (!isValidPayslipCode(code)) code = undefined;

  // ── Strip percentage numbers and extract remaining numeric tokens ─────────
  const noPct = clean.replace(/\d+\.?\d*\s*%/g, ' __PCT__ ');
  const rawNums = (noPct.match(/[\d,]+(?:\.\d+)?/g) ?? [])
    .map(m => ({ raw: m, val: cleanNum(m) }))
    .filter(({ val }) => !isNaN(val) && val >= 0);

  if (rawNums.length === 0) return null;

  // ── Separate code from numeric tokens ────────────────────────────────────
  const codeNum = code ? parseInt(code, 10) : undefined;
  // Remove the code value from rawNums (only first occurrence)
  let codeRemoved = false;
  const nonCodeNums = rawNums.filter(({ val }) => {
    if (!codeRemoved && codeNum !== undefined && val === codeNum &&
        Number.isInteger(val) && val >= 10 && val <= 9999) {
      codeRemoved = true;
      return false;
    }
    return true;
  });

  if (nonCodeNums.length === 0) return null;

  // ── The last "substantial" number is the amount (>= 0.01 NIS) ───────────
  const substantial = nonCodeNums.filter(({ val }) => val >= 0.01);
  if (substantial.length === 0) return null;

  const amountToken = substantial[substantial.length - 1];
  const amount = amountToken.val;
  const others  = substantial.slice(0, -1);
  const quantity = others.length > 0 ? others[0].val : undefined;
  const rate     = others.length > 1 ? others[1].val : undefined;

  // ── Extract Hebrew description ────────────────────────────────────────────
  // Remove all digit-sequences (including commas/dots in numbers), %, code
  let descRaw = clean
    .replace(/[\d,]+(?:\.\d+)?%?/g, ' ')
    .replace(/[^\u0590-\u05FF\s"'.,()\-א-ת]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!descRaw || descRaw.length < 2) return null;

  // Remove lone punctuation
  descRaw = descRaw.replace(/^[,.\-\s]+|[,.\-\s]+$/g, '').trim();
  if (!descRaw || descRaw.length < 2) return null;

  // Reject descriptions that look like org/city/personal names
  if (isNoiseDescription(descRaw)) return null;

  // Minimum confidence: line must have a valid code OR a known salary keyword
  if (!isValidPayslipCode(code) && !hasSalaryKeyword(descRaw)) return null;

  // ── Determine if deduction ────────────────────────────────────────────────
  const deductionByCode = isDeductionCode(code);
  const deductionByDesc = isDeductionDescription(descRaw);
  const isDeduction = deductionByCode || deductionByDesc;

  return {
    code,
    description: descRaw,
    quantity,
    rate,
    amount: isDeduction ? -Math.abs(amount) : amount,
    rawLine: line,
  };
}

// ---------------------------------------------------------------------------
// Step 3c: Extract all component rows from OCR text
// ---------------------------------------------------------------------------

export function extractComponentRows(rawText: string): ExtractedRow[] {
  const text = normalize(rawText);
  const lines = text.split('\n');
  const rows: ExtractedRow[] = [];

  // Track section context: once we see "ניכויים" header, mark deduction section
  let inDeductionSection = false;

  for (const line of lines) {
    const l = line.trim().toLowerCase();
    if (/^ניכויים/.test(l) || /ניכויי\s*חובה/.test(l)) {
      inDeductionSection = true;
    }
    if (/^תשלומים|^רכיבי\s*שכר/.test(l)) {
      inDeductionSection = false;
    }

    const row = parseLine(line);
    if (!row) continue;

    // If in deduction section and amount is positive, flip sign
    if (inDeductionSection && row.amount > 0) {
      rows.push({ ...row, amount: -row.amount });
    } else {
      rows.push(row);
    }
  }

  // Deduplicate: remove rows where description is extremely similar and amounts match
  const seen = new Set<string>();
  return rows.filter(r => {
    const key = `${r.description.slice(0, 8)}_${Math.abs(r.amount).toFixed(0)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ---------------------------------------------------------------------------
// Step 3d: Extract header summary fields
// ---------------------------------------------------------------------------

function scanLines(
  lines: string[],
  keywords: string[],
  validate: (n: number) => boolean,
  strategy: 'first' | 'largest' = 'largest',
): number | undefined {
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].toLowerCase();
    if (!keywords.some(kw => l.includes(kw.toLowerCase()))) continue;
    const nums = extractNums(lines[i]).filter(validate);
    if (nums.length === 0) continue;
    return strategy === 'largest' ? Math.max(...nums) : nums[0];
  }
  return undefined;
}

export function extractSummary(rawText: string): ExtractedSummary {
  const text = normalize(rawText);
  const lines = text.split('\n');
  const summary: ExtractedSummary = {};

  const creditPoints = scanLines(
    lines,
    ['נקודות זיכוי', 'נקודות מס', 'נ.ז', 'נ"ז', 'זיכוי נקודות'],
    n => n >= 0.5 && n <= 20,
    'first',
  );
  if (creditPoints) summary.creditPoints = creditPoints;

  // Pension %
  const pensionPctRx = text.match(
    /(?:פנסיה|קרן\s*פנסיה|ק\.\s*פנסיה|הפרשת\s*עובד|תגמולי\s*עובד)[^\n]{0,60}?(\d{1,2}(?:\.\d+)?)\s*%/i,
  );
  if (pensionPctRx) {
    const pct = parseFloat(pensionPctRx[1]);
    if (pct >= 0.5 && pct <= 20) summary.pensionContributionPct = pct;
  }

  // Net to bank
  const netToBank = scanLines(
    lines,
    ['נטו לבנק', 'נטו לתשלום', 'נטו'],
    n => n >= 100 && n <= 200000,
    'largest',
  );
  if (netToBank) summary.netToBank = netToBank;

  // Total payments
  const totalPay = scanLines(
    lines,
    ['סה"כ תשלומים', 'סך תשלומים', 'סה"כ שכר'],
    n => n >= 100 && n <= 200000,
    'largest',
  );
  if (totalPay) summary.totalPayments = totalPay;

  // Tax year / month (look for 4-digit year and 1-2 digit month)
  const yearMatch = text.match(/(?:שנת?\s*מס|שנה)\s*:?\s*(20\d{2})/i);
  if (yearMatch) summary.taxYear = parseInt(yearMatch[1], 10);

  const monthMatch = text.match(/(?:חודש|תקופה)\s*:?\s*(\d{1,2})\s*\/\s*(20\d{2})/i);
  if (monthMatch) {
    summary.taxMonth = parseInt(monthMatch[1], 10);
    if (!summary.taxYear) summary.taxYear = parseInt(monthMatch[2], 10);
  }

  return summary;
}

// ---------------------------------------------------------------------------
// Full pipeline
// ---------------------------------------------------------------------------
export async function extractFromFile(
  file: File,
  onProgress: OcrProgressCallback,
): Promise<{ text: string; rows: ExtractedRow[]; summary: ExtractedSummary }> {
  onProgress(0, 'מתחיל...');
  const text = await parseViaServer(file, onProgress);
  onProgress(87, 'מנתח שורות...');
  const rows = extractComponentRows(text);
  onProgress(94, 'מחלץ סיכומים...');
  const summary = extractSummary(text);
  onProgress(100, `הושלם — נמצאו ${rows.length} שורות`);
  return { text, rows, summary };
}
