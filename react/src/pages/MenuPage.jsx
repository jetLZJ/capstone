import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  FiPlus,
  FiMinus,
  FiSearch,
  FiPieChart,
  FiShoppingBag,
  FiEdit2,
  FiTrash2,
  FiCheckCircle,
  FiClock,
  FiTag,
  FiImage,
  FiSend,
} from 'react-icons/fi';
import useAuth from '../hooks/useAuth';
import MenuEditor from '../components/menu/MenuEditor';

const DEFAULT_CATEGORY = 'All Items';

const ORDER_STORAGE_KEY = 'capstone-active-order-id';

const readStoredOrderId = () => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(ORDER_STORAGE_KEY);
    if (!raw) return null;
    const parsed = Number.parseInt(raw, 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  } catch (err) {
    console.warn('Failed to read stored order id', err);
    return null;
  }
};

const persistOrderId = (id) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(ORDER_STORAGE_KEY, String(id));
  } catch (err) {
    console.warn('Failed to persist order id', err);
  }
};

const clearStoredOrderId = () => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(ORDER_STORAGE_KEY);
  } catch (err) {
    console.warn('Failed to clear stored order id', err);
  }
};

const normalizeOrderItems = (items) => {
  if (!Array.isArray(items)) return [];
  return items
    .filter((entry) => entry && typeof entry === 'object')
    .map((entry) => ({
      id: entry.item_id ?? entry.id ?? null,
      name: entry.name ?? '',
      description: entry.description ?? '',
      price: entry.price ?? 0,
      img_link: entry.img_link ?? null,
      quantity: entry.qty ?? entry.quantity ?? 1,
      qty_left: entry.qty_left ?? null,
    }))
    .filter((entry) => Number.isInteger(entry.id) && entry.id > 0);
};

const resolveImageUrl = (imgLink) => {
  if (!imgLink) return null;
  const raw = String(imgLink).trim();
  if (!raw) return null;

  const normalized = raw.replace(/\\/g, '/');
  if (/^blob:/i.test(normalized)) return normalized;
  if (/^https?:\/\//i.test(normalized)) return normalized;
  if (normalized.startsWith('/api/menu/uploads/')) return normalized;
  if (normalized.startsWith('/')) return normalized;
  if (normalized.startsWith('api/')) return `/${normalized}`;

  const toUploadPath = (value) => {
    const safeValue = String(value).replace(/\\/g, '/');
    const file = safeValue
      .replace(/^static\/(uploads\/)?/i, '')
      .replace(/^menu\/(uploads\/)?/i, '')
      .replace(/^uploads\//i, '')
      .replace(/^\/+/, '');
    return file ? `/api/menu/uploads/${file}` : null;
  };

  if (/^(?:static\/uploads|menu\/uploads|uploads)\//i.test(normalized) ||
      (!normalized.includes('/') && /\.(png|jpe?g|gif|webp|avif|svg)$/i.test(normalized))) {
    const uploadUrl = toUploadPath(normalized);
    if (uploadUrl) return uploadUrl;
  }

  if (/^static\//i.test(normalized)) {
    return `/api/${normalized.replace(/^\//, '')}`;
  }

  return `/api/${normalized.replace(/^\//, '')}`;
};

const getCategoryName = (item) => item?.type_name || 'Uncategorized';

const computePrepTime = (item) => {
  if (item?.prep_time) return item.prep_time;
  const base = ((item?.id ?? 0) % 4);
  return 10 + base * 5;
};

const computeRating = (item) => {
  if (item?.rating) {
    const val = Number(item.rating);
    if (!Number.isNaN(val)) return val.toFixed(1);
  }
  const seed = ((item?.id ?? 1) * 73) % 12;
  return (4 + seed / 10).toFixed(1);
};

const formatPrice = (price) => {
  const val = Number(price);
  if (Number.isNaN(val)) return '$0.00';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
};

const categoryEmoji = (name) => {
  const map = {
    Appetizers: '🥗',
    Mains: '🍽️',
    'Main Courses': '🍽️',
    Desserts: '🍰',
    Beverages: '🥤',
    Drinks: '🥤',
    Specials: '⭐',
    'Chef Specials': '⭐',
  };
  return map[name] || '🍲';
};

const LoadingState = ({ label = 'Loading menu…' }) => (
  <div className="flex min-h-[60vh] items-center justify-center">
    <div className="space-y-3 text-center">
      <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-[rgba(15,23,42,0.15)] border-t-[var(--app-primary)]" />
      <p className="text-sm text-[var(--app-muted)]">{label}</p>
    </div>
  </div>
);

const MenuPage = () => {
  const { profile, authFetch, isLoading: authLoading, isAuthenticated } = useAuth();
  const [items, setItems] = useState([]);
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(DEFAULT_CATEGORY);
  const [search, setSearch] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [orderItems, setOrderItems] = useState([]);
  const [orderId, setOrderId] = useState(null);
  const [orderSaving, setOrderSaving] = useState(false);
  const [orderLoading, setOrderLoading] = useState(false);
  const [orderSubmitting, setOrderSubmitting] = useState(false);
  const [pendingOrderItemId, setPendingOrderItemId] = useState(null);

  const role = (profile?.role || '').toLowerCase();
  const isAdminManager = role === 'admin' || role === 'manager';
  const isStaff = role === 'staff';

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch('/api/menu');
      const data = res?.data?.items ?? res?.data ?? [];
      setItems(Array.isArray(data) ? data : []);
      setError(null);
    } catch (err) {
      console.error('Failed to load menu items', err);
      setError('Unable to load menu items right now.');
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  const loadTypes = useCallback(async () => {
    try {
      const res = await authFetch('/api/menu/types');
      const data = res?.data?.types ?? res?.data ?? [];
      setTypes(Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn('Failed to load menu types', err);
    }
  }, [authFetch]);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      loadItems();
      loadTypes();
    }
  }, [authLoading, isAuthenticated, loadItems, loadTypes]);

  const loadStoredOrder = useCallback(async () => {
    const storedId = readStoredOrderId();
    if (!storedId) {
      setOrderId(null);
      setOrderItems([]);
      return;
    }

    setOrderLoading(true);
    try {
      const res = await authFetch(`/api/orders/${storedId}`);
      if (res?.status === 200 && res.data) {
        setOrderId(storedId);
        setOrderItems(normalizeOrderItems(res.data.items));
      } else {
        clearStoredOrderId();
        setOrderId(null);
        setOrderItems([]);
      }
    } catch (err) {
      const status = err?.response?.status;
      if (status === 404 || status === 403) {
        clearStoredOrderId();
        setOrderId(null);
        setOrderItems([]);
      } else {
        console.error('Failed to load stored order', err);
      }
    } finally {
      setOrderLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    if (!authLoading && isAuthenticated && !isAdminManager) {
      loadStoredOrder();
    }
  }, [authLoading, isAuthenticated, isAdminManager, loadStoredOrder]);

  useEffect(() => {
    if (!isAuthenticated) {
      setOrderId(null);
      setOrderItems([]);
      clearStoredOrderId();
    }
  }, [isAuthenticated]);

  const categorySummaries = useMemo(() => {
    const categories = Array.from(new Set([
      ...types.map((t) => t.name).filter(Boolean),
      ...items.map((item) => getCategoryName(item)),
    ]));

    const targetCategories = categories.length
      ? categories
      : ['Appetizers', 'Mains', 'Desserts', 'Beverages'];

    return targetCategories.map((name) => {
      const matching = items.filter((item) => getCategoryName(item) === name);
      const total = matching.length;
      const available = matching.filter((item) => (item.qty_left ?? 0) > 0).length;
      return { name, total, available };
    });
  }, [items, types]);

  const tabOptions = useMemo(() => {
    const unique = Array.from(new Set(categorySummaries.map((c) => c.name))).filter(Boolean);
    return [DEFAULT_CATEGORY, ...unique];
  }, [categorySummaries]);

  useEffect(() => {
    if (!tabOptions.includes(selectedCategory)) {
      setSelectedCategory(DEFAULT_CATEGORY);
    }
  }, [tabOptions, selectedCategory]);

  const filteredItems = useMemo(() => {
    return items
      .filter((item) => {
        if (!search.trim()) return true;
        const term = search.trim().toLowerCase();
        return (
          (item.name || '').toLowerCase().includes(term) ||
          (item.description || '').toLowerCase().includes(term) ||
          getCategoryName(item).toLowerCase().includes(term)
        );
      })
      .filter((item) => {
        if (selectedCategory === DEFAULT_CATEGORY) return true;
        return getCategoryName(item) === selectedCategory;
      })
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [items, search, selectedCategory]);

  const groupedSections = useMemo(() => {
    const map = new Map();
    items.forEach((item) => {
      const key = getCategoryName(item);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(item);
    });
    return Array.from(map.entries())
      .map(([name, values]) => ({
        name,
        items: values.sort((a, b) => (a.name || '').localeCompare(b.name || '')),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [items]);

  const totalOrderQuantity = useMemo(() => {
    return orderItems.reduce((acc, entry) => acc + (Number(entry.quantity) || 0), 0);
  }, [orderItems]);

  const orderSubtotal = useMemo(() => {
    return orderItems.reduce((acc, entry) => {
      const price = Number(entry.price) || 0;
      const quantity = Number(entry.quantity) || 0;
      return acc + price * quantity;
    }, 0);
  }, [orderItems]);

  const handleOpenEditor = (item) => {
    setEditingItem(item);
    setEditorOpen(true);
  };

  const handleEditorSaved = async () => {
    setEditorOpen(false);
    setEditingItem(null);
    await loadItems();
    toast.success('Menu item saved');
  };

  const handleEditorCancel = () => {
    setEditorOpen(false);
    setEditingItem(null);
  };

  const handleAvailabilityToggle = async (item, makeAvailable) => {
    const nextQty = makeAvailable ? Math.max(item.qty_left || 0, 1) : 0;
    try {
      await authFetch(`/api/menu/${item.id}`, {
        method: 'PUT',
        data: JSON.stringify({ qty_left: nextQty }),
      });
      setItems((prev) => prev.map((entry) => (entry.id === item.id ? { ...entry, qty_left: nextQty } : entry)));
      toast.success(`${item.name} marked ${makeAvailable ? 'available' : 'unavailable'}.`);
    } catch (err) {
      console.error('Failed to update availability', err);
      toast.error('Could not update availability');
    }
  };

  const handleDelete = async (item) => {
    if (!window.confirm(`Delete ${item.name}? This cannot be undone.`)) return;
    try {
      await authFetch(`/api/menu/${item.id}`, { method: 'DELETE' });
      setItems((prev) => prev.filter((entry) => entry.id !== item.id));
      toast.success(`${item.name} deleted`);
    } catch (err) {
      console.error('Failed to delete menu item', err);
      toast.error('Delete failed. Please try again.');
    }
  };

  const handleAddToOrder = async (item) => {
    if (!isAuthenticated) {
      toast.error('Please log in to add items to your order.');
      return;
    }

    if (orderSubmitting) {
      toast.info('Please wait while we finish submitting your current order.');
      return;
    }

    if ((item.qty_left ?? 0) <= 0) {
      toast.info('This item is currently unavailable.');
      return;
    }

    const isCreatingOrder = !orderId;
    setPendingOrderItemId(item.id);
    setOrderSaving(true);

    try {
      const payload = { items: [{ item_id: item.id, qty: 1 }] };
      let response;

      if (isCreatingOrder) {
        response = await authFetch('/api/orders', {
          method: 'POST',
          data: payload,
        });
      } else {
        response = await authFetch(`/api/orders/${orderId}/items`, {
          method: 'PATCH',
          data: payload,
        });
      }

      const status = response?.status;
      const data = response?.data;
      if ((status === 200 || status === 201) && data) {
        const returnedId = Number.parseInt(data.order_id, 10);
        const effectiveOrderId = Number.isInteger(returnedId) && returnedId > 0 ? returnedId : orderId;
        if (effectiveOrderId) {
          setOrderId(effectiveOrderId);
          persistOrderId(effectiveOrderId);
        }

        const normalized = normalizeOrderItems(data.items);
        setOrderItems(normalized);

        const updatedItem = normalized.find((entry) => entry.id === item.id);
        if (updatedItem && typeof updatedItem.qty_left === 'number') {
          setItems((prev) => prev.map((entry) => (entry.id === item.id ? { ...entry, qty_left: updatedItem.qty_left } : entry)));
        }

        toast.success(isCreatingOrder ? `${item.name} added to your order.` : `${item.name} updated in your order.`);
      } else {
        const message = data?.msg || 'Unable to update your order right now.';
        throw new Error(message);
      }
    } catch (err) {
      console.error('Failed to add item to order', err);
      const status = err?.response?.status;
      const message = err?.response?.data?.msg || err?.message || 'Unable to add item to your order right now.';
      toast.error(message);

      if ((status === 404 || status === 403) && orderId) {
        clearStoredOrderId();
        setOrderId(null);
        setOrderItems([]);
      }
    } finally {
      setOrderSaving(false);
      setPendingOrderItemId(null);
    }
  };

  const handleUpdateOrderItem = useCallback(async (itemId, operation, qty = 1) => {
    if (!orderId || orderSubmitting) return;
    if (!isAuthenticated) {
      toast.error('Please log in to manage your order.');
      return;
    }

    const prevEntry = orderItems.find((entry) => entry.id === itemId);
    const previousQty = Number(prevEntry?.quantity) || 0;
    const itemName = prevEntry?.name || 'item';

    setPendingOrderItemId(itemId);
    setOrderSaving(true);

    try {
      const response = await authFetch(`/api/orders/${orderId}/items/${itemId}`, {
        method: 'PATCH',
        data: { operation, qty },
      });
      const status = response?.status;
      const data = response?.data;
      if (status === 200 && data) {
        const normalized = normalizeOrderItems(data.items);
        const updatedEntry = normalized.find((entry) => entry.id === itemId);
        const newQty = Number(updatedEntry?.quantity) || 0;
        const delta = newQty - previousQty;

        const returnedId = Number.parseInt(data.order_id, 10);
        if (!data.order_closed && Number.isInteger(returnedId) && returnedId > 0) {
          setOrderId(returnedId);
          persistOrderId(returnedId);
        }

        if (data.order_closed) {
          clearStoredOrderId();
          setOrderId(null);
          setOrderItems([]);
        } else {
          setOrderItems(normalized);
        }

        setItems((prev) => prev.map((entry) => {
          if (entry.id !== itemId) return entry;
          if (updatedEntry && typeof updatedEntry.qty_left === 'number') {
            return { ...entry, qty_left: updatedEntry.qty_left };
          }
          const currentStock = Number(entry.qty_left);
          if (Number.isNaN(currentStock)) return entry;
          const nextStock = currentStock - delta;
          return { ...entry, qty_left: Math.max(0, nextStock) };
        }));

        if (data.order_closed) {
          toast.info('Your order is now empty.');
        } else if (delta > 0) {
          toast.success(`Added another ${itemName}.`);
        } else if (delta < 0) {
          toast.success(`Removed one ${itemName}.`);
        }
      } else {
        const message = data?.msg || 'Unable to update this item right now.';
        throw new Error(message);
      }
    } catch (err) {
      console.error('Failed to adjust order item', err);
      const status = err?.response?.status;
      const message = err?.response?.data?.msg || err?.message || 'Unable to update this item right now.';
      toast.error(message);
      if (status === 404 || status === 403) {
        clearStoredOrderId();
        setOrderId(null);
        setOrderItems([]);
      }
    } finally {
      setOrderSaving(false);
      setPendingOrderItemId(null);
    }
  }, [authFetch, isAuthenticated, orderId, orderItems, orderSubmitting]);

  const handleIncrementOrderItem = useCallback(
    (itemId) => {
      handleUpdateOrderItem(itemId, 'increment', 1);
    },
    [handleUpdateOrderItem],
  );

  const handleDecrementOrderItem = useCallback(
    (itemId) => {
      handleUpdateOrderItem(itemId, 'decrement', 1);
    },
    [handleUpdateOrderItem],
  );

  const handleSubmitOrder = useCallback(async () => {
    if (!orderId || !orderItems.length) {
      toast.info('Add at least one item before submitting your order.');
      return;
    }

    setOrderSubmitting(true);
    try {
      const response = await authFetch(`/api/orders/${orderId}/submit`, { method: 'POST' });
      const status = response?.status;
      const data = response?.data;
      if (status === 200 && data) {
        clearStoredOrderId();
        setOrderId(null);
        setOrderItems([]);
        toast.success('Order submitted! We\'ll start preparing it right away.');
      } else {
        const message = data?.msg || 'Unable to submit your order right now.';
        throw new Error(message);
      }
    } catch (err) {
      console.error('Failed to submit order', err);
      const status = err?.response?.status;
      const message = err?.response?.data?.msg || err?.message || 'Unable to submit your order right now.';
      toast.error(message);
      if (status === 404 || status === 403) {
        clearStoredOrderId();
        setOrderId(null);
        setOrderItems([]);
      }
    } finally {
      setOrderSubmitting(false);
    }
  }, [authFetch, orderId, orderItems.length]);

  if (authLoading) {
    return <LoadingState />;
  }

  if (profile && isStaff) {
    return <Navigate to="/unauthorized" replace />;
  }

  if (error) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16">
        <div className="rounded-3xl border border-red-200 bg-red-50 p-8 text-red-600">
          <h1 className="text-2xl font-semibold">Something went wrong</h1>
          <p className="mt-2 text-sm">{error}</p>
          <button
            type="button"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-[var(--app-primary)] px-5 py-2 text-sm font-semibold text-[var(--app-primary-contrast)]"
            onClick={loadItems}
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (loading && !items.length) {
    return <LoadingState label="Loading menu items…" />;
  }

  const adminView = (
    <section className="space-y-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-4">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[rgba(15,23,42,0.08)] text-2xl font-semibold text-[var(--app-primary)]">
            $
          </span>
          <div>
            <h1 className="text-3xl font-semibold text-[var(--app-text)]">Menu Management System</h1>
            <p className="mt-1 text-sm text-[var(--app-muted)]">Manage menu items, pricing, availability, and descriptions.</p>
          </div>
        </div>
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
          <div className="relative w-full sm:w-64">
            <FiSearch className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--app-muted)]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search menu..."
              className="w-full rounded-full border border-[rgba(15,23,42,0.08)] bg-[var(--app-surface)] py-2 pl-11 pr-4 text-sm text-[var(--app-text)] shadow-sm focus:border-[var(--app-primary)] focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={() => handleOpenEditor(null)}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--app-primary)] px-5 py-3 text-sm font-semibold text-[var(--app-primary-contrast)] shadow-sm transition hover:opacity-90"
          >
            <FiPlus />
            Add Menu Item
          </button>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {categorySummaries.map((summary) => (
          <article
            key={summary.name}
            className="rounded-3xl border border-[rgba(15,23,42,0.05)] bg-[var(--app-surface)] p-6 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[var(--app-muted)]">{summary.name || 'Uncategorized'}</p>
                <p className="mt-3 text-3xl font-semibold text-[var(--app-text)]">{summary.available}/{summary.total}</p>
                <p className="mt-1 text-xs text-[var(--app-muted)]">Available this week</p>
              </div>
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[rgba(15,23,42,0.05)] text-[var(--app-primary)]">
                <FiPieChart />
              </span>
            </div>
          </article>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {tabOptions.map((tab) => {
          const isActive = tab === selectedCategory;
          return (
            <button
              key={tab}
              type="button"
              onClick={() => setSelectedCategory(tab)}
              className={`rounded-full px-5 py-2 text-sm font-medium transition ${
                isActive
                  ? 'bg-[var(--app-primary)] text-[var(--app-primary-contrast)] shadow-sm'
                  : 'border border-[rgba(15,23,42,0.08)] bg-[var(--app-surface)] text-[var(--app-muted)] hover:text-[var(--app-primary)]'
              }`}
            >
              {tab}
            </button>
          );
        })}
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {filteredItems.map((item) => {
          const available = (item.qty_left ?? 0) > 0;
          const imgSrc = resolveImageUrl(item.img_link);
          const rating = computeRating(item);
          const prepTime = computePrepTime(item);

          return (
            <article
              key={item.id}
              className="group relative overflow-hidden rounded-3xl border border-[rgba(15,23,42,0.06)] bg-[var(--app-surface)] shadow-sm transition hover:-translate-y-1 hover:shadow-md"
            >
              <span
                className={`absolute right-5 top-5 rounded-full px-3 py-1 text-xs font-semibold ${
                  available
                    ? 'bg-[rgba(34,197,94,0.12)] text-[var(--app-success)]'
                    : 'bg-[rgba(248,113,113,0.15)] text-red-500'
                }`}
              >
                {available ? 'Available' : 'Unavailable'}
              </span>
              <div className="h-48 bg-[var(--app-bg)]">
                {imgSrc ? (
                  <img src={imgSrc} alt={item.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-[var(--app-muted)]">
                    <FiImage className="text-3xl" />
                  </div>
                )}
              </div>
              <div className="space-y-4 p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold text-[var(--app-text)]">{item.name}</h3>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--app-muted)]">
                      <span className="inline-flex items-center gap-1">
                        <FiTag /> {getCategoryName(item)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <FiClock /> {prepTime} min
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <FiCheckCircle className="text-[var(--app-success)]" /> {rating}
                      </span>
                    </div>
                  </div>
                  <span className="text-lg font-semibold text-[var(--app-text)]">{formatPrice(item.price)}</span>
                </div>
                <p className="text-sm leading-relaxed text-[var(--app-muted)]">
                  {item.description || 'No description provided yet.'}
                </p>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => handleAvailabilityToggle(item, !available)}
                    className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                      available
                        ? 'bg-[rgba(248,113,113,0.12)] text-red-500 hover:bg-[rgba(248,113,113,0.2)]'
                        : 'bg-[rgba(34,197,94,0.12)] text-[var(--app-success)] hover:bg-[rgba(34,197,94,0.2)]'
                    }`}
                  >
                    {available ? 'Mark Unavailable' : 'Mark Available'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenEditor(item)}
                    className="inline-flex items-center gap-2 rounded-full border border-[rgba(15,23,42,0.12)] px-4 py-2 text-sm font-semibold text-[var(--app-text)] hover:border-[var(--app-primary)]"
                  >
                    <FiEdit2 /> Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(item)}
                    className="inline-flex items-center gap-2 rounded-full border border-red-200 px-4 py-2 text-sm font-semibold text-red-500 transition hover:bg-red-50"
                  >
                    <FiTrash2 /> Delete
                  </button>
                </div>
                <div className="flex items-center justify-between text-xs text-[var(--app-muted)]">
                  <span>Stock: {item.qty_left ?? 0}</span>
                  {item.discount ? <span>Discount: {item.discount}%</span> : null}
                </div>
              </div>
            </article>
          );
        })}

        {!filteredItems.length && (
          <div className="col-span-full rounded-3xl border border-dashed border-[rgba(15,23,42,0.15)] bg-[var(--app-bg)] p-12 text-center text-sm text-[var(--app-muted)]">
            No menu items match this filter yet. Try adjusting the search or add a new dish.
          </div>
        )}
      </div>
    </section>
  );

  const userView = (
    <section className="space-y-10">
      <header className="space-y-4">
        <div className="flex items-start gap-4">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[rgba(15,23,42,0.08)] text-2xl text-[var(--app-primary)]">
            <FiShoppingBag />
          </span>
          <div>
            <h1 className="text-3xl font-semibold text-[var(--app-text)]">Discover the Menu</h1>
            <p className="mt-1 text-[var(--app-muted)]">Choose your favorites and add them to your order.</p>
          </div>
        </div>
        {orderLoading ? (
          <div className="inline-flex items-center gap-2 rounded-full bg-[rgba(15,23,42,0.05)] px-4 py-2 text-xs font-medium text-[var(--app-muted)]">
            <FiClock /> Loading your active order…
          </div>
        ) : totalOrderQuantity > 0 ? (
          <div className="inline-flex items-center gap-2 rounded-full bg-[rgba(15,23,42,0.05)] px-4 py-2 text-xs font-medium text-[var(--app-muted)]">
            <FiCheckCircle className="text-[var(--app-success)]" />
            {orderSubmitting
              ? 'Submitting your order…'
              : orderSaving
                ? 'Updating your order…'
                : `${totalOrderQuantity} item${totalOrderQuantity > 1 ? 's' : ''} in your order`}
          </div>
        ) : null}
      </header>

      {(orderLoading || totalOrderQuantity > 0) && (
        <section className="rounded-3xl border border-[rgba(15,23,42,0.08)] bg-[var(--app-surface)] p-6 shadow-sm">
          {orderLoading ? (
            <p className="text-sm text-[var(--app-muted)]">We&apos;re loading your active order…</p>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-[var(--app-text)]">Active Order</h2>
                <span className="text-sm text-[var(--app-muted)]">{totalOrderQuantity} item{totalOrderQuantity > 1 ? 's' : ''}</span>
              </div>
              <ul className="space-y-3">
                {orderItems.map((entry) => {
                  const entryQty = Number(entry.quantity) || 0;
                  const stockRemaining = typeof entry.qty_left === 'number' ? entry.qty_left : null;
                  const isPending = orderSaving && pendingOrderItemId === entry.id;
                  const disableDecrement = orderSaving || orderSubmitting || entryQty <= 0;
                  const disableIncrement = orderSaving || orderSubmitting || (stockRemaining !== null && stockRemaining <= 0);

                  return (
                    <li
                      key={entry.id}
                      className="flex flex-col gap-2 rounded-2xl bg-[rgba(15,23,42,0.02)] p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex-1">
                        <p className="font-medium text-[var(--app-text)]">{entry.name}</p>
                        <p className="text-xs text-[var(--app-muted)]">{formatPrice(entry.price)} each</p>
                        {stockRemaining !== null ? (
                          <p className="text-xs text-[var(--app-muted)]">
                            {stockRemaining > 0 ? `${stockRemaining} left in stock` : 'No more available'}
                          </p>
                        ) : null}
                        {isPending ? <p className="text-xs text-[var(--app-muted)]">Saving…</p> : null}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleDecrementOrderItem(entry.id)}
                          disabled={disableDecrement || entryQty <= 0}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[rgba(15,23,42,0.12)] bg-[var(--app-surface)] text-[var(--app-text)] transition disabled:cursor-not-allowed disabled:opacity-50 hover:border-[var(--app-primary)]"
                          aria-label={`Remove one ${entry.name}`}
                        >
                          <FiMinus />
                        </button>
                        <span className="inline-flex w-8 justify-center text-sm font-semibold text-[var(--app-text)]">{entryQty}</span>
                        <button
                          type="button"
                          onClick={() => handleIncrementOrderItem(entry.id)}
                          disabled={disableIncrement}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[rgba(15,23,42,0.12)] bg-[var(--app-primary)] text-[var(--app-primary-contrast)] transition disabled:cursor-not-allowed disabled:opacity-50 hover:opacity-90"
                          aria-label={`Add one more ${entry.name}`}
                        >
                          <FiPlus />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
              <div className="flex items-center justify-between border-t border-[rgba(15,23,42,0.08)] pt-3 text-sm text-[var(--app-text)]">
                <span className="font-semibold">Subtotal</span>
                <span className="font-semibold">{formatPrice(orderSubtotal)}</span>
              </div>
              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={handleSubmitOrder}
                  disabled={orderSubmitting || orderSaving || orderItems.length === 0}
                  className="inline-flex items-center gap-2 rounded-full bg-[var(--app-primary)] px-5 py-2 text-sm font-semibold text-[var(--app-primary-contrast)] transition disabled:cursor-not-allowed disabled:opacity-60 hover:opacity-90"
                >
                  <FiSend className="text-sm" />
                  {orderSubmitting ? 'Submitting…' : 'Submit Order'}
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {groupedSections.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-[rgba(15,23,42,0.15)] bg-[var(--app-bg)] p-12 text-center text-sm text-[var(--app-muted)]">
          The menu is being curated by our team. Please check back shortly!
        </div>
      ) : (
        groupedSections.map((section) => (
          <div key={section.name} className="space-y-5">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{categoryEmoji(section.name)}</span>
              <h2 className="text-xl font-semibold text-[var(--app-text)]">{section.name}</h2>
            </div>
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {section.items.map((item) => {
                const available = (item.qty_left ?? 0) > 0;
                const imgSrc = resolveImageUrl(item.img_link);
                const rating = computeRating(item);
                const prepTime = computePrepTime(item);
                const existingEntry = orderItems.find((entry) => entry.id === item.id);
                const currentQty = Number(existingEntry?.quantity) || 0;
                const isUpdatingThisItem = orderSaving && pendingOrderItemId === item.id;
                const buttonDisabled = !available || orderSaving || orderSubmitting;
                const buttonText = isUpdatingThisItem
                  ? 'Saving…'
                  : orderSubmitting
                    ? 'Submitting…'
                  : existingEntry
                    ? `Add another (currently ${currentQty})`
                    : 'Add to Order';
                const buttonClassName = [
                  'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition',
                  !available
                    ? 'cursor-not-allowed bg-[rgba(15,23,42,0.05)] text-[var(--app-muted)]'
                    : existingEntry
                      ? 'bg-[rgba(15,23,42,0.08)] text-[var(--app-primary)] hover:bg-[rgba(15,23,42,0.12)]'
            : 'bg-[var(--app-primary)] text-[var(--app-primary-contrast)] hover:opacity-90',
          orderSaving || orderSubmitting ? 'opacity-75' : '',
                ].join(' ');

                return (
                  <article
                    key={item.id}
                    className="flex h-full flex-col overflow-hidden rounded-3xl border border-[rgba(15,23,42,0.08)] bg-[var(--app-surface)] shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <div className="h-40 bg-[var(--app-bg)]">
                      {imgSrc ? (
                        <img src={imgSrc} alt={item.name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-[var(--app-muted)]">
                          <FiImage className="text-3xl" />
                        </div>
                      )}
                    </div>
                    <div className="flex flex-1 flex-col gap-4 p-6">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="text-lg font-semibold text-[var(--app-text)]">{item.name}</h3>
                          <div className="mt-1 flex items-center gap-2 text-xs text-[var(--app-muted)]">
                            <span className="inline-flex items-center gap-1">
                              <FiClock /> {prepTime} min
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <FiCheckCircle className="text-[var(--app-success)]" /> {rating}
                            </span>
                          </div>
                        </div>
                        <span className="text-lg font-semibold text-[var(--app-text)]">{formatPrice(item.price)}</span>
                      </div>
                      <p className="text-sm leading-relaxed text-[var(--app-muted)]">
                        {item.description || 'Delicious menu item prepared fresh for you.'}
                      </p>
                      <div className="mt-auto flex items-center justify-between">
                        <span className={`text-xs font-semibold ${available ? 'text-[var(--app-success)]' : 'text-red-500'}`}>
                          {available ? 'In stock' : 'Temporarily unavailable'}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleAddToOrder(item)}
                          disabled={buttonDisabled}
                          className={buttonClassName}
                        >
                          <FiPlus className="text-sm" />
                          {buttonText}
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        ))
      )}
    </section>
  );

  return (
    <div className="min-h-full bg-[var(--app-bg)] py-10">
      <div className="mx-auto w-full max-w-6xl space-y-10 px-4 sm:px-6 lg:px-8">
        {isAdminManager ? adminView : userView}
      </div>

      {editorOpen && (
        <div className="fixed inset-0 z-40 overflow-y-auto bg-black/30">
          <div className="flex min-h-full items-center justify-center px-4 py-10">
            <div className="relative w-full max-w-2xl">
            <button
              type="button"
              onClick={handleEditorCancel}
              className="absolute right-5 top-5 inline-flex h-10 w-10 items-center justify-center rounded-full bg-[rgba(15,23,42,0.08)] text-lg text-[var(--app-muted)] transition hover:text-[var(--app-primary)]"
              aria-label="Close editor"
            >
              ×
            </button>
            <MenuEditor
              item={editingItem}
              onSaved={handleEditorSaved}
              onCancel={handleEditorCancel}
              types={types}
            />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MenuPage;