import type { PayslipComponent, TaxableStatus } from '../models/types';
import { COMPONENT_TYPE_LABELS } from '../services/componentClassifier';
import { formatILS } from '../utils/currency';

interface Props {
  components: PayslipComponent[];
  suspiciousIds: string[];
}

const TAXABLE_LABEL: Record<string, { label: string; color: string }> = {
  true:      { label: 'חייב ✓',    color: 'text-green-700 bg-green-50' },
  false:     { label: 'פטור ✗',    color: 'text-gray-500 bg-gray-100' },
  uncertain: { label: 'לא ודאי ?', color: 'text-amber-700 bg-amber-50' },
};

function TaxBadge({ value }: { value: TaxableStatus }) {
  const { label, color } = TAXABLE_LABEL[String(value)];
  return (
    <span className={`inline-block text-xs rounded px-2 py-0.5 font-medium ${color}`}>
      {label}
    </span>
  );
}

export function ComponentAnalysis({ components, suspiciousIds }: Props) {
  const payments = components.filter(c => !c.componentType.startsWith('deduction'));
  const deductions = components.filter(c => c.componentType.startsWith('deduction'));

  const cashTotal = payments
    .filter(c => c.isCashPayment)
    .reduce((s, c) => s + c.amount, 0);
  const nonCashTotal = payments
    .filter(c => !c.isCashPayment)
    .reduce((s, c) => s + c.amount, 0);
  const deductionTotal = deductions.reduce((s, c) => s + c.amount, 0);

  const uncertainCount = payments.filter(c =>
    c.incomeTaxable === 'uncertain' || c.nlTaxable === 'uncertain',
  ).length;

  return (
    <div className="space-y-4">
      {/* Summary chips */}
      <div className="flex flex-wrap gap-3">
        <div className="bg-white rounded-xl border border-gray-100 px-4 py-2 text-xs">
          <span className="text-gray-500">ברוטו מזומן</span>
          <span className="font-bold text-gray-900 ml-2">{formatILS(cashTotal)}</span>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 px-4 py-2 text-xs">
          <span className="text-gray-500">שווי / גילום</span>
          <span className="font-bold text-gray-900 ml-2">{formatILS(nonCashTotal)}</span>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 px-4 py-2 text-xs">
          <span className="text-gray-500">ניכויים</span>
          <span className="font-bold text-red-600 ml-2">{formatILS(deductionTotal)}</span>
        </div>
        {uncertainCount > 0 && (
          <div className="bg-amber-50 rounded-xl border border-amber-200 px-4 py-2 text-xs text-amber-700">
            ⚠ {uncertainCount} רכיבים בסיווג לא-ודאי — בדוק ידנית
          </div>
        )}
      </div>

      {/* Payments table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-bold text-gray-700">ניתוח רכיבי תשלום</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs" style={{ minWidth: 700 }}>
            <thead className="bg-gray-50 text-gray-500 uppercase tracking-wide">
              <tr>
                <th className="px-3 py-2 text-right">תיאור</th>
                <th className="px-3 py-2 text-right">סוג</th>
                <th className="px-3 py-2 text-right w-24">סכום</th>
                <th className="px-3 py-2 text-center w-20">מס ה.</th>
                <th className="px-3 py-2 text-center w-20">ב"ל</th>
                <th className="px-3 py-2 text-center w-16">מזומן</th>
                <th className="px-3 py-2 text-right w-24">הערה</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((c, idx) => {
                const isSuspicious = suspiciousIds.includes(c.id);
                return (
                  <tr
                    key={c.id}
                    className={`border-b border-gray-50 ${
                      isSuspicious ? 'bg-amber-50' :
                      idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'
                    }`}
                  >
                    <td className="px-3 py-2">
                      <span className="font-medium text-gray-800">{c.description}</span>
                      {isSuspicious && (
                        <span className="ml-1 text-amber-600 text-xs">⚠</span>
                      )}
                      {c.code && <span className="text-gray-400 ml-1">({c.code})</span>}
                    </td>
                    <td className="px-3 py-2 text-gray-500">
                      {COMPONENT_TYPE_LABELS[c.componentType] ?? c.componentType}
                    </td>
                    <td className={`px-3 py-2 text-right font-semibold ${c.amount < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                      {formatILS(c.amount)}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <TaxBadge value={c.incomeTaxable} />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <TaxBadge value={c.nlTaxable} />
                    </td>
                    <td className="px-3 py-2 text-center">
                      {c.isCashPayment
                        ? <span className="text-green-600 font-bold">✓</span>
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-2 text-gray-400 text-xs">{c.note ?? ''}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Deductions table */}
      {deductions.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="text-sm font-bold text-gray-700">ניכויים</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs" style={{ minWidth: 400 }}>
              <thead className="bg-gray-50 text-gray-500 uppercase tracking-wide">
                <tr>
                  <th className="px-3 py-2 text-right">תיאור</th>
                  <th className="px-3 py-2 text-right">סוג</th>
                  <th className="px-3 py-2 text-right w-28">סכום</th>
                  <th className="px-3 py-2 text-right w-24">הערה</th>
                </tr>
              </thead>
              <tbody>
                {deductions.map((c, idx) => (
                  <tr
                    key={c.id}
                    className={`border-b border-gray-50 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}`}
                  >
                    <td className="px-3 py-2 font-medium text-gray-800">
                      {c.description}
                      {c.code && <span className="text-gray-400 ml-1">({c.code})</span>}
                    </td>
                    <td className="px-3 py-2 text-gray-500">
                      {COMPONENT_TYPE_LABELS[c.componentType] ?? c.componentType}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-red-600">
                      {formatILS(c.amount)}
                    </td>
                    <td className="px-3 py-2 text-gray-400 text-xs">{c.note ?? ''}</td>
                  </tr>
                ))}
                <tr className="bg-gray-50 border-t-2 border-gray-200 font-bold text-xs">
                  <td colSpan={2} className="px-3 py-2 text-right text-gray-600">סך ניכויים</td>
                  <td className="px-3 py-2 text-right text-red-700">{formatILS(deductionTotal)}</td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
