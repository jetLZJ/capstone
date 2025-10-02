import { Link, Navigate } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import AdminDashboard from '../components/dashboard/AdminDashboard';
import ManagerDashboard from '../components/dashboard/ManagerDashboard';
import StaffDashboard from '../components/dashboard/StaffDashboard';

const HomePage = () => {
  const { isAuthenticated, profile, isLoading } = useAuth();
  const role = (profile?.role || '').toLowerCase();

  if (isAuthenticated && role === 'user') {
    return <Navigate to="/menu" replace />;
  }

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="text-center max-w-3xl mx-auto mb-10">
          <h1 className="text-4xl md:text-6xl font-extrabold mb-4 text-[var(--app-text)] font-serif">Bella Vista</h1>
          <p className="text-lg md:text-xl text-[var(--app-muted)]">Experience culinary excellence in the heart of the city. Choose how you'd like to access our restaurant system.</p>
        </div>
        <div className="max-w-5xl mx-auto grid grid-cols-1 gap-8 md:grid-cols-2">
          <div className="rounded-xl bg-[var(--app-surface)] p-8 shadow-lg">
            <h3 className="text-xl font-semibold mb-3 text-[var(--app-text)]">Customer Access</h3>
            <p className="text-[var(--app-muted)] mb-6">Browse our menu, place orders, and enjoy a seamless dining experience.</p>
            <Link
              to="/login"
              state={{ role: 'User' }}
              className="inline-block rounded-lg bg-app-primary px-6 py-3 text-center font-medium text-app-primary-contrast shadow-md transition hover:opacity-95"
            >
              Customer Login
            </Link>
          </div>
          <div className="rounded-xl bg-[var(--app-surface)] p-8 shadow-lg">
            <h3 className="text-xl font-semibold mb-3 text-[var(--app-text)]">Staff Access</h3>
            <p className="text-[var(--app-muted)] mb-6">Access management tools, scheduling, and restaurant operations.</p>
            <Link
              to="/login"
              state={{ role: 'Staff' }}
              className="inline-block rounded-lg border border-[rgba(0,0,0,0.08)] px-6 py-3 text-center font-medium text-app-text transition hover:border-[var(--app-primary)]"
            >
              Staff Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading && !profile) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-12 text-center text-[var(--app-muted)]">
        Loading your dashboard…
      </div>
    );
  }

  const normalizedRole = role || 'staff';
  const staffRoles = new Set(['staff', 'server', 'kitchen', 'chef', 'bar', 'bartender']);

  let dashboard = null;
  if (normalizedRole === 'admin') {
    dashboard = <AdminDashboard />;
  } else if (normalizedRole === 'manager') {
    dashboard = <ManagerDashboard />;
  } else if (staffRoles.has(normalizedRole)) {
    dashboard = <StaffDashboard />;
  } else {
    dashboard = (
      <div className="rounded-3xl border border-[rgba(15,23,42,0.08)] bg-[var(--app-surface)] p-6 text-[var(--app-text)] shadow-sm">
        <h2 className="text-2xl font-semibold">Welcome back!</h2>
        <p className="mt-2 text-[var(--app-muted)]">Select an area from the navigation to get started.</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link to="/menu" className="btn btn-primary">Menu</Link>
          <Link to="/schedule" className="btn btn-outline">Schedule</Link>
          <Link to="/analytics" className="btn btn-outline">Analytics</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-[var(--app-bg)] py-10">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        {dashboard}
      </div>
    </div>
  );
};

export default HomePage;