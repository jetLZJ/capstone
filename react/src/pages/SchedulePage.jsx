import { useCallback, useEffect, useMemo, useState } from 'react';
import ScheduleCalendar from '../components/schedule/ScheduleCalendar';
import ScheduleSidebar from '../components/schedule/ShiftList';
import ShiftEditor from '../components/schedule/ShiftEditor';
import useAuth from '../hooks/useAuth';
import { mergeNotifications, startOfWeek, toApiDate, toApiTime } from '../components/schedule/scheduleHelpers';
import { toast } from 'react-toastify';

const initialFilters = { staffId: '', status: '' };

const SchedulePage = () => {
  const { authFetch, profile } = useAuth();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()).toISOString().slice(0, 10));
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

  const role = useMemo(() => data.role || profile?.role || 'User', [data.role, profile?.role]);
  const normalizedRole = (role || '').toLowerCase();
  const isManager = normalizedRole === 'manager' || normalizedRole === 'admin';
  const isStaff = normalizedRole === 'staff' || normalizedRole === 'server';
  const activeWeekStart = data.week_start || weekStart;

  const loadWeek = useCallback(async (ws) => {
    setLoading(true);
    try {
      const response = await authFetch('/api/schedules/week', { params: { week_start: ws } });
      const payload = response?.data || {};
      setData({
        days: payload.days || [],
        coverage: payload.coverage || {},
        role: payload.role,
        week_start: payload.week_start || ws,
      });
    } catch (error) {
      console.error('Failed to load schedule', error);
      toast.error('Unable to load weekly schedule');
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

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

  const refreshWeek = useCallback(() => {
    loadWeek(weekStart);
  }, [loadWeek, weekStart]);

  const openEditor = useCallback((mode, shift = null, defaultDate = null) => {
    setEditorError('');
    setEditorState({ open: true, mode, shift, defaultDate });
  }, []);

  const closeEditor = useCallback(() => {
    setEditorState((prev) => ({ ...prev, open: false, shift: null }));
    setEditorError('');
  }, []);

  const handleSave = useCallback(async (form) => {
    if (!editorState.open) return;
    setIsSaving(true);
    setEditorError('');
    const payload = {
      week_start: weekStart,
      shift_date: toApiDate(form.shift_date),
      start_time: toApiTime(form.start_time),
      end_time: toApiTime(form.end_time),
      staff_id: form.staff_id || null,
      role: form.role || 'Server',
      status: form.status || 'scheduled',
      notes: form.notes || '',
      repeat_weeks: form.repeat_weeks || 0,
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
  }, [authFetch, editorState, weekStart, closeEditor, refreshWeek]);

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
    try {
      await authFetch(`/api/schedules/assignments/${assignment.id}`, {
        method: 'PATCH',
        data: {
          shift_date: toApiDate(targetDate),
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
  }, [authFetch, refreshWeek]);

  const weekNav = useCallback((direction) => {
    const current = startOfWeek(new Date(weekStart));
    if (direction === 'prev') current.setDate(current.getDate() - 7);
    else if (direction === 'next') current.setDate(current.getDate() + 7);
    else current.setTime(startOfWeek(new Date()).getTime());
    const iso = current.toISOString().slice(0, 10);
    setWeekStart(iso);
  }, [weekStart]);

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

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">Team schedule</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Coordinate staffing coverage, track confirmations, and resolve conflicts quickly.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => weekNav('prev')}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            ← Previous
          </button>
          <button
            type="button"
            onClick={() => weekNav('today')}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            This week
          </button>
          <button
            type="button"
            onClick={() => weekNav('next')}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Next →
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        <ScheduleSidebar
          coverage={data.coverage}
          onAddShift={() => openEditor('create', null, weekStart)}
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
        />

        <ShiftEditor
          open={editorState.open}
          mode={editorState.mode}
          initialShift={editorState.shift}
          defaultDate={editorState.defaultDate}
          staffOptions={staff}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={closeEditor}
          weekStart={data.week_start || weekStart}
          isSaving={isSaving}
          error={editorError}
        />
      </div>
    </div>
  );
};

export default SchedulePage;
