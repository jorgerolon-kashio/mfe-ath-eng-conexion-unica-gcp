
import { EnvironmentConfig } from '../types';

export class KashioApiService {
  private config: EnvironmentConfig;
  private isMock: boolean = true;

  constructor(config: EnvironmentConfig, isMock: boolean = true) {
    this.config = config;
    this.isMock = isMock;
  }

  /**
   * Maps service names and endpoints to BFF proxy endpoints
   * All requests go through the BFF proxy pattern: /api/v1/:service/*
   * The BFF will forward the request to the appropriate microservice
   */
  private getBffEndpoint(service: string, endpoint: string): string {
    // Map service names to BFF service identifiers
    const serviceMap: Record<string, string> = {
      'KBRM': 'kbrm',
      'KSEC': 'ksec',
      'KPSP': 'kpsp',
      'KCORE_CUS': 'kcore-cus',
      'KCORE_ACC': 'kcore-acc',
      'KCORE_CNF': 'kcore-cnf'
    };
    
    const servicePath = serviceMap[service] || service.toLowerCase();
    
    // Extract query params if present
    const [endpointPath, queryParams] = endpoint.split('?');
    
    // Check for composite endpoints first (support both full and simplified paths)
    if ((endpointPath === '/organizations/complete' || endpointPath === '/kbrm/v2/organizations/complete') && service === 'KBRM') {
      return queryParams ? `/api/v1/organizations/complete?${queryParams}` : '/api/v1/organizations/complete';
    }
    if ((endpointPath === '/users/complete' || endpointPath === '/ksec/v1/users/complete') && service === 'KSEC') {
      return queryParams ? `/api/v1/users/complete?${queryParams}` : '/api/v1/users/complete';
    }
    
    // Check for direct BFF endpoints (optimized paths for common operations)
    // These are handled by specific controllers in the BFF
    if (endpointPath === '/kbrm/v2/organizations' && service === 'KBRM') {
      return queryParams ? `/api/v1/organizations?${queryParams}` : '/api/v1/organizations';
    }
    // Handle organizations with public_id (GET, PUT, DELETE)
    if (endpointPath.startsWith('/kbrm/v2/organizations/') && service === 'KBRM') {
      const publicId = endpointPath.replace('/kbrm/v2/organizations/', '');
      return `/api/v1/organizations/${publicId}`;
    }
    if (endpointPath === '/kbrm/v2/customers' && service === 'KBRM') {
      return queryParams ? `/api/v1/customers?${queryParams}` : '/api/v1/customers';
    }
    if (endpointPath === '/kbrm/v2/party-roles' && service === 'KBRM') {
      return queryParams ? `/api/v1/party-roles?${queryParams}` : '/api/v1/party-roles';
    }
    if (endpointPath === '/kbrm/v2/individuals' && service === 'KBRM') {
      return queryParams ? `/api/v1/individuals?${queryParams}` : '/api/v1/individuals';
    }
    if (endpointPath === '/kbrm/v2/agreements' && service === 'KBRM') {
      return queryParams ? `/api/v1/agreements?${queryParams}` : '/api/v1/agreements';
    }
    if (endpointPath === '/kbrm/v2/address' && service === 'KBRM') {
      return queryParams ? `/api/v1/address?${queryParams}` : '/api/v1/address';
    }
    if (endpointPath === '/kbrm/v2/contact-medium' && service === 'KBRM') {
      return queryParams ? `/api/v1/contact-medium?${queryParams}` : '/api/v1/contact-medium';
    }
    if (endpointPath === '/kbrm/v2/relationships' && service === 'KBRM') {
      return queryParams ? `/api/v1/relationships?${queryParams}` : '/api/v1/relationships';
    }
    if (endpointPath === '/ksec/v1/users' && service === 'KSEC') {
      return queryParams ? `/api/v1/users?${queryParams}` : '/api/v1/users';
    }
    // Handle customers with ID
    if (endpointPath.startsWith('/kbrm/v2/customers/') && service === 'KBRM') {
      const customerId = endpointPath.replace('/kbrm/v2/customers/', '');
      return `/api/v1/customers/${customerId}`;
    }
    // Handle party-roles with ID
    if (endpointPath.startsWith('/kbrm/v2/party-roles/') && service === 'KBRM') {
      const partyRoleId = endpointPath.replace('/kbrm/v2/party-roles/', '');
      return `/api/v1/party-roles/${partyRoleId}`;
    }
    // Handle individuals with public_id (GET, PUT, DELETE)
    if (endpointPath.startsWith('/kbrm/v2/individuals/') && service === 'KBRM') {
      const publicId = endpointPath.replace('/kbrm/v2/individuals/', '');
      return `/api/v1/individuals/${publicId}`;
    }
    // Support for v1 endpoints (backward compatibility)
    if (endpointPath === '/kbrm/v1/organizations' && service === 'KBRM') {
      return queryParams ? `/api/v1/organizations?${queryParams}` : '/api/v1/organizations';
    }
    if (endpoint === '/kbrm/v1/customers' && service === 'KBRM') {
      return '/api/v1/customers';
    }
    if (endpoint === '/kbrm/v1/party-roles' && service === 'KBRM') {
      return '/api/v1/party-roles';
    }
    if (endpoint === '/kbrm/v1/agreements' && service === 'KBRM') {
      return '/api/v1/agreements';
    }
    if (endpoint === '/kbrm/v1/address' && service === 'KBRM') {
      return '/api/v1/address';
    }
    if (endpoint === '/kbrm/v1/contact-medium' && service === 'KBRM') {
      return '/api/v1/contact-medium';
    }
    if (endpoint === '/kbrm/v1/relationships' && service === 'KBRM') {
      return '/api/v1/relationships';
    }
    if (endpoint.startsWith('/kbrm/v1/customers/') && service === 'KBRM' && !endpoint.includes('/api') && endpoint.split('/').length === 4) {
      const customerId = endpoint.split('/').pop();
      return `/api/v1/customers/${customerId}`;
    }
    if (endpoint.startsWith('/kbrm/v1/party-roles/') && service === 'KBRM') {
      const partyRoleId = endpoint.split('/').pop();
      return `/api/v1/party-roles/${partyRoleId}`;
    }
    
    // For all other endpoints, use the generic proxy pattern
    // Format: /api/v1/:service/:endpoint
    // Example: /api/v1/kbrm/kbrm/v1/individuals
    // Example: /api/v1/ksec/ksec/v1/users
    // Example: /api/v1/kcore-cus/customers
    return queryParams ? `/api/v1/${servicePath}${endpointPath}?${queryParams}` : `/api/v1/${servicePath}${endpointPath}`;
  }

  async call(service: string, endpoint: string, method: string, data?: any): Promise<any> {
    // TEMPORAL: Si estamos en d1 y es KBRM, apuntar directamente a KBRM mientras resolvemos el Ingress
    const useDirectKbrm = this.config.environment === 'd1' && service === 'KBRM' && !this.isMock;
    
    // Always use BFF - it handles all microservice routing
    const useBff = this.config.bff_url && !this.isMock && !useDirectKbrm;
    
    if (this.isMock) {
      await new Promise(resolve => setTimeout(resolve, 500));
      
      if (endpoint.endsWith('/organizations')) {
        return { data: { party_public_id: 'ORG_' + Math.random().toString(36).substr(7).toUpperCase(), party_id: 101 } };
      }
      if (endpoint.endsWith('/customers') && service === 'KBRM') {
        return { data: { public_id: 'KBRM_CUS_' + Math.random().toString(36).substr(7), customer_id: 202, party_role: { public_id: 'PR_' + Math.random().toString(36).substr(7), party_role_id: 303 } } };
      }
      if (endpoint.endsWith('/individuals')) {
        return { data: { public_id: 'IND_' + Math.random().toString(36).substr(7).toUpperCase() } };
      }
      if (endpoint.endsWith('/users') && service === 'KSEC') {
        return { data: { public_id: 'USR_' + Math.random().toString(36).substr(7).toUpperCase() } };
      }
      if (endpoint.endsWith('/customers') && service.startsWith('KCORE')) {
        return { public_id: 'KCORE_CUS_' + Math.random().toString(36).substr(7), id: 505 };
      }
      if (endpoint.includes('/api')) {
        return { value: 'ks_live_t3st_v4lue_' + Math.random().toString(36).substr(2, 24) };
      }
      if (endpoint.endsWith('/accounts') && service.startsWith('KCORE')) {
        return { public_id: 'ACC_' + Math.random().toString(36).substr(7).toUpperCase() };
      }
      if (endpoint.includes('/psps/search')) {
        return { data: [{ id: 142, name: 'BCP', public_id: 'PSP_BCP_001' }] };
      }
      if (endpoint.endsWith('/customers') && service === 'KPSP') {
        return { data: { id: 777, public_id: 'KPSP_CUS_99' } };
      }

      return { success: true, message: 'Step completed', data: { id: 999 } };
    }

    try {
      const headers: HeadersInit = { 
        'Content-Type': 'application/json'
      };

      let fullUrl: string;
      
      // TEMPORAL: Apuntar directamente a KBRM d1 mientras resolvemos el Ingress
      if (useDirectKbrm) {
        // El endpoint ya viene con /kbrm/v2/... así que solo necesitamos agregar la base URL
        // Construir URL directa a KBRM
        fullUrl = `https://d1-api.kashio-dev.net${endpoint}`;
        console.log('[KashioApi] Using direct KBRM URL (temporal):', fullUrl);
      } else if (!useBff) {
        throw new Error('BFF URL not configured. Please set environment to a valid value.');
      } else {
        // Always use BFF - it handles all microservice routing and authentication
        const bffEndpoint = this.getBffEndpoint(service, endpoint);
        fullUrl = `${this.config.bff_url}${bffEndpoint}`;
        // BFF handles authentication internally, no need to add headers here
      }

      const response = await fetch(fullUrl, {
        method,
        headers,
        body: data ? JSON.stringify(data) : undefined,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 401) {
          throw new Error("Error de autenticación. Verifica tus credenciales.");
        }
        if (response.status === 403) {
          throw new Error("Acceso denegado. Verifica los permisos del usuario.");
        }
        const errorMessage = errorData.error || errorData.message || `API Error: ${response.status} calling ${service}`;
        throw new Error(errorMessage);
      }

      const responseData = await response.json();
      
      // Handle BFF response format
      if (useBff && responseData.success !== undefined) {
        if (!responseData.success) {
          throw new Error(responseData.error || responseData.message || 'Error from BFF');
        }
        return responseData.data || responseData;
      }
      
      return responseData;
    } catch (err: any) {
      throw new Error(`Error de red o API: ${err.message}`);
    }
  }
}
