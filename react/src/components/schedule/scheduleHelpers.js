const STATUS_META = {
  confirmed: {
    label: 'Confirmed',
    bg: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-200 dark:border-emerald-400/40',
    dot: 'bg-emerald-500 dark:bg-emerald-400',
  },
  scheduled: {
    label: 'Scheduled',
    bg: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-500/15 dark:text-blue-200 dark:border-blue-400/40',
    dot: 'bg-blue-500 dark:bg-blue-400',
  },
  pending: {
    label: 'Pending',
    bg: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-500/15 dark:text-amber-200 dark:border-amber-400/40',
    dot: 'bg-amber-500 dark:bg-amber-300',
  },
  open: {
    label: 'Open Coverage',
    bg: 'bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-500/15 dark:text-rose-200 dark:border-rose-400/40',
    dot: 'bg-rose-500 dark:bg-rose-400',
  },
};

export function startOfWeek(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day + 6) % 7; // Monday as start of the week
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + Number(n || 0));
  return x;
}

export function parseISOToDate(value) {
  if (!value) return new Date(NaN);
  try {
    return new Date(value);
  } catch (err) {
    return new Date(NaN);
  }
}

export function toDateInputValue(date) {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 10);
}

export function toTimeInputValue(date) {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function minutesBetween(start, end) {
  const a = parseISOToDate(start);
  const b = parseISOToDate(end);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0;
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 60000));
}

export function formatTimeRange(start, end) {
  const from = parseISOToDate(start);
  const to = parseISOToDate(end);
  if (Number.isNaN(from.getTime())) return 'TBD';
  const opts = { hour: 'numeric', minute: '2-digit' };
  if (Number.isNaN(to.getTime())) {
    return from.toLocaleTimeString([], opts);
  }
  return `${from.toLocaleTimeString([], opts)} – ${to.toLocaleTimeString([], opts)}`;
}

export function combineDateAndMinutes(baseDate, minutesFromMidnight) {
  const d = new Date(baseDate);
  d.setHours(0, 0, 0, 0);
  d.setMinutes(minutesFromMidnight);
  return d;
}

export function statusMeta(status) {
  return STATUS_META[(status || '').toLowerCase()] || STATUS_META.pending;
}

export function statusOptions() {
  return [
    { value: 'confirmed', label: 'Confirmed' },
    { value: 'scheduled', label: 'Scheduled' },
    { value: 'pending', label: 'Pending' },
    { value: 'open', label: 'Open Coverage' },
  ];
}

export function computeDurationLabel(start, end) {
  const minutes = minutesBetween(start, end) || 0;
  if (!minutes) return '';
  const hours = (minutes / 60).toFixed(1);
  return `${hours.replace('.0', '')} hr${hours !== '1' ? 's' : ''}`;
}

export function applyFilters(assignments, filters) {
  if (!Array.isArray(assignments)) return [];
  const { staffId, status } = filters || {};
  return assignments.filter((item) => {
    const staffMatch = !staffId || String(item.staff_id || '') === String(staffId);
    const statusMatch = !status || String(item.status || '').toLowerCase() === String(status).toLowerCase();
    return staffMatch && statusMatch;
  });
}

export function mergeNotifications(existing, incoming) {
  if (!incoming || !incoming.length) return existing;
  return [...incoming.map((msg, idx) => ({ id: `${Date.now()}-${idx}`, message: msg })), ...existing];
}

export function toApiTime(value) {
  if (!value && value !== 0) return '';
  const trimmed = String(value).trim();
  if (!trimmed) return '';

  if (/^\d{2}:\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  if (/^\d{2}:\d{2}:\d{2}$/.test(trimmed)) {
    return trimmed.slice(0, 5);
  }

  const parsed = parseISOToDate(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    return toTimeInputValue(parsed);
  }

  return '';
}

export function toApiDate(value) {
  if (!value) return '';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  return toDateInputValue(value);
}

export { STATUS_META };
