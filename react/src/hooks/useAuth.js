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
  return context;
};

export default useAuth;