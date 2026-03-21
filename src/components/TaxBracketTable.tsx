import type { BracketBreakdown, IncomeTaxConfig } from '../models/types';
import { formatILS, formatPct } from '../utils/currency';

interface Props {
  breakdowns: BracketBreakdown[];
  config: IncomeTaxConfig;
  incomeTaxBase: number;
}

export function TaxBracketTable({ breakdowns, config, incomeTaxBase }: Props) {
  const totalTax = breakdowns.reduce((s, b) => s + b.taxInBracket, 0);

  return (
    <div className="space-y-4">
      {/* Config info */}
      <div className="bg-blue-50 rounded-xl px-4 py-3 text-xs text-blue-800 flex flex-wrap gap-x-6 gap-y-1">
        <span>תצורה: <strong>{config.name}</strong></span>
        <span>בסיס חייב: <strong>{formatILS(incomeTaxBase)}</strong></span>
        <span>ערך נקודת זיכוי: <strong>{formatILS(config.creditPointMonthlyValue)}/חודש</strong></span>
        <span>תקרת מס יסף: <strong>{formatILS(config.surtaxMonthlyThreshold)}/חודש</strong></span>
      </div>

      {/* Bracket breakdown table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-bold text-gray-700">פירוט מדרגות מס</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 text-gray-500 uppercase tracking-wide">
              <tr>
                <th className="px-4 py-2 text-right">מדרגה</th>
                <th className="px-4 py-2 text-right">טווח (₪/חודש)</th>
                <th className="px-4 py-2 text-right">שיעור</th>
                <th className="px-4 py-2 text-right">הכנסה במדרגה</th>
                <th className="px-4 py-2 text-right">מס במדרגה</th>
              </tr>
            </thead>
            <tbody>
              {config.brackets.map((bracket, idx) => {
                const breakdown = breakdowns.find(b => b.bracketMin === bracket.min);
                const isActive = breakdown && breakdown.incomeInBracket > 0;
                const isHighest = breakdown?.isHighestReached;
                return (
                  <tr
                    key={idx}
                    className={`border-b border-gray-50 ${
                      isHighest ? 'bg-blue-50 font-semibold' :
                      isActive ? 'bg-white' : 'bg-gray-50/60 text-gray-400'
                    }`}
                  >
                    <td className="px-4 py-2">
                      <span className={`inline-flex items-center gap-1 ${isHighest ? 'text-blue-700' : ''}`}>
                        {isHighest && <span className="text-blue-500">▶</span>}
                        מדרגה {idx + 1}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-gray-600">
                      {formatILS(bracket.min)}
                      {' – '}
                      {bracket.max !== null ? formatILS(bracket.max) : '∞'}
                    </td>
                    <td className="px-4 py-2">
                      <span className={`font-bold ${isActive ? 'text-gray-900' : ''}`}>
                        {formatPct(bracket.rate)}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      {breakdown ? formatILS(breakdown.incomeInBracket) : '—'}
                    </td>
                    <td className="px-4 py-2">
                      {breakdown ? (
                        <span className={breakdown.taxInBracket > 0 ? 'text-red-600' : 'text-gray-400'}>
                          {formatILS(breakdown.taxInBracket)}
                        </span>
                      ) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-gray-50 border-t-2 border-gray-200 font-bold text-xs">
              <tr>
                <td colSpan={3} className="px-4 py-3 text-right text-gray-600">סך מס לפני זיכויים</td>
                <td className="px-4 py-3">{formatILS(incomeTaxBase)}</td>
                <td className="px-4 py-3 text-red-700">{formatILS(totalTax)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Full brackets reference */}
      <details className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <summary className="px-5 py-3 text-xs font-semibold text-gray-600 cursor-pointer hover:text-gray-900">
          טבלת מדרגות מס מלאה — {config.name}
        </summary>
        <div className="px-5 pb-4">
          <div className="grid grid-cols-3 gap-2 text-xs mt-2">
            {config.brackets.map((b, i) => (
              <div key={i} className="bg-gray-50 rounded-lg p-2 text-center">
                <div className="font-bold text-blue-700">{formatPct(b.rate)}</div>
                <div className="text-gray-500">
                  {formatILS(b.min)} – {b.max !== null ? formatILS(b.max) : '∞'}
                </div>
              </div>
            ))}
          </div>
          {config.notes && (
            <p className="text-xs text-gray-400 mt-3 leading-relaxed">{config.notes}</p>
          )}
        </div>
      </details>
    </div>
  );
}
