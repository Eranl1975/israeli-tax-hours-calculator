import type { PayslipActuals } from '../models/types';
import { formatILS } from '../utils/currency';

interface Props {
  actuals: PayslipActuals;
  onChange: (actuals: PayslipActuals) => void;
}

interface FieldDef {
  key: keyof PayslipActuals;
  label: string;
  hint?: string;
}

const FIELDS: FieldDef[] = [
  { key: 'totalPayments', label: 'סך כל התשלומים', hint: 'ברוטו כולל כל הרכיבים' },
  { key: 'totalMandatoryTaxDeductions', label: 'סך ניכויי חובה מסים' },
  { key: 'actualIncomeTax', label: 'מס הכנסה בפועל' },
  { key: 'actualNL', label: 'ביטוח לאומי בפועל' },
  { key: 'actualHealth', label: 'ביטוח בריאות בפועל' },
  { key: 'actualSocialDeductions', label: 'ניכויים סוציאליים', hint: 'פנסיה, קה"ש, ועד' },
  { key: 'actualNetToBank', label: 'נטו לבנק בפועל' },
];

export function SummaryInputs({ actuals, onChange }: Props) {
  function update(key: keyof PayslipActuals, raw: string) {
    const val = parseFloat(raw);
    onChange({ ...actuals, [key]: isNaN(val) ? 0 : val });
  }

  const impliedNet = actuals.totalPayments - actuals.totalMandatoryTaxDeductions - actuals.actualSocialDeductions;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100">
        <h2 className="text-sm font-bold text-gray-700">נתוני תלוש בפועל</h2>
        <p className="text-xs text-gray-400 mt-0.5">הזן את הסכומים כפי שמופיעים בתלוש</p>
      </div>

      <div className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {FIELDS.map(({ key, label, hint }) => (
            <div key={key}>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                {label}
                {hint && <span className="text-gray-400 font-normal"> ({hint})</span>}
              </label>
              <input
                type="number"
                value={actuals[key] || ''}
                onChange={e => update(key, e.target.value)}
                placeholder="0"
                className="input-base"
                step="0.01"
              />
            </div>
          ))}
        </div>

        {actuals.totalPayments > 0 && (
          <div className="mt-4 p-3 bg-blue-50 rounded-xl text-xs text-blue-800 space-y-1">
            <div className="flex justify-between">
              <span>נטו משוער (לפי שדות לעיל):</span>
              <span className="font-bold">{formatILS(impliedNet)}</span>
            </div>
            {Math.abs(impliedNet - actuals.actualNetToBank) > 10 && actuals.actualNetToBank > 0 && (
              <div className="text-amber-700">
                פער מ"נטו לבנק בפועל": {formatILS(actuals.actualNetToBank - impliedNet)}
                {' '}(ייתכן ניכויים נוספים שאינם בטבלה)
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
