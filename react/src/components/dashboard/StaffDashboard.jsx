import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import useDashboardData from './useDashboardData';
import useAuth from '../../hooks/useAuth';
import { formatDateTime } from '../../utils/formatters';

const parseDate = (value, fallback) => {
  if (value) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date;
  }
  if (fallback) {
    const date = new Date(`${fallback}T00:00:00`);
    if (!Number.isNaN(date.getTime())) return date;
  }
  return null;
};

const StaffDashboard = () => {
  const { profile } = useAuth();
  const { loading, error, schedule, refresh } = useDashboardData({ includeSchedule: true });

  const coverage = schedule?.coverage;
  const totalAssigned = (coverage?.confirmed ?? 0) + (coverage?.scheduled ?? 0);

  const upcoming = useMemo(() => {
    if (!schedule?.days?.length) return [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return schedule.days
      .flatMap((day) =>
        (day.assignments || []).map((assignment) => ({
          ...assignment,
          dayLabel: day.label,
          dayDate: day.date,
        })),
      )
      .map((item) => ({
        ...item,
        startDate: parseDate(item.start, item.shift_date || item.dayDate),
      }))
      .filter((item) => item.startDate && item.startDate >= today)
      .sort((a, b) => {
        const aTime = a.startDate ? a.startDate.getTime() : Infinity;
        const bTime = b.startDate ? b.startDate.getTime() : Infinity;
        return aTime - bTime;
      })
      .slice(0, 3);
  }, [schedule]);

  if (loading) {
    return (
      <div className="space-y-6 rounded-3xl border border-[rgba(15,23,42,0.08)] bg-[var(--app-surface)] p-8 shadow-sm">
        <p className="text-[var(--app-muted)]">Loading your schedule…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4 rounded-3xl border border-red-200 bg-red-50 p-6">
        <p className="font-semibold text-red-700">Unable to load your dashboard</p>
        <p className="text-sm text-red-600">{error}</p>
        <button
          type="button"
          onClick={refresh}
          className="inline-flex items-center justify-center rounded-full bg-[var(--app-primary)] px-4 py-2 text-sm font-semibold text-[var(--app-primary-contrast)]"
        >
          Try again
        </button>
      </div>
    );
  }

  const nextShift = upcoming[0];
  const otherShifts = upcoming.slice(1);

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-[var(--app-text)]">Welcome back, {profile?.first_name || 'Team member'}!</h1>
        <p className="text-[var(--app-muted)]">Here’s a quick look at your upcoming shifts and weekly coverage.</p>
      </header>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border border-[rgba(15,23,42,0.08)] bg-[var(--app-surface)] p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-[var(--app-text)]">Your next shift</h2>

          {nextShift ? (
            <div className="mt-4 rounded-2xl border border-[rgba(15,23,42,0.08)] bg-[rgba(15,23,42,0.03)] p-4">
              <p className="text-sm font-semibold text-[var(--app-text)]">{nextShift.role || 'Scheduled shift'}</p>
              <p className="mt-1 text-sm text-[var(--app-muted)]">{formatDateTime(nextShift.start || `${nextShift.shift_date}T00:00:00`)}</p>
              <p className="mt-1 text-xs text-[var(--app-muted)]">Status: {(nextShift.status || 'scheduled').toUpperCase()}</p>
              {nextShift.notes ? <p className="mt-2 text-xs text-[var(--app-muted)]">{nextShift.notes}</p> : null}
            </div>
          ) : (
            <p className="mt-4 text-sm text-[var(--app-muted)]">No upcoming shifts for you.</p>
          )}

          {otherShifts.length ? (
            <div className="mt-5">
              <h3 className="text-xs uppercase tracking-wide text-[var(--app-muted)]">Also coming up</h3>
              <ul className="mt-3 space-y-3 text-sm">
                {otherShifts.map((shift) => (
                  <li key={`${shift.id}-${shift.start}`} className="rounded-2xl border border-[rgba(15,23,42,0.08)] bg-[var(--app-surface)] p-3">
                    <p className="font-medium text-[var(--app-text)]">{shift.role || 'Shift'}</p>
                    <p className="text-xs text-[var(--app-muted)]">{formatDateTime(shift.start || `${shift.shift_date}T00:00:00`)}</p>
                    <p className="mt-1 text-xs text-[var(--app-muted)]">Status: {(shift.status || 'scheduled').toUpperCase()}</p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <div className="rounded-3xl border border-[rgba(15,23,42,0.08)] bg-[var(--app-surface)] p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-[var(--app-text)]">Weekly coverage</h2>
          {coverage ? (
            <dl className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs uppercase tracking-wide text-[var(--app-muted)]">Confirmed shifts</dt>
                <dd className="text-lg font-semibold text-[var(--app-text)]">{coverage.confirmed ?? 0}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-[var(--app-muted)]">Pending confirmation</dt>
                <dd className="text-lg font-semibold text-[var(--app-text)]">{coverage.pending ?? 0}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-[var(--app-muted)]">Open shifts</dt>
                <dd className="text-lg font-semibold text-[var(--app-text)]">{coverage.open ?? 0}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-[var(--app-muted)]">Total assigned</dt>
                <dd className="text-lg font-semibold text-[var(--app-text)]">{totalAssigned}</dd>
              </div>
            </dl>
          ) : (
            <p className="mt-4 text-sm text-[var(--app-muted)]">Coverage metrics aren’t available right now.</p>
          )}

          <div className="mt-6 text-sm">
            <Link
              to="/schedule"
              className="inline-flex w-full items-center justify-center rounded-full bg-[var(--app-primary)] px-4 py-2 font-semibold text-[var(--app-primary-contrast)]"
            >
              Open schedule board
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default StaffDashboard;
