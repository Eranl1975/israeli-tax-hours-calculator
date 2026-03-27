import { useState, useMemo } from 'react';
import type { ExtractedData } from '../services/payslipExtractor';
import { calculateIncomeTax } from '../tax/incomeTaxEngine';
import { calculateNL } from '../tax/nlEngine';
import { INCOME_TAX_CONFIG_2025, INCOME_TAX_CONFIG_2026 } from '../tax/incomeTaxConfig';
import { NL_CONFIG_2025 } from '../tax/nlConfig';
import { FileUploadPanel } from '../components/FileUploadPanel';

// ─── helpers ─────────────────────────────────────────────────────────────────
function fmt(n: number) {
  return new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }).format(n);
}
function pct(n: number) {
  return (n * 100).toFixed(1) + '%';
}

// ─── sub-components ──────────────────────────────────────────────────────────

interface CalcResult {
  taxBase: number;
  incomeTax: number;
  creditReduction: number;
  taxBeforeCredits: number;
  marginalBracket: string;
  effectiveRate: number;
  nl: number;
  health: number;
  totalDeductions: number;
  netToBank: number;
  breakdowns: { label: string; rate: number; income: number; tax: number; isActive: boolean }[];
}

function compute(gross: number, creditPoints: number, pensionPct: number, isProposed: boolean): CalcResult {
  const config = isProposed ? INCOME_TAX_CONFIG_2026 : INCOME_TAX_CONFIG_2025;
  const pensionDeduction = (pensionPct / 100) * gross;
  const taxBase = Math.max(0, gross - pensionDeduction);
  const tr = calculateIncomeTax(taxBase, creditPoints, config);
  const nl = calculateNL(gross, NL_CONFIG_2025);
  const totalDeductions = tr.netTax + nl.blAmount + nl.healthAmount;
  return {
    taxBase,
    incomeTax: tr.netTax,
    creditReduction: tr.creditReduction,
    taxBeforeCredits: tr.taxBeforeCredits,
    marginalBracket: tr.marginalBracketLabel,
    effectiveRate: tr.effectiveRate,
    nl: nl.blAmount,
    health: nl.healthAmount,
    totalDeductions,
    netToBank: Math.max(0, gross - totalDeductions),
    breakdowns: tr.breakdowns.map(b => ({
      label: b.bracketLabel,
      rate: b.rate,
      income: b.incomeInBracket,
      tax: b.taxInBracket,
      isActive: b.isHighestReached,
    })),
  };
}

function ComparisonCard({
  title,
  subtitle,
  result,
  gross,
  savings,
}: {
  title: string;
  subtitle: string;
  result: CalcResult;
  gross: number;
  savings?: number; // positive = cheaper
}) {
  const [showBreakdown, setShowBreakdown] = useState(false);

  return (
    <div className={`rounded-2xl border-2 p-5 space-y-3 ${savings && savings > 0 ? 'border-green-400 bg-green-50' : 'border-gray-200 bg-white'}`}>
      {/* Title */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-gray-800 text-sm">{title}</h3>
          <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>
        </div>
        {savings !== undefined && savings > 0 && (
          <span className="bg-green-500 text-white text-xs font-bold rounded-full px-3 py-1">
            חיסכון {fmt(savings)}
          </span>
        )}
      </div>

      {/* Key figures */}
      <div className="space-y-2 text-sm">
        <Row label="ברוטו לתשלום" value={fmt(gross)} bold />
        <Row label="בסיס מס הכנסה" value={fmt(result.taxBase)} muted />
        <div className="border-t border-gray-100 pt-2 space-y-1.5">
          <Row label={`מס הכנסה (מדרגה שולית ${result.marginalBracket})`} value={fmt(result.incomeTax)} negative />
          <Row label="ביטוח לאומי" value={fmt(result.nl)} negative />
          <Row label="ביטוח בריאות" value={fmt(result.health)} negative />
        </div>
        <div className="border-t-2 border-gray-300 pt-2">
          <Row label="נטו לכיס" value={fmt(result.netToBank)} bold large />
        </div>
        <div className="flex gap-3 text-xs text-gray-500 pt-1">
          <span>שיעור אפקטיבי: <b className="text-gray-700">{pct(result.effectiveRate)}</b></span>
          <span>·</span>
          <span>סה"כ ניכויים: <b className="text-gray-700">{fmt(result.totalDeductions)}</b></span>
        </div>
      </div>

      {/* Bracket breakdown toggle */}
      <button
        onClick={() => setShowBreakdown(v => !v)}
        className="w-full text-xs text-blue-600 hover:text-blue-800 text-center py-1"
      >
        {showBreakdown ? '▲ הסתר פירוט מדרגות' : '▼ הצג פירוט מדרגות'}
      </button>

      {showBreakdown && (
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="px-3 py-1.5 text-right">מדרגה</th>
                <th className="px-3 py-1.5 text-right">הכנסה במדרגה</th>
                <th className="px-3 py-1.5 text-right">מס</th>
              </tr>
            </thead>
            <tbody>
              {result.breakdowns.map((b, i) => (
                <tr
                  key={i}
                  className={`border-t border-gray-100 ${
                    b.isActive ? 'bg-yellow-50 font-semibold text-yellow-800' : 'text-gray-700'
                  }`}
                >
                  <td className="px-3 py-1">{b.label}</td>
                  <td className="px-3 py-1">{fmt(b.income)}</td>
                  <td className="px-3 py-1">{fmt(b.tax)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  bold,
  large,
  muted,
  negative,
}: {
  label: string;
  value: string;
  bold?: boolean;
  large?: boolean;
  muted?: boolean;
  negative?: boolean;
}) {
  return (
    <div className={`flex justify-between items-center ${muted ? 'opacity-60' : ''}`}>
      <span className={`text-gray-600 ${bold ? 'font-bold' : ''} ${large ? 'text-base' : 'text-xs'}`}>{label}</span>
      <span className={`font-medium ${bold ? 'font-bold' : ''} ${large ? 'text-base' : 'text-sm'} ${negative ? 'text-red-600' : 'text-gray-900'}`}>
        {negative && value !== fmt(0) ? `−${value}` : value}
      </span>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const MONTHS = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];

export function MainPage() {
  const [gross, setGross] = useState<number>(0);
  const [creditPoints, setCreditPoints] = useState<number>(2.25);
  const [pensionPct, setPensionPct] = useState<number>(6);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(2025);
  const [showUpload, setShowUpload] = useState(false);

  // Auto-compute both scenarios — no button needed
  const current  = useMemo(() => compute(gross, creditPoints, pensionPct, false), [gross, creditPoints, pensionPct]);
  const proposed = useMemo(() => compute(gross, creditPoints, pensionPct, true),  [gross, creditPoints, pensionPct]);

  const taxSavings = current.incomeTax - proposed.incomeTax;
  const hasData = gross > 0;

  function handleImport(data: ExtractedData) {
    if (data.gross        !== undefined) setGross(data.gross);
    if (data.creditPoints !== undefined) setCreditPoints(data.creditPoints);
  }

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 shadow-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900">מנתח מדרגות מס</h1>
            <p className="text-xs text-gray-400">השוואת מדרגות 2025 מול הצעת 2026 — לפי ברוטו מהתלוש</p>
          </div>
          <button
            onClick={() => { setGross(0); setCreditPoints(2.25); setPensionPct(6); setMonth(new Date().getMonth()+1); setYear(2025); }}
            className="text-xs text-gray-400 hover:text-gray-700 border border-gray-200 hover:border-gray-400 rounded-lg px-3 py-1.5"
          >
            ↺ איפוס
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-5">

        {/* ── Upload section ────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <button
            onClick={() => setShowUpload(v => !v)}
            className="w-full flex items-center justify-between px-5 py-3.5 text-sm font-bold text-gray-700 hover:bg-gray-50"
          >
            <span>📂 העלה תלוש לחילוץ אוטומטי</span>
            <span className="text-gray-400">{showUpload ? '▲' : '▼'}</span>
          </button>
          {showUpload && (
            <div className="border-t border-gray-100 p-4">
              <FileUploadPanel onImport={handleImport} />
            </div>
          )}
        </div>

        {/* ── Inputs ────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-sm font-bold text-gray-700 mb-4">נתוני תלוש</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">

            {/* Gross — primary field */}
            <div className="col-span-2 sm:col-span-3">
              <label className="text-xs font-semibold text-gray-600 block mb-1">
                ברוטו לתשלום (₪)
              </label>
              <input
                type="number"
                value={gross || ''}
                onChange={e => setGross(parseFloat(e.target.value) || 0)}
                placeholder="לדוגמה: 18500"
                className="input-base text-lg font-bold w-full"
                min={0}
                step={100}
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1">נקודות זיכוי</label>
              <input
                type="number"
                value={creditPoints}
                onChange={e => setCreditPoints(parseFloat(e.target.value) || 0)}
                min={0} max={20} step={0.25}
                className="input-base"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1">הפרשה לפנסיה (%)</label>
              <input
                type="number"
                value={pensionPct}
                onChange={e => setPensionPct(parseFloat(e.target.value) || 0)}
                min={0} max={20} step={0.5}
                className="input-base"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1">חודש / שנה</label>
              <div className="flex gap-1">
                <select
                  value={month}
                  onChange={e => setMonth(parseInt(e.target.value))}
                  className="input-base flex-1 text-xs"
                >
                  {MONTHS.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
                </select>
                <select
                  value={year}
                  onChange={e => setYear(parseInt(e.target.value))}
                  className="input-base w-20 text-xs"
                >
                  <option value={2025}>2025</option>
                  <option value={2026}>2026</option>
                </select>
              </div>
            </div>

          </div>
        </div>

        {/* ── Results ───────────────────────────────────────────────── */}
        {!hasData ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center">
            <div className="text-4xl mb-3">📊</div>
            <p className="text-gray-400 text-sm">הזן סכום ברוטו מהתלוש כדי לראות השוואת מדרגות</p>
            <p className="text-gray-300 text-xs mt-1">או העלה תלוש לחילוץ אוטומטי</p>
          </div>
        ) : (
          <>
            {/* Savings banner */}
            {taxSavings > 0 && (
              <div className="bg-green-600 text-white rounded-2xl px-5 py-4 flex items-center justify-between">
                <div>
                  <p className="font-bold text-base">💰 חיסכון חודשי בהצעת 2026</p>
                  <p className="text-green-100 text-xs mt-0.5">
                    ירידה במס הכנסה בלבד — ב"ל ובריאות נשארים זהים
                  </p>
                </div>
                <div className="text-3xl font-black">{fmt(taxSavings)}</div>
              </div>
            )}

            {/* Two comparison cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <ComparisonCard
                title="מדרגות 2025"
                subtitle="מדרגות קיימות"
                result={current}
                gross={gross}
              />
              <ComparisonCard
                title="מדרגות 2026 (מוצע)"
                subtitle="לפי הצעת הממשלה"
                result={proposed}
                gross={gross}
                savings={taxSavings > 0 ? taxSavings : undefined}
              />
            </div>

            {/* Bracket transition indicator */}
            <BracketTransitionInfo current={current} proposed={proposed} gross={gross} pensionPct={pensionPct} />
          </>
        )}

      </main>
    </div>
  );
}

// ─── Bracket transition helper ────────────────────────────────────────────────

function BracketTransitionInfo({ current, proposed, gross, pensionPct }: {
  current: CalcResult; proposed: CalcResult; gross: number; pensionPct: number;
}) {
  const c2025 = INCOME_TAX_CONFIG_2025;
  const c2026 = INCOME_TAX_CONFIG_2026;
  const taxBase = Math.max(0, gross - (pensionPct / 100) * gross);

  // Find next bracket threshold for each config
  function nextThreshold(config: typeof c2025) {
    const next = config.brackets.find(b => b.max !== null && taxBase < b.max);
    if (!next || next.max === null) return null;
    return { threshold: next.max, rate: config.brackets[config.brackets.indexOf(next) + 1]?.rate };
  }

  const next2025 = nextThreshold(c2025);
  const next2026 = nextThreshold(c2026);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-sm space-y-2">
      <h3 className="font-bold text-gray-700 text-xs mb-3">📈 מעבר מדרגה הבא</h3>
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="space-y-1">
          <p className="font-semibold text-gray-500">מדרגות 2025 — מדרגה שולית: <span className="text-gray-800">{current.marginalBracket}</span></p>
          {next2025 ? (
            <p className="text-gray-600">
              מעבר למדרגה הבאה בעוד{' '}
              <span className="font-bold text-orange-600">{fmt(next2025.threshold - taxBase)}</span>
              {' '}ברוטו חודשי
            </p>
          ) : (
            <p className="text-gray-400">במדרגה המקסימלית</p>
          )}
        </div>
        <div className="space-y-1">
          <p className="font-semibold text-gray-500">מדרגות 2026 — מדרגה שולית: <span className="text-gray-800">{proposed.marginalBracket}</span></p>
          {next2026 ? (
            <p className="text-gray-600">
              מעבר למדרגה הבאה בעוד{' '}
              <span className="font-bold text-orange-600">{fmt(next2026.threshold - taxBase)}</span>
              {' '}ברוטו חודשי
            </p>
          ) : (
            <p className="text-gray-400">במדרגה המקסימלית</p>
          )}
        </div>
      </div>
    </div>
  );
}
