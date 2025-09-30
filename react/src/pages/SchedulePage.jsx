import { useState } from 'react';
import ShiftList from '../components/schedule/ShiftList';
import ShiftEditor from '../components/schedule/ShiftEditor';

const SchedulePage = () => {
  const [editing, setEditing] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6 text-gray-900 dark:text-white">Staff Scheduling</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <ShiftList onEdit={(s) => setEditing(s)} key={refreshKey} />
        </div>
        <div>
          <ShiftEditor shift={editing} onSaved={() => { setEditing(null); setRefreshKey(k => k+1) }} onCancel={() => setEditing(null)} />
        </div>
      </div>
    </div>
  )
}

export default SchedulePage;