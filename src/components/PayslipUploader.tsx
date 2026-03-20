import { useState, useRef, useCallback } from 'react';
import type { ExtractedPayslipData } from '../services/payslipExtractor';
import { extractFromFile } from '../services/payslipExtractor';

interface Props {
  onApply: (data: ExtractedPayslipData) => void;
}

const FIELD_LABELS: Record<keyof ExtractedPayslipData, string> = {
  baseMonthlyGross: 'שכר ברוטו חודשי (₪)',
  plannedMonthlyHours: 'שעות עבודה בחודש',
  workdaysInMonth: 'ימי עבודה',
  creditPoints: 'נקודות זיכוי',
  pensionContributionPct: 'הפרשה לפנסיה (%)',
  overtimeIncome: 'שעות נוספות (₪)',
  bonusIncome: 'בונוס/פרמיה (₪)',
  additionalTaxableMonthly: 'הכנסה נוספת חייבת (₪)',
  secondEmployerIncome: 'הכנסה ממעסיק שני (₪)',
};

const ACCEPT = '.jpg,.jpeg,.png,.webp,.pdf';

type Status = 'idle' | 'loading' | 'done' | 'error';

export function PayslipUploader({ onApply }: Props) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isPdf, setIsPdf] = useState(false);
  const [status, setStatus] = useState<Status>('idle');
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState('');
  const [extracted, setExtracted] = useState<ExtractedPayslipData | null>(null);
  const [rawText, setRawText] = useState('');
  const [showRaw, setShowRaw] = useState(false);
  const [editedData, setEditedData] = useState<ExtractedPayslipData>({});
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((f: File) => {
    const ok = /\.(jpe?g|png|webp|pdf)$/i.test(f.name);
    if (!ok) {
      setError('פורמט לא נתמך. יש להעלות JPG, PNG, WEBP או PDF.');
      return;
    }
    if (f.size > 20 * 1024 * 1024) {
      setError('הקובץ גדול מדי (מקסימום 20MB).');
      return;
    }
    setError('');
    setFile(f);
    setStatus('idle');
    setExtracted(null);
    setEditedData({});
    setRawText('');
    setIsPdf(f.type === 'application/pdf');
    if (f.type !== 'application/pdf') {
      const url = URL.createObjectURL(f);
      setPreview(url);
    } else {
      setPreview(null);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const f = e.dataTransfer.files[0];
      if (f) handleFile(f);
    },
    [handleFile],
  );

  async function handleExtract() {
    if (!file) return;
    setStatus('loading');
    setProgress(0);
    setError('');
    try {
      const { text, data } = await extractFromFile(file, (pct, label) => {
        setProgress(pct);
        setProgressLabel(label);
      });
      setRawText(text);
      setExtracted(data);
      setEditedData(data);
      setStatus('done');
    } catch (e) {
      console.error(e);
      setError('שגיאה בזיהוי הטקסט. נסה תמונה ברורה יותר.');
      setStatus('error');
    }
  }

  function handleApply() {
    // Filter out undefined/NaN values before applying
    const clean: ExtractedPayslipData = {};
    for (const key of Object.keys(editedData) as (keyof ExtractedPayslipData)[]) {
      const v = editedData[key];
      if (v !== undefined && !isNaN(v as number)) {
        (clean as Record<string, number>)[key] = v as number;
      }
    }
    onApply(clean);
    setOpen(false);
  }

  const foundCount = extracted ? Object.keys(extracted).length : 0;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      {/* Accordion header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 text-right hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">📄</span>
          <span className="font-semibold text-gray-800 text-sm">העלאת תלוש שכר — מילוי אוטומטי</span>
          {foundCount > 0 && (
            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
              {foundCount} שדות זוהו
            </span>
          )}
        </div>
        <span className="text-gray-400 text-sm">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="px-5 pb-5 border-t border-gray-100">
          <p className="text-xs text-gray-400 mt-3 mb-4 leading-relaxed">
            העלה תלוש שכר (תמונה או PDF) — המערכת תזהה את הטקסט ותמלא את השדות הרלוונטיים אוטומטית.
            הדיוק תלוי באיכות הסריקה. <strong>תמיד בדוק את הנתונים לפני החישוב.</strong>
          </p>

          {/* Drop zone */}
          <div
            onDrop={handleDrop}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onClick={() => inputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
              dragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
            }`}
          >
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPT}
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />
            {file ? (
              <div className="flex flex-col items-center gap-2">
                {preview && !isPdf ? (
                  <img src={preview} alt="תצוגה מקדימה" className="max-h-32 rounded-lg object-contain border border-gray-200" />
                ) : (
                  <div className="text-4xl">📑</div>
                )}
                <p className="text-sm font-medium text-gray-700">{file.name}</p>
                <p className="text-xs text-gray-400">{(file.size / 1024).toFixed(0)} KB — לחץ להחלפה</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 text-gray-400">
                <span className="text-3xl">⬆️</span>
                <p className="text-sm">גרור קובץ לכאן או לחץ לבחירה</p>
                <p className="text-xs">JPG, PNG, WEBP, PDF — עד 20MB</p>
              </div>
            )}
          </div>

          {error && <p className="text-xs text-red-500 mt-2">{error}</p>}

          {/* Extract button */}
          {file && status !== 'loading' && (
            <button
              onClick={handleExtract}
              className="mt-3 w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl py-2.5 text-sm transition-colors"
            >
              🔍 חלץ נתונים
            </button>
          )}

          {/* Progress */}
          {status === 'loading' && (
            <div className="mt-4">
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>{progressLabel}</span>
                <span>{progress}%</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-gray-400 mt-2 text-center">
                זיהוי OCR עשוי לקחת 10–30 שניות...
              </p>
            </div>
          )}

          {/* Results */}
          {status === 'done' && extracted && (
            <div className="mt-4">
              {foundCount === 0 ? (
                <div className="text-sm text-amber-600 bg-amber-50 rounded-xl p-3">
                  לא זוהו נתונים מוכרים. ייתכן שהתמונה לא ברורה מספיק, או שהתלוש אינו בפורמט סטנדרטי.
                </div>
              ) : (
                <>
                  <p className="text-xs font-semibold text-gray-600 mb-2">
                    זוהו {foundCount} שדות — ניתן לערוך לפני ההחלה:
                  </p>
                  <div className="flex flex-col gap-2">
                    {(Object.keys(extracted) as (keyof ExtractedPayslipData)[]).map(key => (
                      <div key={key} className="flex items-center justify-between gap-3 bg-gray-50 rounded-lg px-3 py-2">
                        <label className="text-xs text-gray-600 flex-1">{FIELD_LABELS[key]}</label>
                        <input
                          type="number"
                          value={editedData[key] ?? ''}
                          onChange={e => setEditedData(prev => ({ ...prev, [key]: parseFloat(e.target.value) || 0 }))}
                          className="w-28 border border-gray-300 rounded-lg px-2 py-1 text-sm text-left focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        />
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={handleApply}
                    className="mt-3 w-full bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl py-2.5 text-sm transition-colors"
                  >
                    ✓ החל על המחשבון
                  </button>
                </>
              )}

              {/* Raw text toggle */}
              <button
                onClick={() => setShowRaw(s => !s)}
                className="mt-3 text-xs text-gray-400 hover:text-gray-600 underline"
              >
                {showRaw ? 'הסתר' : 'הצג'} טקסט גולמי שזוהה
              </button>
              {showRaw && (
                <pre className="mt-2 text-xs bg-gray-50 border border-gray-200 rounded-lg p-3 max-h-40 overflow-auto whitespace-pre-wrap text-gray-500 text-right">
                  {rawText || '(לא זוהה טקסט)'}
                </pre>
              )}
            </div>
          )}

          {status === 'error' && !error && (
            <p className="text-xs text-red-500 mt-2">שגיאה בעיבוד הקובץ. נסה שוב.</p>
          )}
        </div>
      )}
    </div>
  );
}
