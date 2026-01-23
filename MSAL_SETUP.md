# Configuración de MSAL (Microsoft Authentication Library)

## Configuración Implementada

La autenticación con Microsoft está implementada usando `@azure/msal-browser` y `@azure/msal-react`.

### Credenciales Configuradas

- **Application ID (Client ID)**: `4c10af87-d1e8-4542-81c0-3da0383b7230`
- **Tenant ID**: `4cb14595-301a-44ee-af4e-33b9bb64c9c4`
- **Redirect URI**: Se configura automáticamente usando `window.location.origin`

### Archivos Creados

1. **`config/msalConfig.ts`**: Configuración de MSAL
2. **`components/Login.tsx`**: Componente de pantalla de login
3. **`components/UserProfile.tsx`**: Componente de perfil de usuario en el sidebar
4. **`index.tsx`**: Modificado para incluir `MsalProvider`
5. **`App.tsx`**: Modificado para proteger la aplicación con autenticación

## Configuración en Azure AD

Para que la autenticación funcione correctamente, necesitas configurar los **Redirect URIs** en Azure AD:

### Redirect URIs a Configurar

1. **Desarrollo Local**: `http://localhost:5173`
2. **Desarrollo (Cloud Run)**: `https://mfe-ath-eng-conexion-unica-gcp-215989210525.us-central1.run.app`
3. **Producción**: La URL base de tu aplicación en producción (ej: `https://tu-dominio.com`)

### Pasos para Configurar en Azure Portal

1. Ve a [Azure Portal](https://portal.azure.com)
2. Navega a **Azure Active Directory** > **App registrations**
3. Busca tu aplicación con el ID: `4c10af87-d1e8-4542-81c0-3da0383b7230`
4. Ve a **Authentication** en el menú lateral
5. En **Redirect URIs**, agrega:
   - `http://localhost:5173` (para desarrollo local)
   - `https://mfe-ath-eng-conexion-unica-gcp-215989210525.us-central1.run.app` (para desarrollo en Cloud Run)
   - Tu URL de producción (ej: `https://tu-dominio.com`)
6. Guarda los cambios

### Scopes Configurados

Actualmente se está usando el scope `User.Read` que permite leer el perfil básico del usuario. Si necesitas permisos adicionales, puedes agregarlos en `config/msalConfig.ts`:

```typescript
export const loginRequest: PopupRequest = {
  scopes: ['User.Read', 'email', 'profile'], // Agregar más scopes si es necesario
};
```

## Funcionalidad

- ✅ Login con Microsoft (popup)
- ✅ Logout
- ✅ Protección de rutas (solo usuarios autenticados pueden acceder)
- ✅ Perfil de usuario en el sidebar con información de Microsoft
- ✅ Manejo automático de tokens y sesiones

## Notas

- El `redirectUri` se configura automáticamente usando `window.location.origin`, por lo que funciona tanto en desarrollo como en producción sin cambios de código.
- Los tokens se almacenan en `sessionStorage` por defecto.
- Si tienes problemas con Safari, puedes cambiar `storeAuthStateInCookie` a `true` en `msalConfig.ts`.
