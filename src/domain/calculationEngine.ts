// ============================================================
// Main Calculation Engine
// Orchestrates income tax + NL + component analysis.
// ============================================================

import type {
  PayslipData,
  PayslipComponent,
  ComponentType,
  CalculationResults,
} from '../models/types';
import { calculateIncomeTax } from '../tax/incomeTaxEngine';
import { calculateNL } from '../tax/nlEngine';
import { INCOME_TAX_CONFIG_2025, getIncomeTaxConfigByYear } from '../tax/incomeTaxConfig';
import { NL_CONFIG_2025 } from '../tax/nlConfig';
import { buildReconciliation } from './reconciliation';

// Component types that represent actual cash payments
const CASH_PAYMENT_TYPES: ComponentType[] = [
  'direct_pay', 'overtime_125', 'overtime_150', 'car_allowance',
  'retro', 'other_payment',
];

// Component types that are deductions (not in tax base)
export const DEDUCTION_TYPES: ComponentType[] = [
  'deduction_income_tax', 'deduction_nl', 'deduction_health',
  'deduction_social', 'deduction_other',
];

// Non-cash but taxable (value-in-kind)
const VALUE_IN_KIND_TYPES: ComponentType[] = ['value_in_kind'];
const GROSSED_UP_TYPES: ComponentType[] = ['grossed_up'];
const CORRECTION_TYPES: ComponentType[] = ['gross_correction', 'retro'];

function isDeduction(c: PayslipComponent): boolean {
  return DEDUCTION_TYPES.includes(c.componentType);
}

function sumBy(components: PayslipComponent[], filter: (c: PayslipComponent) => boolean): number {
  return components.filter(filter).reduce((s, c) => s + c.amount, 0);
}

export function calculateResults(data: PayslipData): CalculationResults {
  const { header, components } = data;
  const config = getIncomeTaxConfigByYear(header.taxYear);
  const nlConfig = NL_CONFIG_2025; // TODO: multi-year NL config

  const payments = components.filter(c => !isDeduction(c));

  // --- Income breakdown ---
  const directPayTotal = sumBy(payments, c =>
    CASH_PAYMENT_TYPES.includes(c.componentType),
  );
  const valueInKindTotal = sumBy(payments, c =>
    VALUE_IN_KIND_TYPES.includes(c.componentType),
  );
  const grossedUpTotal = sumBy(payments, c =>
    GROSSED_UP_TYPES.includes(c.componentType),
  );
  const correctionTotal = sumBy(payments, c =>
    CORRECTION_TYPES.includes(c.componentType),
  );

  const totalPaymentsCalc = directPayTotal + valueInKindTotal + grossedUpTotal + correctionTotal;
  const grossCashPay = directPayTotal + correctionTotal;

  // --- Pension deduction from tax base ---
  const pensionDeduction = (header.employeePensionPct / 100) * grossCashPay;

  // --- Income tax base ---
  // Only components explicitly marked incomeTaxable=true
  const definitelyTaxable = sumBy(payments, c => c.incomeTaxable === true);
  const uncertainTaxable = sumBy(payments, c => c.incomeTaxable === 'uncertain');
  const incomeTaxBase = Math.max(0, definitelyTaxable - pensionDeduction);
  const incomeTaxBaseWithUncertain = Math.max(0, definitelyTaxable + uncertainTaxable - pensionDeduction);

  // --- NL base ---
  const nlBase = sumBy(payments, c => c.nlTaxable === true);

  // --- Income tax calculation ---
  const taxResult = calculateIncomeTax(incomeTaxBase, header.creditPoints, config);

  // --- NL calculation ---
  const nlResult = calculateNL(nlBase, nlConfig);

  // --- Theoretical net ---
  const theoreticalNetToBank =
    grossCashPay - taxResult.netTax - nlResult.blAmount - nlResult.healthAmount;

  // --- Reconciliation ---
  const reconciliation = buildReconciliation({
    data,
    theoreticalIncomeTax: taxResult.netTax,
    theoreticalNL: nlResult.blAmount,
    theoreticalHealth: nlResult.healthAmount,
    incomeTaxBase,
    incomeTaxBaseWithUncertain,
    config,
  });

  return {
    directPayTotal,
    valueInKindTotal,
    grossedUpTotal,
    correctionTotal,
    totalPaymentsCalc,
    incomeTaxBase,
    incomeTaxBaseWithUncertain,
    nlBase,
    pensionDeduction,
    taxBeforeCredits: taxResult.taxBeforeCredits,
    creditPointsReduction: taxResult.creditReduction,
    theoreticalIncomeTax: taxResult.netTax,
    surtax: taxResult.surtax,
    effectiveTaxRate: taxResult.effectiveRate,
    marginalBracketLabel: taxResult.marginalBracketLabel,
    bracketBreakdown: taxResult.breakdowns,
    theoreticalNL: nlResult.blAmount,
    theoreticalHealth: nlResult.healthAmount,
    grossCashPay,
    theoreticalNetToBank,
    ...reconciliation,
  };
}

// Default config export for UI selectors
export { INCOME_TAX_CONFIG_2025 };
