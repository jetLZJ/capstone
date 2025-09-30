import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import AuthContainer from '../components/auth/AuthContainer';
import useAuth from '../hooks/useAuth';

const LoginPage = () => {
  const { isAuthenticated } = useAuth();
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

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh]">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold mb-2 text-primary-600 font-serif">Welcome to Restaurant Manager</h1>
        <p className="text-gray-600 dark:text-gray-400">Please login or register to continue</p>
      </div>
      <AuthContainer onSuccess={handleAuthSuccess} />
    </div>
  );
};

export default LoginPage;