import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import { FaUser, FaBars, FaTimes, FaSignOutAlt } from 'react-icons/fa';

const Header = () => {
  const { isAuthenticated, profile, logout } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const navigate = useNavigate();

  const role = (profile?.role || '').toLowerCase();
  const isManagerOrAdmin = ['manager', 'admin'].includes(role);
  const isStaffOnly = ['staff', 'server'].includes(role) && !isManagerOrAdmin;
  const isUserRole = role === 'user';

  const navItems = (() => {
    if (isStaffOnly) {
      return [{ label: 'Schedule', to: '/schedule' }];
    }

    const base = [
      { label: 'Home', to: '/' },
      { label: 'Menu', to: '/menu' },
    ];

    if (isAuthenticated) {
      base.push({ label: 'Schedule', to: '/schedule' });
      base.push({ label: 'Analytics', to: '/analytics' });
    }

    return base;
  })();

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const toggleProfileDropdown = () => {
    setIsProfileDropdownOpen(!isProfileDropdownOpen);
  };

  const handleLogout = async () => {
    setIsProfileDropdownOpen(false);
    setIsMenuOpen(false);
    await logout();
    navigate('/');
  };

  return (
  <header className="bg-[var(--app-surface)] dark:bg-[var(--app-surface)] shadow-md">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="text-2xl font-bold text-[var(--app-accent)] font-serif">
            Restaurant Manager
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex space-x-6">
            {navItems.map((item) => (
              <Link key={item.to} to={item.to} className="text-[var(--app-text)] hover:text-[var(--app-accent)] transition">
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Authentication */}
          <div className="hidden md:flex items-center space-x-4">
            {isAuthenticated ? (
              <div className="relative">
                <button
                  className="flex items-center space-x-2 focus:outline-none"
                  onClick={toggleProfileDropdown}
                >
                  <div className="bg-[var(--app-primary)] text-[var(--app-primary-contrast)] p-2 rounded-full">
                    <FaUser />
                  </div>
                  <span className="text-[var(--app-text)]">
                    {profile?.first_name || 'User'}
                  </span>
                </button>

                {/* Profile Dropdown */}
                {isProfileDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-[var(--app-surface)] z-10">
                    <div className="py-1">
                      {isUserRole ? (
                        <Link
                          to="/profile"
                          className="block px-4 py-2 text-sm text-[var(--app-text)] hover:bg-[var(--app-bg)]"
                          onClick={() => setIsProfileDropdownOpen(false)}
                        >
                          Profile
                        </Link>
                      ) : null}
                      <button
                        className="flex items-center w-full px-4 py-2 text-sm text-[var(--app-text)] hover:bg-[var(--app-bg)]"
                        onClick={handleLogout}
                      >
                        <FaSignOutAlt className="mr-2" />
                        Logout
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <Link
                to="/login"
                className="btn btn-primary"
              >
                Login
              </Link>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden text-[var(--app-text)] focus:outline-none"
            onClick={toggleMenu}
          >
            {isMenuOpen ? <FaTimes size={24} /> : <FaBars size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation */}
      {isMenuOpen && (
        <div className="md:hidden bg-[var(--app-surface)] py-3 px-4 border-t">
          <nav className="flex flex-col space-y-3">
            {navItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="text-[var(--app-text)] hover:text-[var(--app-accent)] transition"
                onClick={() => setIsMenuOpen(false)}
              >
                {item.label}
              </Link>
            ))}
            {isAuthenticated ? (
              <>
                {isUserRole ? (
                  <Link
                    to="/profile"
                    className="text-[var(--app-text)] hover:text-[var(--app-accent)] transition"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Profile
                  </Link>
                ) : null}
                <button
                  className="flex items-center text-left text-[var(--app-text)] hover:text-[var(--app-accent)] transition"
                  onClick={() => {
                    handleLogout();
                    setIsMenuOpen(false);
                  }}
                >
                  <FaSignOutAlt className="mr-2" />
                  Logout
                </button>
              </>
            ) : (
              <Link
                to="/login"
                className="btn btn-primary"
                onClick={() => setIsMenuOpen(false)}
              >
                Login
              </Link>
            )}
          </nav>
        </div>
      )}
    </header>
  );
};

export default Header;