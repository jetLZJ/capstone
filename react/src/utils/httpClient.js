import axios from 'axios';
import AuthService from '../services/AuthService';

const rawBase = (import.meta.env?.VITE_API_BASE_URL || '').trim();

const INTERNAL_DOCKER_HOSTS = new Set(['proxy', 'proxyserver']);

const normalizeBaseURL = (value) => {
  if (!value) {
    return '';
  }

  // Permit relative paths such as "/api"
  if (value.startsWith('/')) {
    return value.replace(/\/+$/, '');
  }

  if (typeof window === 'undefined') {
    return value.replace(/\/+$/, '');
  }

  try {
    const url = new URL(value, window.location.origin);

    if (INTERNAL_DOCKER_HOSTS.has(url.hostname) && url.hostname !== window.location.hostname) {
      const fallbackPort = url.port || '8080';
      const needsPort = fallbackPort && !['80', '443'].includes(fallbackPort);
      const rewrittenOrigin = `${url.protocol}//${window.location.hostname}${needsPort ? `:${fallbackPort}` : ''}`;
      const rebuilt = `${rewrittenOrigin}${url.pathname}${url.search}${url.hash}`;
      return rebuilt.replace(/\/+$/, '');
    }

    return url.toString().replace(/\/+$/, '');
  } catch (err) {
    // If the value is not a valid absolute URL treat it as-is
    return value.replace(/\/+$/, '');
  }
};

const baseURL = normalizeBaseURL(rawBase);

// Create axios instance with default config
const httpClient = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor to include auth token
httpClient.interceptors.request.use(
  (config) => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (user && user.access_token) {
      config.headers.Authorization = `Bearer ${user.access_token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor to handle token refresh
httpClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If the error is 401 and we haven't retried the request yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // Refresh token
        const updatedUser = await AuthService.refreshToken();
        
        // Update the original request with the new token
        originalRequest.headers.Authorization = `Bearer ${updatedUser.access_token}`;
        
        // Retry the original request
        return httpClient(originalRequest);
      } catch (refreshError) {
        // If refresh fails, logout the user
        AuthService.logout();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default httpClient;