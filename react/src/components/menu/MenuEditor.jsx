import { useState, useEffect } from 'react';
import useAuth from '../../hooks/useAuth';

export default function MenuEditor({ item, onSaved, onCancel }) {
  const isEdit = Boolean(item && item.id);
  const [form, setForm] = useState({ name: '', price: '', description: '', qty_left: 0 });
  const [saving, setSaving] = useState(false);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const { authFetch, profile } = useAuth();

  useEffect(() => {
    if (item) setForm({ name: item.name || '', price: item.price || '', description: item.description || '', qty_left: item.qty_left || 0 });
    if (item && item.img_link) {
      setPreview(`/api/menu/uploads/${item.img_link.split('/').pop()}`);
    } else {
      setPreview(null);
    }
  }, [item]);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name) return alert('Name required');
    setSaving(true);
    try {
      if (isEdit) {
  await authFetch(`/api/menu/${item.id}`, { method: 'PUT', data: JSON.stringify(form) });
        if (file) {
          await new Promise((res, rej) => {
            const xhr = new XMLHttpRequest();
            const token = JSON.parse(localStorage.getItem('user') || '{}')?.access_token;
            const fd = new FormData();
            fd.append('file', file, file.name);
            xhr.open('POST', `/api/menu/${item.id}/image`);
            if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
            xhr.upload.onprogress = (ev) => {
              if (ev.lengthComputable) setUploadProgress(Math.round((ev.loaded / ev.total) * 100));
            };
            xhr.onload = () => {
              if (xhr.status >= 200 && xhr.status < 300) {
                try { const resp = JSON.parse(xhr.responseText); if (resp.img_link) setPreview(`/api/menu/uploads/${resp.img_link.split('/').pop()}`); } catch (e) {}
                setUploadProgress(0);
                res();
              } else {
                rej(new Error('Upload failed'));
              }
            };
            xhr.onerror = () => rej(new Error('Upload failed'));
            xhr.send(fd);
          });
        }
      } else {
  await authFetch('/api/menu', { method: 'POST', data: JSON.stringify(form) });
      }
      onSaved && onSaved();
    } catch (err) {
      alert('Save failed');
    } finally { setSaving(false) }
  };

  return (
  <form onSubmit={handleSubmit} className="bg-[var(--app-surface)] p-4 rounded shadow">
      <div className="mb-2">
        <label className="block text-sm">Name</label>
        <input name="name" value={form.name} onChange={handleChange} className="w-full p-2 border rounded" />
      </div>
      <div className="mb-2">
        <label className="block text-sm">Price</label>
        <input name="price" value={form.price} onChange={handleChange} type="number" step="0.01" className="w-full p-2 border rounded" />
      </div>
      <div className="mb-2">
        <label className="block text-sm">Description</label>
        <textarea name="description" value={form.description} onChange={handleChange} className="w-full p-2 border rounded"></textarea>
      </div>
      {['Manager','Admin'].includes(profile?.role) && (
        <div className="mb-2">
          <label className="block text-sm">Image (manager &amp; admin only)</label>
          <input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0] ?? null; setFile(f); if (f) setPreview(URL.createObjectURL(f)); }} className="w-full mt-1" />
          {preview && <div className="mt-2"><img src={preview} alt="preview" className="h-32 object-cover rounded" /></div>}
          {uploadProgress > 0 && <div className="mt-2 text-sm text-gray-600">Uploading: {uploadProgress}%</div>}
        </div>
      )}
      <div className="flex gap-2 justify-end">
        <button type="button" className="btn btn-outline" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : (isEdit ? 'Save' : 'Create')}</button>
      </div>
    </form>
  );
}
