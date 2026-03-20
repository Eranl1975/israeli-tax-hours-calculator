// ============================================================
// Payslip OCR Extractor
// Converts an uploaded image or PDF to text using Tesseract.js,
// then parses Hebrew/numeric patterns to extract salary fields.
// Runs entirely in the browser — no API key required.
// ============================================================

import Tesseract from 'tesseract.js';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

export interface ExtractedPayslipData {
  baseMonthlyGross?: number;
  plannedMonthlyHours?: number;
  workdaysInMonth?: number;
  creditPoints?: number;
  pensionContributionPct?: number;
  overtimeIncome?: number;
  bonusIncome?: number;
  additionalTaxableMonthly?: number;
  secondEmployerIncome?: number;
}

export type OcrProgressCallback = (pct: number, status: string) => void;

// ---------------------------------------------------------------------------
// Step 1: File → image data URL
// ---------------------------------------------------------------------------
export async function fileToImageDataUrl(file: File, onProgress: OcrProgressCallback): Promise<string> {
  if (file.type === 'application/pdf') {
    onProgress(5, 'טוען PDF...');
    return await pdfFirstPageToDataUrl(file);
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
  const viewport = page.getViewport({ scale: 2.0 });
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
export async function runOcr(imageDataUrl: string, onProgress: OcrProgressCallback): Promise<string> {
  const result = await Tesseract.recognize(imageDataUrl, 'heb+eng', {
    logger: m => {
      if (m.status === 'recognizing text') {
        onProgress(10 + Math.round(m.progress * 80), `מזהה טקסט... ${Math.round(m.progress * 100)}%`);
      }
    },
  });
  return result.data.text;
}

// ---------------------------------------------------------------------------
// Step 3: Flexible line-by-line parser
// ---------------------------------------------------------------------------

function cleanNum(s: string): number {
  return parseFloat(s.replace(/,/g, '').replace(/\.(\d{3})/g, '$1'));
}

/** Extract all numbers from a string, return largest or first depending on context */
function extractNumbers(s: string): number[] {
  const matches = s.match(/[\d,]+(?:\.\d+)?/g) ?? [];
  return matches.map(m => cleanNum(m)).filter(n => !isNaN(n) && n >= 0);
}

/** Find the first number in string that passes the validator */
function firstValid(s: string, validate: (n: number) => boolean): number | undefined {
  for (const n of extractNumbers(s)) {
    if (validate(n)) return n;
  }
  return undefined;
}

/** Find the largest number in string that passes the validator */
function largestValid(s: string, validate: (n: number) => boolean): number | undefined {
  const valid = extractNumbers(s).filter(validate);
  return valid.length > 0 ? Math.max(...valid) : undefined;
}

// ---- Label keyword banks ----
// Each bank lists all Hebrew synonyms / abbreviations for a field.
// The parser scans each line: if any keyword matches, it extracts the number
// from that line (or the next line if current line has no suitable number).

const SALARY_KEYWORDS = [
  // Standard labels
  'שכר יסוד', 'שכר בסיס', 'שכר בסיסי', 'שכר ברוטו', 'שכר חודשי',
  'שי', 'ש.י', 'ש"י', 'שכ.י', 'שכ"י',
  'משכורת יסוד', 'משכורת בסיס', 'משכורת ברוטו', 'משכורת',
  'ברוטו לחישוב', 'ברוטו ל.ב.ה', 'שכר (ב)',
  'קצובת שכר', 'שכר קבוע',
];

const HOURS_KEYWORDS = [
  'ס"ה שעות', 'סה"כ שעות', 'ס.ה שעות', 'סהכ שעות',
  'שעות עבודה', 'שעות רגילות', 'שעות חודש', 'שע. עבודה',
  'שעות נוכחות', 'שע\'ות', 'שע רגילות', 'שע.ר',
  'כמות שעות', 'מס. שעות', 'מספר שעות',
];

const DAYS_KEYWORDS = [
  'ימי עבודה', 'ימי נוכחות', 'ימי חודש', 'מס. ימים', 'מספר ימים',
  'י. עבודה', 'י.ע', 'יע ', 'ימים ',
];

const CREDIT_KEYWORDS = [
  'נקודות זיכוי', 'נקודות מס', 'נ.ז', 'נ"ז', 'זיכוי נקודות',
  'נקודות (מס)', 'נקודות ז.',
];

const OVERTIME_KEYWORDS = [
  'שעות נוספות', 'שע. נוספות', 'שעות נוסף', 'גמול שע. נוספות',
  'גמול שעות נוספות', 'שע"נ', 'שעות נ.',
  'תוספת שעות נוספות', 'ש.נ',
];

const BONUS_KEYWORDS = [
  'בונוס', 'פרמיה', 'מענק', 'תגמול', 'מענק מיוחד',
  'פרמיית ביצועים', 'בונוס חודשי', 'גמול',
];

const PENSION_KEYWORDS = [
  'פנסיה', 'קרן פנסיה', 'ק. פנסיה', 'קה"ש עובד', 'קופת גמל עובד',
  'פנסיה עובד', 'הפרשת עובד', 'תגמולי עובד',
];

function normalize(s: string): string {
  return s
    .replace(/[""״]/g, '"')
    .replace(/['׳]/g, "'")
    .replace(/\r\n|\r/g, '\n')
    .replace(/[ \t]+/g, ' ');
}

function lineContainsAny(line: string, keywords: readonly string[]): boolean {
  const l = line.toLowerCase();
  return keywords.some(kw => l.includes(kw.toLowerCase()));
}

/**
 * Scan lines for a field. When a line matches a keyword, extract a number from
 * that line or the next non-empty line (handles label-on-one-line, value-on-next).
 * Also handles reversed layout: number first, then label on same line.
 */
function scanLines(
  lines: string[],
  keywords: string[],
  validate: (n: number) => boolean,
  strategy: 'first' | 'largest' = 'largest',
): number | undefined {
  for (let i = 0; i < lines.length; i++) {
    if (!lineContainsAny(lines[i], keywords)) continue;
    // Try current line
    const pick = strategy === 'largest' ? largestValid : firstValid;
    let val = pick(lines[i], validate);
    if (val !== undefined) return val;
    // Try next non-empty line
    for (let j = i + 1; j < Math.min(i + 3, lines.length); j++) {
      if (lines[j].trim() === '') continue;
      val = pick(lines[j], validate);
      if (val !== undefined) return val;
      break;
    }
  }
  return undefined;
}

export function parsePayslipText(rawText: string): ExtractedPayslipData {
  const t = normalize(rawText);
  const lines = t.split('\n');
  const data: ExtractedPayslipData = {};

  // Base monthly gross — must be >= 1,000 NIS and <= 200,000
  const gross = scanLines(lines, SALARY_KEYWORDS, n => n >= 1000 && n <= 200000, 'largest');
  if (gross) data.baseMonthlyGross = gross;

  // Hours — 1–400
  const hours = scanLines(lines, HOURS_KEYWORDS, n => n >= 1 && n <= 400, 'first');
  if (hours) data.plannedMonthlyHours = hours;

  // Work days — 1–31
  const days = scanLines(lines, DAYS_KEYWORDS, n => n >= 1 && n <= 31, 'first');
  if (days) data.workdaysInMonth = days;

  // Credit points — 0.5–20
  const credits = scanLines(lines, CREDIT_KEYWORDS, n => n >= 0.5 && n <= 20, 'first');
  if (credits) data.creditPoints = credits;

  // Overtime income (NIS amount, not hours) — >= 100
  const overtime = scanLines(lines, OVERTIME_KEYWORDS, n => n >= 100 && n <= 100000, 'largest');
  if (overtime) data.overtimeIncome = overtime;

  // Bonus — >= 100
  const bonus = scanLines(lines, BONUS_KEYWORDS, n => n >= 100 && n <= 200000, 'largest');
  if (bonus) data.bonusIncome = bonus;

  // Pension % — look for a percentage sign near pension keywords
  // Try special pension % regex first (most reliable)
  const pensionPctRx = t.match(
    /(?:פנסיה|קרן\s*פנסיה|ק\.\s*פנסיה|הפרשת\s*עובד|תגמולי\s*עובד)[^\n]{0,60}?(\d{1,2}(?:\.\d+)?)\s*%/i,
  );
  if (pensionPctRx) {
    const pct = parseFloat(pensionPctRx[1]);
    if (pct >= 0.5 && pct <= 20) data.pensionContributionPct = pct;
  } else {
    // Fallback: scan pension lines for small numbers (2–20) assuming it's a %
    const pensionLine = lines.find(l => lineContainsAny(l, PENSION_KEYWORDS));
    if (pensionLine) {
      const pct = firstValid(pensionLine, n => n >= 2 && n <= 20);
      if (pct) data.pensionContributionPct = pct;
    }
  }

  return data;
}

// ---------------------------------------------------------------------------
// Full pipeline
// ---------------------------------------------------------------------------
export async function extractFromFile(
  file: File,
  onProgress: OcrProgressCallback,
): Promise<{ text: string; data: ExtractedPayslipData }> {
  onProgress(0, 'מתחיל...');
  const imageDataUrl = await fileToImageDataUrl(file, onProgress);
  onProgress(10, 'מריץ זיהוי טקסט...');
  const text = await runOcr(imageDataUrl, onProgress);
  onProgress(92, 'מנתח נתונים...');
  const data = parsePayslipText(text);
  onProgress(100, 'הושלם');
  return { text, data };
}
