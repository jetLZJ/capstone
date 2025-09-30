import { useState } from 'react';
import LoginForm from './LoginForm';
import RegisterForm from './RegisterForm';

const AuthContainer = ({ onSuccess }) => {
  const [activeTab, setActiveTab] = useState('login');

  const handleTabChange = (tab) => {
    setActiveTab(tab);
  };

  return (
    <div className="w-full max-w-md mx-auto px-4 py-8 bg-white dark:bg-gray-800 rounded-lg shadow-md">
      <div className="flex mb-6 border-b dark:border-gray-700">
        <button
          className={`flex-1 py-3 font-medium text-center ${
            activeTab === 'login'
              ? 'text-primary-600 border-b-2 border-primary-600'
              : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
          onClick={() => handleTabChange('login')}
        >
          Login
        </button>
        <button
          className={`flex-1 py-3 font-medium text-center ${
            activeTab === 'register'
              ? 'text-primary-600 border-b-2 border-primary-600'
              : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
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