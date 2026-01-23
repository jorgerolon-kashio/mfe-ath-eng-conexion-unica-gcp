import React from 'react';
import { useMsal, useAccount } from '@azure/msal-react';

const UserProfile: React.FC = () => {
  const { instance, accounts } = useMsal();
  const account = useAccount(accounts[0] || {});

  const handleLogout = () => {
    instance.logoutRedirect({
      postLogoutRedirectUri: window.location.origin,
    });
  };

  if (!account) {
    return null;
  }

  return (
    <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-background-light cursor-pointer transition-colors">
      <div className="size-10 rounded-full bg-cover bg-center border border-border-light" style={{ 
        backgroundImage: `url('https://ui-avatars.com/api/?name=${encodeURIComponent(account.name || account.username)}&background=0057FF&color=fff')` 
      }}></div>
      <div className="flex flex-col flex-1 min-w-0">
        <p className="text-sm font-bold text-text-main truncate">
          {account.name || account.username}
        </p>
        <p className="text-xs text-text-secondary truncate">
          {account.username}
        </p>
      </div>
      <button 
        onClick={handleLogout}
        className="text-text-secondary hover:text-text-main"
        title="Cerrar sesión"
      >
        <span className="material-symbols-outlined text-[20px]">logout</span>
      </button>
    </div>
  );
};

export default UserProfile;
