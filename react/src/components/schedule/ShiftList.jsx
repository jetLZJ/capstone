import { useState, useEffect } from 'react';
import useAuth from '../../hooks/useAuth';

export default function ShiftList({ onEdit }) {
  const { authFetch } = useAuth();
  const [shifts, setShifts] = useState([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await authFetch('/api/schedules/shifts');
        if (mounted) setShifts(res.data?.shifts ?? []);
      } catch (e) {
        console.error(e);
      }
    })();
    return () => { mounted = false };
  }, [authFetch]);

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Shifts</h3>
        <button className="btn btn-primary" onClick={() => onEdit(null)}>New Shift</button>
      </div>
      <ul className="space-y-2">
        {shifts.map(s => (
          <li key={s.id} className="p-3 bg-white dark:bg-gray-700 rounded shadow flex justify-between items-center">
            <div>
              <div className="font-medium">{s.name} <span className="text-sm text-gray-500">{s.start_time} - {s.end_time}</span></div>
              <div className="text-sm text-gray-600 dark:text-gray-300">Role: {s.role_required}</div>
            </div>
            <div>
              <button className="btn" onClick={() => onEdit(s)}>Edit</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
