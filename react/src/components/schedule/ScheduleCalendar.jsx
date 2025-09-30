import { useEffect, useState } from 'react';
import useAuth from '../../hooks/useAuth';

export default function ScheduleCalendar({ onEdit, refreshKey }) {
  const { authFetch } = useAuth();
  const [shifts, setShifts] = useState([]);

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

  const getDayName = (s) => {
    try {
      const d = new Date(s);
      if (isNaN(d)) return 'Unspecified';
      return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()];
    } catch (_) { return 'Unspecified'; }
  };

  const grouped = shifts.reduce((acc, sh) => {
    const day = getDayName(sh.start_time || sh.date || '');
    acc[day] = acc[day] || [];
    acc[day].push(sh);
    return acc;
  }, {});

  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Week View (calendar skeleton)</h3>
        <button className="btn btn-primary" onClick={() => onEdit && onEdit(null)}>New Shift</button>
      </div>

      <div className="grid grid-cols-7 gap-3">
        {days.map(d => (
          <div key={d} className="p-3 bg-white dark:bg-gray-800 rounded shadow min-h-[8rem]">
            <div className="font-medium">{d}</div>
            <ul className="mt-2 space-y-2">
              {(grouped[d] || []).map(s => (
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
              {(!grouped[d] || grouped[d].length === 0) && (
                <li className="text-sm text-gray-400">No shifts</li>
              )}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
