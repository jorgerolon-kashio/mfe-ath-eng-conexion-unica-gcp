import { Configuration, PopupRequest } from '@azure/msal-browser';

// Configuración de MSAL
export const msalConfig: Configuration = {
  auth: {
    clientId: '4c10af87-d1e8-4542-81c0-3da0383b7230', // Application ID
    authority: 'https://login.microsoftonline.com/4cb14595-301a-44ee-af4e-33b9bb64c9c4', // Tenant ID
    redirectUri: window.location.origin, // Path principal del frontend (se adapta automáticamente)
  },
  cache: {
    cacheLocation: 'sessionStorage', // Opciones: 'sessionStorage' o 'localStorage'
    storeAuthStateInCookie: false, // Establecer en true si tienes problemas con Safari
  },
  system: {
    allowNativeBroker: false, // Deshabilitar broker nativo para evitar conflictos
    loggerOptions: {
      loggerCallback: (level, message, containsPii) => {
        if (containsPii) {
          return;
        }
        // Solo loguear errores en producción
        if (level === 0) { // Error
          console.error('MSAL Error:', message);
        }
      },
      logLevel: 0, // Error level only
    },
  },
};

// Scopes que la aplicación necesita
export const loginRequest: PopupRequest = {
  scopes: ['User.Read'], // Permisos básicos de lectura del perfil de usuario
};

// Configuración para obtener el token silenciosamente
export const graphConfig = {
  graphMeEndpoint: 'https://graph.microsoft.com/v1.0/me',
};
