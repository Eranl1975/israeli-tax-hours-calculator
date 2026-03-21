// ============================================================
// Payslip OCR Extractor
// Converts an uploaded image or PDF to text using Tesseract.js,
// then parses the component table row-by-row.
// Runs entirely in the browser — no API key required.
// ============================================================

import Tesseract from 'tesseract.js';
import * as pdfjsLib from 'pdfjs-dist';
import { isDeductionCode } from './componentClassifier';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

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
// Step 1: File → image data URL
// ---------------------------------------------------------------------------
export async function fileToImageDataUrl(
  file: File,
  onProgress: OcrProgressCallback,
): Promise<string> {
  if (file.type === 'application/pdf') {
    onProgress(5, 'טוען PDF...');
    return pdfFirstPageToDataUrl(file);
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function pdfFirstPageToDataUrl(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 2.5 }); // higher scale = better OCR
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d')!;
  await page.render({ canvasContext: ctx, viewport, canvas }).promise;
  return canvas.toDataURL('image/png');
}

// ---------------------------------------------------------------------------
// Step 2: OCR
// ---------------------------------------------------------------------------
export async function runOcr(
  imageDataUrl: string,
  onProgress: OcrProgressCallback,
): Promise<string> {
  const result = await Tesseract.recognize(imageDataUrl, 'heb+eng', {
    logger: m => {
      if (m.status === 'recognizing text') {
        onProgress(
          15 + Math.round(m.progress * 70),
          `מזהה טקסט... ${Math.round(m.progress * 100)}%`,
        );
      }
    },
  });
  return result.data.text;
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

function isSkipLine(line: string): boolean {
  const l = line.trim();
  return l.length < 3 || SKIP_LINE_PATTERNS.some(rx => rx.test(l));
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
  const imageDataUrl = await fileToImageDataUrl(file, onProgress);
  onProgress(12, 'מריץ זיהוי טקסט...');
  const text = await runOcr(imageDataUrl, onProgress);
  onProgress(87, 'מנתח שורות...');
  const rows = extractComponentRows(text);
  onProgress(94, 'מחלץ סיכומים...');
  const summary = extractSummary(text);
  onProgress(100, `הושלם — נמצאו ${rows.length} שורות`);
  return { text, rows, summary };
}
