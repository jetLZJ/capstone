import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import useAuth from './useAuth';

export const ORDER_STORAGE_KEY = 'capstone-active-order-id';
export const ORDER_META_KEY = 'capstone-order-meta';

export const readStoredOrderId = () => {
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

export const persistOrderId = (id) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(ORDER_STORAGE_KEY, String(id));
  } catch (err) {
    console.warn('Failed to persist order id', err);
  }
};

export const clearStoredOrderId = () => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(ORDER_STORAGE_KEY);
    window.localStorage.removeItem(ORDER_META_KEY);
    window.dispatchEvent(new CustomEvent('order-meta-updated', { detail: { count: 0 } }));
  } catch (err) {
    console.warn('Failed to clear stored order id', err);
  }
};

export const persistOrderMeta = (count) => {
  if (typeof window === 'undefined') return;
  try {
    if (count > 0) {
      window.localStorage.setItem(ORDER_META_KEY, JSON.stringify({ count }));
    } else {
      window.localStorage.removeItem(ORDER_META_KEY);
    }
    window.dispatchEvent(new CustomEvent('order-meta-updated', { detail: { count } }));
  } catch (err) {
    console.warn('Failed to persist order meta', err);
  }
};

export const readOrderMetaCount = () => {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = window.localStorage.getItem(ORDER_META_KEY);
    if (!raw) return 0;
    const parsed = JSON.parse(raw);
    const total = Number(parsed?.count);
    return Number.isFinite(total) && total > 0 ? total : 0;
  } catch (err) {
    console.warn('Failed to read order meta', err);
    return 0;
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

const useCustomerOrder = () => {
  const { authFetch, isAuthenticated } = useAuth();
  const [orderId, setOrderId] = useState(null);
  const [orderItems, setOrderItems] = useState([]);
  const [orderLoading, setOrderLoading] = useState(false);
  const [orderSaving, setOrderSaving] = useState(false);
  const [orderSubmitting, setOrderSubmitting] = useState(false);
  const [pendingOrderItemId, setPendingOrderItemId] = useState(null);

  const loadStoredOrder = useCallback(async () => {
    if (!isAuthenticated) return;
    const storedId = readStoredOrderId();
    if (!storedId) {
      setOrderId(null);
      setOrderItems([]);
      return;
    }

    setOrderLoading(true);
    try {
      const res = await authFetch(`/api/orders/${storedId}`);
      if (res?.status === 200 && res?.data) {
        const normalized = normalizeOrderItems(res.data.items);
        setOrderId(res.data.order_id ?? storedId);
        setOrderItems(normalized);
      } else if (res?.status === 404) {
        clearStoredOrderId();
        setOrderId(null);
        setOrderItems([]);
      }
    } catch (err) {
      console.error('Failed to load stored order', err);
      clearStoredOrderId();
      setOrderId(null);
      setOrderItems([]);
    } finally {
      setOrderLoading(false);
    }
  }, [authFetch, isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      loadStoredOrder();
    }
  }, [isAuthenticated, loadStoredOrder]);

  useEffect(() => {
    if (!isAuthenticated) {
      setOrderId(null);
      setOrderItems([]);
      clearStoredOrderId();
    }
  }, [isAuthenticated]);

  const totalOrderQuantity = useMemo(
    () => orderItems.reduce((acc, entry) => acc + (Number(entry.quantity) || 0), 0),
    [orderItems],
  );

  const orderSubtotal = useMemo(
    () =>
      orderItems.reduce((acc, entry) => {
        const price = Number(entry.price) || 0;
        const quantity = Number(entry.quantity) || 0;
        return acc + price * quantity;
      }, 0),
    [orderItems],
  );

  useEffect(() => {
    if (isAuthenticated) {
      persistOrderMeta(totalOrderQuantity);
    }
  }, [isAuthenticated, totalOrderQuantity]);

  const handleAddToOrder = useCallback(
    async (item) => {
      if (!item || typeof item !== 'object') return;
      if (!isAuthenticated) {
        toast.info('Log in to start an order.');
        return;
      }

      setOrderSaving(true);
      setPendingOrderItemId(item.id);
      try {
        let response;
        if (!orderId) {
          response = await authFetch('/api/orders', {
            method: 'POST',
            data: { items: [{ item_id: item.id, qty: 1 }] },
          });
        } else {
          response = await authFetch(`/api/orders/${orderId}/items`, {
            method: 'PATCH',
            data: { items: [{ item_id: item.id, qty: 1 }] },
          });
        }

        const status = response?.status;
        const data = response?.data;
        if ((status === 201 || status === 200) && data) {
          const normalized = normalizeOrderItems(data.items);
          setOrderId(data.order_id);
          setOrderItems(normalized);
          persistOrderId(data.order_id);
          toast.success(`${item.name} added to your order.`);
        } else {
          const message = data?.msg || 'Unable to add this item right now.';
          throw new Error(message);
        }
      } catch (err) {
        console.error('Failed to add item to order', err);
        const status = err?.response?.status;
        const message = err?.response?.data?.msg || err?.message || 'Unable to add this item right now.';
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
    },
    [authFetch, isAuthenticated, orderId],
  );

  const handleUpdateOrderItem = useCallback(
    async (itemId, operation, qty) => {
      if (!orderId || !itemId) return;
      if (orderSubmitting) return;

      setOrderSaving(true);
      setPendingOrderItemId(itemId);
      try {
        const response = await authFetch(`/api/orders/${orderId}/items/${itemId}`, {
          method: 'PATCH',
          data: { operation, qty },
        });
        const status = response?.status;
        const data = response?.data;
        if (status === 200 && data) {
          const normalized = normalizeOrderItems(data.items);
          setOrderItems(normalized);
          const delta = operation === 'increment' ? qty : operation === 'decrement' ? -qty : 0;
          const itemName = orderItems.find((entry) => entry.id === itemId)?.name || 'Item';
          if (data.order_closed) {
            toast.info('Your order is now empty.');
            clearStoredOrderId();
            setOrderId(null);
            setOrderItems([]);
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
    },
    [authFetch, orderId, orderItems, orderSubmitting],
  );

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
        toast.success("Order submitted! We'll start preparing it right away.");
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

  return {
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
    refreshOrder: loadStoredOrder,
    setOrderItems,
  };
};

export default useCustomerOrder;
