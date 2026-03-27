import { useState, useRef, useCallback } from 'react';
import type { UploadedFile } from '../models/types';
import type { PayslipComponent } from '../models/types';
import type { ExtractedRow, ExtractedSummary } from '../services/payslipExtractor';
import { extractFromFile } from '../services/payslipExtractor';
import { createComponent } from '../services/componentClassifier';
import { formatILS } from '../utils/currency';

interface Props {
  onImport: (components: PayslipComponent[], summary: ExtractedSummary) => void;
}

// Extend UploadedFile state to track extraction results
interface UploadedFileState extends UploadedFile {
  progress?: number;
  progressStatus?: string;
  extractedRows?: ExtractedRow[];
  summary?: ExtractedSummary;
}

function ProgressBar({ pct }: { pct: number }) {
  return (
    <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden mt-1">
      <div
        className="h-1.5 bg-blue-500 rounded-full transition-all duration-150"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function RowsPreview({ rows }: { rows: ExtractedRow[] }) {
  const payments   = rows.filter(r => r.amount > 0);
  const deductions = rows.filter(r => r.amount < 0);
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="mt-2 border border-green-200 rounded-lg overflow-hidden text-xs">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex justify-between items-center px-3 py-2 bg-green-50 hover:bg-green-100 text-green-800 font-semibold"
      >
        <span>✓ {rows.length} שורות ({payments.length} תשלומים | {deductions.length} ניכויים)</span>
        <span>{expanded ? '▲' : '▼'}</span>
      </button>
      {expanded && (
        <div className="max-h-48 overflow-y-auto bg-white">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 text-gray-500 sticky top-0">
              <tr>
                <th className="px-2 py-1 text-right w-12">סמל</th>
                <th className="px-2 py-1 text-right">סכום</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className={`border-t border-gray-50 ${r.amount < 0 ? 'text-red-700' : 'text-gray-800'}`}>
                  <td className="px-2 py-0.5 text-gray-400 font-mono">{r.code ?? '—'}</td>
                  <td className="px-2 py-0.5 text-right font-medium">{formatILS(r.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function FileCard({
  uf,
  onRemove,
  onProcess,
  onApply,
}: {
  uf: UploadedFileState;
  onRemove: () => void;
  onProcess: (id: string) => void;
  onApply: (id: string) => void;
}) {
  return (
    <div className={`relative rounded-xl border p-3 text-xs flex gap-3 items-start ${
      uf.status === 'error'      ? 'border-red-200 bg-red-50' :
      uf.status === 'done'       ? 'border-green-200 bg-green-50' :
      uf.status === 'processing' ? 'border-blue-200 bg-blue-50' :
                                   'border-gray-200 bg-white'
    }`}>
      {/* Thumbnail / icon */}
      {uf.preview ? (
        <img src={uf.preview} alt="" className="w-12 h-16 object-cover rounded border border-gray-200 flex-shrink-0" />
      ) : (
        <div className="w-12 h-16 flex items-center justify-center bg-gray-100 rounded border border-gray-200 flex-shrink-0 text-2xl">
          📄
        </div>
      )}

      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-800 truncate">{uf.file.name}</p>
        <p className="text-gray-400">{(uf.file.size / 1024).toFixed(1)} KB</p>

        {uf.status === 'pending' && (
          <button
            onClick={() => onProcess(uf.id)}
            className="mt-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-3 py-1 text-xs font-semibold"
          >
            חלץ נתונים
          </button>
        )}

        {uf.status === 'processing' && (
          <div className="mt-2">
            <p className="text-blue-700">{uf.progressStatus ?? 'מעבד...'}</p>
            <ProgressBar pct={uf.progress ?? 10} />
          </div>
        )}

        {uf.status === 'done' && uf.extractedRows && (
          <div>
            <RowsPreview rows={uf.extractedRows} />
            {uf.extractedRows.length > 0 && (
              <button
                onClick={() => onApply(uf.id)}
                className="mt-2 w-full bg-green-600 hover:bg-green-700 text-white rounded-lg px-3 py-1.5 text-xs font-semibold"
              >
                ← הכנס לטבלה ({uf.extractedRows.length} שורות)
              </button>
            )}
            {uf.extractedRows.length === 0 && (
              <p className="mt-1 text-amber-700">לא זוהו שורות — בדוק את איכות הצילום</p>
            )}
          </div>
        )}

        {uf.status === 'error' && (
          <p className="text-red-600 mt-1">{uf.errorMessage ?? 'שגיאה בעיבוד'}</p>
        )}
      </div>

      <button
        onClick={onRemove}
        className="text-gray-300 hover:text-red-500 font-bold text-lg leading-none flex-shrink-0"
        title="הסר קובץ"
      >
        ✕
      </button>
    </div>
  );
}

export function FileUploadPanel({ onImport }: Props) {
  const [files, setFiles] = useState<UploadedFileState[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function addFiles(fileList: FileList) {
    const newFiles: UploadedFileState[] = Array.from(fileList).map(file => ({
      id: crypto.randomUUID(),
      file,
      isPdf: file.type === 'application/pdf',
      status: 'pending',
      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
    }));
    setFiles(prev => [...prev, ...newFiles]);
  }

  function removeFile(id: string) {
    setFiles(prev => {
      const uf = prev.find(f => f.id === id);
      if (uf?.preview) URL.revokeObjectURL(uf.preview);
      return prev.filter(f => f.id !== id);
    });
  }

  async function processFile(id: string) {
    const uf = files.find(f => f.id === id);
    if (!uf) return;

    setFiles(prev => prev.map(f =>
      f.id === id ? { ...f, status: 'processing', progress: 0, progressStatus: 'מתחיל...' } : f,
    ));

    try {
      const { rows, summary } = await extractFromFile(uf.file, (pct, status) => {
        setFiles(prev => prev.map(f =>
          f.id === id ? { ...f, progress: pct, progressStatus: status } : f,
        ));
      });

      setFiles(prev => prev.map(f =>
        f.id === id
          ? { ...f, status: 'done', extractedRows: rows, summary, progress: 100 }
          : f,
      ));
    } catch (err) {
      setFiles(prev => prev.map(f =>
        f.id === id ? { ...f, status: 'error', errorMessage: String(err) } : f,
      ));
    }
  }

  function applyFile(id: string) {
    const uf = files.find(f => f.id === id);
    if (!uf?.extractedRows) return;

    const comps: PayslipComponent[] = uf.extractedRows.map(row =>
      createComponent(row.description, row.amount, 'ocr', {
        ...(row.code ? { code: row.code } : {}),
        ...(row.quantity !== undefined ? { quantity: row.quantity } : {}),
        ...(row.rate !== undefined ? { rate: row.rate } : {}),
      }),
    );

    onImport(comps, uf.summary ?? {});
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files);
  }, []);

  const pendingFiles = files.filter(f => f.status === 'pending');

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl py-6 text-center cursor-pointer transition-colors ${
          dragging ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
        }`}
      >
        <div className="text-3xl mb-1">📂</div>
        <p className="text-sm text-gray-500">
          גרור קבצים לכאן, או{' '}
          <span className="text-blue-600 font-semibold">לחץ לבחירה</span>
        </p>
        <p className="text-xs text-gray-400 mt-0.5">JPG · PNG · WEBP · PDF</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".jpg,.jpeg,.png,.webp,.pdf"
          className="hidden"
          onChange={e => e.target.files && addFiles(e.target.files)}
        />
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map(uf => (
            <FileCard
              key={uf.id}
              uf={uf}
              onRemove={() => removeFile(uf.id)}
              onProcess={processFile}
              onApply={applyFile}
            />
          ))}
        </div>
      )}

      {/* Process all button */}
      {pendingFiles.length > 1 && (
        <button
          onClick={() => pendingFiles.forEach(f => processFile(f.id))}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl py-2.5 transition-colors"
        >
          חלץ נתונים מכל הקבצים ({pendingFiles.length})
        </button>
      )}
    </div>
  );
}
