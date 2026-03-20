export function roundTo(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function formatHours(hours: number): string {
  if (!isFinite(hours) || hours < 0) return '—';
  return `${roundTo(hours, 1).toFixed(1)} שע'`;
}

export function formatHoursLong(hours: number): string {
  if (!isFinite(hours) || hours < 0) return '—';
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return m > 0 ? `${h} שעות ו-${m} דקות` : `${h} שעות`;
}
