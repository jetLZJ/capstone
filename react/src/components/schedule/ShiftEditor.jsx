import { useEffect, useMemo, useState } from 'react';
import { statusOptions, toDateInputValue, toTimeInputValue, startOfWeek } from './scheduleHelpers';

const defaultTimes = ['07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '16:00', '18:00', '20:00'];

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

const timeOptions = () => {
  const base = [];
  for (let hour = 6; hour <= 23; hour++) {
    const h = String(hour).padStart(2, '0');
    base.push(`${h}:00`);
    base.push(`${h}:30`);
  }
  return Array.from(new Set([...defaultTimes, ...base]));
};

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
  onSave,
  onDelete,
  onClose,
  weekStart,
  isSaving,
  error,
}) {
  const [form, setForm] = useState(() => emptyForm(weekStart));

  useEffect(() => {
    if (!open) {
      setForm(emptyForm(weekStart));
      return;
    }
    if (mode === 'edit' && initialShift) {
      setForm({
        shift_date: initialShift.shift_date || '',
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
  }, [open, mode, initialShift, defaultDate, weekStart]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
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
  const times = useMemo(() => timeOptions(), []);
  const statuses = statusOptions();

  return (
    <div className="rounded-3xl border border-slate-200 bg-white shadow-lg">
      <div className="border-b border-slate-100 px-6 py-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              {isEdit ? 'Edit assignment' : 'Schedule a new shift'}
            </h3>
            <p className="text-xs text-slate-500">
              {isEdit ? 'Update staffing, status, and timing' : 'Choose the team member, day, time, and repetition'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-xs text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            Close
          </button>
        </div>
      </div>
      {open ? (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-6 py-5">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Shift date
              <input
                type="date"
                name="shift_date"
                value={form.shift_date}
                onChange={handleChange}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-blue-400 focus:outline-none"
                required
              />
            </label>
            <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Staff member
              <select
                name="staff_id"
                value={form.staff_id}
                onChange={handleChange}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-blue-400 focus:outline-none"
              >
                <option value="">Unassigned shift</option>
                {staffOptions.map((staff) => (
                  <option key={staff.id} value={staff.id}>
                    {staffLabel(staff)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Start time
              <select
                name="start_time"
                value={form.start_time}
                onChange={handleChange}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-blue-400 focus:outline-none"
                required
              >
                {times.map((time) => (
                  <option key={`start-${time}`} value={time}>
                    {time}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              End time
              <select
                name="end_time"
                value={form.end_time}
                onChange={handleChange}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-blue-400 focus:outline-none"
                required
              >
                {times.map((time) => (
                  <option key={`end-${time}`} value={time}>
                    {time}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Role / station
              <input
                name="role"
                value={form.role}
                onChange={handleChange}
                placeholder="Server, Bartender, Host..."
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-blue-400 focus:outline-none"
              />
            </label>
            <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Status
              <select
                name="status"
                value={form.status}
                onChange={handleChange}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-blue-400 focus:outline-none"
              >
                {statuses.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Notes for team
            <textarea
              name="notes"
              value={form.notes}
              onChange={handleChange}
              rows={3}
              placeholder="Prep tasks, uniform reminders, coverage needs..."
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-blue-400 focus:outline-none"
            />
          </label>

          {mode === 'create' ? (
            <label className="flex items-center justify-between rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-xs text-slate-500">
              Repeat this shift weekly
              <select
                name="repeat_weeks"
                value={form.repeat_weeks}
                onChange={handleChange}
                className="rounded-lg border border-slate-200 px-3 py-1 text-sm focus:border-blue-400 focus:outline-none"
              >
                {[0, 1, 2, 3, 4].map((week) => (
                  <option key={week} value={week}>
                    {week === 0 ? 'Just this week' : `Repeat ${week} more week${week === 1 ? '' : 's'}`}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            {isEdit ? (
              <button
                type="button"
                onClick={onDelete}
                className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-rose-600 hover:bg-rose-50"
              >
                Delete
              </button>
            ) : (
              <div className="text-xs text-slate-400">You can add repeating shifts for upcoming weeks.</div>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSaving ? 'Saving…' : isEdit ? 'Save changes' : 'Schedule shift'}
              </button>
            </div>
          </div>
        </form>
      ) : (
        <div className="px-6 py-8 text-sm text-slate-500">
          Select a shift from the board or start a new assignment to review details here.
        </div>
      )}
    </div>
  );
}
