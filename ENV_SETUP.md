# Configuración de Variables de Entorno

El frontend se conecta al BFF mediante variables de entorno. El BFF maneja toda la configuración de microservicios y autenticación.

## Variables de Entorno

Crea un archivo `.env` en la raíz del proyecto con las siguientes variables:

```env
# URL del BFF (Backend for Frontend)
# Si no se especifica, se usa http://localhost:3007 (LOCAL)
VITE_BFF_URL=http://localhost:3007

# Entorno (opcional, solo si no se especifica VITE_BFF_URL)
# Valores: LOCAL, d1, q3
# Si no se especifica, se usa LOCAL por defecto
VITE_ENVIRONMENT=LOCAL
```

## Prioridad de Configuración

1. **VITE_BFF_URL** (máxima prioridad): Si está definida, se usa directamente esta URL
2. **VITE_ENVIRONMENT**: Si no hay VITE_BFF_URL, se usa el environment para buscar la URL en `BFF_URLS`
3. **LOCAL** (por defecto): Si no hay ninguna variable, se usa `http://localhost:3007`

## Ejemplos

### Desarrollo Local
```env
VITE_BFF_URL=http://localhost:3007
```

### Desarrollo (d1)
```env
VITE_ENVIRONMENT=d1
```

O directamente:
```env
VITE_BFF_URL=https://d1-api.kashio-dev.net
```

### QA (q3)
```env
VITE_ENVIRONMENT=q3
```

O directamente:
```env
VITE_BFF_URL=https://q1-api.kashio-dev.net
```

## Notas

- Las variables de entorno en Vite deben comenzar con `VITE_` para ser accesibles en el código
- Después de cambiar las variables de entorno, reinicia el servidor de desarrollo (`npm run dev`)
- El archivo `.env` está en `.gitignore` y no se commitea al repositorio


