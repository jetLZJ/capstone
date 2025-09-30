export function startOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  d.setHours(0,0,0,0);
  return d;
}

export function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }

export function parseISOToDate(iso) {
  try { return new Date(iso); } catch { return new Date(NaN); }
}

export function timeOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}
