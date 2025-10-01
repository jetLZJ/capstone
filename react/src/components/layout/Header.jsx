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
    <header className="bg-[var(--app-surface)] shadow-md">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center py-4">
          {/* Logo */}
          <Link to="/" className="text-2xl font-bold text-[var(--app-accent)] font-serif">
            RestaurantManager
          </Link>
          
          {/* Desktop Navigation */}
          <nav className="hidden md:flex space-x-6 items-center">
            {isAuthenticated && (
              <>
                <Link to="/" className="text-[var(--app-text)] hover:text-[var(--app-accent)]">
                  Home
                </Link>
                <Link to="/menu" className="text-[var(--app-text)] hover:text-[var(--app-accent)]">
                  Menu
                </Link>
                <Link to="/schedule" className="text-[var(--app-text)] hover:text-[var(--app-accent)]">
                  Schedule
                </Link>
                <Link to="/analytics" className="text-[var(--app-text)] hover:text-[var(--app-accent)]">
                  Analytics
                </Link>
              </>
            )}
            
            <button 
              onClick={toggleDarkMode}
              className="text-[var(--app-text)] hover:text-[var(--app-accent)]"
              aria-label="Toggle dark mode"
            >
              {darkMode ? <FiSun size={20} /> : <FiMoon size={20} />}
            </button>
            
            {isAuthenticated ? (
              <div className="relative group">
                <button className="flex items-center space-x-2 text-[var(--app-text)] hover:text-[var(--app-accent)]">
                  <span>{profile?.first_name || 'User'}</span>
                </button>
                <div className="absolute right-0 w-48 mt-2 py-2 bg-[var(--app-surface)] rounded-md shadow-xl z-20 hidden group-hover:block">
                  <Link to="/profile" className="block px-4 py-2 text-sm text-[var(--app-text)] hover:bg-[var(--app-bg)]">
                    Profile
                  </Link>
                  <button 
                    onClick={logout}
                    className="block w-full text-left px-4 py-2 text-sm text-[var(--app-text)] hover:bg-[var(--app-bg)]"
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
            className="md:hidden text-[var(--app-text)]"
            onClick={toggleMenu}
            aria-label="Toggle menu"
          >
            {isOpen ? <FiX size={24} /> : <FiMenu size={24} />}
          </button>
        </div>
        
        {/* Mobile Navigation */}
          {isOpen && (
          <div className="md:hidden py-4 border-t">
            <div className="flex flex-col space-y-4">
              {isAuthenticated ? (
                <>
                  <Link to="/" className="text-[var(--app-text)] hover:text-[var(--app-accent)]">
                    Home
                  </Link>
                  <Link to="/menu" className="text-[var(--app-text)] hover:text-[var(--app-accent)]">
                    Menu
                  </Link>
                  <Link to="/schedule" className="text-[var(--app-text)] hover:text-[var(--app-accent)]">
                    Schedule
                  </Link>
                  <Link to="/analytics" className="text-[var(--app-text)] hover:text-[var(--app-accent)]">
                    Analytics
                  </Link>
                  <hr className="border-t" />
                  <Link to="/profile" className="text-[var(--app-text)] hover:text-[var(--app-accent)]">
                    Profile
                  </Link>
                  <button 
                    onClick={logout}
                    className="text-left text-[var(--app-text)] hover:text-[var(--app-accent)]"
                  >
                    Logout
                  </button>
                </>
              ) : (
                <Link to="/login" className="text-[var(--app-accent)]">
                  Login / Register
                </Link>
              )}
              
              <div className="flex items-center space-x-2">
                <button
                  onClick={toggleDarkMode}
                  className="text-[var(--app-text)] hover:text-[var(--app-accent)] dark:text-[var(--app-muted)] dark:hover:text-[var(--app-accent)]"
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