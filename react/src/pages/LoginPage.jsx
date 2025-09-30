import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import AuthContainer from '../components/auth/AuthContainer';
import useAuth from '../hooks/useAuth';
import { toast } from 'react-toastify';

const demoUsers = [
  { role: 'Admin', email: 'alice.admin@example.com' },
  { role: 'Manager', email: 'maya.manager@example.com' },
  { role: 'Staff', email: 'sam.staff@example.com' },
  { role: 'User', email: 'user1@example.com' },
];

const LoginPage = () => {
  const { isAuthenticated, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || '/';

  useEffect(() => {
    if (isAuthenticated) {
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, from]);

  const handleAuthSuccess = () => {
    navigate(from, { replace: true });
  };

  const handleQuickLogin = async (email) => {
    try {
      await login({ email, password: 'password' });
      toast.success(`Logged in as ${email}`);
      navigate(from, { replace: true });
    } catch (err) {
      console.error('Quick login failed', err);
      toast.error('Quick login failed');
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[80vh] px-4">
      <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
        <div className="px-6 py-8 bg-gradient-to-br from-white/60 to-primary-50/20 rounded-lg shadow-md">
          <h1 className="text-4xl font-extrabold mb-3 text-primary-600">Welcome to Restaurant Manager</h1>
          <p className="text-gray-700 dark:text-gray-300 mb-6">Manage your menu, shifts, and analytics in one place. Use the demo credentials below to quickly test different roles.</p>

          <div className="space-y-3">
            {demoUsers.map((u) => (
              <div key={u.email} className="flex items-center justify-between bg-white dark:bg-gray-800 p-3 rounded">
                <div>
                  <div className="text-sm font-semibold">{u.role}</div>
                  <div className="text-xs text-gray-500">{u.email}</div>
                </div>
                <div>
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={() => handleQuickLogin(u.email)}
                  >
                    Quick Login
                  </button>
                </div>
              </div>
            ))}
          </div>

          <p className="mt-6 text-xs text-gray-500">Note: demo password is <strong>password</strong>. These accounts are for local testing only.</p>
        </div>

        <div className="px-4">
          <AuthContainer onSuccess={handleAuthSuccess} />
        </div>
      </div>
    </div>
  );
};

export default LoginPage;