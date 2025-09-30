import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FiMenu, FiX, FiMoon, FiSun } from 'react-icons/fi';
import useAuth from '../../hooks/useAuth';

const Header = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const { isAuthenticated, logout, profile } = useAuth();
  
  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };
  
  const toggleDarkMode = () => {
    const newDarkMode = !darkMode;
    setDarkMode(newDarkMode);
    
    if (newDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };
  
  return (
    <header className="bg-white dark:bg-gray-800 shadow-md">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center py-4">
          {/* Logo */}
          <Link to="/" className="text-2xl font-bold text-primary-600 font-serif">
            RestaurantManager
          </Link>
          
          {/* Desktop Navigation */}
          <nav className="hidden md:flex space-x-6 items-center">
            {isAuthenticated && (
              <>
                <Link to="/" className="text-gray-700 hover:text-primary-600 dark:text-gray-300 dark:hover:text-primary-400">
                  Home
                </Link>
                <Link to="/menu" className="text-gray-700 hover:text-primary-600 dark:text-gray-300 dark:hover:text-primary-400">
                  Menu
                </Link>
                <Link to="/schedule" className="text-gray-700 hover:text-primary-600 dark:text-gray-300 dark:hover:text-primary-400">
                  Schedule
                </Link>
                <Link to="/analytics" className="text-gray-700 hover:text-primary-600 dark:text-gray-300 dark:hover:text-primary-400">
                  Analytics
                </Link>
              </>
            )}
            
            <button 
              onClick={toggleDarkMode}
              className="text-gray-700 hover:text-primary-600 dark:text-gray-300 dark:hover:text-primary-400"
              aria-label="Toggle dark mode"
            >
              {darkMode ? <FiSun size={20} /> : <FiMoon size={20} />}
            </button>
            
            {isAuthenticated ? (
              <div className="relative group">
                <button className="flex items-center space-x-2 text-gray-700 hover:text-primary-600 dark:text-gray-300">
                  <span>{profile?.first_name || 'User'}</span>
                </button>
                <div className="absolute right-0 w-48 mt-2 py-2 bg-white dark:bg-gray-800 rounded-md shadow-xl z-20 hidden group-hover:block">
                  <Link to="/profile" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700">
                    Profile
                  </Link>
                  <button 
                    onClick={logout}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                  >
                    Logout
                  </button>
                </div>
              </div>
            ) : (
              <Link to="/login" className="btn btn-primary">
                Login
              </Link>
            )}
          </nav>
          
          {/* Mobile Menu Button */}
          <button
            className="md:hidden text-gray-700 dark:text-gray-300"
            onClick={toggleMenu}
            aria-label="Toggle menu"
          >
            {isOpen ? <FiX size={24} /> : <FiMenu size={24} />}
          </button>
        </div>
        
        {/* Mobile Navigation */}
        {isOpen && (
          <div className="md:hidden py-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex flex-col space-y-4">
              {isAuthenticated ? (
                <>
                  <Link to="/" className="text-gray-700 hover:text-primary-600 dark:text-gray-300 dark:hover:text-primary-400">
                    Home
                  </Link>
                  <Link to="/menu" className="text-gray-700 hover:text-primary-600 dark:text-gray-300 dark:hover:text-primary-400">
                    Menu
                  </Link>
                  <Link to="/schedule" className="text-gray-700 hover:text-primary-600 dark:text-gray-300 dark:hover:text-primary-400">
                    Schedule
                  </Link>
                  <Link to="/analytics" className="text-gray-700 hover:text-primary-600 dark:text-gray-300 dark:hover:text-primary-400">
                    Analytics
                  </Link>
                  <hr className="border-gray-200 dark:border-gray-700" />
                  <Link to="/profile" className="text-gray-700 hover:text-primary-600 dark:text-gray-300 dark:hover:text-primary-400">
                    Profile
                  </Link>
                  <button 
                    onClick={logout}
                    className="text-left text-gray-700 hover:text-primary-600 dark:text-gray-300 dark:hover:text-primary-400"
                  >
                    Logout
                  </button>
                </>
              ) : (
                <Link to="/login" className="text-primary-600">
                  Login / Register
                </Link>
              )}
              
              <div className="flex items-center space-x-2">
                <button 
                  onClick={toggleDarkMode}
                  className="text-gray-700 hover:text-primary-600 dark:text-gray-300 dark:hover:text-primary-400"
                  aria-label="Toggle dark mode"
                >
                  {darkMode ? <FiSun size={20} /> : <FiMoon size={20} />}
                  <span className="ml-2">{darkMode ? 'Light Mode' : 'Dark Mode'}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;