import { useState, useEffect } from 'react';
import useAuth from '../../hooks/useAuth';
import MenuService from '../../services/MenuService';

export default function MenuList({ onEdit, q, typeFilter, items: itemsProp }) {
  const { authFetch } = useAuth();
  const [items, setItems] = useState(itemsProp ?? []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        setLoading(true);
        if (itemsProp) {
          // parent provided items; filter locally
          let data = itemsProp;
          if (q) data = data.filter(i => (i.name||'').toLowerCase().includes(q.toLowerCase()) || (i.description||'').toLowerCase().includes(q.toLowerCase()));
          if (typeFilter) data = data.filter(i => (i.type_name || '').toLowerCase() === typeFilter.toLowerCase());
          if (mounted) setItems(data);
        } else {
          const params = new URLSearchParams();
          if (q) params.set('q', q);
          if (typeFilter) params.set('type', typeFilter);
          const url = '/api/menu' + (params.toString() ? ('?' + params.toString()) : '');
          const res = await authFetch(url);
          const data = res.data?.items ?? res.data ?? [];
          if (mounted) setItems(data);
        }
      } catch (e) {
        setError('Failed to load menu items');
      } finally {
        setLoading(false);
      }
    };
    load();
    return () => { mounted = false };
  }, [authFetch, q, typeFilter, itemsProp]);

  const handleDelete = async (id) => {
    if (!confirm('Delete this item?')) return;
    try {
      await authFetch(`/api/menu/${id}`, { method: 'DELETE' });
      setItems(items.filter(i => i.id !== id));
    } catch (e) {
      alert('Delete failed');
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Menu Items</h3>
        <button className="btn btn-primary" onClick={() => onEdit(null)}>New Item</button>
      </div>
      {loading ? <p>Loading...</p> : error ? <p className="text-red-600">{error}</p> : (
        <ul className="space-y-3">
          {items.map(it => (
            <li key={it.id} className="p-3 bg-white dark:bg-gray-700 rounded shadow flex justify-between items-center">
              <div>
                <div className="font-medium">{it.name} <span className="text-sm text-gray-500">${it.price}</span></div>
                <div className="text-sm text-gray-600 dark:text-gray-300">{it.description}</div>
              </div>
              <div className="flex gap-2">
                <button className="btn" onClick={() => onEdit(it)}>Edit</button>
                <button className="btn btn-outline" onClick={() => handleDelete(it.id)}>Delete</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
