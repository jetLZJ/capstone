import { useCallback, useEffect, useRef, useState } from 'react';
import useAuth from '../../hooks/useAuth';

const unwrapResponse = (response) => {
  if (!response) return null;
  if (typeof response === 'object' && response !== null && Object.prototype.hasOwnProperty.call(response, 'data')) {
    return response.data;
  }
  return response;
};

const useDashboardData = ({ includeSummary = false, includeSchedule = false } = {}) => {
  const { authFetch } = useAuth();
  const [state, setState] = useState({
    loading: includeSummary || includeSchedule,
    error: null,
    summary: null,
    schedule: null,
  });
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const loadData = useCallback(async () => {
    if (!includeSummary && !includeSchedule) {
      if (isMounted.current) {
        setState({
          loading: false,
          error: null,
          summary: null,
          schedule: null,
        });
      }
      return;
    }

    if (isMounted.current) {
      setState((prev) => ({ ...prev, loading: true, error: null }));
    }

    try {
      const [summaryRes, scheduleRes] = await Promise.all([
        includeSummary ? authFetch('/api/analytics/summary', { method: 'GET' }) : Promise.resolve(null),
        includeSchedule ? authFetch('/api/schedules/week', { method: 'GET' }) : Promise.resolve(null),
      ]);

      if (!isMounted.current) return;

      setState({
        loading: false,
        error: null,
        summary: includeSummary ? unwrapResponse(summaryRes) : null,
        schedule: includeSchedule ? unwrapResponse(scheduleRes) : null,
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
  }, [authFetch, includeSchedule, includeSummary]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return {
    ...state,
    refresh: loadData,
  };
};

export default useDashboardData;
