import { Link, Navigate } from 'react-router-dom';
import useAuth from '../hooks/useAuth';

const HomePage = () => {
  const { isAuthenticated, profile } = useAuth();

  if (isAuthenticated && (profile?.role || '').toLowerCase() === 'user') {
    return <Navigate to="/menu" replace />;
  }

  return (
    <div className="container mx-auto px-4 py-12">
      {/* Hero */}
      <div className="text-center max-w-3xl mx-auto mb-10">
        <h1 className="text-4xl md:text-6xl font-extrabold mb-4 text-[var(--app-text)] font-serif">Bella Vista</h1>
        <p className="text-lg md:text-xl text-[var(--app-muted)]">Experience culinary excellence in the heart of the city. Choose how you'd like to access our restaurant system.</p>
      </div>

      {/* Access Cards */}
      {!isAuthenticated ? (
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-[var(--app-surface)] p-8 rounded-xl shadow-lg">
            <h3 className="text-xl font-semibold mb-3 text-[var(--app-text)]">Customer Access</h3>
            <p className="text-[var(--app-muted)] mb-6">Browse our menu, place orders, and enjoy a seamless dining experience.</p>
            <Link
              to="/login"
              state={{ role: 'User' }}
              className="inline-block bg-app-primary text-app-primary-contrast px-6 py-3 rounded-lg text-center font-medium hover:opacity-95 transition-shadow shadow-md"
            >
              Customer Login
            </Link>
          </div>

          <div className="bg-[var(--app-surface)] p-8 rounded-xl shadow-lg">
            <h3 className="text-xl font-semibold mb-3 text-[var(--app-text)]">Staff Access</h3>
            <p className="text-[var(--app-muted)] mb-6">Access management tools, scheduling, and restaurant operations.</p>
            <Link
              to="/login"
              state={{ role: 'Staff' }}
              className="inline-block bg-app-surface text-app-text border border-[rgba(0,0,0,0.08)] px-6 py-3 rounded-lg text-center font-medium hover:bg-[color-mix(in_srgb,var(--app-surface) 90%, var(--app-bg) 10%)] transition"
            >
              Staff Login
            </Link>
          </div>
        </div>
      ) : (
        <div className="max-w-4xl mx-auto bg-[var(--app-surface)] rounded-xl shadow-md p-6">
          <h2 className="text-2xl font-bold mb-2 text-[var(--app-text)]">Welcome back, {profile?.first_name || 'User'}!</h2>
          <p className="text-[var(--app-muted)] mb-4">Use the navigation to access Menu, Schedule, and Analytics.</p>
          <div className="flex gap-3">
            <Link to="/menu" className="btn btn-primary">Menu</Link>
            <Link to="/schedule" className="btn btn-outline">Schedule</Link>
            <Link to="/analytics" className="btn btn-outline">Analytics</Link>
          </div>
        </div>
      )}

    </div>
  );
};

export default HomePage;