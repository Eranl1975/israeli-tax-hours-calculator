import type { CalculationResults, TaxConfig, ThresholdStatus } from '../domain/types';
import { formatILS, formatPct } from '../utils/currency';
import { formatHours, roundTo } from '../utils/numbers';

interface Props {
  results: CalculationResults;
  config: TaxConfig;
  targetBracketIndex: number;
}

function Card({
  title,
  children,
  className = '',
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`bg-white rounded-2xl shadow-sm border border-gray-100 p-5 ${className}`}>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">{title}</h3>
      {children}
    </div>
  );
}

function Row({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex justify-between items-baseline py-1.5 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-600">{label}</span>
      <span className="font-semibold text-gray-900 text-sm">
        {value}
        {sub && <span className="text-xs text-gray-400 mr-1">{sub}</span>}
      </span>
    </div>
  );
}

const STATUS_COLORS: Record<ThresholdStatus, string> = {
  safe: 'bg-green-500',
  warning85: 'bg-yellow-400',
  warning90: 'bg-orange-400',
  warning95: 'bg-red-400',
  exceeded: 'bg-red-600',
};

const STATUS_LABELS: Record<ThresholdStatus, string> = {
  safe: 'בטוח',
  warning85: 'אזהרה — 85%',
  warning90: 'אזהרה — 90%',
  warning95: 'אזהרה — 95%',
  exceeded: 'חריגה!',
};

function ThresholdBar({ pct, status }: { pct: number; status: ThresholdStatus }) {
  const clampedPct = Math.min(pct, 100);
  return (
    <div>
      <div className="flex justify-between text-xs text-gray-500 mb-1">
        <span>שימוש בתקרת המדרגה</span>
        <span className={status === 'exceeded' ? 'text-red-600 font-bold' : ''}>
          {roundTo(pct, 1)}%
        </span>
      </div>
      <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${STATUS_COLORS[status]}`}
          style={{ width: `${clampedPct}%` }}
        />
      </div>
      <div className="flex justify-between text-xs mt-1">
        <span className="text-gray-400">0%</span>
        <span
          className={`font-semibold ${
            status === 'exceeded'
              ? 'text-red-600'
              : status.startsWith('warning')
              ? 'text-orange-500'
              : 'text-green-600'
          }`}
        >
          {STATUS_LABELS[status]}
        </span>
        <span className="text-gray-400">100%</span>
      </div>
    </div>
  );
}

export function ResultsCards({ results, config, targetBracketIndex }: Props) {
  const targetBracket = config.brackets[targetBracketIndex];
  const isExceeded = results.thresholdStatus === 'exceeded';

  return (
    <div className="flex flex-col gap-4">
      {/* Threshold status banner */}
      {results.thresholdStatus !== 'safe' && (
        <div
          className={`rounded-xl p-4 text-sm font-medium ${
            isExceeded
              ? 'bg-red-50 border border-red-200 text-red-700'
              : 'bg-amber-50 border border-amber-200 text-amber-700'
          }`}
        >
          {isExceeded
            ? `⚠️ חרגת ממדרגת ה-${targetBracket?.label}. יש להפחית הכנסה או שעות.`
            : `⚡ אתה מתקרב לתקרת מדרגת ה-${targetBracket?.label}.`}
        </div>
      )}

      {/* Progress bar */}
      {results.selectedBracketCeiling !== null && (
        <Card title="מצב תקרת המדרגה">
          <ThresholdBar pct={results.thresholdPct} status={results.thresholdStatus} />
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div className="bg-gray-50 rounded-lg p-2">
              <div className="text-gray-400">תקרת מדרגה שנתית</div>
              <div className="font-bold text-gray-800">{formatILS(results.selectedBracketCeiling)}</div>
            </div>
            <div className={`rounded-lg p-2 ${isExceeded ? 'bg-red-50' : 'bg-green-50'}`}>
              <div className="text-gray-400">{isExceeded ? 'חריגה' : 'רווח עד תקרה'} (חודשי)</div>
              <div className={`font-bold ${isExceeded ? 'text-red-700' : 'text-green-700'}`}>
                {formatILS(
                  isExceeded ? results.reductionNeededMonthly : results.monthlyRoomToThreshold,
                )}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Income summary */}
      <Card title="סיכום הכנסה">
        <Row label="הכנסה חודשית חייבת" value={formatILS(results.monthlyTaxableIncome)} />
        <Row label="הכנסה שנתית חייבת" value={formatILS(results.annualTaxableIncome)} />
        <Row label="תעריף שעתי" value={`${formatILS(results.hourlyRate)}/שע׳`} />
        <Row label="מדרגה שולית נוכחית" value={results.currentBracketLabel} />
      </Card>

      {/* Tax summary */}
      <Card title="סיכום מס">
        <Row label="מס שנתי לפני זיכויים" value={formatILS(results.annualTaxBeforeCredits)} />
        <Row label="מס שנתי אחרי זיכויים" value={formatILS(results.annualTaxAfterCredits)} />
        {results.annualSurtax > 0 && (
          <Row label="מס יסף שנתי" value={formatILS(results.annualSurtax)} />
        )}
        <Row label="מס חודשי (ממוצע)" value={formatILS(results.monthlyTaxAfterCredits)} />
        <Row label="שיעור מס אפקטיבי" value={formatPct(results.effectiveTaxRate)} />
        <Row label="נטו חודשי (לאחר מס)" value={formatILS(results.netMonthlyIncome)} />
      </Card>

      {/* Hours analysis */}
      <Card title={isExceeded ? 'נדרש לצמצם' : 'כמה עוד אפשר לעבוד'}>
        {!isExceeded ? (
          <>
            <Row
              label="שעות נוספות מותרות בחודש"
              value={formatHours(results.maxExtraMonthlyHours)}
            />
            <Row
              label="ממוצע שעות יומיות מותרות"
              value={formatHours(results.maxAvgDailyHours)}
            />
            <Row
              label="הכנסה חודשית נוספת מותרת"
              value={formatILS(results.monthlyRoomToThreshold)}
            />
          </>
        ) : (
          <>
            <Row
              label="הפחתת הכנסה חודשית נדרשת"
              value={formatILS(results.reductionNeededMonthly)}
            />
            <Row
              label="שעות חודשיות לצמצום"
              value={formatHours(results.reductionMonthlyHours)}
            />
            <Row
              label="שעות יומיות לצמצום"
              value={formatHours(results.reductionDailyHours)}
            />
          </>
        )}
      </Card>

      {/* Disclaimer */}
      <div className="text-xs text-gray-400 bg-gray-50 rounded-xl p-4 leading-relaxed">
        <strong>הערה חשובה:</strong> מחשבון זה הוא כלי הערכה בלבד ואינו מחליף ייעוץ של רואה חשבון
        או יועץ מס מוסמך. חישובי המס מבוססים על הנחות ייתכן שאינן מדויקות למצבך. מדרגות המס
        מתעדכנות מדי שנה — יש לוודא מול רשות המסים.
      </div>
    </div>
  );
}
