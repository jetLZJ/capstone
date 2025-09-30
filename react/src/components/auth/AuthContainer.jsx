import { useState } from 'react';
import LoginForm from './LoginForm';
import RegisterForm from './RegisterForm';

const AuthContainer = ({ onSuccess }) => {
  const [activeTab, setActiveTab] = useState('login');

  const handleTabChange = (tab) => {
    setActiveTab(tab);
  };

  return (
    <div className="w-full max-w-md mx-auto px-4 py-8 bg-[var(--app-surface)] rounded-lg shadow-md">
      <div className="flex mb-6 border-b">
        <button
          className={`flex-1 py-3 font-medium text-center ${
            activeTab === 'login'
              ? 'text-[var(--app-accent)] border-b-2 border-[var(--app-accent)]'
              : 'text-[var(--app-muted)] hover:text-[var(--app-text)]'
          }`}
          onClick={() => handleTabChange('login')}
        >
          Login
        </button>
        <button
          className={`flex-1 py-3 font-medium text-center ${
            activeTab === 'register'
              ? 'text-[var(--app-accent)] border-b-2 border-[var(--app-accent)]'
              : 'text-[var(--app-muted)] hover:text-[var(--app-text)]'
          }`}
          onClick={() => handleTabChange('register')}
        >
          Register
        </button>
      </div>

      {activeTab === 'login' ? (
        <LoginForm onSuccess={onSuccess} />
      ) : (
        <RegisterForm onSuccess={onSuccess} />
      )}
    </div>
  );
};

export default AuthContainer;