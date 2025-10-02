import React from 'react';

const DemoLoginPanel = ({ demoUsers = [], onQuickLogin = () => {} }) => {
  return (
    <div className="space-y-3">
      {demoUsers.map((u) => (
        <div key={u.email} className="flex items-center justify-between bg-[var(--app-surface)] p-3 rounded">
          <div>
            <div className="text-sm font-semibold">{u.role}</div>
            <div className="text-xs text-[var(--app-muted)]">{u.email}</div>
          </div>
          <div>
            <button
              className="btn btn-outline btn-sm"
              onClick={() => onQuickLogin(u.email)}
            >
              Quick Login
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default DemoLoginPanel;
