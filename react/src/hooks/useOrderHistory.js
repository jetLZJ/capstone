import { useCallback, useEffect, useMemo, useState } from 'react';
import useAuth from './useAuth';

const DEFAULT_LIMIT = 20;

const useOrderHistory = ({ auto = true, limit = DEFAULT_LIMIT } = {}) => {
  const { authFetch, isAuthenticated, profile } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const isUser = useMemo(() => {
    const role = (profile?.role || '').toLowerCase();
    return isAuthenticated && role === 'user';
  }, [isAuthenticated, profile?.role]);

  const loadHistory = useCallback(async () => {
    if (!isUser) {
      setOrders([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await authFetch('/api/orders', { params: { limit } });
      const payload = response?.data;
      if (Array.isArray(payload?.orders)) {
        setOrders(payload.orders);
      } else {
        setOrders([]);
        if (payload) {
          console.warn('Unexpected orders response shape', payload);
        }
      }
    } catch (err) {
      console.error('Failed to load order history', err);
      setError('Unable to load your past orders right now.');
    } finally {
      setLoading(false);
    }
  }, [authFetch, isUser, limit]);

  useEffect(() => {
    if (auto && isUser) {
      loadHistory();
    }
    if (!isAuthenticated) {
      setOrders([]);
    }
  }, [auto, isAuthenticated, isUser, loadHistory]);

  return {
    orders,
    loading,
    error,
    refresh: loadHistory,
    setOrders,
  };
};

export default useOrderHistory;
