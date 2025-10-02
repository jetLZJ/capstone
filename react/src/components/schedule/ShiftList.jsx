import { statusOptions } from './scheduleHelpers';
import StaffAvailabilityCard from './StaffAvailabilityCard';

const metricCard = (title, value, accent) => (
  <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="text-sm font-semibold text-slate-500">{title}</div>
    <div className={`mt-2 text-3xl font-bold ${accent}`}>{value}</div>
  </div>
);

function Notifications({ notifications, onDismiss }) {
  if (!notifications?.length) return null;
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-slate-700">Recent actions</h4>
        <button type="button" onClick={onDismiss} className="text-xs text-slate-400 hover:text-slate-600">
          Clear
        </button>
      </div>
      <ul className="mt-3 space-y-2 text-sm text-slate-600">
        {notifications.map((item) => (
          <li key={item.id} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
            {item.message}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function ScheduleSidebar({
  coverage,
  onAddShift,
  filters,
  onFilterChange,
  staff,
  role,
  notifications,
  onClearNotifications,
  availabilityEntries = [],
  weekStart,
  onAvailabilitySave,
  availabilityLoading = false,
  availabilitySaving = false,
  className = '',
}) {
  const statusFilterOptions = [{ value: '', label: 'All statuses' }, ...statusOptions()];
  const normalizedRole = (role || '').toLowerCase();
  const isManager = normalizedRole === 'manager' || normalizedRole === 'admin';
  const isStaff = normalizedRole === 'staff' || normalizedRole === 'server';

  return (
    <aside className={`flex flex-col gap-6 ${className}`}>
      <div className="flex flex-col gap-4 md:flex-row">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:flex-1 md:basis-3/4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">This week</h3>
              <p className="text-sm text-slate-500">Weekly staff assignment summary</p>
            </div>
            {isManager ? (
              <button
                type="button"
                onClick={onAddShift}
                className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white shadow-sm hover:bg-slate-700"
              >
                New Shift
              </button>
            ) : null}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {metricCard('Confirmed', coverage?.confirmed ?? 0, 'text-emerald-500')}
            {metricCard('Scheduled', coverage?.scheduled ?? 0, 'text-blue-500')}
            {metricCard('Pending', coverage?.pending ?? 0, 'text-amber-500')}
            {metricCard('Open', coverage?.open ?? 0, 'text-rose-500')}
          </div>
          <div className="mt-4 rounded-xl bg-slate-50 p-3 text-xs text-slate-500">
            Active staff this week: <span className="font-semibold text-slate-700">{coverage?.active_staff ?? 0}</span>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:basis-1/4 md:max-w-sm">
          <h4 className="text-sm font-semibold text-slate-700">Filters</h4>
          <div className="mt-3 space-y-3 text-sm">
            <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Staff member
              <select
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-blue-300 focus:outline-none"
                value={filters.staffId || ''}
                onChange={(e) => onFilterChange({ ...filters, staffId: e.target.value })}
              >
                <option value="">All team members</option>
                {staff.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name} • {person.role}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Shift status
              <select
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-blue-300 focus:outline-none"
                value={filters.status || ''}
                onChange={(e) => onFilterChange({ ...filters, status: e.target.value })}
              >
                {statusFilterOptions.map((option) => (
                  <option key={option.value || 'all'} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="mt-4 text-xs text-slate-400">
            Filters adjust both the board and exported reports.
          </div>
        </div>
      </div>

      <Notifications notifications={notifications} onDismiss={onClearNotifications} />

      {!isManager && isStaff ? (
        <StaffAvailabilityCard
          entries={availabilityEntries}
          isSaving={availabilitySaving}
          isLoading={availabilityLoading}
          onSave={onAvailabilitySave}
          weekStart={weekStart}
        />
      ) : null}
    </aside>
  );
}
