import { useState } from 'react';
import LoginForm from './LoginForm';
import RegisterForm from './RegisterForm';

const AuthContainer = ({
  onSuccess,
  role = 'user',
  demo = null,
  onQuickLogin = null,
  title,
  subtitle,
}) => {
  const [activeTab, setActiveTab] = useState('login');
  const roleKey = role?.toString().toLowerCase();
  const allowRegister = roleKey === 'user';

  const handleTabChange = (tab) => {
    setActiveTab(tab);
  };

  return (
    <div className={`${allowRegister ? 'w-full max-w-md mx-auto px-5 py-7' : 'w-full max-w-sm mx-auto px-6 py-10 text-center'} bg-[var(--app-surface)] rounded-3xl shadow-lg border border-[rgba(15,23,42,0.05)]`}>

      {/* title/subtitle */}
      {typeof title !== 'undefined' && (
        <div className="mb-6">
          <h2 className="text-3xl font-semibold text-[var(--app-text)]">{title}</h2>
          {typeof subtitle !== 'undefined' && <p className="text-[var(--app-muted)] mt-1">{subtitle}</p>}
        </div>
      )}

      <div className="flex mb-6 justify-center">
        <div className="inline-flex rounded-full bg-[var(--app-bg)] p-1">
          <button
            className={`px-6 py-2 rounded-full font-medium transition-colors ${activeTab === 'login' ? 'bg-white text-[var(--app-primary)] shadow-sm' : 'text-[var(--app-muted)] hover:text-[var(--app-primary)]'}`}
            onClick={() => handleTabChange('login')}
          >
            Sign In
          </button>
          {allowRegister && (
            <button
              className={`px-6 py-2 rounded-full font-medium transition-colors ${activeTab === 'register' ? 'bg-white text-[var(--app-primary)] shadow-sm' : 'text-[var(--app-muted)] hover:text-[var(--app-primary)]'}`}
              onClick={() => handleTabChange('register')}
            >
              Register
            </button>
          )}
        </div>
      </div>

      {activeTab === 'login' ? (
        <LoginForm onSuccess={onSuccess} role={roleKey} />
      ) : (
        <RegisterForm onSuccess={onSuccess} />
      )}

      {/* demo block below when provided */}
      {demo && (
        <div className="mt-6 text-center text-[var(--app-muted)]">
          {Array.isArray(demo) ? (
            <div className="space-y-3">
              {demo.map((d) => (
                <div key={d.email} className="flex items-center justify-between bg-[var(--app-surface)] p-3 rounded">
                  <div>
                    <div className="text-sm font-semibold text-[var(--app-text)]">{d.role}</div>
                    <div className="text-xs text-[var(--app-muted)]">{d.email}</div>
                  </div>
                  <div>
                    {onQuickLogin && (
                      <button className="btn btn-outline btn-sm" onClick={() => onQuickLogin(d.email)}>Quick Login</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div>
              <div className="text-sm mb-2">Demo credentials</div>
              <div className="text-sm">Email: <span className="font-medium text-[var(--app-text)]">{demo.email}</span></div>
              <div className="text-sm mb-3">Password: <span className="font-medium text-[var(--app-text)]">{demo.password}</span></div>
              {onQuickLogin && (
                <button className="btn btn-outline btn-sm" onClick={() => onQuickLogin(demo.email)}>Quick Login as Demo</button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AuthContainer;