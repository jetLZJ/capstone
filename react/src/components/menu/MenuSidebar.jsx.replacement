import { useEffect, useState } from 'react';
import TypesService from '../../services/TypesService';

export default function MenuSidebar({ selectedType, onSelect }) {
  const [types, setTypes] = useState([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const t = await TypesService.list();
        if (mounted) setTypes(t);
      } catch (e) { console.error(e); }
    })();
    return () => { mounted = false };
  }, []);

  return (
    <div className="bg-[var(--app-surface)] p-4 rounded shadow">
      <h4 className="font-semibold mb-3 text-[var(--app-text)]">Categories</h4>
      <ul className="space-y-2">
        <li>
          <button className={`w-full text-left p-2 rounded ${!selectedType ? 'bg-[var(--app-bg)]' : ''}`} onClick={() => onSelect(null)}>All</button>
        </li>
        {types.map(t => (
          <li key={t.id}>
            <button className={`w-full text-left p-2 rounded ${selectedType === t.name ? 'bg-[var(--app-bg)]' : ''}`} onClick={() => onSelect(t.name)}>{t.name}</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
