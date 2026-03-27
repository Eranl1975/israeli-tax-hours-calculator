/**
 * LiteParse local API server
 *
 * Runs entirely on localhost (127.0.0.1) — no file data ever leaves this machine.
 *
 * Routing:
 *   PDF  → LiteParse  (PDF.js + optional Tesseract for scanned pages)
 *   Image (JPG/PNG/TIFF/WEBP) → Tesseract.js directly (no ImageMagick needed)
 *
 * Security measures:
 *  - Binds to 127.0.0.1 only (never 0.0.0.0)
 *  - CORS restricted to localhost origins
 *  - Only PDF and image MIME types accepted
 *  - Max upload size: 20 MB
 *  - Temp file always deleted after parsing (even on error)
 *  - No external network calls at any point
 */

import express from 'express';
import multer from 'multer';
import { LiteParse } from '@llamaindex/liteparse';
import { createWorker } from 'tesseract.js';
import { tmpdir } from 'os';
import { unlink, rename } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';

// ─── Config ──────────────────────────────────────────────────────────────────
const HOST = '127.0.0.1'; // localhost ONLY — never expose to the network
const PORT = 3001;
const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20 MB

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/tiff',
  'image/webp',
]);

const MIME_TO_EXT = {
  'application/pdf': '.pdf',
  'image/png':       '.png',
  'image/jpeg':      '.jpg',
  'image/jpg':       '.jpg',
  'image/tiff':      '.tiff',
  'image/webp':      '.webp',
};

const IMAGE_MIME_TYPES = new Set([
  'image/png', 'image/jpeg', 'image/jpg', 'image/tiff', 'image/webp',
]);

// ─── Express setup ───────────────────────────────────────────────────────────
const app = express();

// Restrict all requests to localhost origins only
app.use((req, res, next) => {
  const origin = req.headers.origin ?? '';
  const isLocalhost =
    !origin ||
    origin.startsWith('http://localhost') ||
    origin.startsWith('http://127.0.0.1');

  if (!isLocalhost) {
    res.status(403).json({ error: 'Forbidden: localhost only' });
    return;
  }

  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// Multer: store to OS temp dir, enforce size + type limits
const upload = multer({
  dest: tmpdir(),
  limits: { fileSize: MAX_FILE_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`סוג קובץ לא נתמך: ${file.mimetype}`));
    }
  },
});

// ─── OCR image via Tesseract.js (no ImageMagick required) ────────────────────
async function ocrImage(imagePath) {
  const worker = await createWorker('heb+eng', 1, {
    // Keep all processing local
    cachePath: join(tmpdir(), 'tesseract-cache'),
  });
  try {
    const { data } = await worker.recognize(imagePath);
    return data.text ?? '';
  } finally {
    await worker.terminate();
  }
}

// ─── Parse PDF via LiteParse ─────────────────────────────────────────────────
async function parsePdf(pdfPath) {
  const parser = new LiteParse({
    ocrEnabled: true,
    ocrLanguage: 'heb+eng',
  });
  const result = await parser.parse(pdfPath);
  return typeof result === 'string'
    ? result
    : (result.text ?? result.markdown ?? '');
}

// ─── Health check ────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', engine: 'liteparse+tesseract', local: true });
});

// ─── Parse endpoint ──────────────────────────────────────────────────────────
app.options('/api/parse', (_req, res) => res.sendStatus(200));

app.post('/api/parse', upload.single('file'), async (req, res) => {
  let tmpPath = req.file?.path;
  let renamedPath;

  try {
    if (!req.file) {
      res.status(400).json({ error: 'לא נשלח קובץ' });
      return;
    }

    // Give the temp file its correct extension so parsers can detect the type
    const ext = MIME_TO_EXT[req.file.mimetype] ?? '.bin';
    renamedPath = join(tmpdir(), `lp-${randomUUID()}${ext}`);
    await rename(tmpPath, renamedPath);
    tmpPath = null;

    let text;
    if (IMAGE_MIME_TYPES.has(req.file.mimetype)) {
      // Images: use Tesseract.js directly — no ImageMagick needed
      console.log(`[parse] image OCR → ${req.file.originalname}`);
      text = await ocrImage(renamedPath);
    } else {
      // PDF: use LiteParse (PDF.js + Tesseract for scanned pages)
      console.log(`[parse] PDF parse → ${req.file.originalname}`);
      text = await parsePdf(renamedPath);
    }

    res.json({ text });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[parse] error:', msg);
    res.status(500).json({ error: msg });
  } finally {
    if (tmpPath)     unlink(tmpPath).catch(() => {});
    if (renamedPath) unlink(renamedPath).catch(() => {});
  }
});

// ─── Error handler ───────────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error('[parse] unhandled error:', msg);
  res.status(400).json({ error: msg });
});

// ─── Start ───────────────────────────────────────────────────────────────────
app.listen(PORT, HOST, () => {
  console.log(`✓ Parse server  http://${HOST}:${PORT}`);
  console.log('  PDF → LiteParse | Images → Tesseract.js | 100% local');
});
