import React, { useMemo, useState, useCallback } from 'react';
import { DndContext, DragOverlay, PointerSensor, useDraggable, useDroppable, useSensor, useSensors } from '@dnd-kit/core';
import { addDays, applyFilters, formatTimeRange, parseISOToDate, statusMeta, computeDurationLabel } from './scheduleHelpers';

const classNames = (...values) => values.filter(Boolean).join(' ');

const ShiftCard = ({ assignment, isManager, onEdit }) => {
  const meta = statusMeta(assignment.status);
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({
    id: `assignment-${assignment.id}`,
    disabled: !isManager,
  });

  const start = parseISOToDate(assignment.start);
  const durationLabel = computeDurationLabel(assignment.start, assignment.end);

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={classNames(
  'rounded-2xl border border-[rgba(15,23,42,0.08)] bg-[var(--app-surface)] shadow-sm transition hover:border-[var(--app-info)] hover:shadow-md',
  isDragging ? 'ring-2 ring-[color-mix(in_srgb,var(--app-info)_45%,_transparent_55%)] ring-offset-2 ring-offset-[var(--app-bg)]' : ''
      )}
    >
      <div className="flex items-start justify-between gap-3 p-3">
        <div>
          <div className="flex items-center gap-2">
            <span className={classNames('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium', meta.bg)}>
              <span className={classNames('h-2 w-2 rounded-full', meta.dot)} />
              {meta.label}
            </span>
            {durationLabel && <span className="text-xs text-[var(--app-muted)]">{durationLabel}</span>}
          </div>
          <div className="mt-2 text-sm font-semibold text-[var(--app-text)]">{assignment.staff_name || 'Unassigned'}</div>
          <div className="text-xs text-[var(--app-muted)]">{assignment.role || 'General'}</div>
        </div>
        <div className="text-right">
          <div className="text-sm font-medium text-[var(--app-text)]">{formatTimeRange(assignment.start, assignment.end)}</div>
          <div className="text-xs text-[var(--app-muted)]">
            {Number.isNaN(start.getTime()) ? '' : start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      </div>
      {assignment.notes ? (
        <div className="border-t border-[rgba(15,23,42,0.08)] px-3 py-2 text-xs text-[var(--app-muted)]">{assignment.notes}</div>
      ) : null}
      {isManager ? (
  <div className="border-t border-[rgba(15,23,42,0.08)] px-3 py-2 text-xs text-[var(--app-info)] transition hover:text-[color-mix(in_srgb,var(--app-info)_80%,_var(--app-text)_20%)]">
          <button type="button" onClick={() => onEdit(assignment)}>Edit shift</button>
        </div>
      ) : null}
    </div>
  );
};

const DayColumn = ({ day, assignments, isActive, onAdd, onEdit, isManager }) => {
  const { setNodeRef, isOver } = useDroppable({ id: `day-${day.date}` });
  const dateObj = parseISOToDate(day.date);

  return (
    <div
      ref={setNodeRef}
      className={classNames(
  'flex min-h-[14rem] flex-col gap-3 rounded-2xl border border-[rgba(15,23,42,0.08)] bg-[var(--app-surface)] p-4 shadow-sm transition',
  isOver ? 'ring-2 ring-[color-mix(in_srgb,var(--app-info)_45%,_transparent_55%)] ring-offset-2 ring-offset-[var(--app-bg)]' : '',
  isActive ? 'border-[color-mix(in_srgb,var(--app-info)_45%,_transparent_55%)] bg-[color-mix(in_srgb,var(--app-info)_6%,_var(--app-surface)_94%)]' : ''
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-[var(--app-text)]">
            {dateObj.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
          </div>
          <div className="text-xs text-[var(--app-muted)]">{assignments.length} shift{assignments.length === 1 ? '' : 's'}</div>
        </div>
        {isManager ? (
          <button
            type="button"
            onClick={() => onAdd(day.date)}
            className="rounded-full border border-dashed border-[rgba(15,23,42,0.2)] px-2 py-1 text-xs text-[var(--app-muted)] transition hover:border-[var(--app-info)] hover:text-[var(--app-info)]"
          >
            + Add
          </button>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-3">
        {assignments.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[rgba(15,23,42,0.08)] bg-[color-mix(in_srgb,var(--app-surface)_92%,_var(--app-bg)_8%)] p-3 text-center text-xs text-[var(--app-muted)]">
            No assignments yet
          </div>
        ) : (
          assignments.map((assignment) => (
            <ShiftCard key={assignment.id} assignment={assignment} isManager={isManager} onEdit={onEdit} />
          ))
        )}
      </div>
    </div>
  );
};

export default function ScheduleCalendar({
  days,
  weekStart,
  loading = false,
  filters,
  role,
  onAddShift,
  onEditShift,
  onMoveShift,
}) {
  const [activeId, setActiveId] = useState(null);
  const [overId, setOverId] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const normalizedRole = (role || '').toLowerCase();
  const isManager = normalizedRole === 'manager' || normalizedRole === 'admin';

  const dayAssignments = useMemo(() => {
    return (days || []).map((day) => {
      const filtered = applyFilters(day.assignments || [], filters).sort((a, b) => {
        const aStart = parseISOToDate(a.start).getTime();
        const bStart = parseISOToDate(b.start).getTime();
        return aStart - bStart;
      });
      return { ...day, assignments: filtered };
    });
  }, [days, filters]);

  const activeAssignment = useMemo(() => {
    if (!activeId) return null;
    const id = Number(String(activeId).replace('assignment-', ''));
    for (const day of days || []) {
      const match = (day.assignments || []).find((item) => Number(item.id) === id);
      if (match) return match;
    }
    return null;
  }, [activeId, days]);

  const handleDragStart = useCallback(({ active }) => {
    if (active?.id && String(active.id).startsWith('assignment-')) {
      setActiveId(active.id);
    }
  }, []);

  const handleDragOver = useCallback(({ over }) => {
    setOverId(over?.id || null);
  }, []);

  const handleDragEnd = useCallback(
    ({ active, over }) => {
      if (!active || !over || !String(active.id).startsWith('assignment-') || !String(over.id).startsWith('day-')) {
        setActiveId(null);
        setOverId(null);
        return;
      }
      const assignment = activeAssignment;
      setActiveId(null);
      setOverId(null);
      if (!assignment) return;

      const targetDate = String(over.id).replace('day-', '');
      if (typeof onMoveShift === 'function') {
        onMoveShift(assignment, targetDate);
      }
    },
    [activeAssignment, onMoveShift]
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-[var(--app-text)]">Week of {parseISOToDate(weekStart).toLocaleDateString()}</h2>
          <p className="text-sm text-[var(--app-muted)]">
            Through {addDays(parseISOToDate(weekStart), 6).toLocaleDateString()}
          </p>
        </div>
        {isManager && (
          <button
            type="button"
            onClick={() => onAddShift(weekStart)}
            className="rounded-full bg-[var(--app-primary)] px-5 py-2 text-sm font-semibold text-[var(--app-primary-contrast)] shadow-sm transition hover:opacity-90"
          >
            + New assignment
          </button>
        )}
      </div>

    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-7">
          {loading
            ? Array.from({ length: 7 }).map((_, idx) => (
                <div key={idx} className="h-52 animate-pulse rounded-2xl bg-[color-mix(in_srgb,var(--app-surface)_85%,_var(--app-bg)_15%)]" />
              ))
            : dayAssignments.map((day) => (
                <DayColumn
                  key={day.date}
                  day={day}
                  assignments={day.assignments}
                  onAdd={(date) => onAddShift(date)}
                  onEdit={onEditShift}
                  isManager={isManager}
                  isActive={overId === `day-${day.date}`}
                />
              ))}
        </div>

        <DragOverlay>
          {activeAssignment ? (
            <div className="w-60 rounded-xl border border-[rgba(15,23,42,0.1)] bg-[var(--app-surface)] p-4 shadow-xl">
              <div className="text-sm font-semibold text-[var(--app-text)]">{activeAssignment.staff_name || 'Unassigned'}</div>
              <div className="text-xs text-[var(--app-muted)]">{formatTimeRange(activeAssignment.start, activeAssignment.end)}</div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
