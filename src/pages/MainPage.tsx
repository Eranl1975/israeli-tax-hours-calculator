import { useState, useMemo } from 'react';
import type { PayslipData, PayslipComponent, ResultTab } from '../models/types';
import { calculateResults } from '../domain/calculationEngine';
import { getIncomeTaxConfigByYear } from '../tax/incomeTaxConfig';
import { createMockPayslip } from '../domain/mockData';
import { exportToCSV, exportToJSON } from '../utils/exportUtils';
import { PayslipHeaderForm } from '../components/PayslipHeaderForm';
import { ComponentsTable } from '../components/ComponentsTable';
import { SummaryInputs } from '../components/SummaryInputs';
import { SummaryCards } from '../components/SummaryCards';
import { TaxBracketTable } from '../components/TaxBracketTable';
import { ReconciliationPanel } from '../components/ReconciliationPanel';
import { ComponentAnalysis } from '../components/ComponentAnalysis';
import { FileUploadPanel } from '../components/FileUploadPanel';

const EMPTY_PAYSLIP: PayslipData = {
  header: {
    taxYear: 2025,
    taxMonth: new Date().getMonth() + 1,
    employerName: '',
    creditPoints: 2.25,
    employeePensionPct: 6,
  },
  components: [],
  actuals: {
    totalPayments: 0,
    totalMandatoryTaxDeductions: 0,
    actualIncomeTax: 0,
    actualNL: 0,
    actualHealth: 0,
    actualSocialDeductions: 0,
    actualNetToBank: 0,
  },
};

const TAB_LABELS: Record<ResultTab, string> = {
  summary: 'סיכום',
  brackets: 'מדרגות',
  components: 'רכיבים',
  reconciliation: 'התאמה',
};

export function MainPage() {
  const [data, setData] = useState<PayslipData>(EMPTY_PAYSLIP);
  const [activeTab, setActiveTab] = useState<ResultTab>('summary');
  const [showUpload, setShowUpload] = useState(false);
  const [calculated, setCalculated] = useState(false);

  const config = getIncomeTaxConfigByYear(data.header.taxYear);
  const results = useMemo(() => {
    if (data.components.filter(c => !c.componentType.startsWith('deduction')).length === 0) {
      return null;
    }
    try { return calculateResults(data); } catch { return null; }
  }, [data]);

  function handleImportComponents(comps: PayslipComponent[]) {
    setData(prev => ({ ...prev, components: [...prev.components, ...comps] }));
  }

  function handleReset() {
    setData(EMPTY_PAYSLIP);
    setCalculated(false);
  }

  function handleLoadMock() {
    setData(createMockPayslip());
    setCalculated(true);
  }

  const hasComponents = data.components.length > 0;
  const hasResults = results !== null;

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900">מנתח תלוש שכר</h1>
            <p className="text-xs text-gray-400 mt-0.5">חישוב מס, ביטוח לאומי והתאמת תלוש — לשכירים בישראל</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleLoadMock}
              className="text-xs border border-gray-200 hover:border-blue-300 text-gray-500 hover:text-blue-600 rounded-lg px-3 py-1.5 transition-colors"
            >
              טען דוגמה
            </button>
            {hasResults && (
              <>
                <button
                  onClick={() => exportToCSV(data, results!)}
                  className="text-xs border border-gray-200 hover:border-green-300 text-gray-500 hover:text-green-700 rounded-lg px-3 py-1.5 transition-colors"
                >
                  ↓ CSV
                </button>
                <button
                  onClick={() => exportToJSON(data, results!)}
                  className="text-xs border border-gray-200 hover:border-blue-300 text-gray-500 hover:text-blue-700 rounded-lg px-3 py-1.5 transition-colors"
                >
                  ↓ JSON
                </button>
              </>
            )}
            <button
              onClick={handleReset}
              className="text-sm text-gray-500 hover:text-gray-800 border border-gray-200 hover:border-gray-400 rounded-lg px-4 py-1.5 transition-colors font-medium"
            >
              ↺ איפוס
            </button>
          </div>
        </div>
      </header>

      {/* Main layout */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_420px] gap-6 items-start">

          {/* Left column: inputs */}
          <div className="space-y-4">
            {/* Header form */}
            <PayslipHeaderForm
              header={data.header}
              onChange={h => setData(prev => ({ ...prev, header: h }))}
            />

            {/* Upload accordion */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <button
                onClick={() => setShowUpload(v => !v)}
                className="w-full flex items-center justify-between px-5 py-4 text-sm font-bold text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <span>📂 העלאת תלוש לזיהוי אוטומטי</span>
                <span className="text-gray-400">{showUpload ? '▲' : '▼'}</span>
              </button>
              {showUpload && (
                <div className="border-t border-gray-100">
                  <div className="p-4">
                    <FileUploadPanel onImport={handleImportComponents} />
                  </div>
                </div>
              )}
            </div>

            {/* Components table */}
            <ComponentsTable
              components={data.components}
              suspiciousIds={results?.suspiciousComponentIds ?? []}
              onChange={comps => setData(prev => ({ ...prev, components: comps }))}
            />

            {/* Actual figures from payslip */}
            <SummaryInputs
              actuals={data.actuals}
              onChange={actuals => setData(prev => ({ ...prev, actuals }))}
            />

            {/* Calculate button */}
            <button
              onClick={() => setCalculated(true)}
              disabled={!hasComponents}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold rounded-xl py-3.5 text-base transition-colors shadow-sm"
            >
              {hasResults ? '↻ חשב מחדש' : 'חשב'}
            </button>
            {!hasComponents && (
              <p className="text-xs text-gray-400 text-center -mt-2">
                הוסף רכיבי שכר לטבלה כדי לחשב
              </p>
            )}
          </div>

          {/* Right column: results */}
          <div>
            {!hasResults || !calculated ? (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center xl:sticky xl:top-24">
                <div className="text-4xl mb-3">📊</div>
                <p className="text-gray-400 text-sm">
                  {hasComponents
                    ? 'לחץ "חשב" כדי לראות תוצאות'
                    : 'הוסף רכיבי שכר מהטבלה ולחץ "חשב"'}
                </p>
                {!hasComponents && (
                  <button
                    onClick={handleLoadMock}
                    className="mt-4 text-xs text-blue-600 hover:text-blue-800 underline"
                  >
                    טען תלוש לדוגמה
                  </button>
                )}
              </div>
            ) : (
              <div className="xl:sticky xl:top-24 space-y-4">
                {/* Tabs */}
                <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
                  {(Object.keys(TAB_LABELS) as ResultTab[]).map(tab => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-colors ${
                        activeTab === tab
                          ? 'bg-white text-gray-900 shadow-sm'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      {TAB_LABELS[tab]}
                    </button>
                  ))}
                </div>

                {/* Tab content */}
                {activeTab === 'summary' && (
                  <SummaryCards
                    results={results!}
                    actuals={data.actuals}
                    creditPoints={data.header.creditPoints}
                  />
                )}
                {activeTab === 'brackets' && (
                  <TaxBracketTable
                    breakdowns={results!.bracketBreakdown}
                    config={config}
                    incomeTaxBase={results!.incomeTaxBase}
                  />
                )}
                {activeTab === 'components' && (
                  <ComponentAnalysis
                    components={data.components}
                    suspiciousIds={results!.suspiciousComponentIds}
                  />
                )}
                {activeTab === 'reconciliation' && (
                  <ReconciliationPanel
                    results={results!}
                    actuals={data.actuals}
                  />
                )}
              </div>
            )}
          </div>

        </div>
      </main>
    </div>
  );
}
