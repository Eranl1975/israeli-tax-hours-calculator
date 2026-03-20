import { useState } from 'react';
import type { UserInputs } from '../domain/types';
import { calculateResults } from '../domain/thresholdEngine';
import { getTaxConfigById, ALL_TAX_CONFIGS } from '../config/taxConfigs';
import { APP_CONFIG } from '../config/appConfig';
import { InputForm } from '../components/InputForm';
import { ResultsCards } from '../components/ResultsCards';
import { ComparisonView } from '../components/ComparisonView';
import { PayslipUploader } from '../components/PayslipUploader';
import type { ExtractedPayslipData } from '../services/payslipExtractor';

const DEFAULT_CONFIG_ID = ALL_TAX_CONFIGS.find(c => c.isDefault)?.id ?? ALL_TAX_CONFIGS[0].id;

const DEFAULT_INPUTS: UserInputs = {
  baseMonthlyGross: 0,
  plannedMonthlyHours: APP_CONFIG.defaultMonthlyHours,
  workdaysInMonth: APP_CONFIG.defaultWorkdaysInMonth,
  creditPoints: APP_CONFIG.defaultCreditPoints,
  targetBracketIndex: 2,
  hourlyRateOverride: 0,
  additionalTaxableMonthly: 0,
  overtimeIncome: 0,
  bonusIncome: 0,
  secondEmployerIncome: 0,
  pensionContributionPct: APP_CONFIG.defaultPensionContributionPct,
  scenarioName: '',
  taxConfigId: DEFAULT_CONFIG_ID,
};

type Tab = 'results' | 'comparison';

export function CalculatorPage() {
  const [inputs, setInputs] = useState<UserInputs>(DEFAULT_INPUTS);
  // Snapshot of inputs at the moment "חשב" was clicked
  const [submitted, setSubmitted] = useState<UserInputs | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('results');

  const config = submitted ? getTaxConfigById(submitted.taxConfigId) : getTaxConfigById(inputs.taxConfigId);

  const results = submitted
    ? (() => {
        try { return calculateResults(submitted, config); } catch { return null; }
      })()
    : null;

  function handleCalculate() {
    setSubmitted({ ...inputs });
    setActiveTab('results');
  }

  function handleReset() {
    setInputs(DEFAULT_INPUTS);
    setSubmitted(null);
    setActiveTab('results');
  }

  function handleApplyPayslip(data: ExtractedPayslipData) {
    setInputs(prev => ({
      ...prev,
      ...(data.baseMonthlyGross !== undefined && { baseMonthlyGross: data.baseMonthlyGross }),
      ...(data.plannedMonthlyHours !== undefined && { plannedMonthlyHours: data.plannedMonthlyHours }),
      ...(data.workdaysInMonth !== undefined && { workdaysInMonth: data.workdaysInMonth }),
      ...(data.creditPoints !== undefined && { creditPoints: data.creditPoints }),
      ...(data.pensionContributionPct !== undefined && { pensionContributionPct: data.pensionContributionPct }),
      ...(data.overtimeIncome !== undefined && { overtimeIncome: data.overtimeIncome }),
      ...(data.bonusIncome !== undefined && { bonusIncome: data.bonusIncome }),
      ...(data.additionalTaxableMonthly !== undefined && { additionalTaxableMonthly: data.additionalTaxableMonthly }),
      ...(data.secondEmployerIncome !== undefined && { secondEmployerIncome: data.secondEmployerIncome }),
    }));
    setSubmitted(null); // Reset results so user clicks "חשב" again after auto-fill
  }

  const hasResults = submitted !== null && results !== null;

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 shadow-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">מחשבון שכר ושעות</h1>
            <p className="text-xs text-gray-400 mt-0.5">חישוב חכם לשכירים בישראל</p>
          </div>
          <button
            onClick={handleReset}
            className="text-sm text-gray-500 hover:text-gray-800 border border-gray-200 hover:border-gray-400 rounded-lg px-4 py-1.5 transition-colors font-medium"
          >
            ↺ איפוס
          </button>
        </div>
      </header>

      {/* Main layout */}
      <main className="max-w-5xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

          {/* Left column: form */}
          <div className="flex flex-col gap-4">
            <PayslipUploader onApply={handleApplyPayslip} />
            <InputForm
              inputs={inputs}
              taxConfigs={ALL_TAX_CONFIGS}
              onChange={newInputs => {
                setInputs(newInputs);
              }}
            />

            {/* Credit point note */}
            <div className="text-xs text-gray-500 bg-blue-50 rounded-xl p-4 leading-relaxed">
              <strong>נקודות זיכוי:</strong> מפחיתות את גובה המס — לא את ההכנסה החייבת.
              ערך נקודת זיכוי: <strong>₪{config.creditPointMonthlyValue}/חודש</strong> לפי התצורה הנבחרת.
            </div>

            {/* Calculate button */}
            <button
              onClick={handleCalculate}
              disabled={inputs.baseMonthlyGross <= 0}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold rounded-xl py-3.5 text-base transition-colors shadow-sm"
            >
              חשב
            </button>
            {inputs.baseMonthlyGross <= 0 && (
              <p className="text-xs text-gray-400 text-center -mt-2">יש להזין שכר ברוטו חודשי</p>
            )}
          </div>

          {/* Right column: results */}
          <div>
            {!hasResults ? (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
                <div className="text-4xl mb-3">🧮</div>
                <p className="text-gray-400 text-sm">הזן נתונים ולחץ <strong>חשב</strong> כדי לראות תוצאות</p>
              </div>
            ) : (
              <>
                {/* Tabs */}
                <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-4">
                  <button
                    onClick={() => setActiveTab('results')}
                    className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${
                      activeTab === 'results'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    תוצאות
                  </button>
                  <button
                    onClick={() => setActiveTab('comparison')}
                    className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${
                      activeTab === 'comparison'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    השוואה 2025 vs 2026
                  </button>
                </div>

                {activeTab === 'results' && (
                  <ResultsCards
                    results={results}
                    config={config}
                    targetBracketIndex={submitted.targetBracketIndex}
                  />
                )}

                {activeTab === 'comparison' && (
                  <ComparisonView inputs={submitted} />
                )}
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
