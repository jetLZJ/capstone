import { useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
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

  const roleFromState = location.state?.role;
  const qs = new URLSearchParams(location.search);
  const roleParam = qs.get('role');
  const role = (roleFromState || roleParam || 'User').toString();
  const roleKey = role?.toLowerCase() || 'user';
  const defaultLanding = roleKey === 'user' ? '/menu' : '/';
  const from = location.state?.from?.pathname || defaultLanding;
  const isUser = roleKey === 'user';

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
    <div className="flex min-h-[80vh] px-4 py-12">
      <div className="mx-auto w-full max-w-lg">
        {isUser && (
          <div className="mb-4 pl-5">
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-sm font-medium text-[var(--app-text)] hover:text-[var(--app-primary)] transition-colors"
            >
              <span aria-hidden="true">←</span>
              <span>Back to Welcome</span>
            </Link>
          </div>
        )}
        <AuthContainer
          onSuccess={handleAuthSuccess}
          role={roleKey}
          title={isUser ? 'Customer Portal' : 'Staff Portal'}
          subtitle={isUser ? 'Sign in to your account or create a new one' : 'Access restaurant management systems'}
          demo={isUser ? { email: 'user1@example.com', password: 'password' } : demoUsers.filter((u) => u.role.toLowerCase() !== 'user')}
          onQuickLogin={(email) => handleQuickLogin(email)}
        />
      </div>
    </div>
  );
};

export default LoginPage;