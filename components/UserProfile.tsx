import React from 'react';
import { useMsal, useAccount } from '@azure/msal-react';

const UserProfile: React.FC = () => {
  const { instance } = useMsal();
  const account = useAccount(null);

  const handleLogout = () => {
    instance.logoutRedirect({
      postLogoutRedirectUri: window.location.origin,
    });
  };

  // En LOCAL no hay autenticación, mostrar placeholder
  if (!account) {
    return (
      <div className="flex items-center gap-3">
        <div className="size-9 rounded-full bg-primary/10 border border-border-light flex items-center justify-center">
          <span className="material-symbols-outlined text-primary text-[18px]">person</span>
        </div>
        <div className="flex flex-col min-w-0">
          <p className="text-sm font-bold text-text-main">Usuario Local</p>
          <p className="text-xs text-text-secondary">Modo desarrollo</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2">
        <div className="size-9 rounded-full bg-cover bg-center border border-border-light" style={{ 
          backgroundImage: `url('https://ui-avatars.com/api/?name=${encodeURIComponent(account.name || account.username)}&background=0057FF&color=fff')` 
        }}></div>
        <div className="flex flex-col min-w-0">
          <p className="text-sm font-bold text-text-main truncate">
            {account.name || account.username}
          </p>
          <p className="text-xs text-text-secondary truncate">
            {account.username}
          </p>
        </div>
      </div>
      <button 
        onClick={handleLogout}
        className="ml-2 p-2 rounded-lg text-text-secondary hover:text-text-main hover:bg-background-light transition-colors"
        title="Cerrar sesión"
      >
        <span className="material-symbols-outlined text-[20px]">logout</span>
      </button>
    </div>
  );
};

export default UserProfile;
