
import React from 'react';
import ReactDOM from 'react-dom/client';
import { PublicClientApplication } from '@azure/msal-browser';
import { MsalProvider } from '@azure/msal-react';
import { msalConfig } from './config/msalConfig';
import App from './App';

// Crear instancia de MSAL
const msalInstance = new PublicClientApplication(msalConfig);

// Inicializar MSAL y manejar redirects pendientes
msalInstance.initialize().then(() => {
  // Manejar cualquier redirect pendiente antes de renderizar
  msalInstance.handleRedirectPromise().then((response) => {
    if (response) {
      console.log('Login redirect completado:', response);
    }
  }).catch((error) => {
    console.error('Error en redirect:', error);
  });

  const rootElement = document.getElementById('root');
  if (!rootElement) {
    throw new Error("Could not find root element to mount to");
  }

  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <MsalProvider instance={msalInstance}>
        <App />
      </MsalProvider>
    </React.StrictMode>
  );
});
