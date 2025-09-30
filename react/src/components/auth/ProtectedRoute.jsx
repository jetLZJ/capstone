import { Navigate, useLocation } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';

/**
 * Component for protecting routes that require authentication
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Child components to render if authenticated
 * @param {string[]} [props.allowedRoles] - Optional array of roles allowed to access the route
 * @returns {React.ReactNode} Protected route or redirect to login
 */
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { isAuthenticated, isLoading, profile } = useAuth();
  const location = useLocation();

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-gray-300 border-t-primary-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">Loading...</p>
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check role-based access if roles are provided
  if (allowedRoles && profile) {
    const userRole = profile.role || '';
    if (!allowedRoles.includes(userRole)) {
      return <Navigate to="/unauthorized" replace />;
    }
  }

  // Render children if all checks pass
  return children;
};

export default ProtectedRoute;