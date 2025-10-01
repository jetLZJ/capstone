import { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { FiUploadCloud } from 'react-icons/fi';
import useAuth from '../../hooks/useAuth';

const inputBaseClass =
  'w-full rounded-2xl border border-[rgba(15,23,42,0.12)] bg-[var(--app-surface)] px-4 py-2.5 text-sm text-[var(--app-text)] shadow-sm transition focus:border-[var(--app-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--app-primary)] placeholder:text-[var(--app-muted)]';

const labelClass = 'text-sm font-medium text-[var(--app-muted)]';

const resolvePreviewUrl = (link) => {
  if (!link) return null;
  const trimmed = link.trim();
  if (!trimmed) return null;
  const sanitized = trimmed.replace(/\\/g, '/');
  if (sanitized !== trimmed && !sanitized.startsWith('blob:')) {
    return resolvePreviewUrl(sanitized);
  }
  if (trimmed.startsWith('blob:')) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith('/')) return trimmed;

  const toUploadsPath = (value) => {
    const normalizedValue = String(value).replace(/\\/g, '/');
    const file = normalizedValue
      .replace(/^static\/(uploads\/)?/i, '')
      .replace(/^menu\/(uploads\/)?/i, '')
      .replace(/^uploads\//i, '')
      .replace(/^\/+/, '');
    return file ? `/api/menu/uploads/${file}` : null;
  };

  if (/^static\/uploads\//i.test(trimmed) || /^menu\/uploads\//i.test(trimmed)) {
    return toUploadsPath(trimmed) ?? null;
  }

  if (!trimmed.includes('/') && /\.(png|jpe?g|gif|webp|avif|svg)$/i.test(trimmed)) {
    return toUploadsPath(trimmed) ?? null;
  }

  return `/api/${trimmed.replace(/^\//, '')}`;
};

export default function MenuEditor({ item, onSaved, onCancel, types = [] }) {
  const isEdit = Boolean(item?.id);
  const { authFetch, profile } = useAuth();
  const [saving, setSaving] = useState(false);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  const defaultType = useMemo(() => types?.[0]?.name ?? '', [types]);

  const [form, setForm] = useState({
    name: '',
    price: '',
    description: '',
    type: defaultType,
    prep_time: '',
    image_url: '',
    qty_left: 0,
    available: true,
  });

  useEffect(() => {
    if (item) {
      const qty = Number(item.qty_left ?? 0);
      const resolvedPreview = resolvePreviewUrl(item.img_link);
      setForm({
        name: item.name ?? '',
        price: item.price !== undefined && item.price !== null ? String(item.price) : '',
        description: item.description ?? '',
        type: item.type_name ?? defaultType,
        prep_time: item.prep_time ? String(item.prep_time) : '',
        image_url: item.img_link ?? '',
        qty_left: Number.isNaN(qty) ? 0 : qty,
        available: qty > 0,
      });
      setPreview(resolvedPreview);
      setFile(null);
    } else {
      setForm((prev) => ({
        ...prev,
        type: prev.type || defaultType,
        image_url: '',
        qty_left: 0,
        available: true,
      }));
      setPreview(null);
      setFile(null);
    }
  }, [item, defaultType]);

  useEffect(() => () => {
    if (preview && preview.startsWith('blob:')) {
      URL.revokeObjectURL(preview);
    }
  }, [preview]);

  const updateForm = (next) => setForm((prev) => ({ ...prev, ...next }));

  const handleFieldChange = (event) => {
    const { name, value } = event.target;
    if (name === 'qty_left') {
      const qty = Math.max(0, Number.parseInt(value, 10) || 0);
      updateForm({ qty_left: qty, available: qty > 0 });
      return;
    }
    if (name === 'image_url') {
      updateForm({ image_url: value });
      if (!file) {
        setPreview(resolvePreviewUrl(value));
      }
      return;
    }
    updateForm({ [name]: value });
  };

  const handleToggleAvailability = () => {
    setForm((prev) => {
      const nextAvailable = !prev.available;
      const nextQty = nextAvailable ? prev.qty_left > 0 ? prev.qty_left : 1 : 0;
      return { ...prev, available: nextAvailable, qty_left: nextQty };
    });
  };

  const handleFileChange = (event) => {
    const selected = event.target.files?.[0] ?? null;
    setFile(selected);
    if (selected) {
      setPreview(URL.createObjectURL(selected));
    } else if (!form.image_url) {
      setPreview(null);
    } else {
      setPreview(resolvePreviewUrl(form.image_url));
    }
  };

  const uploadImage = async (targetId) => {
    if (!file || !targetId) return;
    await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const token = JSON.parse(localStorage.getItem('user') || '{}')?.access_token;
      const fd = new FormData();
      fd.append('file', file, file.name);
      xhr.open('POST', `/api/menu/${targetId}/image`);
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.upload.onprogress = (ev) => {
        if (ev.lengthComputable) setUploadProgress(Math.round((ev.loaded / ev.total) * 100));
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText || '{}');
            if (response.img_link) setPreview(resolvePreviewUrl(response.img_link));
            if (response.img_link) updateForm({ image_url: response.img_link });
          } catch (error) {
            // ignore parse errors
          }
          setUploadProgress(0);
          setFile(null);
          resolve();
        } else {
          reject(new Error('Upload failed'));
        }
      };
      xhr.onerror = () => reject(new Error('Upload failed'));
      xhr.send(fd);
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const name = form.name.trim();
    if (!name) {
      toast.error('Item name is required.');
      return;
    }

    const price = Number.parseFloat(form.price);
    if (Number.isNaN(price) || price < 0) {
      toast.error('Please provide a valid price.');
      return;
    }

    const qty = Math.max(0, Number.parseInt(form.qty_left, 10) || 0);
    const finalQty = form.available ? qty : 0;

    const payload = {
      name,
      price,
      description: form.description?.trim() || '',
      qty_left: finalQty,
    };

    if (form.type) payload.type = form.type;
    if (form.image_url?.trim()) payload.img_link = form.image_url.trim();

    setSaving(true);
    try {
      if (isEdit) {
        const response = await authFetch(`/api/menu/${item.id}`, {
          method: 'PUT',
          data: payload,
        });
        if ((response?.status ?? 0) >= 400) {
          throw new Error(response?.data?.msg || 'Failed to update menu item');
        }
        await uploadImage(item.id);
        toast.success('Menu item updated successfully.');
      } else {
        const response = await authFetch('/api/menu', {
          method: 'POST',
          data: payload,
        });
        if ((response?.status ?? 0) !== 201 || !response?.data?.id) {
          throw new Error(response?.data?.msg || 'Failed to create menu item');
        }
        await uploadImage(response.data.id);
        toast.success('Menu item created successfully.');
      }
      onSaved?.();
    } catch (error) {
      console.error('Failed to save menu item', error);
      toast.error(error?.message || 'Unable to save menu item right now.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-h-[calc(100vh-6rem)] overflow-y-auto rounded-3xl bg-[var(--app-surface)] p-6 shadow-2xl">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold text-[var(--app-text)]">
          {isEdit ? 'Edit Menu Item' : 'Add New Menu Item'}
        </h2>
        <p className="text-sm text-[var(--app-muted)]">
          Create a new menu item with details, pricing, and availability.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label className={labelClass} htmlFor="name">Item Name</label>
            <input
              id="name"
              name="name"
              className={inputBaseClass}
              placeholder="Enter item name"
              value={form.name}
              onChange={handleFieldChange}
              disabled={saving}
            />
          </div>
          <div className="space-y-2">
            <label className={labelClass} htmlFor="price">Price ($)</label>
            <input
              id="price"
              name="price"
              type="number"
              min="0"
              step="0.01"
              className={inputBaseClass}
              placeholder="0"
              value={form.price}
              onChange={handleFieldChange}
              disabled={saving}
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className={labelClass} htmlFor="description">Description</label>
          <textarea
            id="description"
            name="description"
            className={`${inputBaseClass} h-24 resize-none`}
            placeholder="Describe the dish"
            value={form.description}
            onChange={handleFieldChange}
            disabled={saving}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label className={labelClass} htmlFor="type">Category</label>
            <select
              id="type"
              name="type"
              className={inputBaseClass}
              value={form.type || ''}
              onChange={handleFieldChange}
              disabled={saving}
            >
              <option value="">Select category</option>
              {types.map((t) => (
                <option key={t.id ?? t.name} value={t.name}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className={labelClass} htmlFor="prep_time">Prep Time</label>
            <input
              id="prep_time"
              name="prep_time"
              className={inputBaseClass}
              placeholder="e.g., 15 min"
              value={form.prep_time}
              onChange={handleFieldChange}
              disabled
            />
            <p className="text-xs text-[var(--app-muted)]">(Prep time is informational only)</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label className={labelClass} htmlFor="qty_left">Quantity Available</label>
            <input
              id="qty_left"
              name="qty_left"
              type="number"
              min="0"
              className={inputBaseClass}
              placeholder="0"
              value={form.qty_left}
              onChange={handleFieldChange}
              disabled={saving}
            />
          </div>
          <div className="space-y-2">
            <label className={labelClass} htmlFor="image_url">Image URL</label>
            <input
              id="image_url"
              name="image_url"
              className={inputBaseClass}
              placeholder="Enter image URL or upload image"
              value={form.image_url}
              onChange={handleFieldChange}
              disabled={saving}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 sm:items-start">
          <div className="space-y-2">
            <span className={labelClass}>Availability</span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleToggleAvailability}
                className={`relative inline-flex h-7 w-12 items-center rounded-full transition ${
                  form.available
                    ? 'bg-[var(--app-primary)]'
                    : 'bg-[rgba(15,23,42,0.12)]'
                }`}
                aria-pressed={form.available}
                aria-label="Toggle availability"
                disabled={saving}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-200 ease-in-out ${
                    form.available ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
              <div>
                <p className="text-sm font-semibold text-[var(--app-text)]">Available for orders</p>
                <p className="text-xs text-[var(--app-muted)]">
                  {form.available ? 'Customers can order this item.' : 'Item will be hidden from ordering.'}
                </p>
              </div>
            </div>
          </div>

          {['Manager', 'Admin'].includes((profile?.role || '').trim()) && (
            <div className="space-y-2 sm:text-right">
              <span className={labelClass}>Upload Image</span>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-dashed border-[rgba(15,23,42,0.2)] px-4 py-2 text-xs font-semibold text-[var(--app-muted)] transition hover:border-[var(--app-primary)] hover:text-[var(--app-primary)]">
                <FiUploadCloud className="text-base" />
                <span>{file ? file.name : 'Choose file'}</span>
                <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} disabled={saving} />
              </label>
              {uploadProgress > 0 && (
                <span className="block text-xs text-[var(--app-muted)] sm:text-right">Uploading… {uploadProgress}%</span>
              )}
            </div>
          )}
        </div>

        {preview ? (
          <div className="overflow-hidden rounded-2xl border border-[rgba(15,23,42,0.08)]">
            <img src={preview} alt="Menu item preview" className="h-48 w-full object-cover" />
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-[rgba(15,23,42,0.15)] bg-[var(--app-bg)] p-6 text-center text-xs text-[var(--app-muted)]">
            Image preview will appear here.
          </div>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center justify-center rounded-full border border-[rgba(15,23,42,0.15)] px-5 py-2 text-sm font-semibold text-[var(--app-text)] transition hover:border-[var(--app-primary)]"
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-full bg-[var(--app-primary)] px-5 py-2 text-sm font-semibold text-[var(--app-primary-contrast)] shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={saving}
          >
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Menu Item'}
          </button>
        </div>
      </form>
    </div>
  );
}
