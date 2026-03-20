import type { UserInputs, TaxConfig, CalculationResults } from '../domain/types';
import { calculateResults } from '../domain/thresholdEngine';
import { formatILS, formatPct } from '../utils/currency';
import { formatHours } from '../utils/numbers';
import { ALL_TAX_CONFIGS } from '../config/taxConfigs';

interface Props {
  inputs: UserInputs; // Always runs both configs on the same inputs
}

interface ColData {
  config: TaxConfig;
  results: CalculationResults;
}

function CompRow({
  label,
  a,
  b,
  fmt,
  lowerIsBetter = false,
}: {
  label: string;
  a: number;
  b: number;
  fmt: (v: number) => string;
  lowerIsBetter?: boolean;
}) {
  const diff = b - a;
  const bIsBetter = lowerIsBetter ? diff < 0 : diff > 0;
  return (
    <tr className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
      <td className="py-2 px-3 text-sm text-gray-600">{label}</td>
      <td className="py-2 px-3 text-sm font-semibold text-gray-900 text-center">{fmt(a)}</td>
      <td className="py-2 px-3 text-sm font-semibold text-center">
        <span className={bIsBetter ? 'text-green-700' : diff === 0 ? 'text-gray-900' : 'text-red-700'}>
          {fmt(b)}
        </span>
      </td>
      <td className="py-2 px-3 text-center">
        {Math.abs(diff) >= 1 && (
          <span
            className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${
              bIsBetter ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            }`}
          >
            {diff > 0 ? '+' : ''}
            {fmt(diff)}
          </span>
        )}
      </td>
    </tr>
  );
}

export function ComparisonView({ inputs }: Props) {
  const cols: ColData[] = ALL_TAX_CONFIGS.map(config => ({
    config,
    results: calculateResults({ ...inputs, taxConfigId: config.id }, config),
  }));

  if (cols.length < 2) return null;

  const [colA, colB] = cols;
  const rA = colA.results;
  const rB = colB.results;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="p-5 border-b border-gray-100">
        <h2 className="text-base font-bold text-gray-800">השוואה: {colA.config.name} vs {colB.config.name}</h2>
        <p className="text-xs text-gray-400 mt-1">
          חישוב על אותם נתונים שהזנת — ההבדל בין תצורות המס בלבד.
          {colB.config.notes && <span className="text-amber-500"> ⚠ {colB.config.notes}</span>}
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              <th className="py-2 px-3 text-right">מדד</th>
              <th className="py-2 px-3 text-center">{colA.config.name}</th>
              <th className="py-2 px-3 text-center">{colB.config.name}</th>
              <th className="py-2 px-3 text-center">הפרש</th>
            </tr>
          </thead>
          <tbody>
            <CompRow label="מס שנתי אחרי זיכויים" a={rA.annualTaxAfterCredits} b={rB.annualTaxAfterCredits} fmt={formatILS} lowerIsBetter />
            <CompRow label="מס חודשי (ממוצע)" a={rA.monthlyTaxAfterCredits} b={rB.monthlyTaxAfterCredits} fmt={formatILS} lowerIsBetter />
            <CompRow label="שיעור מס אפקטיבי" a={rA.effectiveTaxRate} b={rB.effectiveTaxRate} fmt={v => formatPct(v)} lowerIsBetter />
            <CompRow label="נטו חודשי" a={rA.netMonthlyIncome} b={rB.netMonthlyIncome} fmt={formatILS} />
            <CompRow label="רווח חודשי עד תקרה" a={Math.max(0, rA.monthlyRoomToThreshold)} b={Math.max(0, rB.monthlyRoomToThreshold)} fmt={formatILS} />
            <CompRow label="שעות נוספות מותרות (חודשי)" a={Math.max(0, rA.maxExtraMonthlyHours)} b={Math.max(0, rB.maxExtraMonthlyHours)} fmt={v => formatHours(v)} />
            <CompRow label="ממוצע שעות יומיות מותרות" a={rA.maxAvgDailyHours} b={rB.maxAvgDailyHours} fmt={v => formatHours(v)} />
          </tbody>
        </table>
      </div>

      {/* Summary highlight */}
      <div className="p-4 bg-blue-50 border-t border-blue-100">
        <p className="text-xs text-blue-700 leading-relaxed">
          <strong>סיכום:</strong>{' '}
          {rB.annualTaxAfterCredits < rA.annualTaxAfterCredits
            ? `לפי המדרגות המוצעות ל-${colB.config.year} תשלם ${formatILS(rA.annualTaxAfterCredits - rB.annualTaxAfterCredits)} פחות מס בשנה (${formatILS((rA.annualTaxAfterCredits - rB.annualTaxAfterCredits) / 12)} בחודש).`
            : rB.annualTaxAfterCredits > rA.annualTaxAfterCredits
            ? `לפי המדרגות המוצעות תשלם ${formatILS(rB.annualTaxAfterCredits - rA.annualTaxAfterCredits)} יותר מס בשנה.`
            : 'אין הפרש במס בין שתי התצורות עבור ההכנסה שהזנת.'}
        </p>
      </div>
    </div>
  );
}
