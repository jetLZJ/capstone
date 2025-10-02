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

const HOLIDAY_CACHE = new Map();
const HOLIDAY_PROMISES = new Map();
const HOLIDAY_ENDPOINT = 'https://date.nager.at/api/v3/PublicHolidays';

export const WORKING_DAY_START_MINUTES = 9 * 60;
export const WORKING_DAY_END_MINUTES = 22 * 60;
export const WORKING_DAY_TOTAL_MINUTES = WORKING_DAY_END_MINUTES - WORKING_DAY_START_MINUTES;
export const MIN_SHIFT_DURATION_MINUTES = 6 * 60;

const DEFAULT_SHIFT_DURATION_MINUTES = 60;
const MINIMUM_SHIFT_BLOCK_MINUTES = 15;

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

function normalizeDateKey(value) {
  if (!value && value !== 0) return '';
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }
    return toDateInputValue(trimmed);
  }
  return toDateInputValue(value);
}

async function fetchHolidayYear(year) {
  if (typeof fetch !== 'function') {
    console.warn('Fetch API is not available in this environment; skipping holiday lookup.');
    HOLIDAY_CACHE.set(year, {});
    return {};
  }
  try {
    const response = await fetch(`${HOLIDAY_ENDPOINT}/${year}/SG`);
    if (!response.ok) {
      throw new Error(`Holiday API responded with ${response.status}`);
    }
    const data = await response.json();
    const normalized = {};
    (data || []).forEach((item) => {
      const key = normalizeDateKey(item?.date);
      if (!key) return;
      normalized[key] = {
        name: item?.name || item?.localName || 'Public Holiday',
        localName: item?.localName || item?.name || 'Public Holiday',
        observed: Boolean(String(item?.name || '').toLowerCase().includes('observed') || String(item?.localName || '').toLowerCase().includes('observed')),
        raw: item,
      };
    });
    HOLIDAY_CACHE.set(year, normalized);
    return normalized;
  } catch (error) {
    console.warn(`Failed to load Singapore holidays for ${year}:`, error);
    HOLIDAY_CACHE.set(year, {});
    throw error;
  }
}

export async function ensureSingaporeHolidays(years = []) {
  const uniqueYears = Array.from(new Set(years.map((year) => Number(year)).filter((year) => Number.isFinite(year))));
  if (!uniqueYears.length) return;

  const loaders = uniqueYears.map((year) => {
    if (HOLIDAY_CACHE.has(year)) return HOLIDAY_CACHE.get(year);
    if (HOLIDAY_PROMISES.has(year)) return HOLIDAY_PROMISES.get(year);

    const promise = fetchHolidayYear(year)
      .catch(() => ({}))
      .finally(() => {
        HOLIDAY_PROMISES.delete(year);
      });

    HOLIDAY_PROMISES.set(year, promise);
    return promise;
  });

  await Promise.allSettled(loaders);
}

export function getSingaporeHoliday(date) {
  const normalized = normalizeDateKey(date);
  if (!normalized) return null;
  const year = Number(normalized.slice(0, 4));
  if (!Number.isFinite(year)) return null;
  const yearCache = HOLIDAY_CACHE.get(year);
  return yearCache ? yearCache[normalized] || null : null;
}

export function timeStringToMinutes(value) {
  if (typeof value !== 'string') return Number.NaN;
  const match = value.trim().match(/^([0-9]{1,2}):([0-9]{2})$/);
  if (!match) return Number.NaN;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return Number.NaN;
  return hours * 60 + minutes;
}

export function generateWorkingTimeOptions(stepMinutes = 30) {
  const options = [];
  for (let minutes = WORKING_DAY_START_MINUTES; minutes <= WORKING_DAY_END_MINUTES; minutes += stepMinutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    options.push(`${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`);
  }
  return options;
}

export function calculateTimelineMetrics(start, end) {
  const totalMinutes = WORKING_DAY_TOTAL_MINUTES || 1;
  const startDate = parseISOToDate(start);
  if (Number.isNaN(startDate.getTime())) return null;

  const startMinutes = startDate.getHours() * 60 + startDate.getMinutes();
  const rawEndDate = parseISOToDate(end);
  let endMinutes = Number.isNaN(rawEndDate.getTime())
    ? startMinutes + DEFAULT_SHIFT_DURATION_MINUTES
    : rawEndDate.getHours() * 60 + rawEndDate.getMinutes();

  if (!Number.isFinite(endMinutes) || endMinutes <= startMinutes) {
    endMinutes = startMinutes + DEFAULT_SHIFT_DURATION_MINUTES;
  }

  let clampedStart = Math.max(WORKING_DAY_START_MINUTES, Math.min(startMinutes, WORKING_DAY_END_MINUTES));
  let clampedEnd = Math.min(WORKING_DAY_END_MINUTES, Math.max(endMinutes, clampedStart + MINIMUM_SHIFT_BLOCK_MINUTES));

  if (clampedEnd - clampedStart < MINIMUM_SHIFT_BLOCK_MINUTES) {
    clampedEnd = Math.min(WORKING_DAY_END_MINUTES, clampedStart + MINIMUM_SHIFT_BLOCK_MINUTES);
    clampedStart = Math.max(WORKING_DAY_START_MINUTES, clampedEnd - MINIMUM_SHIFT_BLOCK_MINUTES);
  }

  const durationMinutes = Math.max(clampedEnd - clampedStart, MINIMUM_SHIFT_BLOCK_MINUTES);

  return {
    top: ((clampedStart - WORKING_DAY_START_MINUTES) / totalMinutes) * 100,
    height: (durationMinutes / totalMinutes) * 100,
    startMinutes: clampedStart,
    endMinutes: clampedStart + durationMinutes,
    durationMinutes,
  };
}

export { STATUS_META };
