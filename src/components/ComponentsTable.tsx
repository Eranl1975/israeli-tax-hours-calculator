import { useRef } from 'react';
import type { PayslipComponent, ComponentType, TaxableStatus } from '../models/types';
import { COMPONENT_TYPE_LABELS, createComponent } from '../services/componentClassifier';
import { formatILS } from '../utils/currency';

interface Props {
  components: PayslipComponent[];
  suspiciousIds?: string[];
  onChange: (components: PayslipComponent[]) => void;
}

const ALL_TYPES = Object.entries(COMPONENT_TYPE_LABELS) as [ComponentType, string][];

function TaxToggle({
  value,
  onChange,
}: {
  value: TaxableStatus;
  onChange: (v: TaxableStatus) => void;
}) {
  const states: TaxableStatus[] = [true, false, 'uncertain'];
  const labels: Record<string, string> = { true: '✓', false: '✗', uncertain: '?' };
  const colors: Record<string, string> = {
    true: 'bg-green-100 text-green-700',
    false: 'bg-gray-100 text-gray-500',
    uncertain: 'bg-amber-100 text-amber-700',
  };
  const next = states[(states.indexOf(value) + 1) % states.length];
  return (
    <button
      title="לחץ להחלפה: כן / לא / לא ודאי"
      onClick={() => onChange(next)}
      className={`w-8 h-6 rounded text-xs font-bold cursor-pointer ${colors[String(value)]}`}
    >
      {labels[String(value)]}
    </button>
  );
}

export function ComponentsTable({ components, suspiciousIds = [], onChange }: Props) {
  const nextCode = useRef(components.length + 1);

  function update(id: string, field: keyof PayslipComponent, value: unknown) {
    onChange(components.map(c => (c.id === id ? { ...c, [field]: value } : c)));
  }

  function addRow() {
    const newComp = createComponent('', 0, 'manual');
    onChange([...components, newComp]);
    nextCode.current++;
  }

  function removeRow(id: string) {
    onChange(components.filter(c => c.id !== id));
  }

  const totalPayments = components
    .filter(c => !c.componentType.startsWith('deduction'))
    .reduce((s, c) => s + c.amount, 0);
  const totalDeductions = components
    .filter(c => c.componentType.startsWith('deduction'))
    .reduce((s, c) => s + c.amount, 0);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <h2 className="text-sm font-bold text-gray-700">רכיבי שכר</h2>
        <button
          onClick={addRow}
          className="text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold px-3 py-1.5 rounded-lg transition-colors"
        >
          + הוסף שורה
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs" style={{ minWidth: 900 }}>
          <thead className="bg-gray-50 text-gray-500 uppercase tracking-wide">
            <tr>
              <th className="px-2 py-2 text-right w-14">סמל</th>
              <th className="px-2 py-2 text-right w-40">תיאור</th>
              <th className="px-2 py-2 text-right w-16">כמות</th>
              <th className="px-2 py-2 text-right w-20">תעריף</th>
              <th className="px-2 py-2 text-right w-24">סכום (₪)</th>
              <th className="px-2 py-2 text-right w-36">סוג רכיב</th>
              <th className="px-2 py-2 text-center w-14">מס?</th>
              <th className="px-2 py-2 text-center w-14">ב"ל?</th>
              <th className="px-2 py-2 text-right w-28">הערה</th>
              <th className="px-2 py-2 w-8"></th>
            </tr>
          </thead>
          <tbody>
            {components.map((c, idx) => {
              const isSuspicious = suspiciousIds.includes(c.id);
              const isDeduction = c.componentType.startsWith('deduction');
              return (
                <tr
                  key={c.id}
                  className={`border-b border-gray-50 ${isSuspicious ? 'bg-amber-50' : idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}`}
                >
                  <td className="px-2 py-1">
                    <input
                      type="text"
                      value={c.code ?? ''}
                      onChange={e => update(c.id, 'code', e.target.value)}
                      className="w-12 input-cell"
                    />
                  </td>
                  <td className="px-2 py-1">
                    <input
                      type="text"
                      value={c.description}
                      onChange={e => {
                        // Auto-reclassify when description changes
                        const newComp = createComponent(e.target.value, c.amount, 'manual');
                        onChange(components.map(comp => comp.id === c.id
                          ? { ...comp, ...newComp, id: c.id, description: e.target.value, amount: c.amount }
                          : comp,
                        ));
                      }}
                      className="w-36 input-cell"
                    />
                  </td>
                  <td className="px-2 py-1">
                    <input
                      type="number"
                      value={c.quantity ?? ''}
                      onChange={e => update(c.id, 'quantity', parseFloat(e.target.value) || undefined)}
                      className="w-14 input-cell"
                    />
                  </td>
                  <td className="px-2 py-1">
                    <input
                      type="number"
                      value={c.rate ?? ''}
                      onChange={e => update(c.id, 'rate', parseFloat(e.target.value) || undefined)}
                      className="w-18 input-cell"
                    />
                  </td>
                  <td className="px-2 py-1">
                    <input
                      type="number"
                      value={c.amount}
                      onChange={e => update(c.id, 'amount', parseFloat(e.target.value) || 0)}
                      className={`w-22 input-cell font-semibold ${isDeduction ? 'text-red-600' : 'text-gray-900'}`}
                    />
                  </td>
                  <td className="px-2 py-1">
                    <select
                      value={c.componentType}
                      onChange={e => update(c.id, 'componentType', e.target.value as ComponentType)}
                      className="input-cell text-xs"
                    >
                      {ALL_TYPES.map(([t, label]) => (
                        <option key={t} value={t}>{label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-1 text-center">
                    {!isDeduction ? (
                      <TaxToggle
                        value={c.incomeTaxable}
                        onChange={v => update(c.id, 'incomeTaxable', v)}
                      />
                    ) : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-2 py-1 text-center">
                    {!isDeduction ? (
                      <TaxToggle
                        value={c.nlTaxable}
                        onChange={v => update(c.id, 'nlTaxable', v)}
                      />
                    ) : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-2 py-1">
                    <input
                      type="text"
                      value={c.note ?? ''}
                      onChange={e => update(c.id, 'note', e.target.value)}
                      placeholder="הערה..."
                      className="w-24 input-cell"
                    />
                  </td>
                  <td className="px-2 py-1">
                    <button
                      onClick={() => removeRow(c.id)}
                      className="text-red-400 hover:text-red-600 font-bold"
                      title="מחק שורה"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="bg-gray-50 font-semibold text-xs border-t-2 border-gray-200">
            <tr>
              <td colSpan={4} className="px-3 py-2 text-right text-gray-600">סיכום</td>
              <td className="px-2 py-2 text-right">
                <div className="text-green-700">{formatILS(totalPayments)}</div>
                {totalDeductions !== 0 && (
                  <div className="text-red-600">{formatILS(totalDeductions)}</div>
                )}
              </td>
              <td colSpan={5} className="px-2 py-2 text-gray-400 text-xs">
                {components.length} שורות | ✓=חייב | ✗=פטור | ?=לא ודאי
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
