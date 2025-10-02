import { useEffect, useMemo, useState } from 'react';
import {
  FiBarChart2,
  FiChevronDown,
  FiDollarSign,
  FiShoppingCart,
  FiTrendingUp,
  FiSmile,
  FiUsers,
} from 'react-icons/fi';
import useAuth from '../../hooks/useAuth';

const timeframeOptions = [
  { value: 'this_week', label: 'This Week' },
  { value: 'last_week', label: 'Last Week' },
  { value: 'last_30', label: 'Last 30 Days' },
];

const tabs = ['Revenue', 'Popular Items', 'Categories', 'Staff Performance'];

const formatCurrency = (value = 0) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);

const RevenueTrendChart = ({ data }) => {
  const chartHeight = 260;
  const padding = { top: 20, bottom: 50, left: 60, right: 70 };
  const usableHeight = chartHeight - padding.top - padding.bottom;
  const pointCount = data.length;
  const chartWidth = pointCount > 1 ? 80 * pointCount : 240;
  const usableWidth = chartWidth - padding.left - padding.right;
  const barWidth = 36;
  const step = pointCount > 1 ? usableWidth / (pointCount - 1) : 0;

  const maxRevenue = Math.max(...data.map((d) => d.revenue), 1);
  const maxOrders = Math.max(...data.map((d) => d.orders), 1);

  const leftAxisStops = 3;
  const leftAxisLabels = Array.from({ length: leftAxisStops + 1 }, (_, i) => Math.round((maxRevenue / leftAxisStops) * i));
  const rightAxisLabels = Array.from({ length: leftAxisStops + 1 }, (_, i) => Math.round((maxOrders / leftAxisStops) * i));

  const getBarX = (idx) => padding.left + idx * step - barWidth / 2;
  const getBarHeight = (value) => (value / maxRevenue) * usableHeight;
  const getLinePoint = (value, idx) => {
    const x = padding.left + idx * step;
    const y = chartHeight - padding.bottom - (value / maxOrders) * usableHeight;
    return { x, y };
  };

  const linePoints = data.map((point, idx) => getLinePoint(point.orders, idx));
  const path = linePoints
    .map((point, idx) => `${idx === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(' ');

  return (
    <div className="w-full overflow-x-auto">
      <svg
        className="min-w-[600px]"
        height={chartHeight}
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        role="img"
        aria-label="Daily revenue and orders trend"
      >
        {/* background */}
        <rect x={0} y={0} width={chartWidth} height={chartHeight} fill="var(--app-surface)" rx={24} />

        {/* horizontal grid lines and left axis labels */}
        {leftAxisLabels.map((label, idx) => {
          const y = chartHeight - padding.bottom - (label / maxRevenue) * usableHeight;
          return (
            <g key={`grid-${label}`}>
              <line
                x1={padding.left}
                x2={chartWidth - padding.right}
                y1={y}
                y2={y}
                stroke="rgba(15,23,42,0.08)"
                strokeDasharray="4 6"
              />
              <text
                x={padding.left - 12}
                y={y + 4}
                fontSize="12"
                textAnchor="end"
                fill="var(--app-muted)"
              >
                {label.toLocaleString()}
              </text>
            </g>
          );
        })}

        {/* right axis labels */}
        {rightAxisLabels.map((label) => {
          const y = chartHeight - padding.bottom - (label / maxOrders) * usableHeight;
          return (
            <text
              key={`right-${label}`}
              x={chartWidth - padding.right + 10}
              y={y + 4}
              fontSize="12"
              fill="var(--app-muted)"
            >
              {label}
            </text>
          );
        })}

        {/* bars */}
        {data.map((point, idx) => {
          const barHeight = getBarHeight(point.revenue);
          const barX = getBarX(idx);
          const barY = chartHeight - padding.bottom - barHeight;
          return (
            <g key={point.day}>
              <rect
                x={barX}
                y={barY}
                width={barWidth}
                height={barHeight}
                rx={12}
                fill="rgba(124, 58, 237, 0.9)"
              />
              <text
                x={padding.left + idx * step}
                y={chartHeight - padding.bottom + 22}
                fontSize="13"
                textAnchor="middle"
                fill="var(--app-muted)"
              >
                {point.day}
              </text>
            </g>
          );
        })}

        {/* line */}
        <path d={path} fill="none" stroke="#34d399" strokeWidth={3} strokeLinecap="round" />
        {linePoints.map((point, idx) => (
          <circle key={`point-${idx}`} cx={point.x} cy={point.y} r={5} fill="#34d399" stroke="#ffffff" strokeWidth={2} />
        ))}

        {/* axis labels */}
        <text x={padding.left} y={padding.top} fontSize="12" fill="var(--app-muted)">
          Revenue
        </text>
        <text
          x={chartWidth - padding.right}
          y={padding.top}
          fontSize="12"
          fill="var(--app-muted)"
          textAnchor="end"
        >
          Orders
        </text>
      </svg>
    </div>
  );
};

export default function AnalyticsSummary() {
  const { authFetch } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [menuLookup, setMenuLookup] = useState({});
  const [timeframe, setTimeframe] = useState('this_week');
  const [activeTab, setActiveTab] = useState('Revenue');

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams({ timeframe });
        const res = await authFetch(`/api/analytics/summary?${params.toString()}`);
        if (!ignore) {
          setData(res?.data ?? res);
          setError(null);
        }
      } catch (e) {
        console.error('Failed to load analytics summary', e);
        if (!ignore) setError('Unable to load analytics data');
      } finally {
        if (!ignore) setLoading(false);
      }
    })();

    return () => {
      ignore = true;
    };
  }, [authFetch, timeframe]);

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const res = await authFetch('/api/menu');
        const items = res?.data?.items ?? res?.items ?? [];
        if (!ignore && items.length) {
          const lookup = {};
          items.forEach((item) => {
            lookup[item.id] = item;
          });
          setMenuLookup(lookup);
        }
      } catch (e) {
        console.error('Failed to load menu metadata', e);
      }
    })();

    return () => {
      ignore = true;
    };
  }, [authFetch]);

  const metrics = useMemo(() => {
    if (!data) {
      return [];
    }

    const comparison = timeframe === 'last_30' ? null : data.comparison;
    const comparisonLabel = comparison?.label ?? 'vs previous period';

    const buildDelta = (currentValue, previousValue) => {
      if (!comparison || previousValue === undefined || previousValue === null) {
        return null;
      }
      if (typeof previousValue !== 'number' || previousValue <= 0) {
        return null;
      }
      const diff = currentValue - previousValue;
      const pct = previousValue !== 0 ? (diff / previousValue) * 100 : 0;
      const direction = diff > 0 ? 'up' : diff < 0 ? 'down' : 'neutral';
      const sign = direction === 'down' ? '−' : direction === 'up' ? '+' : '';
      return {
        direction,
        label: `${sign}${Math.abs(pct).toFixed(1)}% ${comparisonLabel}`,
      };
    };

    const totalRevenue = data.total_revenue ?? 0;
    const totalOrders = data.total_orders ?? 0;
    const averageOrderValue = data.average_order_value ?? (totalOrders ? totalRevenue / totalOrders : 0);
    const customerScore = Number(data.customer_satisfaction ?? 4.7);

    return [
      {
        key: 'total-revenue',
        label: 'Total Revenue',
        value: formatCurrency(totalRevenue),
        colorClass: 'text-[var(--app-success)]',
        icon: <FiDollarSign className="text-lg" />,
        delta: buildDelta(totalRevenue, comparison?.total_revenue),
      },
      {
        key: 'total-orders',
        label: 'Total Orders',
        value: Number(totalOrders || 0).toLocaleString(),
        colorClass: 'text-[var(--app-info)]',
        icon: <FiShoppingCart className="text-lg" />,
        delta: buildDelta(totalOrders, comparison?.total_orders),
      },
      {
        key: 'average-order-value',
        label: 'Average Order Value',
        value: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(averageOrderValue || 0),
        colorClass: 'text-[var(--app-violet)]',
        icon: <FiTrendingUp className="text-lg" />,
        delta: buildDelta(averageOrderValue || 0, comparison?.average_order_value),
      },
      {
        key: 'customer-satisfaction',
        label: 'Customer Satisfaction',
        value: `${customerScore.toFixed(1)}/5`,
        colorClass: 'text-[var(--app-warning)]',
        icon: <FiSmile className="text-lg" />,
        delta: null,
      },
    ];
  }, [data, timeframe]);

  const revenueTrend = useMemo(() => {
    if (!data?.daily_trend?.length) {
      return [];
    }

    const formatter = timeframe === 'last_30'
      ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' })
      : new Intl.DateTimeFormat('en-US', { weekday: 'short' });

    return data.daily_trend.map((entry) => {
      const sourceDate = `${entry.date}T00:00:00`;
      const label = formatter.format(new Date(sourceDate));
      return {
        day: label,
        revenue: Number(entry.revenue ?? 0),
        orders: Number(entry.orders ?? 0),
      };
    });
  }, [data, timeframe]);

  const popularItems = useMemo(() => {
    if (!data?.top_selling?.length) return [];
    return data.top_selling.map((item, idx) => ({
      ...item,
      rank: idx + 1,
    }));
  }, [data]);

  const categoryBreakdown = useMemo(() => {
    if (!data?.top_selling?.length) return [];

    const counts = {};
    data.top_selling.forEach((item) => {
      const meta = menuLookup[item.id];
      const category = meta?.type_name || 'Uncategorized';
      counts[category] = (counts[category] || 0) + item.count;
    });
    const total = Object.values(counts).reduce((sum, curr) => sum + curr, 0) || 1;

    return Object.entries(counts)
      .map(([category, value]) => ({
        category,
        value,
        share: Math.round((value / total) * 100),
      }))
      .sort((a, b) => b.value - a.value);
  }, [data, menuLookup]);

  const staffPerformance = useMemo(() => {
    if (!data?.staff_utilization?.length) return [];
    return data.staff_utilization
      .map((item) => ({
        user: `User #${item.user_id ?? 'N/A'}`,
        assignments: item.assignments,
      }))
      .sort((a, b) => b.assignments - a.assignments);
  }, [data]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse space-y-3">
          <div className="h-7 w-72 rounded-full bg-[rgba(15,23,42,0.08)]" />
          <div className="h-4 w-2/3 rounded-full bg-[rgba(15,23,42,0.06)]" />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div
              key={`skeleton-${idx}`}
              className="h-36 rounded-3xl bg-[var(--app-surface)] border border-[rgba(15,23,42,0.05)] shadow-sm animate-pulse"
            />
          ))}
        </div>
        <div className="h-12 w-full rounded-full bg-[rgba(15,23,42,0.05)]" />
        <div className="h-64 rounded-3xl bg-[var(--app-surface)] border border-[rgba(15,23,42,0.05)] shadow-sm animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-600">
        <p className="font-semibold">{error}</p>
        <p className="mt-2 text-sm">Please try refreshing the page or check back later.</p>
      </div>
    );
  }

  return (
    <section className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[rgba(15,23,42,0.08)] text-[var(--app-primary)]">
              <FiBarChart2 className="text-lg" />
            </span>
            <h1 className="text-3xl font-semibold text-[var(--app-text)]">Reports &amp; Analytics Dashboard</h1>
          </div>
          <p className="mt-2 text-[var(--app-muted)]">
            Track restaurant performance, sales trends, and staff metrics
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <select
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value)}
              className="appearance-none rounded-2xl border border-[rgba(15,23,42,0.1)] bg-[var(--app-surface)] px-5 py-3 pr-12 text-sm font-medium text-[var(--app-text)] shadow-sm focus:border-[var(--app-primary)] focus:outline-none"
            >
              {timeframeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <FiChevronDown className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[var(--app-muted)]" />
          </div>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        {metrics.map((metric) => (
          <article
            key={metric.key}
            className="rounded-3xl border border-[rgba(15,23,42,0.05)] bg-[var(--app-surface)] p-6 shadow-sm"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-[var(--app-muted)]">{metric.label}</p>
                <div className={`mt-3 text-3xl font-semibold ${metric.colorClass}`}>{metric.value}</div>
                {metric.delta && (
                  <div
                    className={`mt-2 inline-flex items-center gap-1 text-sm ${
                      metric.delta.direction === 'down'
                        ? 'text-[var(--app-warning)]'
                        : metric.delta.direction === 'neutral'
                        ? 'text-[var(--app-muted)]'
                        : 'text-[var(--app-success)]'
                    }`}
                  >
                    <span aria-hidden="true">
                      {metric.delta.direction === 'down' ? '▼' : metric.delta.direction === 'neutral' ? '—' : '▲'}
                    </span>
                    <span className="font-medium">{metric.delta.label}</span>
                  </div>
                )}
              </div>
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[rgba(15,23,42,0.05)] text-[var(--app-primary)]">
                {metric.icon}
              </span>
            </div>
          </article>
        ))}
      </div>

      <div className="overflow-x-auto">
        <div className="inline-flex w-full min-w-[640px] items-center justify-start gap-2 rounded-full bg-[rgba(15,23,42,0.05)] p-1">
          {tabs.map((tab) => {
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`${
                  isActive
                    ? 'bg-[var(--app-surface)] text-[var(--app-primary)] shadow-sm'
                    : 'text-[var(--app-muted)] hover:text-[var(--app-primary)]'
                } px-6 py-2 text-sm font-medium rounded-full transition-colors`}
              >
                {tab}
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-3xl border border-[rgba(15,23,42,0.05)] bg-[var(--app-surface)] p-6 shadow-sm">
        {activeTab === 'Revenue' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-[var(--app-text)]">Daily Revenue Trend</h2>
              <p className="mt-2 text-sm text-[var(--app-muted)]">
                Revenue and order count for the selected timeframe
              </p>
            </div>
            {revenueTrend.length === 0 ? (
              <div className="flex h-48 items-center justify-center rounded-2xl border border-dashed border-[rgba(15,23,42,0.08)] bg-[var(--app-bg)]">
                <p className="text-sm text-[var(--app-muted)]">No revenue data available for this period.</p>
              </div>
            ) : (
              <RevenueTrendChart data={revenueTrend} />
            )}
          </div>
        )}

        {activeTab === 'Popular Items' && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-[var(--app-text)]">Top Performing Menu Items</h2>
            <p className="text-sm text-[var(--app-muted)]">
              Based on total quantity sold for the selected timeframe
            </p>
            <div className="divide-y divide-[rgba(15,23,42,0.08)]">
              {popularItems.length === 0 && (
                <p className="py-6 text-sm text-[var(--app-muted)]">No popular item data available.</p>
              )}
              {popularItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between py-4">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[rgba(15,23,42,0.05)] text-sm font-semibold text-[var(--app-primary)]">
                      {item.rank}
                    </span>
                    <div>
                      <p className="font-medium text-[var(--app-text)]">{item.name}</p>
                      <p className="text-xs text-[var(--app-muted)]">Item #{item.id}</p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-[var(--app-info)]">{item.count} orders</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'Categories' && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-[var(--app-text)]">Sales by Category</h2>
            <p className="text-sm text-[var(--app-muted)]">
              Share of total orders earned by each menu category
            </p>
            {categoryBreakdown.length === 0 ? (
              <p className="text-sm text-[var(--app-muted)]">Category data is not yet available.</p>
            ) : (
              <div className="space-y-4">
                {categoryBreakdown.map((category) => (
                  <div key={category.category}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-[var(--app-text)]">{category.category}</span>
                      <span className="text-[var(--app-muted)]">{category.share}%</span>
                    </div>
                    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[rgba(15,23,42,0.05)]">
                      <div
                        className="h-full rounded-full bg-[var(--app-primary)]/80"
                        style={{ width: `${category.share}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'Staff Performance' && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-[var(--app-text)]">Staff Utilization</h2>
            <p className="text-sm text-[var(--app-muted)]">
              Total shift assignments completed by each staff member
            </p>
            {staffPerformance.length === 0 ? (
              <p className="text-sm text-[var(--app-muted)]">No staff performance data captured yet.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {staffPerformance.map((staff) => (
                  <div
                    key={staff.user}
                    className="flex items-center gap-3 rounded-2xl border border-[rgba(15,23,42,0.05)] bg-[var(--app-bg)] p-4"
                  >
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[var(--app-surface)] shadow-inner text-[var(--app-primary)]">
                      <FiUsers />
                    </span>
                    <div>
                      <p className="font-medium text-[var(--app-text)]">{staff.user}</p>
                      <p className="text-xs text-[var(--app-muted)]">{staff.assignments} shifts this period</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
