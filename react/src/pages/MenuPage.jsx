import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  FiPlus,
  FiSearch,
  FiPieChart,
  FiShoppingBag,
  FiEdit2,
  FiTrash2,
  FiCheckCircle,
  FiClock,
  FiTag,
  FiImage,
} from 'react-icons/fi';
import useAuth from '../hooks/useAuth';
import useCustomerOrder from '../hooks/useCustomerOrder';
import MenuEditor from '../components/menu/MenuEditor';
import ActiveOrderPanel from '../components/orders/ActiveOrderPanel';
import { formatPrice } from '../utils/formatters';

const DEFAULT_CATEGORY = 'All Items';

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

const CustomerBrowseView = ({
  orderStatusPill,
  groupedSections,
  orderItems,
  orderLoading,
  orderSaving,
  orderSubmitting,
  pendingOrderItemId,
  totalOrderQuantity,
  orderSubtotal,
  onAddToOrder,
  onIncrementItem,
  onDecrementItem,
  onSubmitOrder,
  onNavigateToOrders,
}) => {
  const showReviewButton = totalOrderQuantity > 0;

  return (
    <section className="space-y-10">
      <header className="space-y-4">
        <div className="flex flex-wrap items-start gap-4">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[rgba(15,23,42,0.08)] text-2xl text-[var(--app-primary)]">
            <FiShoppingBag />
          </span>
          <div className="flex-1 min-w-[240px]">
            <h1 className="text-3xl font-semibold text-[var(--app-text)]">Discover the Menu</h1>
            <p className="mt-1 text-[var(--app-muted)]">Choose your favorites and add them to your order.</p>
          </div>
          {showReviewButton ? (
            <button
              type="button"
              onClick={onNavigateToOrders}
              className="inline-flex items-center gap-2 rounded-full border border-[rgba(15,23,42,0.12)] bg-[var(--app-surface)] px-4 py-2 text-xs font-semibold text-[var(--app-text)] transition hover:border-[var(--app-primary)]"
            >
              <FiCheckCircle className="text-[var(--app-success)]" /> Review order
            </button>
          ) : null}
        </div>
        {orderStatusPill}
      </header>

      <ActiveOrderPanel
        loading={orderLoading}
        items={orderItems}
        totalQuantity={totalOrderQuantity}
        subtotal={orderSubtotal}
        saving={orderSaving}
        submitting={orderSubmitting}
        pendingItemId={pendingOrderItemId}
        onIncrement={onIncrementItem}
        onDecrement={onDecrementItem}
        onSubmit={onSubmitOrder}
        showEmptyState={false}
      />

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
                          onClick={() => onAddToOrder(item)}
                          disabled={buttonDisabled}
                          className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
                            !available
                              ? 'cursor-not-allowed bg-[rgba(15,23,42,0.05)] text-[var(--app-muted)]'
                              : existingEntry
                                ? 'bg-[rgba(15,23,42,0.08)] text-[var(--app-primary)] hover:bg-[rgba(15,23,42,0.12)]'
                                : 'bg-[var(--app-primary)] text-[var(--app-primary-contrast)] hover:opacity-90'
                          } ${orderSaving || orderSubmitting ? 'opacity-75' : ''}`}
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
};


const MenuPage = () => {
  const { profile, authFetch, isLoading: authLoading, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const {
    orderId,
    orderItems,
    orderLoading,
    orderSaving,
    orderSubmitting,
    pendingOrderItemId,
    totalOrderQuantity,
    orderSubtotal,
    handleAddToOrder,
    handleIncrementOrderItem,
    handleDecrementOrderItem,
    handleSubmitOrder,
    refreshOrder,
  } = useCustomerOrder();

  const [items, setItems] = useState([]);
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(DEFAULT_CATEGORY);
  const [search, setSearch] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  const role = (profile?.role || '').toLowerCase();
  const isAdmin = role === 'admin';
  const isManager = role === 'manager';
  const isStaff = role === 'staff';
  const isUser = role === 'user';
  const isAdminManager = isAdmin || isManager;

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch('/api/menu');
      const payload = res?.data;
      const nextItems = Array.isArray(payload?.items) ? payload.items : [];
      setItems(nextItems);
      if (!Array.isArray(payload?.items)) {
        console.warn('Unexpected menu response shape', payload);
      }
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
      const payload = res?.data;
      if (Array.isArray(payload?.types)) {
        setTypes(payload.types);
      } else {
        setTypes([]);
        if (payload) {
          console.warn('Unexpected menu types response shape', payload);
        }
      }
    } catch (err) {
      console.error('Failed to load menu types', err);
    }
  }, [authFetch]);

  useEffect(() => {
    loadItems();
    loadTypes();
  }, [loadItems, loadTypes]);

  useEffect(() => {
    if (!selectedCategory || selectedCategory === DEFAULT_CATEGORY) return;
    const exists = items.some((item) => getCategoryName(item) === selectedCategory);
    if (!exists) {
      setSelectedCategory(DEFAULT_CATEGORY);
    }
  }, [items, selectedCategory]);

  useEffect(() => {
    if (!orderItems.length) return;
    setItems((prev) =>
      prev.map((entry) => {
        const matched = orderItems.find((item) => item.id === entry.id);
        if (matched && typeof matched.qty_left === 'number') {
          return { ...entry, qty_left: matched.qty_left };
        }
        return entry;
      }),
    );
  }, [orderItems]);

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

  const orderStatusPill = (() => {
    if (orderLoading) {
      return (
        <div className="inline-flex items-center gap-2 rounded-full bg-[rgba(15,23,42,0.05)] px-4 py-2 text-xs font-medium text-[var(--app-muted)]">
          <FiClock /> Loading your active order…
        </div>
      );
    }
    if (totalOrderQuantity > 0) {
      return (
        <div className="inline-flex items-center gap-2 rounded-full bg-[rgba(15,23,42,0.05)] px-4 py-2 text-xs font-medium text-[var(--app-muted)]">
          <FiCheckCircle className="text-[var(--app-success)]" />
          {orderSubmitting
            ? 'Submitting your order…'
            : orderSaving
              ? 'Updating your order…'
              : `${totalOrderQuantity} item${totalOrderQuantity > 1 ? 's' : ''} in your order`}
        </div>
      );
    }
    return null;
  })();

  const handleSubmitOrderWithRefresh = useCallback(async () => {
    await handleSubmitOrder();
    await refreshOrder();
  }, [handleSubmitOrder, refreshOrder]);

  const handleNavigateToOrders = useCallback(() => {
    navigate('/orders');
  }, [navigate]);

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

  if (isAdminManager) {
    return (
      <div className="min-h-full bg-[var(--app-bg)] py-10">
        <div className="mx-auto w-full max-w-6xl space-y-10 px-4 sm:px-6 lg:px-8">
          {adminView}
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
  }

  return (
    <div className="min-h-full bg-[var(--app-bg)] py-10">
      <div className="mx-auto w-full max-w-6xl space-y-10 px-4 sm:px-6 lg:px-8">
        <CustomerBrowseView
          orderStatusPill={orderStatusPill}
          groupedSections={groupedSections}
          orderItems={orderItems}
          orderLoading={orderLoading}
          orderSaving={orderSaving}
          orderSubmitting={orderSubmitting}
          pendingOrderItemId={pendingOrderItemId}
          totalOrderQuantity={totalOrderQuantity}
          orderSubtotal={orderSubtotal}
          onAddToOrder={handleAddToOrder}
          onIncrementItem={handleIncrementOrderItem}
          onDecrementItem={handleDecrementOrderItem}
          onSubmitOrder={handleSubmitOrderWithRefresh}
          onNavigateToOrders={handleNavigateToOrders}
        />
      </div>
    </div>
  );
};

export default MenuPage;