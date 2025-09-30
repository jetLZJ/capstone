import { useEffect, useState, useMemo } from 'react';
import useAuth from '../../hooks/useAuth';

function startOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  d.setHours(0,0,0,0);
  return d;
}

function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }

export default function ScheduleCalendar({ onEdit, refreshKey }) {
  const { authFetch } = useAuth();
  const [shifts, setShifts] = useState([]);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await authFetch('/api/schedules/shifts');
        if (mounted) setShifts(res.data?.shifts ?? []);
      } catch (e) {
        console.error('Failed to load shifts', e);
      }
    })();
    return () => { mounted = false; };
  }, [authFetch, refreshKey]);

  const weekDays = useMemo(() => {
    const days = [];
    for (let i = 0; i < 7; i++) days.push(addDays(weekStart, i));
    return days;
  }, [weekStart]);

  const inRange = (dt, start, end) => {
    try {
      const d = new Date(dt);
      return d >= start && d < end;
    } catch { return false; }
  };

  const byDay = useMemo(() => {
    const nextWeek = addDays(weekStart, 7);
    const map = {};
    for (const day of weekDays) map[day.toDateString()] = [];

    for (const s of shifts) {
      // try parse start_time first, fallback to created date or date field
      const dt = s.start_time || s.date || s.created_at || s.start || null;
      if (!dt) continue;
      if (inRange(dt, weekStart, nextWeek)) {
        const key = new Date(dt).toDateString();
        map[key] = map[key] || [];
        map[key].push(s);
      }
    }

    return map;
  }, [shifts, weekStart, weekDays]);

  const prevWeek = () => setWeekStart(s => addDays(s, -7));
  const nextWeek = () => setWeekStart(s => addDays(s, 7));
  const goToday = () => setWeekStart(startOfWeek(new Date()));

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div>
          <h3 className="text-lg font-semibold">Week of {weekStart.toLocaleDateString()}</h3>
          <div className="text-sm text-gray-500">{addDays(weekStart,6).toLocaleDateString()}</div>
        </div>
        <div className="flex gap-2 items-center">
          <button className="btn" onClick={prevWeek}>Prev</button>
          <button className="btn" onClick={goToday}>Today</button>
          <button className="btn" onClick={nextWeek}>Next</button>
          <button className="btn btn-primary" onClick={() => onEdit && onEdit(null)}>New Shift</button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-3">
        {weekDays.map(day => (
          <div key={day.toDateString()} className="p-3 bg-white dark:bg-gray-800 rounded shadow min-h-[8rem]">
            <div className="font-medium">{day.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</div>
            <ul className="mt-2 space-y-2">
              {(byDay[day.toDateString()] || []).map(s => (
                <li key={s.id} className="p-2 bg-gray-50 dark:bg-gray-700 rounded flex justify-between items-start">
                  <div>
                    <div className="font-semibold">{s.name}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-300">{s.start_time} - {s.end_time}</div>
                    <div className="text-sm text-gray-500">Role: {s.role_required || s.role || 'N/A'}</div>
                  </div>
                  <div className="ml-2 flex flex-col gap-2">
                    <button className="btn btn-sm" onClick={() => onEdit && onEdit(s)}>Edit</button>
                  </div>
                </li>
              ))}
              {(!(byDay[day.toDateString()] || []).length) && (
                <li className="text-sm text-gray-400">No shifts</li>
              )}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
