import { statusOptions } from './scheduleHelpers';
import StaffAvailabilityCard from './StaffAvailabilityCard';
import Modal from './Modal';
import AvailabilitySummary from './AvailabilitySummary';
import { useState } from 'react';

const metricCard = (title, value, accent) => (
  <div className="flex flex-col justify-between rounded-2xl border border-[rgba(15,23,42,0.08)] bg-[var(--app-surface)] p-5 shadow-sm transition">
    <div className="text-sm font-semibold text-[var(--app-muted)]">{title}</div>
    <div className={`mt-2 text-3xl font-bold ${accent}`}>{value}</div>
  </div>
);

function Notifications({ notifications, onDismiss }) {
  if (!notifications?.length) return null;
  return (
    <div className="rounded-2xl border border-[rgba(15,23,42,0.08)] bg-[var(--app-surface)] p-5 shadow-sm transition">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-[var(--app-text)]">Recent actions</h4>
        <button
          type="button"
          onClick={onDismiss}
          className="text-xs text-[var(--app-muted)] transition hover:text-[var(--app-text)]"
        >
          Clear
        </button>
      </div>
  <ul className="mt-3 space-y-2 text-sm text-[color:color-mix(in_srgb,var(--app-text)_82%,_var(--app-bg)_18%)]">
        {notifications.map((item) => (
          <li
            key={item.id}
            className="rounded-xl border border-[rgba(15,23,42,0.06)] bg-[color-mix(in_srgb,var(--app-surface)_92%,_var(--app-bg)_8%)] px-3 py-2"
          >
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
  const [showAvailability, setShowAvailability] = useState(false);

  return (
    <aside className={`flex flex-col gap-6 ${className}`}>
      {/* availability modal (uses shared Modal wrapper) */}
      {showAvailability ? (
        <Modal onClose={() => setShowAvailability(false)} className="w-full max-w-3xl">
          <div
            className="relative flex w-full h-full max-h-[90vh] flex-col overflow-hidden rounded-3xl border border-[rgba(15,23,42,0.08)] bg-[var(--app-surface)] shadow-[0_30px_60px_0_rgba(6,6,20,0.06)]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="availability-title"
          >
            <button
              type="button"
              onClick={() => setShowAvailability(false)}
              className="absolute right-5 top-5 rounded-full px-3 py-1 text-sm font-semibold text-[var(--app-muted)] transition hover:bg-[color-mix(in_srgb,var(--app-surface)_70%,_var(--app-bg)_30%)] hover:text-[var(--app-text)]"
            >
              Close
            </button>

            <div className="flex h-full min-h-0 flex-col">
              <StaffAvailabilityCard
                entries={availabilityEntries}
                isSaving={availabilitySaving}
                isLoading={availabilityLoading}
                onSave={(changes) => {
                  onAvailabilitySave(changes);
                  setShowAvailability(false);
                }}
                weekStart={weekStart}
              />
            </div>
          </div>
        </Modal>
      ) : null}

      {/* filter card (reused) */}
      {
        (() => {
          const filterCard = (
            <div className="rounded-3xl border border-[rgba(15,23,42,0.08)] bg-[var(--app-surface)] p-6 shadow-sm transition md:basis-1/4 md:max-w-sm h-full">
              <h4 className="text-sm font-semibold text-[var(--app-text)]">Filters</h4>
              <div className="mt-3 space-y-3 text-sm">
                <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-[var(--app-muted)]">
                  Staff member
                  <select
                    className="rounded-xl border border-[rgba(15,23,42,0.12)] bg-[var(--app-bg)] px-3 py-2 text-sm text-[var(--app-text)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-info)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--app-surface)]"
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
                <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-[var(--app-muted)]">
                  Shift status
                  <select
                    className="rounded-xl border border-[rgba(15,23,42,0.12)] bg-[var(--app-bg)] px-3 py-2 text-sm text-[var(--app-text)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-info)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--app-surface)]"
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
              <div className="mt-4 text-xs text-[var(--app-muted)]">Filters adjust both the board and exported reports.</div>
            </div>
          );

          if (isManager) {
            return (
              <div className="md:flex md:items-stretch md:gap-6">
                <div className="md:flex-1">
                  <div className="rounded-3xl border border-[rgba(15,23,42,0.08)] bg-[var(--app-surface)] p-6 shadow-sm transition h-full flex flex-col">
                    <div className="flex-1">
                      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                        {metricCard('Confirmed', coverage?.confirmed ?? 0, 'text-[var(--app-success)]')}
                        {metricCard('Scheduled', coverage?.scheduled ?? 0, 'text-[var(--app-info)]')}
                        {metricCard('Pending', coverage?.pending ?? 0, 'text-[var(--app-warning)]')}
                        {metricCard('Open', coverage?.open ?? 0, 'text-[var(--app-violet)]')}
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-4">
                      <div className="rounded-xl bg-[color-mix(in_srgb,var(--app-surface)_90%,_var(--app-bg)_10%)] p-3 text-xs text-[var(--app-muted)]">
                        Active staff this week:{' '}
                        <span className="font-semibold text-[var(--app-text)]">{coverage?.active_staff ?? 0}</span>
                      </div>

                      <div className="ml-auto">
                        <button
                          type="button"
                          onClick={onAddShift}
                          className="rounded-full bg-[var(--app-primary)] px-4 py-2 text-sm font-semibold text-[var(--app-primary-contrast)] shadow-sm transition hover:opacity-90"
                        >
                          + Add shift
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="md:w-1/4 w-full mt-4 md:mt-0">{filterCard}</div>
              </div>
            );
          }

          if (isStaff) {
            return <AvailabilitySummary entries={availabilityEntries} weekStart={weekStart} onOpen={() => setShowAvailability(true)} />;
          }

          return filterCard;
        })()
      }

      

      <Notifications notifications={notifications} onDismiss={onClearNotifications} />

      {/* availability is only available via modal for staff now */}
    </aside>
  );
}
