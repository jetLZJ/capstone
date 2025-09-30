import { useEffect, useState } from 'react';
import useAuth from '../../hooks/useAuth';

export default function AnalyticsSummary() {
  const { authFetch } = useAuth();
  const [data, setData] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await authFetch('/api/analytics/summary');
        setData(res.data);
      } catch (e) { console.error(e); }
    })();
  }, [authFetch]);

  if (!data) return <p>Loading analytics...</p>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="p-4 bg-[var(--app-surface)] rounded shadow">
        <div className="text-sm text-[var(--app-muted)]">Users by role</div>
        <pre className="mt-2 text-sm">{JSON.stringify(data.users_by_role, null, 2)}</pre>
      </div>
      <div className="p-4 bg-[var(--app-surface)] rounded shadow">
        <div className="text-sm text-[var(--app-muted)]">Orders</div>
        <div className="text-2xl font-bold mt-2">{data.total_orders}</div>
        <div className="text-sm text-[var(--app-muted)]">Revenue: ${data.total_revenue}</div>
      </div>
      <div className="p-4 bg-[var(--app-surface)] rounded shadow">
        <div className="text-sm text-[var(--app-muted)]">Top Items</div>
        <ol className="mt-2 list-decimal list-inside text-sm">{data.top_selling.map(i => <li key={i.id}>{i.name} ({i.count})</li>)}</ol>
      </div>
    </div>
  );
}
