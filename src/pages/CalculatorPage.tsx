import { useState, useMemo } from 'react';
import type { UserInputs } from '../domain/types';
import { calculateResults } from '../domain/thresholdEngine';
import { getTaxConfigById, ALL_TAX_CONFIGS } from '../config/taxConfigs';
import { APP_CONFIG } from '../config/appConfig';
import { InputForm } from '../components/InputForm';
import { ResultsCards } from '../components/ResultsCards';

const DEFAULT_CONFIG_ID = ALL_TAX_CONFIGS.find(c => c.isDefault)?.id ?? ALL_TAX_CONFIGS[0].id;

const DEFAULT_INPUTS: UserInputs = {
  baseMonthlyGross: 15000,
  plannedMonthlyHours: APP_CONFIG.defaultMonthlyHours,
  workdaysInMonth: APP_CONFIG.defaultWorkdaysInMonth,
  creditPoints: APP_CONFIG.defaultCreditPoints,
  targetBracketIndex: 2, // Default: stay under 20% bracket
  hourlyRateOverride: 0,
  additionalTaxableMonthly: 0,
  overtimeIncome: 0,
  bonusIncome: 0,
  secondEmployerIncome: 0,
  pensionContributionPct: APP_CONFIG.defaultPensionContributionPct,
  scenarioName: '',
  taxConfigId: DEFAULT_CONFIG_ID,
};

export function CalculatorPage() {
  const [inputs, setInputs] = useState<UserInputs>(DEFAULT_INPUTS);

  const config = useMemo(() => getTaxConfigById(inputs.taxConfigId), [inputs.taxConfigId]);

  const results = useMemo(() => {
    try {
      return calculateResults(inputs, config);
    } catch {
      return null;
    }
  }, [inputs, config]);

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">מחשבון שכר ושעות</h1>
            <p className="text-xs text-gray-400 mt-0.5">חישוב חכם לשכירים בישראל</p>
          </div>
          <button
            onClick={() => setInputs(DEFAULT_INPUTS)}
            className="text-sm text-gray-400 hover:text-gray-700 border border-gray-200 rounded-lg px-3 py-1.5 transition-colors"
          >
            איפוס
          </button>
        </div>
      </header>

      {/* Main layout */}
      <main className="max-w-5xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: inputs */}
          <div>
            <InputForm
              inputs={inputs}
              taxConfigs={ALL_TAX_CONFIGS}
              onChange={setInputs}
            />

            {/* Credit point note */}
            <div className="mt-4 text-xs text-gray-400 bg-blue-50 rounded-xl p-4 leading-relaxed">
              <strong>נקודות זיכוי:</strong> מפחיתות את גובה המס — לא את ההכנסה החייבת.
              ערך נקודת זיכוי: <strong>₪{config.creditPointMonthlyValue}/חודש</strong> לפי התצורה הנוכחית.
            </div>
          </div>

          {/* Right: results */}
          <div>
            {results ? (
              <ResultsCards
                results={results}
                config={config}
                targetBracketIndex={inputs.targetBracketIndex}
              />
            ) : (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 text-center text-gray-400">
                יש להזין נתונים כדי לראות תוצאות
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
