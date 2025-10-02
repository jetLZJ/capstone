import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { DndContext, DragOverlay, PointerSensor, useDraggable, useDroppable, useSensor, useSensors } from '@dnd-kit/core';
import {
  addDays,
  applyFilters,
  calculateTimelineMetrics,
  computeDurationLabel,
  formatTimeRange,
  getSingaporeHoliday,
  parseISOToDate,
  statusMeta,
  toDateInputValue,
  WORKING_DAY_END_MINUTES,
  WORKING_DAY_START_MINUTES,
  WORKING_DAY_TOTAL_MINUTES,
} from './scheduleHelpers';

const classNames = (...values) => values.filter(Boolean).join(' ');

const formatHourLabel = (hour) => {
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour} ${period}`;
};

const TIMELINE_HOURS = Array.from(
  { length: Math.round(WORKING_DAY_TOTAL_MINUTES / 60) + 1 },
  (_, idx) => Math.floor(WORKING_DAY_START_MINUTES / 60) + idx
);

const TIMELINE_MARKERS = TIMELINE_HOURS.map((hour) => ({
  hour,
  label: formatHourLabel(hour),
  position: ((hour * 60 - WORKING_DAY_START_MINUTES) / WORKING_DAY_TOTAL_MINUTES) * 100,
}));

const MIN_TIMELINE_BLOCK_PERCENT = Math.max((15 / WORKING_DAY_TOTAL_MINUTES) * 100, 1.5);

const ShiftCard = ({ assignment, isManager, onEdit, style, isTouchDevice }) => {
  const meta = statusMeta(assignment.status);
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({
    id: `assignment-${assignment.id}`,
    disabled: !isManager,
  });

  const start = parseISOToDate(assignment.start);
  const durationLabel = computeDurationLabel(assignment.start, assignment.end);
  const tooltipParts = [
    assignment.staff_name ? `Staff: ${assignment.staff_name}` : 'Staff: Unassigned',
    assignment.role ? `Role: ${assignment.role}` : null,
    `Time: ${formatTimeRange(assignment.start, assignment.end)}`,
    assignment.notes ? `Notes: ${assignment.notes}` : null,
  ].filter(Boolean);
  const tooltip = tooltipParts.join('\n');

  const handleDoubleClick = () => {
    if (isManager && typeof onEdit === 'function') {
      onEdit(assignment);
    }
  };

  const handleKeyDown = (event) => {
    if (!isManager || typeof onEdit !== 'function') return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onEdit(assignment);
    }
  };

  const handleClick = () => {
    if (!isTouchDevice || !isManager || typeof onEdit !== 'function' || isDragging) return;
    onEdit(assignment);
  };

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={classNames(
        'flex h-full flex-col rounded-2xl border border-[rgba(15,23,42,0.08)] bg-[var(--app-surface)] shadow-sm transition hover:border-[var(--app-info)] hover:shadow-md',
        isManager ? 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-info)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--app-bg)]' : 'cursor-default',
        isDragging ? 'ring-2 ring-[color-mix(in_srgb,var(--app-info)_45%,_transparent_55%)] ring-offset-2 ring-offset-[var(--app-bg)]' : ''
      )}
      onDoubleClick={handleDoubleClick}
      onKeyDown={handleKeyDown}
      onClick={handleClick}
      tabIndex={isManager ? 0 : undefined}
      title={tooltip}
      style={style}
    >
      <div className="flex flex-col gap-3 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className={classNames('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[color:color-mix(in_srgb,var(--app-text)_80%,_var(--app-bg)_20%)]', meta.bg)}>
            <span className={classNames('h-2 w-2 rounded-full', meta.dot)} />
            {meta.label}
          </span>
          {durationLabel ? (
            <span className="text-[11px] font-medium text-[var(--app-muted)]">{durationLabel}</span>
          ) : null}
        </div>
        <div className="min-w-0 space-y-2">
          <div className="truncate text-sm font-semibold text-[var(--app-text)]" title={assignment.staff_name || 'Unassigned'}>
            {assignment.staff_name || 'Unassigned'}
          </div>
          <div className="flex flex-col gap-1 text-xs text-[var(--app-muted)]">
            <span className="truncate" title={assignment.role || 'General'}>
              {assignment.role || 'General'}
            </span>
            <span className="truncate font-medium text-[var(--app-text)]" title={formatTimeRange(assignment.start, assignment.end)}>
              {formatTimeRange(assignment.start, assignment.end)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

const DayColumn = ({
  day,
  assignments = [],
  isActive,
  onAdd,
  onEdit,
  isManager,
  isToday,
  holiday,
  isTouchDevice,
  isSevenColumn,
}) => {
  const { setNodeRef, isOver } = useDroppable({ id: `day-${day.date}` });
  const dateObj = parseISOToDate(day.date);
  const holidayInfo = holiday || getSingaporeHoliday(day.date);
  const hasAssignments = (assignments || []).length > 0;
  const shiftSummary = hasAssignments
    ? `${assignments.length} shift${assignments.length === 1 ? '' : 's'}`
    : 'No shift assign';

  const positionedAssignments = (assignments || []).map((assignment) => {
    const metrics = calculateTimelineMetrics(assignment.start, assignment.end);
    if (!metrics) return null;

    let topPercent = Math.max(0, Math.min(metrics.top, 100 - MIN_TIMELINE_BLOCK_PERCENT));
    let availableSpace = Math.max(0, 100 - topPercent);
    let heightPercent = Math.max(Math.min(metrics.height, availableSpace), MIN_TIMELINE_BLOCK_PERCENT);

    if (topPercent + heightPercent > 100) {
      const overflow = topPercent + heightPercent - 100;
      topPercent = Math.max(0, topPercent - overflow);
      availableSpace = Math.max(0, 100 - topPercent);
      heightPercent = Math.max(Math.min(heightPercent, availableSpace), MIN_TIMELINE_BLOCK_PERCENT);
    }

    return {
      assignment,
      style: {
        top: `${topPercent}%`,
        height: `${heightPercent}%`,
      },
    };
  }).filter(Boolean);

  const formattedDate = Number.isNaN(dateObj.getTime())
    ? day.date
    : dateObj.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

  return (
    <div
      ref={setNodeRef}
      className={classNames(
        'relative flex min-h-[24rem] flex-col gap-4 rounded-2xl border border-[rgba(15,23,42,0.08)] bg-[var(--app-surface)] p-4 shadow-sm transition',
        isOver ? 'ring-2 ring-[color-mix(in_srgb,var(--app-info)_45%,_transparent_55%)] ring-offset-2 ring-offset-[var(--app-bg)]' : '',
        isActive ? 'border-[color-mix(in_srgb,var(--app-info)_45%,_transparent_55%)]' : '',
        holidayInfo ? 'border-[color-mix(in_srgb,var(--app-warning)_45%,_transparent_55%)] bg-[color-mix(in_srgb,var(--app-warning)_8%,_var(--app-surface)_92%)]' : '',
        isToday
          ? 'border-[color-mix(in_srgb,var(--app-primary)_55%,_transparent_45%)] bg-[color-mix(in_srgb,var(--app-primary)_10%,_var(--app-surface)_90%)] shadow-[0_0_55px_0_color-mix(in_srgb,var(--app-primary)_38%,_transparent_62%)] ring-2 ring-[color-mix(in_srgb,var(--app-primary)_50%,_transparent_50%)] ring-offset-4 ring-offset-[color-mix(in_srgb,var(--app-bg)_92%,_var(--app-surface)_8%)]'
          : ''
      )}
    >
      {holidayInfo ? (
        <div className="pointer-events-none absolute left-1/2 -top-4 z-30 flex -translate-x-1/2 flex-col items-center gap-1">
          <span
            className="pointer-events-auto rounded-full bg-[color-mix(in_srgb,var(--app-warning)_14%,_var(--app-surface)_86%)] px-3 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--app-warning)] shadow-[0_5px_14px_-6px_color-mix(in_srgb,var(--app-warning)_48%,_transparent_52%)]"
            title={holidayInfo.name || 'Holiday'}
          >
            {holidayInfo.name || 'Holiday'}
          </span>
          {holidayInfo.observed ? (
            <span className="pointer-events-auto text-[10px] font-medium uppercase tracking-wide text-[color-mix(in_srgb,var(--app-muted)_92%,_var(--app-warning)_8%)]">
              Observed
            </span>
          ) : null}
        </div>
      ) : null}
      <div className="flex flex-wrap items-start gap-2 rounded-2xl bg-[color-mix(in_srgb,var(--app-surface)_98%,_var(--app-bg)_2%)] px-2 py-1 text-left min-h-[5.5rem]">
        <div className="flex w-full items-start justify-between gap-2">
          <div className="text-sm font-semibold text-[var(--app-text)]">{formattedDate}</div>
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
        <div className="w-full text-xs text-[var(--app-muted)]">{shiftSummary}</div>
      </div>

      <div className="flex-1">
        <div className="relative min-h-[22rem]">
          {!isSevenColumn ? (
            <div className="absolute inset-y-0 left-0 w-16 select-none">
              {TIMELINE_MARKERS.map((marker) => {
                const baseStyle =
                  marker.position <= 0
                    ? { top: 0 }
                    : marker.position >= 100
                    ? { bottom: 0 }
                    : { top: `${marker.position}%`, transform: 'translateY(-50%)' };

                return (
                  <div
                    key={`label-${marker.hour}`}
                    className="absolute right-3 text-right text-[10px] font-semibold uppercase tracking-wide text-[var(--app-muted)]"
                    style={baseStyle}
                  >
                    {marker.label}
                  </div>
                );
              })}
            </div>
          ) : null}

          <div
            className={classNames(
              'relative ml-0 rounded-xl border border-[rgba(15,23,42,0.08)] bg-[color-mix(in_srgb,var(--app-surface)_92%,_var(--app-bg)_8%)]',
              isSevenColumn ? '' : 'ml-16'
            )}
            style={{ minHeight: '22rem' }}
          >
            <div className="pointer-events-none absolute inset-0 z-0 px-4">
              {TIMELINE_MARKERS.map((marker) => {
                const baseStyle =
                  marker.position <= 0
                    ? { top: 0 }
                    : marker.position >= 100
                    ? { bottom: 0 }
                    : { top: `${marker.position}%`, transform: 'translateY(-50%)' };

                return (
                  <div key={`line-${marker.hour}`} className="absolute left-0 right-0" style={baseStyle}>
                    {isSevenColumn ? (
                      <div className="flex items-center gap-2">
                        <span className="h-px flex-1 border-t border-dashed border-[rgba(15,23,42,0.12)]" />
                        <span className="rounded-full bg-[color-mix(in_srgb,var(--app-surface)_94%,_var(--app-bg)_6%)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--app-muted)]">
                          {marker.label}
                        </span>
                        <span className="h-px flex-1 border-t border-dashed border-[rgba(15,23,42,0.12)]" />
                      </div>
                    ) : (
                      <div className="h-px w-full border-t border-dashed border-[rgba(15,23,42,0.12)]" />
                    )}
                  </div>
                );
              })}
            </div>

            <div
              className={classNames(
                'relative z-10 h-full overflow-hidden rounded-xl px-4',
                isSevenColumn ? '' : ''
              )}
              style={{ minHeight: '22rem' }}
            >
              {positionedAssignments.map(({ assignment, style }) => (
                <div key={assignment.id} className="absolute inset-x-0 px-1" style={style}>
                  <ShiftCard
                    assignment={assignment}
                    isManager={isManager}
                    onEdit={onEdit}
                    style={{ height: '100%' }}
                    isTouchDevice={isTouchDevice}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const navButtonClass =
  'rounded-full border border-[rgba(15,23,42,0.12)] bg-[var(--app-surface)] px-4 py-2 text-sm font-semibold text-[var(--app-text)] shadow-sm transition hover:border-[var(--app-accent)] hover:text-[var(--app-accent)] hover:shadow-md';

export default function ScheduleCalendar({
  days,
  weekStart,
  loading = false,
  filters,
  role,
  onAddShift,
  onEditShift,
  onMoveShift,
  onNavigateWeek,
}) {
  const [activeId, setActiveId] = useState(null);
  const [overId, setOverId] = useState(null);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [isSevenColumn, setIsSevenColumn] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(min-width: 1280px)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const nav = typeof navigator !== 'undefined' ? navigator : null;
    const isTouch =
      'ontouchstart' in window ||
      (nav && Number(nav.maxTouchPoints) > 0) ||
      (window.matchMedia && window.matchMedia('(hover: none)').matches);
    setIsTouchDevice(Boolean(isTouch));
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mediaQuery = window.matchMedia('(min-width: 1280px)');
    const handleChange = (event) => setIsSevenColumn(event.matches);

    setIsSevenColumn(mediaQuery.matches);
    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }

    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, []);

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

  const todayString = useMemo(() => toDateInputValue(new Date()), []);
  const isSameDate = useCallback((a, b) => {
    if (!a || !b) return false;
    const d1 = toDateInputValue(parseISOToDate(a));
    const d2 = toDateInputValue(parseISOToDate(b));
    return d1 === d2;
  }, []);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-[var(--app-text)]">Week of {parseISOToDate(weekStart).toLocaleDateString()}</h2>
          <p className="text-sm text-[var(--app-muted)]">
            Through {addDays(parseISOToDate(weekStart), 6).toLocaleDateString()}
          </p>
        </div>
        {typeof onNavigateWeek === 'function' ? (
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => onNavigateWeek('prev')} className={navButtonClass}>
              ← Previous
            </button>
            <button type="button" onClick={() => onNavigateWeek('today')} className={navButtonClass}>
              This week
            </button>
            <button type="button" onClick={() => onNavigateWeek('next')} className={navButtonClass}>
              Next →
            </button>
          </div>
        ) : null}
      </div>

    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-7">
          {loading
            ? Array.from({ length: 7 }).map((_, idx) => (
                <div key={idx} className="h-[22rem] animate-pulse rounded-2xl bg-[color-mix(in_srgb,var(--app-surface)_85%,_var(--app-bg)_15%)]" />
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
                  isToday={isSameDate(day.date, todayString)}
                  holiday={day.holiday}
                  isTouchDevice={isTouchDevice}
                  isSevenColumn={isSevenColumn}
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
