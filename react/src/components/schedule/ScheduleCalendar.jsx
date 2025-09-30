// Replaced entire file with a minimal, single-component stub to remove prior corrupted/duplicated content.
import React, { useEffect, useState, useMemo } from 'react';
import useAuth from '../../hooks/useAuth';
import { DndContext, useDraggable, useDroppable, DragOverlay } from '@dnd-kit/core';
import { toast } from 'react-toastify';
import { startOfWeek, addDays, parseISOToDate, timeOverlap } from './scheduleHelpers';

function DraggableShift({ shift }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `shift-${shift.id}` }) || {};
  return (
    <div ref={setNodeRef} {...attributes} {...listeners} className={`${isDragging ? 'opacity-80 scale-105 shadow-lg' : ''}`}>
  <div className="p-3 bg-[var(--app-surface)] rounded-xl border border-gray-100 flex justify-between items-start shadow-sm">
        <div>
          <div className="font-semibold text-sm text-slate-900">{shift.name}</div>
          <div className="text-xs text-[var(--app-muted)]">{new Date(shift.start_time || shift.date || shift.created_at || shift.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}{shift.end_time ? ` — ${new Date(shift.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}</div>
        </div>
  <div className="text-xs text-[var(--app-muted)]">{shift.role || ''}</div>
      </div>
    </div>
  );
}

function DroppableDay({ children, dayKey }) {
  const { isOver, setNodeRef } = useDroppable({ id: `day-${dayKey}` });
  return (
    <div ref={setNodeRef} className={`${isOver ? 'ring-2 ring-blue-400 rounded-2xl' : ''}`}>
      {children}
    </div>
  );
}

export default function ScheduleCalendar({ onEdit, refreshKey }) {
  const { authFetch } = useAuth();
  const [shifts, setShifts] = useState([]);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [activeShift, setActiveShift] = useState(null);
  const [overId, setOverId] = useState(null);

  const weekDays = useMemo(() => Array.from({ length: 7 }).map((_, i) => addDays(weekStart, i)), [weekStart]);

  const byDay = useMemo(() => {
    const map = {};
    for (const s of shifts) {
      const d = new Date(s.start_time || s.date || s.created_at || s.start);
      const key = isNaN(d) ? 'unknown' : d.toDateString();
      if (!map[key]) map[key] = [];
      map[key].push(s);
    }
    return map;
  }, [shifts]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const res = await authFetch('/api/schedules/shifts');
        if (!mounted) return;
        const data = res && res.data ? res.data : res;
        setShifts(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Failed to load shifts', err);
      }
    };
    load();
    return () => { mounted = false; };
  }, [authFetch, refreshKey]);

  const prevWeek = () => setWeekStart(s => addDays(s, -7));
  const nextWeek = () => setWeekStart(s => addDays(s, 7));
  const goToday = () => setWeekStart(startOfWeek(new Date()));

  const handleDragStart = ({ active }) => {
    if (active?.id && String(active.id).startsWith('shift-')) {
      const id = String(active.id).replace('shift-', '');
      const s = shifts.find(x => String(x.id) === String(id));
      setActiveShift(s || null);
    }
  };

  const handleDragOver = ({ over }) => {
    setOverId(over?.id || null);
  };

  const handleDragEnd = async ({ active, over }) => {
    setOverId(null);
    setActiveShift(null);
    if (!active || !over) return;
    if (!String(active.id).startsWith('shift-') || !String(over.id).startsWith('day-')) return;
    const shiftId = String(active.id).replace('shift-', '');
    const dayKey = String(over.id).replace('day-', '');
    const shift = shifts.find(s => String(s.id) === String(shiftId));
    if (!shift) return;

    const oldDt = new Date(shift.start_time || shift.date || shift.created_at || shift.start);
    const targetDay = new Date(dayKey);
    const newDt = new Date(targetDay);
    if (!isNaN(oldDt)) newDt.setHours(oldDt.getHours(), oldDt.getMinutes(), oldDt.getSeconds(), 0);

    const others = shifts.filter(s => {
      const d = new Date(s.start_time || s.date || s.created_at || s.start);
      return d.toDateString() === newDt.toDateString() && String(s.id) !== String(shift.id);
    });
    let conflict = false;
    for (const o of others) {
      const oStart = parseISOToDate(o.start_time || o.date || o.created_at || o.start);
      const oEnd = parseISOToDate(o.end_time || o.end) || new Date(oStart.getTime() + 60 * 60 * 1000);
      const newEnd = shift.end_time ? parseISOToDate(shift.end_time) : new Date(newDt.getTime() + 60 * 60 * 1000);
      if (!isNaN(oStart) && !isNaN(oEnd) && timeOverlap(newDt, newEnd, oStart, oEnd)) { conflict = true; break; }
    }
    if (conflict && !window.confirm('This move will overlap another shift. Proceed?')) return;

    try {
      await authFetch(`/api/schedules/shifts/${shiftId}`, { method: 'PATCH', data: JSON.stringify({ start_time: newDt.toISOString() }) });
      setShifts(prev => prev.map(s => (String(s.id) === String(shift.id) ? { ...s, start_time: newDt.toISOString() } : s)));
      toast.success('Shift moved');
    } catch (err) {
      console.error('Failed to move shift', err);
      toast.error('Failed to move shift');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-2">
        <div>
          <h3 className="text-2xl font-semibold">Week of {weekStart.toLocaleDateString()}</h3>
          <div className="text-sm text-[var(--app-muted)]">{addDays(weekStart, 6).toLocaleDateString()}</div>
        </div>
        <div className="flex gap-3 items-center">
          <button className="px-3 py-2 rounded-md bg-[var(--app-surface)] border border-gray-200 shadow-sm text-sm text-[var(--app-text)]" onClick={prevWeek}>Prev</button>
          <button className="px-3 py-2 rounded-md bg-[var(--app-surface)] border border-gray-200 shadow-sm text-sm text-[var(--app-text)]" onClick={goToday}>Today</button>
          <button className="px-3 py-2 rounded-md bg-[var(--app-surface)] border border-gray-200 shadow-sm text-sm text-[var(--app-text)]" onClick={nextWeek}>Next</button>
          <button className="px-4 py-2 rounded-lg bg-[var(--app-primary)] text-[var(--app-primary-contrast)] text-sm shadow-md" onClick={() => onEdit && onEdit(null)}>+ Add Shift</button>
        </div>
      </div>

      <DndContext onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-7 gap-4">
          {weekDays.map(day => {
            const key = day.toDateString();
            const items = shifts.filter(s => new Date(s.start_time || s.date || s.created_at || s.start).toDateString() === key);
            return (
              <DroppableDay key={key} dayKey={key}>
                <div className="p-4 bg-[var(--app-surface)] rounded-2xl border border-gray-100 shadow-sm min-h-[10rem]">
                  <div className="flex justify-between items-center mb-3">
                    <div>
                      <div className="font-medium text-sm text-[var(--app-text)]">{day.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</div>
                      <div className="text-xs text-[var(--app-muted)]">{items.length} shifts</div>
                    </div>
                    <div className="text-xs text-gray-400">{/* optional icon */}</div>
                  </div>

                  <ul className="space-y-3">
                    {items.map(s => (
                      <li key={s.id}>
                        <DraggableShift shift={s} />
                      </li>
                    ))}

                    {items.length === 0 && (
                      <li className="text-sm text-[var(--app-muted)]">No shifts</li>
                    )}

                    {overId === `day-${key}` && (
                      <li>
                        <div className="border-2 border-dashed border-gray-200 bg-[var(--app-bg)] rounded-md p-3 text-center text-sm text-[var(--app-muted)]">Drop here</div>
                      </li>
                    )}
                  </ul>
                </div>
              </DroppableDay>
            );
          })}
        </div>

        <DragOverlay>
          {activeShift ? (
            <div className="p-3 bg-[var(--app-primary)] text-[var(--app-primary-contrast)] rounded-xl shadow-xl w-64">
              <div className="font-semibold">{activeShift.name}</div>
              <div className="text-sm text-slate-200">{new Date(activeShift.start_time || activeShift.date || activeShift.created_at || activeShift.start).toLocaleString()}</div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
