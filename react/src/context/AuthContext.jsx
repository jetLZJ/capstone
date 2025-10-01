import { createContext, useReducer, useEffect, useCallback } from 'react';
import AuthService from '../services/AuthService';
import httpClient from '../utils/httpClient';
import * as jwtDecodeModule from 'jwt-decode';
// Some distributions of `jwt-decode` don't provide a default export when bundled
// (Vite/Rollup can expose only named exports). Use a safe fallback so both ESM
// and CJS consumers work:
const jwtDecode = jwtDecodeModule?.default ?? jwtDecodeModule;

// Initial state
const initialState = {
  user: null,
  profile: null,
  isAuthenticated: false,
  isLoading: true,
  error: null
};

// Create context
export const AuthContext = createContext(initialState);

// Actions
const ACTIONS = {
  AUTH_START: 'AUTH_START',
  AUTH_SUCCESS: 'AUTH_SUCCESS',
  AUTH_ERROR: 'AUTH_ERROR',
  AUTH_LOGOUT: 'AUTH_LOGOUT',
  AUTH_PROFILE_LOADED: 'AUTH_PROFILE_LOADED'
};

// Reducer function
const authReducer = (state, action) => {
  switch (action.type) {
    case ACTIONS.AUTH_START:
      return {
        ...state,
        isLoading: true,
        error: null
      };
    case ACTIONS.AUTH_SUCCESS:
      return {
        ...state,
        isLoading: false,
        isAuthenticated: true,
        user: action.payload,
        error: null
      };
    case ACTIONS.AUTH_PROFILE_LOADED:
      return {
        ...state,
        profile: action.payload,
      };
    case ACTIONS.AUTH_ERROR:
      return {
        ...state,
        isLoading: false,
        isAuthenticated: false,
        error: action.payload
      };
    case ACTIONS.AUTH_LOGOUT:
      return {
        ...state,
        isLoading: false,
        isAuthenticated: false,
        user: null,
        profile: null
      };
    default:
      return state;
  }
};

// Provider component
export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Check if token is expired
  const isTokenExpired = useCallback((token) => {
    if (!token) return true;
    try {
      const decoded = jwtDecode(token);
      return decoded.exp < Date.now() / 1000;
    } catch {
      return true;
    }
  }, []);

  // Initialize auth state
  const initializeAuth = useCallback(async () => {
    dispatch({ type: ACTIONS.AUTH_START });
    try {
      const userData = JSON.parse(localStorage.getItem('user') || '{}');
      
      // Check if access token exists and is not expired
      if (userData.access_token && !isTokenExpired(userData.access_token)) {
        dispatch({ type: ACTIONS.AUTH_SUCCESS, payload: userData });
        
        // Load user profile
        try {
          const profile = await AuthService.getCurrentUser();
          if (profile) {
            dispatch({ type: ACTIONS.AUTH_PROFILE_LOADED, payload: profile });
          }
        } catch (profileError) {
          console.error('Failed to load profile:', profileError);
        }
      } else if (userData.refresh_token && !isTokenExpired(userData.refresh_token)) {
        // Try refreshing the token
        try {
          const refreshedUser = await AuthService.refreshToken();
          dispatch({ type: ACTIONS.AUTH_SUCCESS, payload: refreshedUser });
          
          // Load user profile
          const profile = await AuthService.getCurrentUser();
          if (profile) {
            dispatch({ type: ACTIONS.AUTH_PROFILE_LOADED, payload: profile });
          }
        } catch (refreshError) {
          dispatch({ type: ACTIONS.AUTH_LOGOUT });
        }
      } else {
        dispatch({ type: ACTIONS.AUTH_LOGOUT });
      }
    } catch (error) {
      dispatch({ type: ACTIONS.AUTH_ERROR, payload: error.message });
    }
  }, [isTokenExpired]);

  // Initialize auth on component mount
  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  // Login function
  const login = async (credentials) => {
    dispatch({ type: ACTIONS.AUTH_START });
    try {
      const userData = await AuthService.login(credentials);
      dispatch({ type: ACTIONS.AUTH_SUCCESS, payload: userData });
      
      // Load user profile
      const profile = await AuthService.getCurrentUser();
      if (profile) {
        dispatch({ type: ACTIONS.AUTH_PROFILE_LOADED, payload: profile });
      }
      
      return userData;
    } catch (error) {
      dispatch({ type: ACTIONS.AUTH_ERROR, payload: error.message || 'Login failed' });
      throw error;
    }
  };

  // Register function
  const register = async (userData) => {
    dispatch({ type: ACTIONS.AUTH_START });
    try {
      const response = await AuthService.register(userData);
      dispatch({ type: ACTIONS.AUTH_SUCCESS, payload: response });
      
      // Load user profile
      const profile = await AuthService.getCurrentUser();
      if (profile) {
        dispatch({ type: ACTIONS.AUTH_PROFILE_LOADED, payload: profile });
      }
      
      return response;
    } catch (error) {
      dispatch({ type: ACTIONS.AUTH_ERROR, payload: error.message || 'Registration failed' });
      throw error;
    }
  };

  // Logout function
  const logout = async () => {
    try {
      await AuthService.logout();
    } finally {
      dispatch({ type: ACTIONS.AUTH_LOGOUT });
    }
  };

  // Refresh token function
  const refreshToken = async () => {
    try {
      const refreshedUser = await AuthService.refreshToken();
      dispatch({ type: ACTIONS.AUTH_SUCCESS, payload: refreshedUser });
      return refreshedUser;
    } catch (error) {
      dispatch({ type: ACTIONS.AUTH_LOGOUT });
      throw error;
    }
  };

  const updateProfile = async (updates) => {
    try {
      const profile = await AuthService.updateProfile(updates);
      if (profile) {
        dispatch({ type: ACTIONS.AUTH_PROFILE_LOADED, payload: profile });
      }
      return profile;
    } catch (error) {
      const message = error?.response?.data?.msg || error?.message || 'Failed to update profile';
      throw new Error(message);
    }
  };

  // authFetch: wrapper around http client so components can use a consistent API
  const authFetch = useCallback(async (url, options = {}) => {
    // httpClient follows axios signature: (url, config)
    return httpClient(url, options);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        ...state,
        authFetch,
        login,
        register,
        logout,
        refreshToken,
        initializeAuth,
        updateProfile
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};