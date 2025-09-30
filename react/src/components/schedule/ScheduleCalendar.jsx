import { useEffect, useState, useMemo } from 'react';
import useAuth from '../../hooks/useAuth';
import { DndContext, useDraggable, useDroppable, DragOverlay, DragOverlay } from '@dnd-kit/core';
import { toast } from 'react-toastify';
import { startOfWeek, addDays, parseISOToDate, timeOverlap } from './scheduleHelpers';

// helpers are imported from scheduleHelpers.js

function parseISOToDate(iso) {
  try { return new Date(iso); } catch { return null; }
}

function timeOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

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
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center mb-2">
          <div>
            <h3 className="text-2xl font-semibold">Week of {weekStart.toLocaleDateString()}</h3>
            <div className="text-sm text-gray-500">{addDays(weekStart,6).toLocaleDateString()}</div>
          </div>
          <div className="flex gap-3 items-center">
            <button className="px-3 py-2 rounded-md bg-white border border-gray-200 shadow-sm text-sm text-gray-700" onClick={prevWeek}>Prev</button>
            <button className="px-3 py-2 rounded-md bg-white border border-gray-200 shadow-sm text-sm text-gray-700" onClick={goToday}>Today</button>
            <button className="px-3 py-2 rounded-md bg-white border border-gray-200 shadow-sm text-sm text-gray-700" onClick={nextWeek}>Next</button>
            <button className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm shadow-md" onClick={() => onEdit && onEdit(null)}>+ Add Shift</button>
          </div>
        </div>

        <DndContext onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-7 gap-4">
            {weekDays.map(day => {
              const key = day.toDateString();
              const items = (byDay[key] || []);
              return (
                <DroppableDay key={key} dayKey={key}>
                  <div className="p-4 bg-white rounded-2xl border border-gray-100 shadow-sm min-h-[10rem]">
                    <div className="flex justify-between items-center mb-3">
                      <div>
                        <div className="font-medium text-sm text-gray-800">{day.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</div>
                        <div className="text-xs text-gray-400">{items.length} shifts</div>
                      </div>
                      <div className="text-xs text-gray-400">{/* optional icon */}</div>
                    </div>

                    <ul className="space-y-3">
                      {items.map(s => (
                        <li key={s.id}>
                          <div className="bg-white border border-gray-100 rounded-lg p-3 shadow-sm flex justify-between items-center">
                            <div>
                              <div className="font-medium text-sm">{s.name}</div>
                              <div className="text-xs text-gray-500">{new Date(s.start_time || s.date || s.created_at || s.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} — {s.end_time ? new Date(s.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</div>
                            </div>
                            <div className="text-xs text-gray-400">{s.role || ''}</div>
                          </div>
                        </li>
                      ))}

                      {items.length === 0 && (
                        <li className="text-sm text-gray-400">No shifts</li>
                      )}

                      {overId === `day-${key}` && (
                        <li>
                          <div className="border-2 border-dashed border-gray-200 bg-gray-50 rounded-md p-3 text-center text-sm text-gray-500">Drop here</div>
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
              <div className="p-3 bg-slate-900 text-white rounded-xl shadow-xl w-64">
                <div className="font-semibold">{activeShift.name}</div>
                <div className="text-sm text-slate-200">{new Date(activeShift.start_time || activeShift.date || activeShift.created_at || activeShift.start).toLocaleString()}</div>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    );
    setActiveId(active.id);
    const id = active.id.replace('shift-', '');
    const shift = shifts.find(s => String(s.id) === String(id));
    setActiveShift(shift || null);
  };

  const handleDragOver = (event) => {
    const { over } = event;
    setOverId(over?.id || null);
  };

  const checkOverlapAndConfirm = (shift, targetDay) => {
    // build new start/end based on targetDay but preserve time-of-day
    const oldStart = parseISOToDate(shift.start_time || shift.date || shift.created_at || shift.start);
    const oldEnd = parseISOToDate(shift.end_time || shift.end || (shift.start_time ? new Date(shift.start_time).getTime() + 60*60*1000 : null));
    const newStart = new Date(targetDay);
    if (!isNaN(oldStart)) newStart.setHours(oldStart.getHours(), oldStart.getMinutes(), oldStart.getSeconds(), 0);

    let newEnd = null;
    if (shift.end_time) {
      const endDt = parseISOToDate(shift.end_time);
      if (!isNaN(endDt)) {
        newEnd = new Date(targetDay);
        newEnd.setHours(endDt.getHours(), endDt.getMinutes(), endDt.getSeconds(), 0);
      }
    } else if (!isNaN(oldStart)) {
      // assume 1 hour shift if no explicit end
      newEnd = new Date(newStart.getTime() + 60*60*1000);
    }

    // check against existing shifts on that day
    const dayKey = newStart.toDateString();
    const others = (byDay[dayKey] || []).filter(s => String(s.id) !== String(shift.id));
    for (const o of others) {
      const oStart = parseISOToDate(o.start_time || o.date || o.created_at || o.start);
      let oEnd = parseISOToDate(o.end_time || o.end);
      if (isNaN(oEnd) && !isNaN(oStart)) oEnd = new Date(oStart.getTime() + 60*60*1000);
      if (!isNaN(oStart) && !isNaN(oEnd) && newStart && newEnd) {
        if (timeOverlap(newStart, newEnd, oStart, oEnd)) return true;
      }
    }
    return false;
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
      toast.success('Shift moved');
    } catch (err) {
      console.error('Failed to move shift', err);
      toast.error('Failed to move shift');
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

      <DndContext onDragStart={handleDragStart} onDragOver={handleDragOver} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-7 gap-3">
          {weekDays.map(day => (
            <div key={day.toDateString()} className="p-3">
              <DroppableDay dayKey={day.toDateString()}>
                <div className="bg-white dark:bg-gray-800 rounded shadow min-h-[8rem] p-3">
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
            </div>
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
