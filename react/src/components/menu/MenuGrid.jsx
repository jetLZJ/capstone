import React, { useEffect, useState } from 'react';
import useAuth from '../../hooks/useAuth';

export default function MenuGrid({ items: itemsProp, onEdit, q, typeFilter }) {
  const { authFetch } = useAuth();
  const [items, setItems] = useState(itemsProp ?? []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (itemsProp) {
        let data = itemsProp;
        if (q) data = data.filter(i => (i.name||'').toLowerCase().includes(q.toLowerCase()) || (i.description||'').toLowerCase().includes(q.toLowerCase()));
        if (typeFilter) data = data.filter(i => (i.type_name || '').toLowerCase() === typeFilter.toLowerCase());
        if (mounted) setItems(data);
        return;
      }
      try {
        const params = new URLSearchParams();
        if (q) params.set('q', q);
        if (typeFilter) params.set('type', typeFilter);
        const url = '/api/menu' + (params.toString() ? ('?' + params.toString()) : '');
        const res = await authFetch(url);
        const data = res.data?.items ?? res.data ?? [];
        if (mounted) setItems(data);
      } catch (e) {
        console.error(e);
      }
    })();
    return () => { mounted = false };
  }, [authFetch, itemsProp, q, typeFilter]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {items.map(it => (
        <div key={it.id} className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <div className="h-44 bg-gray-100 dark:bg-gray-700 flex items-center justify-center overflow-hidden">
            {it.img_link ? (
              <img src={`/api/menu/uploads/${it.img_link?.split('/').pop()}`} alt={it.name} className="object-cover w-full h-full" />
            ) : (
              <div className="text-gray-400">No image</div>
            )}
          </div>
          <div className="p-4">
            <div className="flex justify-between items-start">
              <h3 className="font-semibold text-lg text-gray-900 dark:text-white">{it.name}</h3>
              <div className="text-primary-600 font-bold">${it.price}</div>
            </div>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{it.description}</p>
            <div className="mt-4 flex justify-between items-center">
              <div className="text-sm text-gray-500">Qty: {it.qty_left}</div>
              <div className="flex gap-2">
                <button className="btn btn-sm" onClick={() => onEdit(it)}>Edit</button>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
