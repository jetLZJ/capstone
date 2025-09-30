import { useState, useEffect } from 'react';
import useAuth from '../hooks/useAuth';

const MenuPage = () => {
  const [menuItems, setMenuItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { authFetch } = useAuth();
  
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // Fetch menu items from API
        const menuResponse = await authFetch('/api/menu');
        const categoryResponse = await authFetch('/api/menu/categories');
        
        setMenuItems(menuResponse.data);
        setCategories(categoryResponse.data);
      } catch (err) {
        setError('Failed to load menu data');
        console.error('Error fetching menu data:', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [authFetch]);
  
  // Placeholder for actual implementation
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6 text-gray-900 dark:text-white">
        Menu Management
      </h1>
      
      {loading ? (
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary-500"></div>
        </div>
      ) : error ? (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6">
          <p>{error}</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Coming Soon</h2>
          <p className="text-gray-600 dark:text-gray-300">
            Menu management functionality is under development. Check back soon!
          </p>
        </div>
      )}
    </div>
  );
};

export default MenuPage;