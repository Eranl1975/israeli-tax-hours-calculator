// ============================================================
// Payslip OCR Extractor
// Converts an uploaded image or PDF to text using Tesseract.js,
// then parses Hebrew/numeric patterns to extract salary fields.
// Runs entirely in the browser — no API key required.
// ============================================================

import Tesseract from 'tesseract.js';
import * as pdfjsLib from 'pdfjs-dist';

// Configure the pdfjs worker (Vite resolves this at build time)
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
export async function fileToImageDataUrl(
  file: File,
  onProgress: OcrProgressCallback,
): Promise<string> {
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

  // Scale 2.0 for better OCR quality
  const viewport = page.getViewport({ scale: 2.0 });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;

  const ctx = canvas.getContext('2d')!;
  await page.render({ canvasContext: ctx, viewport, canvas }).promise;

  return canvas.toDataURL('image/png');
}

// ---------------------------------------------------------------------------
// Step 2: Image → OCR text via Tesseract
// ---------------------------------------------------------------------------
export async function runOcr(
  imageDataUrl: string,
  onProgress: OcrProgressCallback,
): Promise<string> {
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
// Step 3: Text → ExtractedPayslipData via regex
// ---------------------------------------------------------------------------

/**
 * Remove commas from number strings and parse to float.
 */
function cleanNum(s: string): number {
  return parseFloat(s.replace(/,/g, ''));
}

/**
 * Search for a numeric value near a Hebrew label pattern.
 * Tries each pattern in order; returns the first match.
 */
function findValue(text: string, patterns: RegExp[]): number | undefined {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const raw = match[match.length - 1]; // last capture group
      const n = cleanNum(raw);
      if (!isNaN(n) && n > 0) return n;
    }
  }
  return undefined;
}

export function parsePayslipText(text: string): ExtractedPayslipData {
  // Normalize: collapse multiple spaces, unify quote chars
  const t = text
    .replace(/[""״]/g, '"')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ');

  const data: ExtractedPayslipData = {};

  // Base monthly gross — שכר יסוד / שכר בסיס / שכר ברוטו
  const baseGross = findValue(t, [
    /שכר\s*(יסוד|בסיס|בסיסי)\s*[:\-]?\s*([\d,]+)/i,
    /שכר\s*ברוטו\s*[:\-]?\s*([\d,]+)/i,
    /משכורת\s*[:\-]?\s*([\d,]+)/i,
    /ברוטו\s*[:\-]?\s*([\d,]+)/i,
  ]);
  if (baseGross && baseGross >= 1000) data.baseMonthlyGross = baseGross;

  // Planned monthly hours — ס"ה שעות / שעות עבודה
  const hours = findValue(t, [
    /ס["']?ה\s*שעות\s*[:\-]?\s*([\d.]+)/i,
    /שעות\s*(עבודה|חודש)\s*[:\-]?\s*([\d.]+)/i,
    /סה["']כ\s*שעות\s*[:\-]?\s*([\d.]+)/i,
  ]);
  if (hours && hours >= 1 && hours <= 400) data.plannedMonthlyHours = hours;

  // Workdays — ימי עבודה / ימי נוכחות
  const days = findValue(t, [
    /ימי?\s*(עבודה|נוכחות|חודש)\s*[:\-]?\s*(\d{1,2})/i,
    /ימים\s*[:\-]?\s*(\d{1,2})/i,
  ]);
  if (days && days >= 1 && days <= 31) data.workdaysInMonth = days;

  // Credit points — נקודות זיכוי
  const credits = findValue(t, [
    /נקודות?\s*זיכוי\s*[:\-]?\s*([\d.]+)/i,
    /זיכוי\s*נקודות?\s*[:\-]?\s*([\d.]+)/i,
  ]);
  if (credits && credits >= 0.5 && credits <= 20) data.creditPoints = credits;

  // Pension contribution % — פנסיה / קרן פנסיה (employee %)
  const pensionPctMatch = t.match(/(?:פנסיה|קרן\s*פנסיה)[^\n]{0,40}?(\d{1,2}(?:\.\d+)?)\s*%/i);
  if (pensionPctMatch) {
    const pct = parseFloat(pensionPctMatch[1]);
    if (pct >= 0.5 && pct <= 20) data.pensionContributionPct = pct;
  }

  // Overtime income — שעות נוספות (as NIS amount, not hours)
  const overtime = findValue(t, [
    /שעות\s*נוספות\s*(?:[\d.]+\s*שע[^\n]{0,10})?\s*([\d,]+)/i,
    /גמול\s*שעות\s*נוספות\s*[:\-]?\s*([\d,]+)/i,
  ]);
  if (overtime && overtime >= 100) data.overtimeIncome = overtime;

  // Bonus — בונוס / פרמיה / מענק
  const bonus = findValue(t, [
    /(?:בונוס|פרמיה|מענק)\s*[:\-]?\s*([\d,]+)/i,
  ]);
  if (bonus && bonus >= 100) data.bonusIncome = bonus;

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
