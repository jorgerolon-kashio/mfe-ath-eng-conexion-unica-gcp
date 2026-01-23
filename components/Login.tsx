import React, { useState } from 'react';
import { useMsal } from '@azure/msal-react';
import { loginRequest } from '../config/msalConfig';
import { InteractionStatus } from '@azure/msal-browser';

const Login: React.FC = () => {
  const { instance, inProgress } = useMsal();
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    // Prevenir múltiples clics mientras hay una interacción en curso
    if (inProgress !== InteractionStatus.None || isLoading) {
      console.log('Ya hay una interacción en curso, esperando...');
      return;
    }

    setIsLoading(true);
    try {
      // Verificar si ya hay una cuenta activa
      const accounts = instance.getAllAccounts();
      if (accounts.length > 0) {
        console.log('Ya hay una sesión activa');
        setIsLoading(false);
        return;
      }

      // Usar loginRedirect en lugar de loginPopup para evitar bloqueos de popups
      // Esto redirige a la página de Microsoft y luego vuelve a la app
      await instance.loginRedirect(loginRequest);
      // Nota: loginRedirect no retorna, redirige la página completa
    } catch (error: any) {
      // Ignorar errores específicos que son normales
      if (
        error.errorCode === 'interaction_in_progress' ||
        error.errorCode === 'block_nested_popups' ||
        error.errorCode === 'no_token_request_cache_error'
      ) {
        console.log('Interacción en curso o error esperado:', error.errorCode);
      } else {
        console.error('Error durante el login:', error);
        alert('Error al iniciar sesión. Por favor, intenta nuevamente.');
        setIsLoading(false);
      }
    }
  };

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark flex items-center justify-center">
      <div className="bg-white dark:bg-[#1a202c] rounded-xl border border-border-light shadow-lg p-8 max-w-md w-full">
        <div className="flex flex-col items-center gap-6">
          <div className="size-16 rounded bg-primary flex items-center justify-center text-white">
            <span className="material-symbols-outlined text-[40px]">verified_user</span>
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-text-main mb-2">Kashio Onboarding</h1>
            <p className="text-text-secondary text-sm">Inicia sesión con tu cuenta de Microsoft</p>
          </div>
          <button
            onClick={handleLogin}
            disabled={isLoading || inProgress !== InteractionStatus.None}
            className="w-full bg-primary hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 px-6 rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" viewBox="0 0 23 23" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M11.5 0C5.149 0 0 5.149 0 11.5S5.149 23 11.5 23 23 17.851 23 11.5 17.851 0 11.5 0z" fill="#F25022"/>
              <path d="M11.5 0C5.149 0 0 5.149 0 11.5S5.149 23 11.5 23 23 17.851 23 11.5 17.851 0 11.5 0z" fill="#7FBA00"/>
              <path d="M11.5 0C5.149 0 0 5.149 0 11.5S5.149 23 11.5 23 23 17.851 23 11.5 17.851 0 11.5 0z" fill="#00A4EF"/>
              <path d="M11.5 0C5.149 0 0 5.149 0 11.5S5.149 23 11.5 23 23 17.851 23 11.5 17.851 0 11.5 0z" fill="#FFB900"/>
            </svg>
            {isLoading || inProgress !== InteractionStatus.None ? 'Iniciando sesión...' : 'Iniciar sesión con Microsoft'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;
