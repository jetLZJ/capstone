import { useCallback, useEffect, useRef, useState } from 'react';
import useAuth from '../../hooks/useAuth';

const unwrapResponse = (response) => {
  if (!response) return null;
  if (typeof response === 'object' && response !== null && Object.prototype.hasOwnProperty.call(response, 'data')) {
    return response.data;
  }
  return response;
};

const useDashboardData = ({ includeSummary = false, includeSchedule = false, includeNotifications = false } = {}) => {
  const { authFetch } = useAuth();
  const [state, setState] = useState({
    loading: includeSummary || includeSchedule || includeNotifications,
    error: null,
    summary: null,
    schedule: null,
    notifications: [],
  });
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const loadData = useCallback(async () => {
    if (!includeSummary && !includeSchedule && !includeNotifications) {
      if (isMounted.current) {
        setState({
          loading: false,
          error: null,
          summary: null,
          schedule: null,
          notifications: [],
        });
      }
      return;
    }

    if (isMounted.current) {
      setState((prev) => ({ ...prev, loading: true, error: null }));
    }

    try {
      const [summaryRes, scheduleRes, notificationsRes] = await Promise.all([
        includeSummary ? authFetch('/api/analytics/summary', { method: 'GET' }) : Promise.resolve(null),
        includeSchedule ? authFetch('/api/schedules/week', { method: 'GET' }) : Promise.resolve(null),
        includeNotifications ? authFetch('/api/schedules/notifications', { method: 'GET' }) : Promise.resolve(null),
      ]);

      if (!isMounted.current) return;

      const summaryPayload = includeSummary ? unwrapResponse(summaryRes) : null;
      const schedulePayload = includeSchedule ? unwrapResponse(scheduleRes) : null;
      const notificationsPayload = includeNotifications ? unwrapResponse(notificationsRes) : null;
      const notifications = includeNotifications ? notificationsPayload?.notifications || [] : [];

      setState({
        loading: false,
        error: null,
        summary: summaryPayload,
        schedule: schedulePayload,
        notifications,
      });
    } catch (error) {
      if (!isMounted.current) return;
      const message = error?.response?.data?.msg || error?.message || 'Unable to load dashboard info';
      setState((prev) => ({
        ...prev,
        loading: false,
        error: message,
      }));
    }
  }, [authFetch, includeNotifications, includeSchedule, includeSummary]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const acknowledgeNotification = useCallback(
    async (notificationId) => {
      if (!includeNotifications) return;
      await authFetch(`/api/schedules/notifications/${notificationId}/ack`, { method: 'POST' });
      if (!isMounted.current) return;
      setState((prev) => ({
        ...prev,
        notifications: Array.isArray(prev.notifications)
          ? prev.notifications.filter((item) => item?.id !== notificationId)
          : [],
      }));
    },
    [authFetch, includeNotifications],
  );

  return {
    ...state,
    refresh: loadData,
    acknowledgeNotification: includeNotifications ? acknowledgeNotification : undefined,
  };
};

export default useDashboardData;
