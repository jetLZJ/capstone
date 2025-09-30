import React, { useEffect, useState, useMemo } from 'react';
import useAuth from '../../hooks/useAuth';
import { DndContext, useDraggable, useDroppable, DragOverlay } from '@dnd-kit/core';
import { toast } from 'react-toastify';
import { startOfWeek, addDays, parseISOToDate, timeOverlap } from './scheduleHelpers';

function DraggableShift({ shift }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `shift-${shift.id}` }) || {};
  return (
    <div ref={setNodeRef} {...attributes} {...listeners} className={`${isDragging ? 'opacity-60 scale-105 shadow-lg' : ''}`}>
      <div className="p-2 bg-white rounded-lg border border-gray-100 flex justify-between items-start">
        <div>
          <div className="font-semibold text-sm">{shift.name}</div>
          <div className="text-xs text-gray-500">{new Date(shift.start_time || shift.date || shift.created_at || shift.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} — {shift.end_time ? new Date(shift.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</div>
        </div>
        <div className="text-xs text-gray-400">{shift.role || ''}</div>
      </div>
    </div>
  );
}

function DroppableDay({ children, dayKey }) {
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
      import React, { useEffect, useState, useMemo } from 'react';
      import useAuth from '../../hooks/useAuth';
      import { DndContext, useDraggable, useDroppable, DragOverlay } from '@dnd-kit/core';
      import { toast } from 'react-toastify';
      import { startOfWeek, addDays, parseISOToDate, timeOverlap } from './scheduleHelpers';

      function DraggableShift({ shift }) {
        const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `shift-${shift.id}` }) || {};
        return (
          <div ref={setNodeRef} {...attributes} {...listeners} className={`${isDragging ? 'opacity-60 scale-105 shadow-lg' : ''}`}>
            <div className="p-2 bg-white rounded-lg border border-gray-100 flex justify-between items-start">
              <div>
                <div className="font-semibold text-sm">{shift.name}</div>
                <div className="text-xs text-gray-500">{new Date(shift.start_time || shift.date || shift.created_at || shift.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} — {shift.end_time ? new Date(shift.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</div>
              </div>
              <div className="text-xs text-gray-400">{shift.role || ''}</div>
            </div>
          </div>
        );
      }

      function DroppableDay({ children, dayKey }) {
        const { isOver, setNodeRef } = useDroppable({ id: `day-${dayKey}` });
        return (
          <div ref={setNodeRef} className={`${isOver ? 'ring-2 ring-blue-300 rounded-2xl' : ''}`}>
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

        const handleDragStart = (event) => {
          const { active } = event;
          setActiveId(active?.id || null);
          if (active?.id && String(active.id).startsWith('shift-')) {
            const id = String(active.id).replace('shift-', '');
            const s = shifts.find(x => String(x.id) === String(id));
            setActiveShift(s || null);
          }
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
          if (!String(activeId).startsWith('shift-') || !String(overId).startsWith('day-')) return;
          const shiftId = String(activeId).replace('shift-', '');
          const dayKey = String(overId).replace('day-', '');

          const shift = shifts.find(s => String(s.id) === String(shiftId));
          if (!shift) return;

          const oldDt = new Date(shift.start_time || shift.date || shift.created_at || shift.start);
          const targetDay = new Date(dayKey);
          let newDt = new Date(targetDay);
          if (!isNaN(oldDt)) {
            newDt.setHours(oldDt.getHours(), oldDt.getMinutes(), oldDt.getSeconds(), 0);
          }

          const newStart = newDt;
          const newEnd = shift.end_time ? parseISOToDate(shift.end_time) : new Date(newStart.getTime() + 60 * 60 * 1000);
          const dayKeyStr = newStart.toDateString();
          const others = (byDay[dayKeyStr] || []).filter(s => String(s.id) !== String(shift.id));
          let conflict = false;
          for (const o of others) {
            const oStart = parseISOToDate(o.start_time || o.date || o.created_at || o.start);
            const oEnd = parseISOToDate(o.end_time || o.end) || new Date(oStart.getTime() + 60 * 60 * 1000);
            if (!isNaN(oStart) && !isNaN(oEnd) && timeOverlap(newStart, newEnd, oStart, oEnd)) { conflict = true; break; }
          }

          if (conflict) {
            if (!window.confirm('This move will create an overlapping shift. Proceed?')) return;
          }

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
                <div className="text-sm text-gray-500">{addDays(weekStart, 6).toLocaleDateString()}</div>
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
                              <DraggableShift shift={s} />
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
      }
