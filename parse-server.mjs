/**
 * LiteParse local API server
 *
 * Runs entirely on localhost (127.0.0.1) — no file data ever leaves this machine.
 * Accepts payslip uploads (PDF / PNG / JPG), parses them with LiteParse (local OCR),
 * and returns the extracted text to the React frontend.
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
import { tmpdir } from 'os';
import { unlink, rename } from 'fs/promises';
import { join, extname } from 'path';
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
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/tiff': '.tiff',
  'image/webp': '.webp',
};

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

// ─── Health check ────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', engine: 'liteparse', local: true });
});

// ─── Parse endpoint ──────────────────────────────────────────────────────────
app.options('/api/parse', (_req, res) => res.sendStatus(200));

app.post('/api/parse', upload.single('file'), async (req, res) => {
  // multer stores the file at req.file.path WITHOUT the correct extension.
  // LiteParse detects format by extension, so we rename it first.
  let tmpPath = req.file?.path;
  let renamedPath;

  try {
    if (!req.file) {
      res.status(400).json({ error: 'לא נשלח קובץ' });
      return;
    }

    // Give the temp file its correct extension so LiteParse can detect the type
    const ext = MIME_TO_EXT[req.file.mimetype] ?? '.bin';
    renamedPath = join(tmpdir(), `lp-${randomUUID()}${ext}`);
    await rename(tmpPath, renamedPath);
    tmpPath = null; // original path no longer valid

    const parser = new LiteParse({
      ocrEnabled: true,
      ocrLanguage: 'heb+eng', // Hebrew + English — no data sent externally
    });

    const result = await parser.parse(renamedPath);
    const text = typeof result === 'string' ? result : (result.text ?? result.markdown ?? '');

    res.json({ text, pages: result.pages ?? 1 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[LiteParse] Parse error:', msg);
    res.status(500).json({ error: msg });
  } finally {
    // Always delete temp files — even on error
    if (tmpPath)     unlink(tmpPath).catch(() => {});
    if (renamedPath) unlink(renamedPath).catch(() => {});
  }
});

// ─── Error handler ───────────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error('[LiteParse] Unhandled error:', msg);
  res.status(400).json({ error: msg });
});

// ─── Start ───────────────────────────────────────────────────────────────────
app.listen(PORT, HOST, () => {
  console.log(`✓ LiteParse server  http://${HOST}:${PORT}`);
  console.log('  כל העיבוד מתבצע מקומית — אין שידור נתונים לשום שרת חיצוני.');
});
