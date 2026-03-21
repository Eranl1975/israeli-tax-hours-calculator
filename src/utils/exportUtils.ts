import type { PayslipData, CalculationResults } from '../models/types';

function csvRow(...cells: (string | number)[]): string {
  return cells.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',');
}

export function exportToCSV(data: PayslipData, results: CalculationResults): void {
  const lines: string[] = [];

  lines.push(csvRow('תלוש שכר — ניתוח מפורט'));
  lines.push(csvRow(`שנת מס: ${data.header.taxYear} | חודש: ${data.header.taxMonth} | נקודות זיכוי: ${data.header.creditPoints}`));
  lines.push('');

  lines.push(csvRow('סמל', 'תיאור', 'כמות', 'תעריף', 'סכום', 'סוג', 'חייב מ"ה', 'חייב ב"ל'));
  for (const c of data.components) {
    lines.push(csvRow(
      c.code ?? '',
      c.description,
      c.quantity ?? '',
      c.rate ?? '',
      c.amount,
      c.componentType,
      c.incomeTaxable === true ? 'כן' : c.incomeTaxable === false ? 'לא' : 'לא ודאי',
      c.nlTaxable === true ? 'כן' : c.nlTaxable === false ? 'לא' : 'לא ודאי',
    ));
  }

  lines.push('');
  lines.push(csvRow('סיכום חישוב'));
  lines.push(csvRow('בסיס חייב מ"ה', results.incomeTaxBase));
  lines.push(csvRow('מס הכנסה תיאורטי', results.theoreticalIncomeTax));
  lines.push(csvRow('מס הכנסה בפועל', data.actuals.actualIncomeTax));
  lines.push(csvRow('פער מ"ה', results.incomeTaxDifference));
  lines.push(csvRow('ב"ל + בריאות תיאורטי', results.theoreticalNL + results.theoreticalHealth));
  lines.push(csvRow('נטו תיאורטי', results.theoreticalNetToBank));
  lines.push(csvRow('נטו בפועל', data.actuals.actualNetToBank));

  const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `תלוש_${data.header.taxYear}_${data.header.taxMonth}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportToJSON(data: PayslipData, results: CalculationResults): void {
  const payload = { payslip: data, results };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `תלוש_${data.header.taxYear}_${data.header.taxMonth}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
