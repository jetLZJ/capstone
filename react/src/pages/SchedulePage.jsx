import { useState, useEffect } from 'react';
import useAuth from '../hooks/useAuth';

const SchedulePage = () => {
  const [schedules, setSchedules] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { authFetch } = useAuth();
  
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // Fetch schedule data from API
        const scheduleResponse = await authFetch('/api/schedules');
        const staffResponse = await authFetch('/api/staff');
        
        setSchedules(scheduleResponse.data);
        setStaff(staffResponse.data);
      } catch (err) {
        setError('Failed to load schedule data');
        console.error('Error fetching schedule data:', err);
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
        Staff Scheduling
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
            Staff scheduling functionality is under development. Check back soon!
          </p>
        </div>
      )}
    </div>
  );
};

export default SchedulePage;