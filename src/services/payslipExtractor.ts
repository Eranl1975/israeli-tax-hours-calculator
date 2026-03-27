// ============================================================
// Payslip Extractor — powered by LiteParse (local server)
//
// Extracts ONLY two values from a payslip image/PDF:
//   1. gross (ברוטו) — from the "סך-הכל התשלומים" line
//   2. creditPoints  — from the "נקודות זיכוי" field
//
// All OCR runs locally on 127.0.0.1:3001.
// No data ever leaves this machine.
// ============================================================

export interface ExtractedData {
  gross?: number;        // סך-הכל התשלומים
  creditPoints?: number; // נקודות זיכוי
}

export type OcrProgressCallback = (pct: number, status: string) => void;

// ---------------------------------------------------------------------------
// Step 1: Upload file → local LiteParse/Tesseract server → raw text
// ---------------------------------------------------------------------------
async function parseViaServer(
  file: File,
  onProgress: OcrProgressCallback,
): Promise<string> {
  onProgress(10, 'שולח קובץ לשרת מקומי...');
  const formData = new FormData();
  formData.append('file', file);

  let response: Response;
  try {
    response = await fetch('/api/parse', { method: 'POST', body: formData });
  } catch {
    throw new Error('שרת הניתוח אינו זמין — הרץ: npm run dev');
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
    throw new Error(`שגיאת ניתוח: ${body.error ?? response.statusText}`);
  }

  onProgress(80, 'מנתח טקסט...');
  const { text } = (await response.json()) as { text: string };
  return text ?? '';
}

// ---------------------------------------------------------------------------
// Step 2: Extract the two values from raw OCR text
// ---------------------------------------------------------------------------

function normalize(s: string): string {
  return s
    .replace(/[""״]/g, '"')
    .replace(/['׳]/g, "'")
    .replace(/\r\n|\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/[\u200f\u200e\u202a-\u202e]/g, '');
}

/** Parse a number from a string — handles 1,234 and 1.234 formats */
function parseNum(s: string): number {
  return parseFloat(s.replace(/,/g, ''));
}

/** All numeric tokens in a string (ignoring % tokens) */
function allNums(s: string): number[] {
  const noPct = s.replace(/\d+\.?\d*\s*%/g, ' ');
  return (noPct.match(/[\d,]+(?:\.\d+)?/g) ?? [])
    .map(m => parseNum(m))
    .filter(n => !isNaN(n) && n > 0);
}

/**
 * Extract gross (ברוטו לתשלום) from the "סך-הכל התשלומים" line.
 * Looks for several spellings that appear on Israeli payslips.
 */
function extractGross(text: string): number | undefined {
  const lines = text.split('\n');
  const GROSS_PATTERNS = [
    /סה[""']?כ\s*תשלומים/,
    /סך.{0,6}הכל.{0,6}תשלומים/,
    /סה[""']?כ\s*שכר/,
    /ברוטו\s*לתשלום/,
    /שכר\s*ברוטו/,
    /סה[""']?כ\s*לתשלום/,
    /סך\s*הכל\s*לתשלום/,
    /סה[""']?כ\s*ברוטו/,
  ];

  for (const line of lines) {
    const l = line.trim();
    if (!l) continue;
    if (GROSS_PATTERNS.some(rx => rx.test(l))) {
      const nums = allNums(l).filter(n => n >= 1000 && n <= 200_000);
      if (nums.length > 0) return Math.max(...nums);
    }
  }
  return undefined;
}

/**
 * Extract credit points from "נקודות זיכוי" field.
 */
function extractCreditPoints(text: string): number | undefined {
  const lines = text.split('\n');
  const CP_PATTERNS = [
    /נקודות\s*זיכוי/,
    /נקודות\s*מס/,
    /נ[""']?ז\b/,
    /זיכוי\s*נקודות/,
  ];

  for (const line of lines) {
    const l = line.trim();
    if (!l) continue;
    if (CP_PATTERNS.some(rx => rx.test(l))) {
      const nums = allNums(l).filter(n => n >= 0.5 && n <= 20);
      if (nums.length > 0) return nums[0];
    }
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Full pipeline
// ---------------------------------------------------------------------------
export async function extractFromFile(
  file: File,
  onProgress: OcrProgressCallback,
): Promise<ExtractedData> {
  onProgress(0, 'מתחיל...');
  const raw  = await parseViaServer(file, onProgress);
  const text = normalize(raw);

  onProgress(90, 'מחלץ נתונים...');
  const gross        = extractGross(text);
  const creditPoints = extractCreditPoints(text);

  onProgress(100, gross !== undefined ? `ברוטו: ₪${gross.toLocaleString()}` : 'הושלם — לא נמצאה שורת סך-הכל');
  return { gross, creditPoints };
}
