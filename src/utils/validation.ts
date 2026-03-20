export interface ValidationError {
  field: string;
  message: string;
}

export function validateInputs(inputs: Record<string, unknown>): ValidationError[] {
  const errors: ValidationError[] = [];
  const num = (key: string) => Number(inputs[key]);

  if (num('baseMonthlyGross') < 0) errors.push({ field: 'baseMonthlyGross', message: 'שכר לא יכול להיות שלילי' });
  if (num('plannedMonthlyHours') <= 0) errors.push({ field: 'plannedMonthlyHours', message: 'יש להזין מספר שעות חיובי' });
  if (num('workdaysInMonth') <= 0) errors.push({ field: 'workdaysInMonth', message: 'יש להזין מספר ימי עבודה חיובי' });
  if (num('creditPoints') < 0) errors.push({ field: 'creditPoints', message: 'נקודות זיכוי לא יכולות להיות שליליות' });
  const pension = num('pensionContributionPct');
  if (pension < 0 || pension > 20) errors.push({ field: 'pensionContributionPct', message: 'אחוז פנסיה חייב להיות בין 0 ל-20' });

  return errors;
}
