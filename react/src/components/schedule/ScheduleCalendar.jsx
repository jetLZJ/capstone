import { useEffect, useState, useMemo } from 'react';
import useAuth from '../../hooks/useAuth';
import { DndContext, useDraggable, useDroppable, DragOverlay } from '@dnd-kit/core';
import { startOfWeek, addDays, parseISOToDate, timeOverlap } from './scheduleHelpers';

// helpers are imported from scheduleHelpers.js

function DraggableShift({ shift }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `shift-${shift.id}` }) || {};
  return (
    <div ref={setNodeRef} {...attributes} {...listeners} className={`${isDragging ? 'opacity-60 scale-105 shadow-lg' : ''}`}>
      <div className="p-2 bg-gray-50 dark:bg-gray-700 rounded flex justify-between items-start">
        <div>
          <div className="font-semibold">{shift.name}</div>
          <div className="text-sm text-gray-600 dark:text-gray-300">{shift.start_time} - {shift.end_time}</div>
        </div>
      </div>
    </div>
  );
}

function DroppableDay({ children, dayKey }) {
  const { isOver, setNodeRef } = useDroppable({ id: `day-${dayKey}` });
  return (
    <div ref={setNodeRef} className={`${isOver ? 'ring-2 ring-blue-400' : ''}`}>
      {children}
    </div>
  );
}

export default function ScheduleCalendar({ onEdit, refreshKey }) {
  const { authFetch } = useAuth();
  const [shifts, setShifts] = useState([]);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [activeShift, setActiveShift] = useState(null);
  const [activeId, setActiveId] = useState(null);
  const [overId, setOverId] = useState(null);

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

  const handleDragStart = (event) => {
    const { active } = event;
    if (!active) return;
    setActiveId(active.id);
    const id = active.id.replace('shift-', '');
    const shift = shifts.find(s => String(s.id) === String(id));
    setActiveShift(shift || null);
  };

  const handleDragOver = (event) => {
    const { over } = event;
    setOverId(over?.id || null);
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    setActiveId(null);
    setActiveShift(null);
    setOverId(null);
    if (!over || !active) return;
    const activeId = active.id; // shift-<id>
    const overId = over.id; // day-<dayKey>
    if (!activeId.startsWith('shift-') || !overId.startsWith('day-')) return;
    const shiftId = activeId.replace('shift-', '');
    const dayKey = overId.replace('day-', '');

    // find shift
    const shift = shifts.find(s => String(s.id) === String(shiftId));
    if (!shift) return;

    const oldDt = new Date(shift.start_time || shift.date || shift.created_at || shift.start);
    const targetDay = new Date(dayKey);
    let newDt = new Date(targetDay);
    if (!isNaN(oldDt)) {
      newDt.setHours(oldDt.getHours(), oldDt.getMinutes(), oldDt.getSeconds(), 0);
    }

    // soft conflict detection: ask user to confirm if overlap detected
    const newStart = newDt;
    const newEnd = shift.end_time ? parseISOToDate(shift.end_time) : new Date(newStart.getTime() + 60*60*1000);
    const dayKeyStr = newStart.toDateString();
    const others = (byDay[dayKeyStr] || []).filter(s => String(s.id) !== String(shift.id));
    let conflict = false;
    for (const o of others) {
      const oStart = parseISOToDate(o.start_time || o.date || o.created_at || o.start);
      const oEnd = parseISOToDate(o.end_time || o.end) || new Date(oStart.getTime() + 60*60*1000);
      if (!isNaN(oStart) && !isNaN(oEnd) && timeOverlap(newStart, newEnd, oStart, oEnd)) {
        conflict = true; break;
      }
    }

    if (conflict) {
      if (!window.confirm('This move will create an overlapping shift. Proceed?')) {
        return;
      }
    }

    try {
      await authFetch(`/api/schedules/shifts/${shiftId}`, { method: 'PATCH', data: JSON.stringify({ start_time: newDt.toISOString() }) });
      // refresh local state: optimistically update
      setShifts(prev => prev.map(s => s.id === shift.id ? { ...s, start_time: newDt.toISOString() } : s));
    } catch (err) {
      console.error('Failed to move shift', err);
    }
  };

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

      <DndContext onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-7 gap-3">
          {weekDays.map(day => (
            <DroppableDay key={day.toDateString()} dayKey={day.toDateString()}>
              <div className="p-3 bg-white dark:bg-gray-800 rounded shadow min-h-[8rem]">
                <div className="font-medium">{day.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</div>
                <ul className="mt-2 space-y-2">
                  {(byDay[day.toDateString()] || []).map(s => (
                    <li key={s.id}>
                      <DraggableShift shift={s} />
                    </li>
                  ))}
                  {(!(byDay[day.toDateString()] || []).length) && (
                    <li className="text-sm text-gray-400">No shifts</li>
                  )}
                  {overId === `day-${day.toDateString()}` && (
                    <li className="text-sm text-gray-500 italic">Drop here</li>
                  )}
                </ul>
              </div>
            </DroppableDay>
          ))}
        </div>

        <DragOverlay>
          {activeShift ? (
            <div className="p-3 bg-white dark:bg-gray-800 rounded shadow-lg w-64 border dark:border-gray-700">
              <div className="font-semibold">{activeShift.name}</div>
              <div className="text-sm text-gray-500">{new Date(activeShift.start_time || activeShift.date || activeShift.created_at || activeShift.start).toLocaleString()}</div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
