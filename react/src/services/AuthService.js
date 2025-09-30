import axios from 'axios';

const API_URL = '/api';

/**
 * Authentication service for handling API requests related to user authentication
 */
const AuthService = {
  /**
   * Register a new user
   * @param {Object} userData - User registration data
   * @param {string} userData.email - User email
   * @param {string} userData.password - User password
   * @param {string} userData.first_name - User first name
   * @param {string} userData.last_name - User last name
   * @returns {Promise<Object>} Response containing tokens
   */
  register: async (userData) => {
    try {
      const response = await axios.post(`${API_URL}/auth/register`, userData);
      if (response.data.access_token) {
        localStorage.setItem('user', JSON.stringify(response.data));
      }
      return response.data;
    } catch (error) {
      throw error.response?.data?.msg || 'Registration failed';
    }
  },

  /**
   * Log in a user
   * @param {Object} credentials - Login credentials
   * @param {string} credentials.email - User email
   * @param {string} credentials.password - User password
   * @returns {Promise<Object>} Response containing tokens
   */
  login: async (credentials) => {
    try {
      const response = await axios.post(`${API_URL}/auth/login`, credentials);
      if (response.data.access_token) {
        localStorage.setItem('user', JSON.stringify(response.data));
      }
      return response.data;
    } catch (error) {
      throw error.response?.data?.msg || 'Login failed';
    }
  },

  /**
   * Refresh access token using refresh token
   * @returns {Promise<Object>} Response containing new access token
   */
  refreshToken: async () => {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const response = await axios.post(`${API_URL}/auth/refresh`, {}, {
        headers: { Authorization: `Bearer ${user.refresh_token}` }
      });
      if (response.data.access_token) {
        const updatedUser = { ...user, access_token: response.data.access_token };
        localStorage.setItem('user', JSON.stringify(updatedUser));
        return updatedUser;
      }
      return user;
    } catch (error) {
      // If refresh fails, logout the user
      AuthService.logout();
      throw error.response?.data?.msg || 'Token refresh failed';
    }
  },

  /**
   * Log out a user
   * @returns {Promise<void>}
   */
  logout: async () => {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      if (user.access_token) {
        await axios.delete(`${API_URL}/auth/logout`, {
          headers: { Authorization: `Bearer ${user.access_token}` }
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('user');
    }
  },

  /**
   * Get current user data
   * @returns {Promise<Object>} User profile data
   */
  getCurrentUser: async () => {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      if (!user.access_token) {
        return null;
      }

      const response = await axios.get(`${API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${user.access_token}` }
      });
      return response.data;
    } catch (error) {
      if (error.response?.status === 401) {
        // Try to refresh token on auth errors
        try {
          await AuthService.refreshToken();
          const user = JSON.parse(localStorage.getItem('user') || '{}');
          const response = await axios.get(`${API_URL}/auth/me`, {
            headers: { Authorization: `Bearer ${user.access_token}` }
          });
          return response.data;
        } catch (refreshError) {
          AuthService.logout();
          throw refreshError;
        }
      }
      throw error;
    }
  }
};

export default AuthService;