import { useEffect, useMemo, useState } from 'react';
import Modal from './Modal';
import {
  generateWorkingTimeOptions,
  statusOptions,
  timeStringToMinutes,
  toDateInputValue,
  toTimeInputValue,
  startOfWeek,
  WORKING_DAY_END_MINUTES,
  WORKING_DAY_START_MINUTES,
} from './scheduleHelpers';

const emptyForm = (weekStart) => ({
  shift_date: toDateInputValue(weekStart || startOfWeek(new Date())),
  start_time: '09:00',
  end_time: '17:00',
  staff_id: '',
  role: 'Server',
  status: 'scheduled',
  notes: '',
  repeat_weeks: 0,
});

const staffLabel = (staff) => {
  if (!staff) return 'Unassigned';
  const name = [staff.first_name, staff.last_name].filter(Boolean).join(' ');
  return name || staff.name || staff.email || `ID ${staff.id}`;
};

export default function ShiftEditor({
  open,
  mode,
  initialShift,
  defaultDate,
  staffOptions = [],
  availabilityByDate = {},
  onSave,
  onDelete,
  onClose,
  weekStart,
  isSaving,
  error,
}) {
  const [form, setForm] = useState(() => emptyForm(weekStart));
  const [localError, setLocalError] = useState('');

  useEffect(() => {
    if (!open) {
      setForm(emptyForm(weekStart));
      setLocalError('');
      return;
    }
    if (mode === 'edit' && initialShift) {
      setForm({
        shift_date: toDateInputValue(initialShift.shift_date || initialShift.start || initialShift.date),
        start_time: toTimeInputValue(initialShift.start),
        end_time: toTimeInputValue(initialShift.end || initialShift.start),
        staff_id: initialShift.staff_id ? String(initialShift.staff_id) : '',
        role: initialShift.role || 'Server',
        status: (initialShift.status || 'scheduled').toLowerCase(),
        notes: initialShift.notes || '',
        repeat_weeks: 0,
      });
    } else {
      const template = emptyForm(weekStart || defaultDate);
      template.shift_date = defaultDate ? toDateInputValue(defaultDate) : template.shift_date;
      setForm(template);
    }
    setLocalError('');
  }, [open, mode, initialShift, defaultDate, weekStart]);

  useEffect(() => {
    if (error) {
      setLocalError('');
    }
  }, [error]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (localError) {
      setLocalError('');
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const startMinutes = timeStringToMinutes(form.start_time);
    const endMinutes = timeStringToMinutes(form.end_time);

    if ([startMinutes, endMinutes].some((value) => Number.isNaN(value))) {
      setLocalError('Select valid start and end times between 9:00 AM and 10:00 PM.');
      return;
    }

    if (startMinutes < WORKING_DAY_START_MINUTES || startMinutes >= WORKING_DAY_END_MINUTES) {
      setLocalError('Shifts must start between 9:00 AM and 10:00 PM.');
      return;
    }

    if (endMinutes <= WORKING_DAY_START_MINUTES || endMinutes > WORKING_DAY_END_MINUTES) {
      setLocalError('Shifts must end between 9:00 AM and 10:00 PM.');
      return;
    }

    if (endMinutes <= startMinutes) {
      setLocalError('End time must be later than the start time.');
      return;
    }

    setLocalError('');

    if (typeof onSave === 'function') {
      const payload = {
        ...form,
        staff_id: form.staff_id ? Number(form.staff_id) : null,
        repeat_weeks: Number(form.repeat_weeks || 0),
      };
      onSave(payload);
    }
  };

  const isEdit = mode === 'edit' && initialShift;
  const workingTimes = useMemo(() => generateWorkingTimeOptions(30), []);
  const startTimeOptions = useMemo(() => workingTimes.slice(0, -1), [workingTimes]);
  const endTimeOptions = workingTimes;
  const normalizedStartOptions = useMemo(() => {
    if (!form.start_time || startTimeOptions.includes(form.start_time)) return startTimeOptions;
    return [...startTimeOptions, form.start_time].sort();
  }, [form.start_time, startTimeOptions]);
  const normalizedEndOptions = useMemo(() => {
    if (!form.end_time || endTimeOptions.includes(form.end_time)) return endTimeOptions;
    return [...endTimeOptions, form.end_time].sort();
  }, [form.end_time, endTimeOptions]);
  const statuses = statusOptions();

  const staffList = useMemo(() => {
    return Array.isArray(staffOptions) ? staffOptions : [];
  }, [staffOptions]);

  const availabilityLookup = useMemo(() => {
    const map = new Map();
    if (!availabilityByDate || typeof availabilityByDate !== 'object') {
      return map;
    }
    let entries;
    if (Array.isArray(availabilityByDate)) {
      entries = availabilityByDate;
    } else if (availabilityByDate instanceof Map) {
      entries = Array.from(availabilityByDate.entries());
    } else {
      entries = Object.entries(availabilityByDate);
    }

    entries.forEach((entry) => {
      let dateKey;
      let raw;

      if (Array.isArray(entry) && entry.length === 2) {
        [dateKey, raw] = entry;
      } else if (entry && typeof entry === 'object') {
        dateKey = entry.date || entry[0];
        raw = entry.unavailable || entry.value || entry[1];
      } else {
        return;
      }

      if (!dateKey) return;
      let source = raw;
      if (source && typeof source === 'object' && !Array.isArray(source) && Array.isArray(source.unavailable)) {
        source = source.unavailable;
      }
      const tokens = Array.isArray(source) ? source : [];
      const normalized = new Set(
        tokens
          .map((token) => {
            if (token === null || token === undefined) return '';
            return String(token);
          })
          .filter((token) => token !== '')
      );
      map.set(dateKey, normalized);
    });
    return map;
  }, [availabilityByDate]);

  const activeDateKey = form.shift_date || '';
  const unavailableSet = availabilityLookup.get(activeDateKey);
  const isStaffSelectDisabled = !activeDateKey;
  const availableStaffCount = !isStaffSelectDisabled
    ? staffList.filter((staff) => {
        const idToken = staff?.id !== null && staff?.id !== undefined ? String(staff.id) : '';
        if (!idToken) return false;
        if (!unavailableSet) return true;
        return !unavailableSet.has(idToken);
      }).length
    : 0;

  const combinedError = localError || error;

  useEffect(() => {
    if (!open) return;
    if (!activeDateKey || !form.staff_id || !unavailableSet) return;
    const token = String(form.staff_id);
    if (unavailableSet.has(token)) {
      setForm((prev) => ({ ...prev, staff_id: '' }));
      setLocalError((prev) => prev || 'Selected team member is unavailable on that date. Please choose another.');
    }
  }, [open, activeDateKey, form.staff_id, unavailableSet]);

  if (!open) return null;

  const labelClass = 'flex flex-col gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--app-muted)]';
  const controlClass =
    'rounded-2xl border border-[rgba(15,23,42,0.12)] bg-[var(--app-bg)] px-3 py-2 text-sm text-[var(--app-text)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-info)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--app-surface)] disabled:cursor-not-allowed disabled:opacity-60';

  const handleBackdropClick = (event) => {
    if (event.target === event.currentTarget && typeof onClose === 'function') {
      onClose();
    }
  };

  return (
    <Modal onClose={onClose} className="w-full max-w-4xl">
      <div
        className="relative flex w-full max-h-[90vh] flex-col overflow-hidden rounded-3xl border border-[rgba(15,23,42,0.12)] bg-[var(--app-surface)] shadow-[0_30px_60px_0_rgba(6,6,20,0.22)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="shift-editor-title"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-5 top-5 rounded-full px-3 py-1 text-sm font-semibold text-[var(--app-muted)] transition hover:bg-[color-mix(in_srgb,var(--app-surface)_70%,_var(--app-bg)_30%)] hover:text-[var(--app-text)]"
        >
          Close
        </button>

        <form onSubmit={handleSubmit} className="flex h-full min-h-0 flex-col">
          <div className="px-6 pb-6 pt-8 sm:px-8">
            <header className="space-y-1">
              <h3 id="shift-editor-title" className="text-2xl font-semibold text-[var(--app-text)]">
                {isEdit ? 'Edit assignment' : 'Schedule a new shift'}
              </h3>
              <p className="text-sm text-[var(--app-muted)]">
                {isEdit ? 'Update staffing, status, and timing' : 'Choose the team member, day, time, and repetition'}
              </p>
            </header>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto px-6 sm:px-8">
            <div className="flex flex-col gap-5 pb-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className={labelClass}>
                  Shift date
                  <input
                    type="date"
                    name="shift_date"
                    value={form.shift_date}
                    onChange={handleChange}
                    className={controlClass}
                    required
                  />
                </label>
                <label className={labelClass}>
                  Staff member
                  <select
                    name="staff_id"
                    value={form.staff_id}
                    onChange={handleChange}
                    className={controlClass}
                    disabled={isStaffSelectDisabled}
                    title={isStaffSelectDisabled ? 'Select a shift date first' : undefined}
                  >
                    <option value="">Unassigned shift</option>
                    {staffList.map((staff) => {
                      const idToken = staff?.id !== null && staff?.id !== undefined ? String(staff.id) : '';
                      if (!idToken) return null;
                      const isUnavailable = !isStaffSelectDisabled && unavailableSet?.has(idToken);
                      return (
                        <option key={idToken} value={idToken} disabled={isStaffSelectDisabled || isUnavailable}>
                          {staffLabel(staff)}
                          {isUnavailable ? ' (Unavailable)' : ''}
                        </option>
                      );
                    })}
                  </select>
                  {isStaffSelectDisabled ? (
                    <p className="text-xs text-[var(--app-muted)]">Select a shift date to choose available team members.</p>
                  ) : !availableStaffCount && staffList.length ? (
                    <p className="text-xs text-[var(--app-warning)]">No team members are marked available for this date. You can leave the shift unassigned.</p>
                  ) : null}
                </label>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className={labelClass}>
                  Start time
                  <select
                    name="start_time"
                    value={form.start_time}
                    onChange={handleChange}
                    className={controlClass}
                    required
                  >
                    {normalizedStartOptions.map((time) => (
                      <option key={`start-${time}`} value={time}>
                        {time}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={labelClass}>
                  End time
                  <select
                    name="end_time"
                    value={form.end_time}
                    onChange={handleChange}
                    className={controlClass}
                    required
                  >
                    {normalizedEndOptions.map((time) => (
                      <option key={`end-${time}`} value={time}>
                        {time}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className={labelClass}>
                  Role / station
                  <input
                    name="role"
                    value={form.role}
                    onChange={handleChange}
                    placeholder="Server, Bartender, Host..."
                    className={controlClass}
                  />
                </label>
                <label className={labelClass}>
                  Status
                  <select
                    name="status"
                    value={form.status}
                    onChange={handleChange}
                    className={controlClass}
                  >
                    {statuses.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className={labelClass}>
                Notes for team
                <textarea
                  name="notes"
                  value={form.notes}
                  onChange={handleChange}
                  rows={4}
                  placeholder="Prep tasks, uniform reminders, coverage needs..."
                  className={`${controlClass} resize-none leading-relaxed`}
                />
              </label>

              {mode === 'create' ? (
                <label className="flex items-center justify-between gap-3 rounded-2xl border border-dashed border-[rgba(15,23,42,0.16)] bg-[color-mix(in_srgb,var(--app-surface)_86%,_var(--app-bg)_14%)] px-4 py-3 text-xs text-[var(--app-muted)]">
                  Repeat this shift weekly
                  <select
                    name="repeat_weeks"
                    value={form.repeat_weeks}
                    onChange={handleChange}
                    className={`${controlClass} h-10 max-w-[12rem]`}
                  >
                    {[0, 1, 2, 3, 4].map((week) => (
                      <option key={week} value={week}>
                        {week === 0 ? 'Just this week' : `Repeat ${week} more week${week === 1 ? '' : 's'}`}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              {combinedError ? (
                <div className="rounded-2xl border border-[color-mix(in_srgb,var(--app-warning)_45%,_transparent_55%)] bg-[color-mix(in_srgb,var(--app-warning)_12%,_var(--app-surface)_88%)] px-4 py-3 text-sm text-[var(--app-warning)]">
                  {combinedError}
                </div>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[rgba(15,23,42,0.08)] px-6 py-5 sm:px-8 sm:py-6">
            {isEdit ? (
              <button
                type="button"
                onClick={onDelete}
                className="rounded-full border border-[color-mix(in_srgb,var(--app-warning)_40%,_transparent_60%)] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--app-warning)] transition hover:bg-[color-mix(in_srgb,var(--app-warning)_12%,_var(--app-surface)_88%)]"
              >
                Delete
              </button>
            ) : (
              <div className="text-xs text-[var(--app-muted)]">You can add repeating shifts for upcoming weeks.</div>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-[rgba(15,23,42,0.12)] px-5 py-2 text-sm font-medium text-[var(--app-text)] transition hover:bg-[color-mix(in_srgb,var(--app-surface)_88%,_var(--app-bg)_12%)]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="rounded-full bg-[var(--app-primary)] px-6 py-2 text-sm font-semibold text-[var(--app-primary-contrast)] shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSaving ? 'Saving…' : isEdit ? 'Save changes' : 'Schedule shift'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </Modal>
  );
}
