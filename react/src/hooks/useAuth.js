import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';

/**
 * Custom hook for using authentication context
 * @returns {Object} Authentication context object
 */
const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  // Ensure authFetch is always a callable function even if the provider
  // hasn't yet attached it (prevents transient TypeError during init).
  if (typeof context.authFetch !== 'function') {
    return { ...context, authFetch: async (url, opts = {}) => {
      // Fallback: emulate axios-like call using fetch and include Authorization
      // header read from localStorage so requests from components don't lose
      // authentication while the provider is still initializing.
      const headers = new Headers(opts.headers || {});

      try {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        if (user && user.access_token) {
          headers.set('Authorization', `Bearer ${user.access_token}`);
        }
      } catch (e) {
        // ignore
      }

      // axios uses `data` for the request body; map it to fetch `body`.
      const method = (opts.method || 'GET').toUpperCase();
      let body = undefined;
      if (opts.data !== undefined) {
        // if data is already a string, use it; otherwise stringify JSON
        body = typeof opts.data === 'string' ? opts.data : JSON.stringify(opts.data);
        if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
      } else if (opts.body !== undefined) {
        body = opts.body;
      }

      const res = await fetch(url, { method, headers, body });
      const contentType = res.headers.get('content-type') || '';
      let data = null;
      if (contentType.includes('application/json')) {
        data = await res.json().catch(() => null);
      } else {
        data = await res.text().catch(() => null);
      }
      return { data, status: res.status, ok: res.ok };
    } };
  }

  return context;
};

export default useAuth;