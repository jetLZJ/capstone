import { useState } from 'react';
import MenuList from '../components/menu/MenuList';
import MenuEditor from '../components/menu/MenuEditor';
import MenuGrid from '../components/menu/MenuGrid';
import MenuSidebar from '../components/menu/MenuSidebar';

const MenuPage = () => {
  const [editing, setEditing] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [view, setView] = useState('grid');
  const [query, setQuery] = useState('');
  const [selectedType, setSelectedType] = useState(null);

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6 text-gray-900 dark:text-white">Menu Management</h1>
      <div className="mb-4 flex gap-2 items-center">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search menu..." className="p-2 border rounded w-64" />
        <div className="ml-auto flex gap-2">
          <button className={`btn ${view==='grid' ? 'btn-primary' : ''}`} onClick={() => setView('grid')}>Grid</button>
          <button className={`btn ${view==='list' ? 'btn-primary' : ''}`} onClick={() => setView('list')}>List</button>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div>
          <MenuSidebar selectedType={selectedType} onSelect={(t) => setSelectedType(t)} />
        </div>
        <div className="md:col-span-2">
          {view === 'grid' ? (
            <MenuGrid key={refreshKey} onEdit={(it) => setEditing(it)} q={query} typeFilter={selectedType} />
          ) : (
            <MenuList onEdit={(it) => setEditing(it)} key={refreshKey} q={query} typeFilter={selectedType} />
          )}
        </div>
        <div>
          <MenuEditor item={editing} onSaved={() => { setEditing(null); setRefreshKey(k => k+1) }} onCancel={() => setEditing(null)} />
        </div>
      </div>
    </div>
  )
}

export default MenuPage;