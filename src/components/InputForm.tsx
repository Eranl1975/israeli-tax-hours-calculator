import React from 'react';
import type { UserInputs } from '../domain/types';
import type { TaxConfig } from '../domain/types';
import { APP_CONFIG } from '../config/appConfig';

interface Props {
  inputs: UserInputs;
  taxConfigs: TaxConfig[];
  onChange: (inputs: UserInputs) => void;
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-gray-700">{label}</label>
      {children}
      {hint && <span className="text-xs text-gray-400">{hint}</span>}
    </div>
  );
}

function NumInput({
  value,
  onChange,
  min = 0,
  step = 1,
  placeholder = '',
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  step?: number;
  placeholder?: string;
}) {
  return (
    <input
      type="number"
      value={value === 0 ? '' : value}
      min={min}
      step={step}
      placeholder={placeholder}
      onChange={e => onChange(parseFloat(e.target.value) || 0)}
      className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
    />
  );
}

export function InputForm({ inputs, taxConfigs, onChange }: Props) {
  const set = <K extends keyof UserInputs>(key: K, value: UserInputs[K]) =>
    onChange({ ...inputs, [key]: value });

  const selectedConfig = taxConfigs.find(c => c.id === inputs.taxConfigId) ?? taxConfigs[0];

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <h2 className="text-lg font-bold text-gray-800 mb-5">נתוני שכר</h2>

      {/* Tax Config Selector */}
      <div className="mb-6 p-4 bg-blue-50 rounded-xl border border-blue-100">
        <label className="text-sm font-medium text-gray-700 block mb-2">תצורת מס</label>
        <select
          value={inputs.taxConfigId}
          onChange={e => set('taxConfigId', e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {taxConfigs.map(c => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {selectedConfig.notes && (
          <p className="text-xs text-amber-600 mt-2">⚠ {selectedConfig.notes}</p>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Core salary */}
        <Field label="שכר ברוטו חודשי (₪)" hint="השכר הבסיסי ללא תוספות">
          <NumInput
            value={inputs.baseMonthlyGross}
            onChange={v => set('baseMonthlyGross', v)}
            step={100}
            placeholder="לדוגמה: 15000"
          />
        </Field>

        <Field label="שעות עבודה מתוכננות בחודש" hint="כולל שעות רגילות">
          <NumInput
            value={inputs.plannedMonthlyHours}
            onChange={v => set('plannedMonthlyHours', v)}
            step={0.5}
            placeholder={String(APP_CONFIG.defaultMonthlyHours)}
          />
        </Field>

        <Field label="ימי עבודה בחודש">
          <NumInput
            value={inputs.workdaysInMonth}
            onChange={v => set('workdaysInMonth', v)}
            step={1}
            placeholder={String(APP_CONFIG.defaultWorkdaysInMonth)}
          />
        </Field>

        <Field label="נקודות זיכוי" hint="ממוצע לעובד שכיר נשוי: 2.25">
          <NumInput
            value={inputs.creditPoints}
            onChange={v => set('creditPoints', v)}
            step={0.25}
            placeholder={String(APP_CONFIG.defaultCreditPoints)}
          />
        </Field>

        {/* Target bracket */}
        <Field label="מדרגת מס מקסימלית (יעד)" hint="המדרגה שאינך רוצה לעבור">
          <select
            value={inputs.targetBracketIndex}
            onChange={e => set('targetBracketIndex', parseInt(e.target.value))}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {selectedConfig.brackets.map((b, i) => (
              <option key={i} value={i}>
                {b.label} — עד{' '}
                {b.max !== null
                  ? `₪${b.max.toLocaleString('he-IL')}`
                  : 'ללא תקרה'}{' '}
                לשנה
              </option>
            ))}
          </select>
        </Field>

        <Field label="תעריף שעתי (₪, אופציונלי)" hint="ריק = חישוב אוטומטי מהשכר">
          <NumInput
            value={inputs.hourlyRateOverride}
            onChange={v => set('hourlyRateOverride', v)}
            step={1}
            placeholder="חישוב אוטומטי"
          />
        </Field>
      </div>

      {/* Additional income */}
      <details className="mt-6">
        <summary className="cursor-pointer text-sm font-medium text-blue-600 hover:text-blue-800 select-none">
          + הכנסות נוספות ותוספות
        </summary>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
          <Field label="הכנסה חייבת נוספת חודשית (₪)">
            <NumInput value={inputs.additionalTaxableMonthly} onChange={v => set('additionalTaxableMonthly', v)} step={100} />
          </Field>
          <Field label="שעות נוספות (₪ חודשי)">
            <NumInput value={inputs.overtimeIncome} onChange={v => set('overtimeIncome', v)} step={100} />
          </Field>
          <Field label="בונוס (₪ חודשי ממוצע)">
            <NumInput value={inputs.bonusIncome} onChange={v => set('bonusIncome', v)} step={100} />
          </Field>
          <Field label="הכנסה ממעסיק שני (₪ חודשי)" hint="מצריך תיאום מס">
            <NumInput value={inputs.secondEmployerIncome} onChange={v => set('secondEmployerIncome', v)} step={100} />
          </Field>
          <Field label="אחוז הפרשה לפנסיה (עובד, %)" hint="לדוגמה: 6">
            <NumInput
              value={inputs.pensionContributionPct}
              onChange={v => set('pensionContributionPct', Math.min(20, v))}
              step={0.5}
              placeholder={String(APP_CONFIG.defaultPensionContributionPct)}
            />
          </Field>
          <Field label="שם תרחיש (אופציונלי)">
            <input
              type="text"
              value={inputs.scenarioName}
              onChange={e => set('scenarioName', e.target.value)}
              placeholder="למשל: תרחיש בסיס"
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
            />
          </Field>
        </div>
      </details>
    </div>
  );
}
