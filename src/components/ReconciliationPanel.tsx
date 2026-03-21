import type { ReconciliationNote, CalculationResults, PayslipActuals } from '../models/types';
import { formatILS, formatPct } from '../utils/currency';

interface Props {
  results: CalculationResults;
  actuals: PayslipActuals;
}

const NOTE_CONFIG: Record<ReconciliationNote['type'], { bg: string; border: string; icon: string; titleColor: string }> = {
  info:    { bg: 'bg-blue-50',   border: 'border-blue-200',   icon: 'ℹ',  titleColor: 'text-blue-800' },
  warning: { bg: 'bg-amber-50',  border: 'border-amber-200',  icon: '⚠',  titleColor: 'text-amber-800' },
  alert:   { bg: 'bg-red-50',    border: 'border-red-200',    icon: '✕',  titleColor: 'text-red-800' },
};

function NoteCard({ note }: { note: ReconciliationNote }) {
  const { bg, border, icon, titleColor } = NOTE_CONFIG[note.type];
  return (
    <div className={`${bg} border ${border} rounded-xl p-4`}>
      <div className={`flex items-center gap-2 font-semibold text-sm ${titleColor} mb-1`}>
        <span>{icon}</span>
        <span>{note.title}</span>
      </div>
      <p className="text-xs text-gray-600 leading-relaxed">{note.message}</p>
    </div>
  );
}

function CompareRow({
  label,
  theoretical,
  actual,
  diff,
}: {
  label: string;
  theoretical: number;
  actual: number;
  diff: number;
}) {
  const absDiff = Math.abs(diff);
  const hasActual = actual > 0;
  const diffColor = absDiff < 50 ? 'text-green-700' : diff > 0 ? 'text-amber-700' : 'text-blue-700';

  return (
    <tr className="border-b border-gray-50 text-xs">
      <td className="px-4 py-2 text-gray-600">{label}</td>
      <td className="px-4 py-2 text-right font-medium">{formatILS(theoretical)}</td>
      <td className="px-4 py-2 text-right">{hasActual ? formatILS(actual) : '—'}</td>
      <td className={`px-4 py-2 text-right font-semibold ${hasActual ? diffColor : 'text-gray-300'}`}>
        {hasActual ? (diff >= 0 ? '+' : '') + formatILS(diff) : '—'}
      </td>
      <td className={`px-4 py-2 text-right ${hasActual && absDiff > 50 ? diffColor : 'text-gray-300'}`}>
        {hasActual && theoretical > 0 ? formatPct(diff / theoretical) : '—'}
      </td>
    </tr>
  );
}

export function ReconciliationPanel({ results, actuals }: Props) {
  const notes = results.reconciliationNotes;
  const alertCount = notes.filter(n => n.type === 'alert').length;
  const warnCount  = notes.filter(n => n.type === 'warning').length;

  return (
    <div className="space-y-4">
      {/* Status bar */}
      <div className={`rounded-xl p-4 border text-sm font-semibold ${
        alertCount > 0 ? 'bg-red-50 border-red-200 text-red-800' :
        warnCount  > 0 ? 'bg-amber-50 border-amber-200 text-amber-800' :
                          'bg-green-50 border-green-200 text-green-800'
      }`}>
        {alertCount > 0 ? `⛔ נמצאו ${alertCount} אזהרות קריטיות` :
         warnCount  > 0 ? `⚠ נמצאו ${warnCount} הערות לבדיקה` :
                          '✓ התאמה תקינה — לא נמצאו פערים משמעותיים'}
      </div>

      {/* Comparison table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-bold text-gray-700">השוואה תיאורטי ↔ בפועל</h3>
          <p className="text-xs text-gray-400 mt-0.5">פער חיובי = מוטל יותר ממה שמחושב</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 text-gray-500 uppercase tracking-wide">
              <tr>
                <th className="px-4 py-2 text-right">פריט</th>
                <th className="px-4 py-2 text-right">תיאורטי</th>
                <th className="px-4 py-2 text-right">בפועל</th>
                <th className="px-4 py-2 text-right">פער (₪)</th>
                <th className="px-4 py-2 text-right">פער (%)</th>
              </tr>
            </thead>
            <tbody>
              <CompareRow
                label="מס הכנסה"
                theoretical={results.theoreticalIncomeTax}
                actual={actuals.actualIncomeTax}
                diff={results.incomeTaxDifference}
              />
              <CompareRow
                label="ביטוח לאומי"
                theoretical={results.theoreticalNL}
                actual={actuals.actualNL}
                diff={results.nlDifference}
              />
              <CompareRow
                label="ביטוח בריאות"
                theoretical={results.theoreticalHealth}
                actual={actuals.actualHealth}
                diff={results.theoreticalHealth - actuals.actualHealth}
              />
              <CompareRow
                label="סך תשלומים"
                theoretical={results.totalPaymentsCalc}
                actual={actuals.totalPayments}
                diff={results.totalPaymentsCalc - actuals.totalPayments}
              />
              <CompareRow
                label="נטו לבנק"
                theoretical={results.theoreticalNetToBank}
                actual={actuals.actualNetToBank}
                diff={results.theoreticalNetToBank - actuals.actualNetToBank}
              />
            </tbody>
          </table>
        </div>
      </div>

      {/* Notes */}
      {notes.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-gray-700">ממצאים ותובנות</h3>
          {notes.map((note, i) => (
            <NoteCard key={i} note={note} />
          ))}
        </div>
      )}

      {notes.length === 0 && (
        <div className="bg-gray-50 rounded-xl p-6 text-center text-sm text-gray-400">
          לא נמצאו פערים משמעותיים.
          <br />
          <span className="text-xs">הכנס נתוני תלוש בפועל כדי לראות השוואה מפורטת.</span>
        </div>
      )}
    </div>
  );
}
