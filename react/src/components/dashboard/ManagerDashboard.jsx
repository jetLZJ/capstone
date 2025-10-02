import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import useDashboardData from './useDashboardData';
import useAuth from '../../hooks/useAuth';
import { formatPrice, formatDate } from '../../utils/formatters';

const StatCard = ({ title, value, caption }) => (
  <div className="rounded-2xl border border-[rgba(15,23,42,0.08)] bg-[var(--app-surface)] p-5 shadow-sm">
    <p className="text-sm font-medium text-[var(--app-muted)]">{title}</p>
    <p className="mt-2 text-2xl font-semibold text-[var(--app-text)]">{value}</p>
    {caption ? <p className="mt-1 text-xs text-[var(--app-muted)]">{caption}</p> : null}
  </div>
);

const ManagerDashboard = () => {
  const { profile } = useAuth();
  const { loading, error, summary, schedule, refresh } = useDashboardData({ includeSummary: true, includeSchedule: true });

  const stats = useMemo(() => {
    if (!summary) return [];
    const period = summary.timeframe_range ? `${summary.timeframe_range.start} → ${summary.timeframe_range.end}` : null;
    return [
      {
        title: 'Orders this week',
        value: summary.total_orders ?? 0,
        caption: period,
      },
      {
        title: 'Revenue this week',
        value: formatPrice(summary.total_revenue ?? 0),
        caption: summary.comparison
          ? `${summary.comparison.label}: ${summary.comparison.total_orders} orders / ${formatPrice(summary.comparison.total_revenue)}`
          : null,
      },
      {
        title: 'Average order value',
        value: formatPrice(summary.average_order_value ?? 0),
      },
    ];
  }, [summary]);

  const topSelling = useMemo(() => {
    if (!summary?.top_selling?.length) return [];
    return summary.top_selling.slice(0, 5);
  }, [summary]);

  const dailyHighlights = useMemo(() => {
    if (!summary?.daily_trend?.length) return [];
    return summary.daily_trend.slice(-3);
  }, [summary]);

  if (loading) {
    return (
      <div className="space-y-6 rounded-3xl border border-[rgba(15,23,42,0.08)] bg-[var(--app-surface)] p-8 shadow-sm">
        <p className="text-[var(--app-muted)]">Loading manager dashboard…</p>
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
        <h1 className="text-3xl font-semibold text-[var(--app-text)]">Manager overview</h1>
        <p className="text-[var(--app-muted)]">
          {`Welcome back, ${profile?.first_name || 'Manager'}! Here’s what’s happening this week.`}
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
            <h2 className="text-lg font-semibold text-[var(--app-text)]">Top selling items</h2>
            <Link to="/analytics" className="text-sm font-medium text-[var(--app-accent)] hover:underline">
              Full analytics
            </Link>
          </div>
          <ul className="mt-4 space-y-3 text-sm">
            {topSelling.length ? (
              topSelling.map((item) => (
                <li key={item.id} className="flex items-center justify-between rounded-2xl border border-[rgba(15,23,42,0.08)] bg-[rgba(15,23,42,0.03)] p-3">
                  <span className="font-medium text-[var(--app-text)]">{item.name}</span>
                  <span className="text-xs text-[var(--app-muted)]">{item.count} sold</span>
                </li>
              ))
            ) : (
              <li className="text-[var(--app-muted)]">Sales data isn’t available yet.</li>
            )}
          </ul>
        </div>

        <div className="rounded-3xl border border-[rgba(15,23,42,0.08)] bg-[var(--app-surface)] p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[var(--app-text)]">Daily performance</h2>
            <Link to="/orders" className="text-sm font-medium text-[var(--app-accent)] hover:underline">
              Review orders
            </Link>
          </div>
          <ul className="mt-4 space-y-3 text-sm">
            {dailyHighlights.length ? (
              dailyHighlights.map((entry) => (
                <li key={entry.date} className="flex items-center justify-between">
                  <span className="text-[var(--app-text)]">{formatDate(entry.date)}</span>
                  <span className="text-xs text-[var(--app-muted)]">
                    {entry.orders} orders · {formatPrice(entry.revenue)}
                  </span>
                </li>
              ))
            ) : (
              <li className="text-[var(--app-muted)]">Run analytics to populate daily stats.</li>
            )}
          </ul>

          {schedule?.coverage ? (
            <div className="mt-6 rounded-2xl border border-[rgba(15,23,42,0.08)] bg-[rgba(15,23,42,0.03)] p-4">
              <h3 className="text-sm font-semibold text-[var(--app-text)]">Schedule coverage</h3>
              <dl className="mt-3 grid gap-3 sm:grid-cols-2">
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
                  <dt className="text-xs uppercase tracking-wide text-[var(--app-muted)]">Active staff</dt>
                  <dd className="text-lg font-semibold text-[var(--app-text)]">{schedule.coverage.active_staff ?? 0}</dd>
                </div>
              </dl>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
};

export default ManagerDashboard;
