import type { CalculationResults, PayslipActuals } from '../models/types';
import { formatILS, formatPct } from '../utils/currency';

interface Props {
  results: CalculationResults;
  actuals: PayslipActuals;
  creditPoints: number;
}

interface CardProps {
  title: string;
  value: string;
  sub?: string;
  color?: 'default' | 'green' | 'red' | 'amber' | 'blue';
  badge?: string;
}

function Card({ title, value, sub, color = 'default', badge }: CardProps) {
  const valueColors: Record<string, string> = {
    default: 'text-gray-900',
    green: 'text-green-700',
    red: 'text-red-600',
    amber: 'text-amber-700',
    blue: 'text-blue-700',
  };
  const bgColors: Record<string, string> = {
    default: 'bg-white',
    green: 'bg-green-50',
    red: 'bg-red-50',
    amber: 'bg-amber-50',
    blue: 'bg-blue-50',
  };
  return (
    <div className={`${bgColors[color]} rounded-xl border border-gray-100 p-4`}>
      <div className="flex items-start justify-between gap-1">
        <p className="text-xs text-gray-500 leading-snug">{title}</p>
        {badge && (
          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium whitespace-nowrap">
            {badge}
          </span>
        )}
      </div>
      <p className={`text-xl font-bold mt-1 ${valueColors[color]}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function DiffBadge({ diff, label }: { diff: number; label: string }) {
  if (Math.abs(diff) < 50) return null;
  const over = diff > 0;
  return (
    <div className={`flex items-center justify-between rounded-xl px-4 py-3 text-sm ${over ? 'bg-amber-50 border border-amber-200' : 'bg-green-50 border border-green-200'}`}>
      <span className="text-gray-700">{label}</span>
      <span className={`font-bold ${over ? 'text-amber-700' : 'text-green-700'}`}>
        {over ? '+' : ''}{formatILS(diff)}
        <span className="text-xs font-normal ml-1">({over ? 'מוטל יתר' : 'פחות ממחושב'})</span>
      </span>
    </div>
  );
}

export function SummaryCards({ results, actuals, creditPoints }: Props) {
  return (
    <div className="space-y-4">
      {/* Key figures grid */}
      <div className="grid grid-cols-2 gap-3">
        <Card
          title="בסיס חייב במס הכנסה"
          value={formatILS(results.incomeTaxBase)}
          sub={results.hasUncertainComponents ? `עם לא-ודאי: ${formatILS(results.incomeTaxBaseWithUncertain)}` : undefined}
          color="default"
          badge={results.hasUncertainComponents ? '⚠ לא ודאי' : undefined}
        />
        <Card
          title="מס הכנסה תיאורטי"
          value={formatILS(results.theoreticalIncomeTax)}
          sub={`${formatPct(results.effectiveTaxRate)} ריאלי | מדרגה: ${results.marginalBracketLabel}`}
          color="blue"
        />
        <Card
          title='ב"ל + בריאות תיאורטי'
          value={formatILS(results.theoreticalNL + results.theoreticalHealth)}
          sub={`ב"ל: ${formatILS(results.theoreticalNL)} | בריאות: ${formatILS(results.theoreticalHealth)}`}
          color="default"
        />
        <Card
          title="נטו לבנק תיאורטי"
          value={formatILS(results.theoreticalNetToBank)}
          sub={actuals.actualNetToBank > 0 ? `בפועל: ${formatILS(actuals.actualNetToBank)}` : undefined}
          color="green"
        />
      </div>

      {/* Income breakdown */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-2">
        <p className="text-xs font-bold text-gray-600 mb-2">פירוט הכנסות</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          <span className="text-gray-500">שכר ישיר + שע"נ + רכב</span>
          <span className="font-medium text-right">{formatILS(results.directPayTotal)}</span>
          <span className="text-gray-500">זקיפות שווי</span>
          <span className="font-medium text-right">{formatILS(results.valueInKindTotal)}</span>
          <span className="text-gray-500">גילום</span>
          <span className="font-medium text-right">{formatILS(results.grossedUpTotal)}</span>
          {results.correctionTotal !== 0 && <>
            <span className="text-gray-500">תיקונים / הפרשים</span>
            <span className={`font-medium text-right ${results.correctionTotal < 0 ? 'text-red-600' : ''}`}>
              {formatILS(results.correctionTotal)}
            </span>
          </>}
          <span className="text-gray-700 font-semibold border-t border-gray-100 pt-1">סך הכל תשלומים</span>
          <span className="font-bold text-right border-t border-gray-100 pt-1">{formatILS(results.totalPaymentsCalc)}</span>
        </div>
      </div>

      {/* Tax details */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-1 text-xs">
        <p className="font-bold text-gray-600 mb-2">חישוב מס הכנסה</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          <span className="text-gray-500">ניכוי פנסיה</span>
          <span className="text-right text-red-600">−{formatILS(results.pensionDeduction)}</span>
          <span className="text-gray-500">בסיס חייב</span>
          <span className="text-right font-medium">{formatILS(results.incomeTaxBase)}</span>
          <span className="text-gray-500">מס לפני זיכויים</span>
          <span className="text-right">{formatILS(results.taxBeforeCredits)}</span>
          <span className="text-gray-500">זיכוי נקודות ({creditPoints} נק.)</span>
          <span className="text-right text-green-600">−{formatILS(results.creditPointsReduction)}</span>
          {results.surtax > 0 && <>
            <span className="text-gray-500">מס יסף 3%</span>
            <span className="text-right">{formatILS(results.surtax)}</span>
          </>}
          <span className="text-gray-700 font-semibold border-t border-gray-100 pt-1">מס תיאורטי</span>
          <span className="font-bold text-right border-t border-gray-100 pt-1">{formatILS(results.theoreticalIncomeTax)}</span>
        </div>
      </div>

      {/* Reconciliation diffs */}
      {actuals.actualIncomeTax > 0 && (
        <DiffBadge
          diff={results.incomeTaxDifference}
          label="פער מס הכנסה (תיאורטי − בפועל)"
        />
      )}
      {actuals.actualNL > 0 && (
        <DiffBadge
          diff={results.nlDifference}
          label='פער ב"ל + בריאות (תיאורטי − בפועל)'
        />
      )}
    </div>
  );
}
