// Solo necesitamos la URL del BFF por entorno
// El BFF maneja toda la configuración de microservicios y autenticación
// La URL del BFF se puede configurar mediante variable de entorno VITE_BFF_URL
// Si no está definida, se usa LOCAL por defecto
export const BFF_URLS = {
  "LOCAL": "http://localhost:3003",
  "d1": "http://localhost:3003", // El servicio local se conecta a d1
  "q3": "http://localhost:3003", // El servicio local se conecta a q3
};

// Obtener URL del BFF desde variable de entorno o usar LOCAL por defecto
export function getBffUrl(): string {
  // Prioridad: VITE_BFF_URL > VITE_ENVIRONMENT > LOCAL
  if (import.meta.env.VITE_BFF_URL) {
    return import.meta.env.VITE_BFF_URL;
  }
  
  const env = import.meta.env.VITE_ENVIRONMENT || 'LOCAL';
  return BFF_URLS[env as keyof typeof BFF_URLS] || BFF_URLS.LOCAL;
}

// Configuraciones de KSEC por entorno (solo para roles y productos)
export const ENV_CONFIGURATIONS: Record<string, { ksec_admin_role: string, configuraciones: any[] }> = {
  LOCAL: {
    ksec_admin_role: "rol_ksec_GUTTz56osMjZoLVG7M4o5C",
    configuraciones: [
      { nombre: 'Conectividad', rol_public_id: 'evt_seg7nbSyvFsdBqKu4MkdfdfDqgnjLK', product_public_id: 'evt_testhZkSnjqtboCWsdsDfkqpxYUk' }
    ]
  },
  d1: {
    ksec_admin_role: "rol_ksec_GUTTz56osMjZoLVG7M4o5C",
    configuraciones: [
      { nombre: 'Conectividad', rol_public_id: 'evt_seg7nbSyvFsdBqKu4MkdfdfDqgnjLK', product_public_id: 'evt_testhZkSnjqtboCWsdsDfkqpxYUk' },
      { nombre: 'Análisis de datos', rol_public_id: 'evt_seg7nbSyvFsdBqKu4MkdfdfDqkmlO', product_public_id: 'evt_testhZkSnjqtboCWsdsDfkqpxXCa' }
    ]
  },
  q3: {
    ksec_admin_role: "rol_ksec_GUTTz56osMjZoLVG7M4o5C",
    configuraciones: [
      { nombre: 'Conectividad', rol_public_id: 'evt_seg7nbSyvFsdBqKu4MkdfdfDqgnjLK', product_public_id: 'evt_testhZkSnjqtboCWsdsDfkqpxYUk' }
    ]
  }
};
