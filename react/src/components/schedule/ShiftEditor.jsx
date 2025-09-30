import { useState, useEffect } from 'react';
import useAuth from '../../hooks/useAuth';

export default function ShiftEditor({ shift, onSaved, onCancel }) {
  const isEdit = Boolean(shift && shift.id);
  const [form, setForm] = useState({ name: '', role_required: '', start_time: '', end_time: '' });
  const { authFetch } = useAuth();

  useEffect(() => { if (shift) setForm({ name: shift.name || '', role_required: shift.role_required || '', start_time: shift.start_time || '', end_time: shift.end_time || '' }) }, [shift]);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name) return alert('Name required');
    try {
  await authFetch('/api/schedules/shifts', { method: 'POST', data: JSON.stringify(form) });
      onSaved && onSaved();
    } catch (err) { console.error(err); alert('Failed to save'); }
  };

  return (
    <form onSubmit={submit} className="bg-white dark:bg-gray-800 p-4 rounded shadow">
      <div className="mb-2"><label className="block text-sm">Name</label><input name="name" value={form.name} onChange={handleChange} className="w-full p-2 border rounded"/></div>
      <div className="mb-2"><label className="block text-sm">Role Required</label><input name="role_required" value={form.role_required} onChange={handleChange} className="w-full p-2 border rounded"/></div>
      <div className="mb-2 grid grid-cols-2 gap-2"><div><label className="block text-sm">Start</label><input name="start_time" value={form.start_time} onChange={handleChange} className="w-full p-2 border rounded"/></div><div><label className="block text-sm">End</label><input name="end_time" value={form.end_time} onChange={handleChange} className="w-full p-2 border rounded"/></div></div>
      <div className="flex gap-2 justify-end"><button type="button" className="btn btn-outline" onClick={onCancel}>Cancel</button><button type="submit" className="btn btn-primary">Save</button></div>
    </form>
  );
}
