import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Header from './Header';

const MainLayout = ({ children }) => {
  const location = useLocation();
  const [isAuthPage, setIsAuthPage] = useState(false);

  useEffect(() => {
    // Check if current page is login or register
    const authPages = ['/login', '/register'];
    setIsAuthPage(authPages.includes(location.pathname));
  }, [location]);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {!isAuthPage && <Header />}
      
      <main className={`flex-grow ${!isAuthPage ? 'container mx-auto px-4 py-6' : ''}`}>
        {children}
      </main>
      
      {!isAuthPage && (
        <footer className="bg-white dark:bg-gray-800 shadow-inner py-4">
          <div className="container mx-auto px-4 text-center text-gray-600 dark:text-gray-400">
            <p>&copy; {new Date().getFullYear()} Restaurant Management System</p>
          </div>
        </footer>
      )}
    </div>
  );
};

export default MainLayout;