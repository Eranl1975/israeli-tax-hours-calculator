import type { PayslipHeader } from '../models/types';
import { ALL_INCOME_TAX_CONFIGS } from '../tax/incomeTaxConfig';

interface Props {
  header: PayslipHeader;
  onChange: (h: PayslipHeader) => void;
}

const MONTHS = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-gray-600">{label}</label>
      {children}
      {hint && <span className="text-xs text-gray-400">{hint}</span>}
    </div>
  );
}

export function PayslipHeaderForm({ header, onChange }: Props) {
  const set = <K extends keyof PayslipHeader>(k: K, v: PayslipHeader[K]) =>
    onChange({ ...header, [k]: v });

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <h2 className="text-sm font-bold text-gray-700 mb-4">פרטי תלוש</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Field label="שנת מס">
          <select
            value={header.taxYear}
            onChange={e => set('taxYear', parseInt(e.target.value))}
            className="input-base"
          >
            {ALL_INCOME_TAX_CONFIGS.map(c => (
              <option key={c.year} value={c.year}>{c.year}{c.notes ? ' ⚠' : ''}</option>
            ))}
          </select>
        </Field>

        <Field label="חודש">
          <select
            value={header.taxMonth}
            onChange={e => set('taxMonth', parseInt(e.target.value))}
            className="input-base"
          >
            {MONTHS.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
          </select>
        </Field>

        <Field label="מעסיק (אופציונלי)">
          <input
            type="text"
            value={header.employerName ?? ''}
            onChange={e => set('employerName', e.target.value)}
            placeholder="שם המעסיק"
            className="input-base"
          />
        </Field>

        <Field label="נקודות זיכוי" hint="ברירת מחדל: 2.25">
          <input
            type="number"
            value={header.creditPoints}
            onChange={e => set('creditPoints', parseFloat(e.target.value) || 0)}
            min={0} max={20} step={0.25}
            className="input-base"
          />
        </Field>

        <Field label="הפרשת עובד לפנסיה (%)" hint="לחישוב ניכוי מבסיס המס">
          <input
            type="number"
            value={header.employeePensionPct}
            onChange={e => set('employeePensionPct', parseFloat(e.target.value) || 0)}
            min={0} max={20} step={0.5}
            className="input-base"
          />
        </Field>
      </div>
    </div>
  );
}
