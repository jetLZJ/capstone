import React from 'react';

const DemoLoginPanel = ({ demoUsers = [], onQuickLogin = () => {} }) => {
  return (
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
