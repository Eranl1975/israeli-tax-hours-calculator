import { useState, useRef, useCallback } from 'react';
import type { ExtractedData } from '../services/payslipExtractor';
import { extractFromFile } from '../services/payslipExtractor';

interface Props {
  onImport: (data: ExtractedData) => void;
}

type FileStatus = 'pending' | 'processing' | 'done' | 'error';

interface UploadedFile {
  id: string;
  file: File;
  preview?: string;
  status: FileStatus;
  progress?: number;
  progressStatus?: string;
  result?: ExtractedData;
  errorMessage?: string;
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

function fmt(n: number) {
  return new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }).format(n);
}

function FileCard({
  uf,
  onRemove,
  onProcess,
  onApply,
}: {
  uf: UploadedFile;
  onRemove: () => void;
  onProcess: (id: string) => void;
  onApply: (id: string) => void;
}) {
  const borderClass =
    uf.status === 'error'      ? 'border-red-200 bg-red-50'   :
    uf.status === 'done'       ? 'border-green-200 bg-green-50' :
    uf.status === 'processing' ? 'border-blue-200 bg-blue-50'  :
                                 'border-gray-200 bg-white';

  return (
    <div className={`relative rounded-xl border p-3 text-xs flex gap-3 items-start ${borderClass}`}>
      {/* Thumbnail */}
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

        {uf.status === 'done' && uf.result && (
          <div className="mt-2 space-y-1">
            {/* Show only what was found */}
            {uf.result.gross !== undefined ? (
              <p className="text-green-800 font-semibold">
                ✓ ברוטו: <span className="text-base">{fmt(uf.result.gross)}</span>
              </p>
            ) : (
              <p className="text-amber-700">⚠ לא נמצאה שורת "סך-הכל התשלומים"</p>
            )}
            {uf.result.creditPoints !== undefined && (
              <p className="text-green-700">
                ✓ נקודות זיכוי: {uf.result.creditPoints}
              </p>
            )}
            {(uf.result.gross !== undefined || uf.result.creditPoints !== undefined) && (
              <button
                onClick={() => onApply(uf.id)}
                className="mt-1 w-full bg-green-600 hover:bg-green-700 text-white rounded-lg px-3 py-1.5 text-xs font-semibold"
              >
                ← הכנס לחישוב
              </button>
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
      >
        ✕
      </button>
    </div>
  );
}

export function FileUploadPanel({ onImport }: Props) {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function addFiles(fileList: FileList) {
    const newFiles: UploadedFile[] = Array.from(fileList).map(file => ({
      id: crypto.randomUUID(),
      file,
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
      const result = await extractFromFile(uf.file, (pct, status) => {
        setFiles(prev => prev.map(f =>
          f.id === id ? { ...f, progress: pct, progressStatus: status } : f,
        ));
      });

      setFiles(prev => prev.map(f =>
        f.id === id ? { ...f, status: 'done', result, progress: 100 } : f,
      ));
    } catch (err) {
      setFiles(prev => prev.map(f =>
        f.id === id ? { ...f, status: 'error', errorMessage: String(err) } : f,
      ));
    }
  }

  function applyFile(id: string) {
    const uf = files.find(f => f.id === id);
    if (uf?.result) onImport(uf.result);
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

      {pendingFiles.length > 1 && (
        <button
          onClick={() => pendingFiles.forEach(f => processFile(f.id))}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl py-2.5 transition-colors"
        >
          חלץ מכל הקבצים ({pendingFiles.length})
        </button>
      )}
    </div>
  );
}
