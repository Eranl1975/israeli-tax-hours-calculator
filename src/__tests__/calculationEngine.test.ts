import { describe, it, expect } from 'vitest';
import { calculateResults } from '../domain/calculationEngine';
import { createMockPayslip } from '../domain/mockData';
import { createComponent } from '../services/componentClassifier';
import type { PayslipData } from '../models/types';

describe('calculateResults — mock payslip', () => {
  const mock = createMockPayslip();
  const results = calculateResults(mock);

  it('directPayTotal includes wages + overtime + car allowance', () => {
    // שכר משולב 20987 + 2525.36 + 114.16 + חלף רכב 3800
    expect(results.directPayTotal).toBeCloseTo(27426.52, 1);
  });

  it('valueInKindTotal = sum of זקיפות', () => {
    // 600 + 448.54 + 500 + 500
    expect(results.valueInKindTotal).toBeCloseTo(2048.54, 1);
  });

  it('incomeTaxBase is positive', () => {
    expect(results.incomeTaxBase).toBeGreaterThan(0);
  });

  it('theoreticalIncomeTax is positive', () => {
    expect(results.theoreticalIncomeTax).toBeGreaterThan(0);
  });

  it('incomeTaxDifference = theoretical - actual', () => {
    const expected = results.theoreticalIncomeTax - mock.actuals.actualIncomeTax;
    expect(results.incomeTaxDifference).toBeCloseTo(expected, 1);
  });

  it('theoreticalNetToBank is computed', () => {
    expect(results.theoreticalNetToBank).toBeGreaterThan(0);
  });

  it('bracketBreakdown is non-empty', () => {
    expect(results.bracketBreakdown.length).toBeGreaterThan(0);
  });

  it('suspiciousComponentIds is an array', () => {
    expect(Array.isArray(results.suspiciousComponentIds)).toBe(true);
  });
});

describe('calculateResults — minimal manual payslip', () => {
  it('single direct_pay component with zero credit points', () => {
    const data: PayslipData = {
      header: { taxYear: 2025, taxMonth: 1, creditPoints: 0, employeePensionPct: 0 },
      components: [createComponent('שכר יסוד', 10000, 'manual')],
      actuals: {
        totalPayments: 10000,
        totalMandatoryTaxDeductions: 0,
        actualIncomeTax: 0,
        actualNL: 0,
        actualHealth: 0,
        actualSocialDeductions: 0,
        actualNetToBank: 0,
      },
    };
    const r = calculateResults(data);
    // 10% on 7010 + 14% on (10000-7010)
    const expectedTax = 7010 * 0.10 + (10000 - 7010) * 0.14;
    expect(r.theoreticalIncomeTax).toBeCloseTo(expectedTax, 0);
  });

  it('deduction components are excluded from tax base', () => {
    const data: PayslipData = {
      header: { taxYear: 2025, taxMonth: 1, creditPoints: 0, employeePensionPct: 0 },
      components: [
        createComponent('שכר יסוד', 10000, 'manual'),
        createComponent('מס הכנסה', -1500, 'manual'),
      ],
      actuals: {
        totalPayments: 10000, totalMandatoryTaxDeductions: 1500,
        actualIncomeTax: 1500, actualNL: 0, actualHealth: 0,
        actualSocialDeductions: 0, actualNetToBank: 8500,
      },
    };
    const r = calculateResults(data);
    // tax base should still be 10000, not 8500
    expect(r.incomeTaxBase).toBeCloseTo(10000, 0);
  });
});

describe('classifyComponent', () => {
  it('שכר משולב → direct_pay', () => {
    const c = createComponent('שכר משולב', 20000, 'manual');
    expect(c.componentType).toBe('direct_pay');
    expect(c.incomeTaxable).toBe(true);
  });

  it('שעות נוספות 125% → overtime_125', () => {
    const c = createComponent('שעות נוספות 125%', 1000, 'manual');
    expect(c.componentType).toBe('overtime_125');
  });

  it('מס הכנסה → deduction_income_tax', () => {
    const c = createComponent('מס הכנסה', -1500, 'manual');
    expect(c.componentType).toBe('deduction_income_tax');
    expect(c.incomeTaxable).toBe(false);
  });

  it('שווי ארוחות → value_in_kind', () => {
    const c = createComponent('שווי ארוחות', 600, 'manual');
    expect(c.componentType).toBe('value_in_kind');
    expect(c.isCashPayment).toBe(false);
  });

  it('שווי ארוחות מגולם → grossed_up', () => {
    const c = createComponent('שווי ארוחות מגולם', 923, 'manual');
    expect(c.componentType).toBe('grossed_up');
  });

  it('unknown description → other with uncertain taxability', () => {
    const c = createComponent('תשלום מיוחד לא מוכר', 500, 'manual');
    expect(c.componentType).toBe('other');
    expect(c.incomeTaxable).toBe('uncertain');
  });
});
