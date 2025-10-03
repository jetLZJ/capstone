import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ScheduleCalendar from '../components/schedule/ScheduleCalendar';
import ScheduleSidebar from '../components/schedule/ShiftList';
import ShiftEditor from '../components/schedule/ShiftEditor';
import Modal from '../components/schedule/Modal';
import useAuth from '../hooks/useAuth';
import {
  ensureSingaporeHolidays,
  getSingaporeHoliday,
  mergeNotifications,
  parseISOToDate,
  startOfWeek,
  toApiDate,
  toApiTime,
  toDateInputValue,
  timeStringToMinutes,
  MIN_SHIFT_DURATION_MINUTES,
  formatTimeRange,
} from '../components/schedule/scheduleHelpers';
import { toast } from 'react-toastify';

const initialFilters = { staffId: '', status: '' };

const parseWeekString = (value) => {
  if (!value) return startOfWeek(new Date());
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    return startOfWeek(new Date(year, month - 1, day));
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return startOfWeek(new Date());
  }
  return startOfWeek(parsed);
};

const SchedulePage = () => {
  const { authFetch, profile } = useAuth();
  const [weekStart, setWeekStart] = useState(() => toDateInputValue(startOfWeek(new Date())));
  const [data, setData] = useState({ days: [], coverage: {}, role: null });
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState(initialFilters);
  const [editorState, setEditorState] = useState({ open: false, mode: 'create', shift: null, defaultDate: null });
  const [isSaving, setIsSaving] = useState(false);
  const [editorError, setEditorError] = useState('');
  const [notifications, setNotifications] = useState([]);
  const [availabilityEntries, setAvailabilityEntries] = useState([]);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availabilitySaving, setAvailabilitySaving] = useState(false);
  const [teamAvailability, setTeamAvailability] = useState({});
  const [fillTarget, setFillTarget] = useState(null);
  const [fillError, setFillError] = useState('');
  const [isClaiming, setIsClaiming] = useState(false);
  const weekCacheRef = useRef({});
  const weekLoaders = useRef(new Map());
  const today = useMemo(() => toDateInputValue(new Date()), []);
  const computeDefaultShiftDate = useCallback(
    (value) => {
      const normalized = toDateInputValue(value || new Date());
      if (!normalized) return today;
      return normalized < today ? today : normalized;
    },
    [today]
  );

  const hasScheduleData = Array.isArray(data?.days) && data.days.length > 0;
  const isInitialLoading = loading && !hasScheduleData;

  const role = useMemo(() => data.role || profile?.role || 'User', [data.role, profile?.role]);
  const normalizedRole = (role || '').toLowerCase();
  const isManager = normalizedRole === 'manager' || normalizedRole === 'admin';
  const isStaff = normalizedRole === 'staff' || normalizedRole === 'server';
  const activeWeekStart = data.week_start || weekStart;

  useEffect(() => {
    const todayWeek = toDateInputValue(startOfWeek(new Date()));
    setWeekStart((current) => (current === todayWeek ? current : todayWeek));
  }, []);

  const loadWeek = useCallback(async (ws) => {
    setLoading(true);
    try {
      const response = await authFetch('/api/schedules/week', { params: { week_start: ws } });
      const payload = response?.data || {};
      const incomingDays = payload.days || [];
      const yearsToLoad = Array.from(
        new Set(
          incomingDays
            .map((day) => parseISOToDate(day.date))
            .map((dateObj) => (Number.isNaN(dateObj.getTime()) ? null : dateObj.getFullYear()))
            .filter((year) => Number.isFinite(year))
        )
      );

      if (yearsToLoad.length) {
        await ensureSingaporeHolidays(yearsToLoad);
      }

      const hydratedDays = incomingDays.map((day) => ({
        ...day,
        holiday: getSingaporeHoliday(day.date),
      }));

      const normalizedWeekStart = toDateInputValue(parseWeekString(payload.week_start || ws));

      if (normalizedWeekStart) {
        weekCacheRef.current = {
          ...weekCacheRef.current,
          [normalizedWeekStart]: hydratedDays,
        };
      }

      setWeekStart((current) => (current === normalizedWeekStart ? current : normalizedWeekStart));

      setData({
        days: hydratedDays,
        coverage: payload.coverage || {},
        role: payload.role,
        week_start: normalizedWeekStart,
      });
    } catch (error) {
      console.error('Failed to load schedule', error);
      toast.error('Unable to load weekly schedule');
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  const fetchWeekSnapshot = useCallback(
    async (weekKey) => {
      const normalizedKey = toDateInputValue(parseWeekString(weekKey));
      if (!normalizedKey) return [];

      if (Object.prototype.hasOwnProperty.call(weekCacheRef.current, normalizedKey)) {
        return weekCacheRef.current[normalizedKey] || [];
      }

      if (weekLoaders.current.has(normalizedKey)) {
        return weekLoaders.current.get(normalizedKey);
      }

      const loaderPromise = (async () => {
        try {
          const response = await authFetch('/api/schedules/week', { params: { week_start: normalizedKey } });
          const payload = response?.data || {};
          const incomingDays = payload.days || [];

          const yearsToLoad = Array.from(
            new Set(
              incomingDays
                .map((day) => parseISOToDate(day.date))
                .map((dateObj) => (Number.isNaN(dateObj.getTime()) ? null : dateObj.getFullYear()))
                .filter((year) => Number.isFinite(year))
            )
          );

          if (yearsToLoad.length) {
            await ensureSingaporeHolidays(yearsToLoad);
          }

          const hydratedDays = incomingDays.map((day) => ({
            ...day,
            holiday: getSingaporeHoliday(day.date),
          }));

          weekCacheRef.current = {
            ...weekCacheRef.current,
            [normalizedKey]: hydratedDays,
          };

          return hydratedDays;
        } catch (error) {
          console.error('Failed to load schedule snapshot', error);
          return [];
        } finally {
          weekLoaders.current.delete(normalizedKey);
        }
      })();

      weekLoaders.current.set(normalizedKey, loaderPromise);
      return loaderPromise;
    },
    [authFetch]
  );

  const ensureWeeks = useCallback(
    async (weekKeys = []) => {
      const normalizedKeys = Array.from(
        new Set(
          (weekKeys || [])
            .map((key) => toDateInputValue(parseWeekString(key)))
            .filter((value) => Boolean(value))
        )
      );

      if (!normalizedKeys.length) return;
      await Promise.all(normalizedKeys.map((key) => fetchWeekSnapshot(key)));
    },
    [fetchWeekSnapshot]
  );

  const detectLocalConflict = useCallback(
    (candidate, ignoreId, options = {}) => {
      if (!candidate) return null;

      const staffId = candidate.staff_id;
      if (!staffId) return null;

      const normalizedStaffId = Number(staffId);
      if (!Number.isFinite(normalizedStaffId)) return null;

      const shiftDateKey = toApiDate(candidate.shift_date);
      const startToken = toApiTime(candidate.start_time);
      const endToken = toApiTime(candidate.end_time);

      if (!shiftDateKey || !startToken || !endToken) {
        return null;
      }

      const proposedStart = timeStringToMinutes(startToken);
      const proposedEnd = timeStringToMinutes(endToken);

      if (!Number.isFinite(proposedStart) || !Number.isFinite(proposedEnd)) {
        return null;
      }

      const baseDate = parseISOToDate(`${shiftDateKey}T00:00:00`);
      if (Number.isNaN(baseDate.getTime())) {
        return null;
      }

      const repeatWeeks = Math.max(0, Number(options.repeatWeeks || 0));
      const ignoreToken = ignoreId !== null && ignoreId !== undefined ? Number(ignoreId) : null;

      const dayIndex = new Map();
      const registerDay = (day) => {
        if (!day) return;
        const dateKey = toApiDate(day.date);
        if (!dateKey) return;
        const assignments = Array.isArray(day.assignments) ? day.assignments : [];
        if (!dayIndex.has(dateKey)) {
          dayIndex.set(dateKey, assignments);
          return;
        }
        const existing = dayIndex.get(dateKey) || [];
        const merged = existing.slice();
        assignments.forEach((assignment) => {
          if (!merged.some((item) => Number(item.id) === Number(assignment?.id))) {
            merged.push(assignment);
          }
        });
        dayIndex.set(dateKey, merged);
      };

      (Array.isArray(data?.days) ? data.days : []).forEach(registerDay);
      Object.values(weekCacheRef.current || {}).forEach((days) => {
        if (!Array.isArray(days)) return;
        days.forEach(registerDay);
      });

      for (let offset = 0; offset <= repeatWeeks; offset += 1) {
        const occurrenceDate = new Date(baseDate);
        occurrenceDate.setDate(occurrenceDate.getDate() + offset * 7);
        const occurrenceKey = toApiDate(occurrenceDate);
        if (!occurrenceKey) continue;

        const assignments = dayIndex.get(occurrenceKey);
        if (!Array.isArray(assignments) || !assignments.length) continue;

        for (const assignment of assignments) {
          if (!assignment) continue;
          const staffTokenRaw = assignment.staff_id ?? assignment.assigned_user ?? null;
          const assignmentStaff = staffTokenRaw !== null && staffTokenRaw !== undefined ? Number(staffTokenRaw) : null;
          if (!assignmentStaff || assignmentStaff !== normalizedStaffId) continue;
          if (ignoreToken !== null && Number(assignment.id) === ignoreToken) continue;

          const startDate = parseISOToDate(assignment.start || assignment.start_time);
          const endDate = parseISOToDate(assignment.end || assignment.end_time);
          if (Number.isNaN(startDate.getTime())) continue;

          const existingStartMinutes = startDate.getHours() * 60 + startDate.getMinutes();
          let existingEndMinutes;
          if (Number.isNaN(endDate.getTime())) {
            existingEndMinutes = existingStartMinutes + MIN_SHIFT_DURATION_MINUTES;
          } else {
            existingEndMinutes = endDate.getHours() * 60 + endDate.getMinutes();
          }

          if (existingEndMinutes <= existingStartMinutes) {
            existingEndMinutes = existingStartMinutes + MIN_SHIFT_DURATION_MINUTES;
          }

          const overlaps = !(proposedEnd <= existingStartMinutes || proposedStart >= existingEndMinutes);
          if (overlaps) {
            return {
              ...assignment,
              occurrenceDate: occurrenceKey,
            };
          }
        }
      }

      return null;
    },
    [data?.days]
  );

  const loadStaff = useCallback(async () => {
    if (!isManager) return;
    try {
      const response = await authFetch('/api/schedules/staff');
      setStaff(response?.data?.staff || []);
    } catch (error) {
      console.error('Failed to load staff', error);
    }
  }, [authFetch, isManager]);

  const loadAvailability = useCallback(async (ws) => {
    if (!isStaff) {
      setAvailabilityEntries([]);
      return;
    }
    setAvailabilityLoading(true);
    try {
      const response = await authFetch('/api/schedules/availability', { params: { week_start: ws } });
      const payload = response?.data || response || {};
      setAvailabilityEntries(payload.entries || []);
    } catch (error) {
      console.error('Failed to load availability', error);
      toast.error('Unable to load your availability');
    } finally {
      setAvailabilityLoading(false);
    }
  }, [authFetch, isStaff]);

  const loadTeamAvailability = useCallback(async (ws) => {
    if (!isManager) {
      setTeamAvailability({});
      return;
    }
    try {
      const response = await authFetch('/api/schedules/availability', { params: { week_start: ws } });
      const entries = response?.data?.entries || [];
      const index = new Map();
      entries.forEach((entry) => {
        const dateValue = entry?.date;
        const parsedDate = parseISOToDate(dateValue);
        const dateKey = toDateInputValue(parsedDate) || (typeof dateValue === 'string' ? dateValue.slice(0, 10) : '');
        const staffIdRaw = entry?.user_id ?? entry?.staff_id ?? entry?.id;
        const staffIdToken = staffIdRaw !== null && staffIdRaw !== undefined ? String(staffIdRaw) : '';
        if (!dateKey || !staffIdToken) return;
        if (entry?.is_available === false) {
          const existing = index.get(dateKey) || new Set();
          existing.add(staffIdToken);
          index.set(dateKey, existing);
        }
      });
      const normalized = {};
      index.forEach((value, key) => {
        normalized[key] = Array.from(value);
      });
      setTeamAvailability(normalized);
    } catch (error) {
      console.error('Failed to load team availability', error);
      setTeamAvailability({});
    }
  }, [authFetch, isManager]);

  useEffect(() => {
    loadWeek(weekStart);
  }, [loadWeek, weekStart]);

  useEffect(() => {
    loadStaff();
  }, [loadStaff]);

  useEffect(() => {
    if (isStaff) {
      loadAvailability(activeWeekStart);
    } else {
      setAvailabilityEntries([]);
    }
  }, [isStaff, loadAvailability, activeWeekStart]);

  useEffect(() => {
    if (isManager) {
      loadTeamAvailability(activeWeekStart);
    } else {
      setTeamAvailability({});
    }
  }, [isManager, loadTeamAvailability, activeWeekStart]);

  const refreshWeek = useCallback(() => {
    loadWeek(weekStart);
  }, [loadWeek, weekStart]);

  const openEditor = useCallback(
    (mode, shift = null, defaultDate = null) => {
      setEditorError('');
      const sanitizedDefault = computeDefaultShiftDate(defaultDate);
      setEditorState({ open: true, mode, shift, defaultDate: sanitizedDefault });
    },
    [computeDefaultShiftDate]
  );

  const closeEditor = useCallback(() => {
    setEditorState((prev) => ({ ...prev, open: false, shift: null }));
    setEditorError('');
  }, []);

  const handleSave = useCallback(async (form) => {
    if (!editorState.open) return;
    setEditorError('');

    const normalizedStaffId = form.staff_id ? Number(form.staff_id) : null;
    const shiftDate = toApiDate(form.shift_date);
    const startToken = toApiTime(form.start_time);
    const endToken = toApiTime(form.end_time);
    const repeatWeeks = Math.max(0, Number(form.repeat_weeks || 0));

    if (shiftDate) {
      const baseDate = parseISOToDate(`${shiftDate}T00:00:00`);
      if (!Number.isNaN(baseDate.getTime())) {
        const weekKeys = [];
        for (let offset = 0; offset <= repeatWeeks; offset += 1) {
          const nextDate = new Date(baseDate);
          nextDate.setDate(nextDate.getDate() + offset * 7);
          weekKeys.push(toDateInputValue(startOfWeek(nextDate)));
        }
        await ensureWeeks(weekKeys);
      }
    }

    const conflict = detectLocalConflict(
      {
        staff_id: normalizedStaffId,
        shift_date: shiftDate,
        start_time: startToken,
        end_time: endToken,
      },
      editorState.mode === 'edit' && editorState.shift ? editorState.shift.id : null,
      { repeatWeeks }
    );

    if (conflict) {
      const conflictLabel = conflict.shift_name || conflict.role || 'Existing shift';
      const conflictStart = conflict.start ? conflict.start.slice(11, 16) : '';
      const conflictEnd = conflict.end ? conflict.end.slice(11, 16) : '';
      let message = `Conflict with ${conflictLabel} (${conflictStart || '??'}-${conflictEnd || '??'})`;
      let toastMessage = 'This team member is already booked during that time slot.';
      if (conflict.occurrenceDate) {
        const conflictDateObj = parseISOToDate(`${conflict.occurrenceDate}T00:00:00`);
        if (!Number.isNaN(conflictDateObj.getTime())) {
          const conflictDateLabel = conflictDateObj.toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          });
          message = `${message} on ${conflictDateLabel}`;
          toastMessage = `Already booked on ${conflictDateLabel}.`;
        }
      }
      setEditorError(message);
      toast.error(toastMessage);
      return;
    }

    setIsSaving(true);
    const payload = {
      week_start: weekStart,
      shift_date: shiftDate,
      start_time: startToken,
      end_time: endToken,
      staff_id: normalizedStaffId,
      role: form.role || 'Server',
      status: form.status || 'scheduled',
      notes: form.notes || '',
      repeat_weeks: repeatWeeks,
    };

    try {
      if (editorState.mode === 'edit' && editorState.shift) {
        await authFetch(`/api/schedules/assignments/${editorState.shift.id}`, {
          method: 'PATCH',
          data: payload,
        });
        toast.success('Shift updated');
      } else {
        const response = await authFetch('/api/schedules/assignments', {
          method: 'POST',
          data: payload,
        });
        const createdNotifications = response?.data?.notifications || [];
        setNotifications((prev) => mergeNotifications(prev, createdNotifications));
        toast.success('Shift scheduled');
      }
      closeEditor();
      refreshWeek();
    } catch (error) {
      const conflict = error?.response?.data?.conflicts;
      if (conflict && Array.isArray(conflict) && conflict.length) {
        const conflictMessage = conflict
          .map((item) => `${item.shift_name || 'Existing shift'} (${item.start?.slice(11, 16)}-${item.end?.slice(11, 16)})`)
          .join(', ');
        setEditorError(`Conflict with ${conflictMessage}`);
      } else {
        const message = error?.response?.data?.msg || 'Could not save shift';
        setEditorError(message);
      }
    } finally {
      setIsSaving(false);
    }
  }, [authFetch, editorState, weekStart, closeEditor, refreshWeek, detectLocalConflict, ensureWeeks]);

  const handleDelete = useCallback(async () => {
    if (!editorState.shift) return;
    try {
      await authFetch(`/api/schedules/assignments/${editorState.shift.id}`, { method: 'DELETE' });
      toast.info('Shift removed');
      closeEditor();
      refreshWeek();
    } catch (error) {
      console.error('Failed to delete shift', error);
      toast.error('Unable to delete shift');
    }
  }, [authFetch, editorState.shift, closeEditor, refreshWeek]);

  const handleMove = useCallback(async (assignment, targetDate) => {
    const start = toApiTime(assignment.start);
    const end = toApiTime(assignment.end || assignment.start);
    const targetDateKey = toApiDate(targetDate);

    try {
      if (assignment?.staff_id && targetDateKey) {
        const targetDateObj = parseISOToDate(`${targetDateKey}T00:00:00`);
        if (!Number.isNaN(targetDateObj.getTime())) {
          await ensureWeeks([toDateInputValue(startOfWeek(targetDateObj))]);
        }

        const conflict = detectLocalConflict(
          {
            staff_id: assignment.staff_id,
            shift_date: targetDateKey,
            start_time: start,
            end_time: end,
          },
          assignment.id
        );

        if (conflict) {
          const conflictLabel = conflict.shift_name || conflict.role || 'Existing shift';
          const conflictStart = conflict.start ? conflict.start.slice(11, 16) : '';
          const conflictEnd = conflict.end ? conflict.end.slice(11, 16) : '';
          let message = `Cannot move - conflicts with ${conflictLabel} (${conflictStart || '??'}-${conflictEnd || '??'})`;
          let toastMessage = 'Shift move would create an overlap.';
          if (conflict.occurrenceDate) {
            const conflictDateObj = parseISOToDate(`${conflict.occurrenceDate}T00:00:00`);
            if (!Number.isNaN(conflictDateObj.getTime())) {
              const conflictDateLabel = conflictDateObj.toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              });
              message = `${message} on ${conflictDateLabel}`;
              toastMessage = `Already booked on ${conflictDateLabel}.`;
            }
          }
          toast.error(toastMessage);
          return;
        }
      }

      await authFetch(`/api/schedules/assignments/${assignment.id}`, {
        method: 'PATCH',
        data: {
          shift_date: targetDateKey,
          start_time: start,
          end_time: end,
          staff_id: assignment.staff_id,
          status: assignment.status,
          role: assignment.role,
          notes: assignment.notes,
        },
      });
      toast.success('Shift moved');
      refreshWeek();
    } catch (error) {
      const message = error?.response?.data?.msg || 'Unable to move shift';
      toast.error(message);
    }
  }, [authFetch, detectLocalConflict, ensureWeeks, refreshWeek]);

  const handleRequestFill = useCallback((assignment) => {
    if (!isStaff || !assignment) return;
    if ((assignment.status || '').toLowerCase() !== 'open') return;
    setFillError('');
    setFillTarget(assignment);
  }, [isStaff]);

  const closeFillDialog = useCallback(() => {
    setFillTarget(null);
    setFillError('');
    setIsClaiming(false);
  }, []);

  const handleConfirmFill = useCallback(async () => {
    if (!fillTarget || !isStaff) return;
    const staffId = profile?.id !== undefined ? Number(profile.id) : null;

    if (!Number.isFinite(staffId)) {
      toast.error('Unable to identify your staff profile.');
      return;
    }

    const shiftDate = toApiDate(fillTarget.shift_date || fillTarget.date);
    const startToken = toApiTime(fillTarget.start || fillTarget.start_time);
    const endToken = toApiTime(fillTarget.end || fillTarget.end_time);

    if (!shiftDate || !startToken || !endToken) {
      setFillError('This shift is missing timing details.');
      return;
    }

    const shiftDateObj = parseISOToDate(`${shiftDate}T00:00:00`);
    let weekKey = '';
    if (!Number.isNaN(shiftDateObj.getTime())) {
      weekKey = toDateInputValue(startOfWeek(shiftDateObj));
      if (weekKey) {
        await ensureWeeks([weekKey]);
      }
    }

    const conflict = detectLocalConflict(
      {
        staff_id: staffId,
        shift_date: shiftDate,
        start_time: startToken,
        end_time: endToken,
      },
      fillTarget.id
    );

    if (conflict) {
      const conflictLabel = conflict.shift_name || conflict.role || 'Existing shift';
      const conflictStart = conflict.start ? conflict.start.slice(11, 16) : '';
      const conflictEnd = conflict.end ? conflict.end.slice(11, 16) : '';
      let message = `Conflict with ${conflictLabel} (${conflictStart || '??'}-${conflictEnd || '??'})`;
      let toastMessage = 'Already booked during that time.';
      if (conflict.occurrenceDate) {
        const conflictDateObj = parseISOToDate(`${conflict.occurrenceDate}T00:00:00`);
        if (!Number.isNaN(conflictDateObj.getTime())) {
          const conflictDateLabel = conflictDateObj.toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          });
          message = `${message} on ${conflictDateLabel}`;
          toastMessage = `Already booked on ${conflictDateLabel}.`;
        }
      }
      setFillError(message);
      toast.error(toastMessage);
      return;
    }

    try {
      setIsClaiming(true);
      const response = await authFetch(`/api/schedules/assignments/${fillTarget.id}/claim`, {
        method: 'POST',
      });
      const message = response?.data?.msg || 'Shift claimed';
      toast.success(message);

      if (weekKey) {
        const nextCache = { ...weekCacheRef.current };
        if (Object.prototype.hasOwnProperty.call(nextCache, weekKey)) {
          delete nextCache[weekKey];
          weekCacheRef.current = nextCache;
        }
      }

      closeFillDialog();
      refreshWeek();
    } catch (error) {
      const conflicts = error?.response?.data?.conflicts;
      if (Array.isArray(conflicts) && conflicts.length) {
        const first = conflicts[0];
        const conflictStart = first.start ? first.start.slice(11, 16) : '';
        const conflictEnd = first.end ? first.end.slice(11, 16) : '';
        const conflictLabel = first.shift_name || first.role || 'Existing shift';
        setFillError(`Conflict with ${conflictLabel} (${conflictStart || '??'}-${conflictEnd || '??'})`);
        toast.error('This shift overlaps with one of your assignments.');
      } else {
        const message = error?.response?.data?.msg || 'Unable to claim shift';
        setFillError(message);
        toast.error(message);
      }
    } finally {
      setIsClaiming(false);
    }
  }, [authFetch, closeFillDialog, detectLocalConflict, ensureWeeks, fillTarget, isStaff, profile?.id, refreshWeek]);

  const weekNav = useCallback((direction) => {
    const base = startOfWeek(parseWeekString(activeWeekStart || weekStart));
    if (direction === 'prev') {
      base.setDate(base.getDate() - 7);
    } else if (direction === 'next') {
      base.setDate(base.getDate() + 7);
    } else {
      base.setTime(startOfWeek(new Date()).getTime());
    }
    setWeekStart(toDateInputValue(base));
  }, [activeWeekStart, weekStart]);

  const handleAvailabilitySave = useCallback(async (changes) => {
    if (!changes || !changes.length) return;
    setAvailabilitySaving(true);
    try {
      await authFetch('/api/schedules/availability', {
        method: 'PUT',
        data: { entries: changes },
      });
      toast.success('Availability updated');
      await loadAvailability(activeWeekStart);
    } catch (error) {
      const message = error?.response?.data?.msg || 'Unable to update availability';
      toast.error(message);
    } finally {
      setAvailabilitySaving(false);
    }
  }, [authFetch, loadAvailability, activeWeekStart]);

  if (isInitialLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--app-bg)] px-4">
        <div className="flex flex-col items-center gap-4 text-[var(--app-muted)]">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-[color-mix(in_srgb,var(--app-primary)_35%,_transparent_65%)] border-t-[var(--app-primary)]" aria-label="Loading schedule" />
          <p className="text-sm font-medium">Loading this week’s schedule…</p>
        </div>
      </div>
    );
  }

  const fillDateObj = fillTarget ? parseISOToDate(fillTarget.shift_date || fillTarget.date) : null;
  const fillDateLabel = fillDateObj && !Number.isNaN(fillDateObj.getTime())
    ? fillDateObj.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })
    : '';
  const fillTimeLabel = fillTarget ? formatTimeRange(fillTarget.start || fillTarget.start_time, fillTarget.end || fillTarget.end_time) : '';
  const fillRoleLabel = fillTarget?.role || 'General';

  return (
    <div className="min-h-full bg-[var(--app-bg)] py-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            {isStaff ? (
              <>
                <h1 className="text-3xl font-semibold text-[var(--app-text)]">Your schedule</h1>
                <p className="text-sm text-[var(--app-muted)]">Check and update your availability for upcoming shifts.</p>
              </>
            ) : (
              <>
                <h1 className="text-3xl font-semibold text-[var(--app-text)]">Team schedule</h1>
                <p className="text-sm text-[var(--app-muted)]">
                  Coordinate staffing coverage, track confirmations, and resolve conflicts quickly.
                </p>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <ScheduleSidebar
            coverage={data.coverage}
            onAddShift={() => openEditor('create', null, activeWeekStart)}
            filters={filters}
            onFilterChange={setFilters}
            staff={staff}
            role={role}
            notifications={notifications}
            onClearNotifications={() => setNotifications([])}
            availabilityEntries={availabilityEntries}
            weekStart={activeWeekStart}
            onAvailabilitySave={handleAvailabilitySave}
            availabilityLoading={availabilityLoading}
            availabilitySaving={availabilitySaving}
          />

          <ScheduleCalendar
            days={data.days}
            weekStart={activeWeekStart}
            loading={loading}
            filters={filters}
            role={role}
            onAddShift={(date) => openEditor('create', null, date)}
            onEditShift={(shift) => openEditor('edit', shift, shift.shift_date)}
            onMoveShift={isManager ? handleMove : undefined}
            onNavigateWeek={weekNav}
            onFillOpenShift={handleRequestFill}
            canFillOpenShift={isStaff}
          />

          {fillTarget ? (
            <Modal onClose={isClaiming ? undefined : closeFillDialog} className="max-w-xl">
              <div className="flex h-full min-h-0 flex-col bg-[var(--app-surface)] p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-semibold text-[var(--app-text)]">Fill this open shift</h2>
                    <p className="text-sm text-[var(--app-muted)]">Claim this slot to add it to your schedule.</p>
                  </div>
                  <button
                    type="button"
                    onClick={closeFillDialog}
                    className="rounded-full px-3 py-1 text-xs font-semibold text-[var(--app-muted)] transition hover:bg-[color-mix(in_srgb,var(--app-surface)_70%,_var(--app-bg)_30%)] hover:text-[var(--app-text)]"
                    disabled={isClaiming}
                  >
                    Close
                  </button>
                </div>

                <div className="mt-6 space-y-4">
                  <div className="rounded-2xl border border-[rgba(15,23,42,0.08)] bg-[color-mix(in_srgb,var(--app-surface)_96%,_var(--app-bg)_4%)] p-4">
                    <div className="text-xs uppercase tracking-wide text-[var(--app-muted)]">Shift date</div>
                    <div className="text-lg font-semibold text-[var(--app-text)]">{fillDateLabel || 'TBD'}</div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-2xl border border-[rgba(15,23,42,0.08)] bg-[color-mix(in_srgb,var(--app-surface)_96%,_var(--app-bg)_4%)] p-4">
                      <div className="text-xs uppercase tracking-wide text-[var(--app-muted)]">Time</div>
                      <div className="text-lg font-semibold text-[var(--app-text)]">{fillTimeLabel || 'TBD'}</div>
                    </div>
                    <div className="rounded-2xl border border-[rgba(15,23,42,0.08)] bg-[color-mix(in_srgb,var(--app-surface)_96%,_var(--app-bg)_4%)] p-4">
                      <div className="text-xs uppercase tracking-wide text-[var(--app-muted)]">Role</div>
                      <div className="text-lg font-semibold text-[var(--app-text)]">{fillRoleLabel}</div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-dashed border-[rgba(15,23,42,0.12)] bg-[color-mix(in_srgb,var(--app-surface)_98%,_var(--app-bg)_2%)] p-4 text-sm text-[var(--app-muted)]">
                    Double-check the details above before confirming. You’ll receive a notification if the slot is already filled or overlaps with another shift.
                  </div>

                  {fillError ? (
                    <div className="rounded-xl border border-[color:color-mix(in_srgb,var(--app-danger)_50%,_transparent_50%)] bg-[color-mix(in_srgb,var(--app-danger)_12%,_var(--app-bg)_88%)] px-4 py-3 text-sm font-medium text-[var(--app-danger)]">
                      {fillError}
                    </div>
                  ) : null}
                </div>

                <div className="mt-auto flex items-center justify-end gap-3 pt-6">
                  <button
                    type="button"
                    onClick={closeFillDialog}
                    className="rounded-full border border-[rgba(15,23,42,0.12)] px-4 py-2 text-sm font-semibold text-[var(--app-muted)] transition hover:border-[var(--app-text)] hover:text-[var(--app-text)]"
                    disabled={isClaiming}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmFill}
                    className="rounded-full bg-[var(--app-primary)] px-4 py-2 text-sm font-semibold text-[var(--app-primary-contrast)] shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={isClaiming}
                  >
                    {isClaiming ? 'Claiming…' : 'Fill this slot'}
                  </button>
                </div>
              </div>
            </Modal>
          ) : null}

          <ShiftEditor
            open={editorState.open}
            mode={editorState.mode}
            initialShift={editorState.shift}
            defaultDate={editorState.defaultDate}
            staffOptions={staff}
            availabilityByDate={teamAvailability}
            onSave={handleSave}
            onDelete={handleDelete}
            onClose={closeEditor}
            weekStart={data.week_start || weekStart}
            isSaving={isSaving}
            error={editorError}
          />
        </div>
      </div>
    </div>
  );
};

export default SchedulePage;
