import { useState, useRef, useCallback } from 'react';
import type { UploadedFile } from '../models/types';
import type { PayslipComponent } from '../models/types';
import { extractFromFile } from '../services/payslipExtractor';
import { createComponent } from '../services/componentClassifier';

interface Props {
  onImport: (components: PayslipComponent[]) => void;
}

function ProgressBar({ pct }: { pct: number }) {
  return (
    <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
      <div
        className="h-1.5 bg-blue-500 rounded-full transition-all duration-200"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function FileCard({
  uf,
  onRemove,
  onProcess,
}: {
  uf: UploadedFile;
  onRemove: () => void;
  onProcess: (id: string) => void;
}) {
  return (
    <div className={`relative rounded-xl border p-3 text-xs flex gap-3 items-start ${
      uf.status === 'error' ? 'border-red-200 bg-red-50' :
      uf.status === 'done'  ? 'border-green-200 bg-green-50' :
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
            <ProgressBar pct={50} />
            <p className="text-blue-600 mt-1">מזהה טקסט...</p>
          </div>
        )}
        {uf.status === 'done' && (
          <p className="text-green-700 mt-1 font-medium">✓ זוהה בהצלחה</p>
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
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function addFiles(fileList: FileList) {
    const newFiles: UploadedFile[] = Array.from(fileList).map(file => ({
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

    setFiles(prev => prev.map(f => f.id === id ? { ...f, status: 'processing' } : f));
    try {
      const { text, data } = await extractFromFile(uf.file, () => {});
      setFiles(prev => prev.map(f =>
        f.id === id ? { ...f, status: 'done', ocrText: text } : f,
      ));

      // Convert extracted data to components
      const comps: PayslipComponent[] = [];
      if (data.baseMonthlyGross) {
        comps.push(createComponent('שכר יסוד', data.baseMonthlyGross, 'ocr'));
      }
      if (data.overtimeIncome) {
        comps.push(createComponent('שעות נוספות', data.overtimeIncome, 'ocr'));
      }
      if (data.bonusIncome) {
        comps.push(createComponent('בונוס', data.bonusIncome, 'ocr'));
      }
      if (comps.length > 0) {
        onImport(comps);
      }
    } catch (err) {
      setFiles(prev => prev.map(f =>
        f.id === id ? { ...f, status: 'error', errorMessage: String(err) } : f,
      ));
    }
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files);
  }, []);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100">
        <h2 className="text-sm font-bold text-gray-700">העלאת תלושי שכר</h2>
        <p className="text-xs text-gray-400 mt-0.5">JPG, PNG, WEBP, PDF — OCR מקומי, ללא שרת חיצוני</p>
      </div>

      <div className="p-4 space-y-3">
        {/* Drop zone */}
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl py-8 text-center cursor-pointer transition-colors ${
            dragging ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
          }`}
        >
          <div className="text-3xl mb-2">📂</div>
          <p className="text-sm text-gray-500">גרור קבצים לכאן, או <span className="text-blue-600 font-semibold">לחץ לבחירה</span></p>
          <p className="text-xs text-gray-400 mt-1">JPG · PNG · WEBP · PDF</p>
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
              />
            ))}
          </div>
        )}

        {/* Process all button */}
        {files.some(f => f.status === 'pending') && (
          <button
            onClick={() => files.filter(f => f.status === 'pending').forEach(f => processFile(f.id))}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl py-2.5 transition-colors"
          >
            חלץ נתונים מכל הקבצים
          </button>
        )}
      </div>
    </div>
  );
}
