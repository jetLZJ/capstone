import { Link } from 'react-router-dom';
import useAuth from '../hooks/useAuth';

const HomePage = () => {
  const { isAuthenticated, profile } = useAuth();

  return (
    <div className="mx-auto max-w-4xl">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4 text-gray-900 dark:text-white font-serif">
          Restaurant Management System
        </h1>
        <p className="text-xl text-gray-600 dark:text-gray-300">
          A complete solution for menu management, staff scheduling, and analytics
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
        {isAuthenticated ? (
          <div className="p-6">
            <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
              Welcome back, {profile?.first_name || 'User'}!
            </h2>
            <p className="mb-6 text-gray-600 dark:text-gray-300">
              Access your dashboard to manage your restaurant operations.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Link
                to="/menu"
                className="bg-primary-50 dark:bg-gray-700 p-6 rounded-lg shadow-sm hover:shadow-md transition"
              >
                <h3 className="text-lg font-bold mb-2 text-primary-700 dark:text-primary-300">Menu Management</h3>
                <p className="text-gray-600 dark:text-gray-400">View and manage menu items, categories, and pricing</p>
              </Link>
              <Link
                to="/schedule"
                className="bg-primary-50 dark:bg-gray-700 p-6 rounded-lg shadow-sm hover:shadow-md transition"
              >
                <h3 className="text-lg font-bold mb-2 text-primary-700 dark:text-primary-300">Staff Scheduling</h3>
                <p className="text-gray-600 dark:text-gray-400">Create and manage staff schedules and assignments</p>
              </Link>
              <Link
                to="/analytics"
                className="bg-primary-50 dark:bg-gray-700 p-6 rounded-lg shadow-sm hover:shadow-md transition"
              >
                <h3 className="text-lg font-bold mb-2 text-primary-700 dark:text-primary-300">Analytics</h3>
                <p className="text-gray-600 dark:text-gray-400">View insights about menu performance and staff utilization</p>
              </Link>
            </div>
          </div>
        ) : (
          <div className="p-6">
            <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
              Welcome to the Restaurant Management System
            </h2>
            <p className="mb-6 text-gray-600 dark:text-gray-300">
              Please login to access the full functionality of the system.
            </p>
            <Link to="/login" className="btn btn-primary">
              Login to Continue
            </Link>
          </div>
        )}
      </div>

      <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
          <h3 className="text-xl font-bold mb-2 text-gray-900 dark:text-white">Menu Features</h3>
          <ul className="list-disc list-inside text-gray-600 dark:text-gray-300 space-y-2">
            <li>Menu item management</li>
            <li>Category organization</li>
            <li>Image uploads</li>
            <li>Pricing and discounts</li>
            <li>Availability control</li>
          </ul>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
          <h3 className="text-xl font-bold mb-2 text-gray-900 dark:text-white">Scheduling Features</h3>
          <ul className="list-disc list-inside text-gray-600 dark:text-gray-300 space-y-2">
            <li>Weekly schedule creation</li>
            <li>Staff assignment</li>
            <li>Shift management</li>
            <li>Schedule viewing</li>
            <li>Shift coverage tracking</li>
          </ul>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
          <h3 className="text-xl font-bold mb-2 text-gray-900 dark:text-white">Analytics Features</h3>
          <ul className="list-disc list-inside text-gray-600 dark:text-gray-300 space-y-2">
            <li>Popular items tracking</li>
            <li>Staff scheduling analytics</li>
            <li>Menu pricing analytics</li>
            <li>System usage reports</li>
            <li>Real-time data visualization</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default HomePage;