import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import useDashboardData from './useDashboardData';
import useAuth from '../../hooks/useAuth';
import { formatPrice, formatDateTime } from '../../utils/formatters';

const StatCard = ({ title, value, caption }) => (
  <div className="rounded-2xl border border-[rgba(15,23,42,0.08)] bg-[var(--app-surface)] p-5 shadow-sm">
    <p className="text-sm font-medium text-[var(--app-muted)]">{title}</p>
    <p className="mt-2 text-2xl font-semibold text-[var(--app-text)]">{value}</p>
    {caption ? <p className="mt-1 text-xs text-[var(--app-muted)]">{caption}</p> : null}
  </div>
);

const parseDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const AdminDashboard = () => {
  const { profile } = useAuth();
  const { loading, error, summary, schedule, refresh } = useDashboardData({ includeSummary: true, includeSchedule: true });

  const stats = useMemo(() => {
    if (!summary) return [];
    return [
      {
        title: 'Total orders (this week)',
        value: summary.total_orders ?? 0,
      },
      {
        title: 'Revenue',
        value: formatPrice(summary.total_revenue ?? 0),
        caption: summary.timeframe_range ? `${summary.timeframe_range.start} → ${summary.timeframe_range.end}` : null,
      },
      {
        title: 'Average order value',
        value: formatPrice(summary.average_order_value ?? 0),
      },
    ];
  }, [summary]);

  const staffBreakdown = useMemo(() => {
    if (!summary?.users_by_role) return [];
    return Object.entries(summary.users_by_role)
      .filter(([role]) => role)
      .map(([role, count]) => ({ role, count }));
  }, [summary]);

  const upcomingOpenShifts = useMemo(() => {
    if (!schedule?.days?.length) return [];
    const flattened = schedule.days.flatMap((day) =>
      (day.assignments || []).map((assignment) => ({
        ...assignment,
        dayLabel: day.label,
        dayDate: day.date,
      })),
    );
    const now = new Date();
    return flattened
      .filter((assignment) => (assignment.status || '').toLowerCase() === 'open')
      .map((assignment) => {
        const date =
          parseDate(assignment.start) ||
          parseDate(`${assignment.shift_date || assignment.dayDate}T00:00:00`);
        return {
          ...assignment,
          startDate: date,
        };
      })
      .filter((assignment) => !assignment.startDate || assignment.startDate >= now)
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
        <p className="text-[var(--app-muted)]">Loading admin dashboard…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4 rounded-3xl border border-red-200 bg-red-50 p-6">
        <p className="font-semibold text-red-700">Unable to load dashboard</p>
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

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-[var(--app-text)]">Admin overview</h1>
        <p className="text-[var(--app-muted)]">
          Good day, {profile?.first_name || 'Admin'}. Here’s a snapshot of operations across the restaurant.
        </p>
      </header>

      <section>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {stats.map((item) => (
            <StatCard key={item.title} title={item.title} value={item.value} caption={item.caption} />
          ))}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border border-[rgba(15,23,42,0.08)] bg-[var(--app-surface)] p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[var(--app-text)]">Team distribution</h2>
            <Link to="/analytics" className="text-sm font-medium text-[var(--app-accent)] hover:underline">
              View analytics
            </Link>
          </div>
          <ul className="mt-4 space-y-3 text-sm">
            {staffBreakdown.length ? (
              staffBreakdown.map((entry) => (
                <li key={entry.role} className="flex items-center justify-between text-[var(--app-text)]">
                  <span className="capitalize">{entry.role}</span>
                  <span className="font-semibold">{entry.count}</span>
                </li>
              ))
            ) : (
              <li className="text-[var(--app-muted)]">No role data available.</li>
            )}
          </ul>
        </div>

        <div className="rounded-3xl border border-[rgba(15,23,42,0.08)] bg-[var(--app-surface)] p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[var(--app-text)]">Schedule snapshot</h2>
            <Link to="/schedule" className="text-sm font-medium text-[var(--app-accent)] hover:underline">
              Manage schedule
            </Link>
          </div>
          {schedule?.coverage ? (
            <dl className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-xs uppercase tracking-wide text-[var(--app-muted)]">Confirmed</dt>
                <dd className="text-lg font-semibold text-[var(--app-text)]">{schedule.coverage.confirmed ?? 0}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-[var(--app-muted)]">Pending</dt>
                <dd className="text-lg font-semibold text-[var(--app-text)]">{schedule.coverage.pending ?? 0}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-[var(--app-muted)]">Open shifts</dt>
                <dd className="text-lg font-semibold text-[var(--app-text)]">{schedule.coverage.open ?? 0}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-[var(--app-muted)]">Active staff this week</dt>
                <dd className="text-lg font-semibold text-[var(--app-text)]">{schedule.coverage.active_staff ?? 0}</dd>
              </div>
            </dl>
          ) : (
            <p className="mt-4 text-sm text-[var(--app-muted)]">No schedule data available.</p>
          )}

          <div className="mt-6">
            <h3 className="text-sm font-semibold text-[var(--app-text)]">Open shifts needing coverage</h3>
            <ul className="mt-3 space-y-3 text-sm">
              {upcomingOpenShifts.length ? (
                upcomingOpenShifts.map((shift) => (
                  <li key={`${shift.id}-${shift.start}`} className="rounded-2xl border border-[rgba(15,23,42,0.08)] bg-[rgba(15,23,42,0.03)] p-3">
                    <p className="font-medium text-[var(--app-text)]">{shift.role || 'General shift'}</p>
                    <p className="text-xs text-[var(--app-muted)]">{formatDateTime(shift.start || `${shift.shift_date}T00:00:00`)}</p>
                    {shift.notes ? (
                      <p className="mt-1 text-xs text-[var(--app-muted)]">{shift.notes}</p>
                    ) : null}
                  </li>
                ))
              ) : (
                <li className="text-[var(--app-muted)]">All shifts are currently staffed.</li>
              )}
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
};

export default AdminDashboard;
