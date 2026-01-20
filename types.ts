
export type Environment = 'd1' | 'q3' | 'LOCAL';
export type EnvironmentType = 'local' | 'dev' | 'prod' | 'custom';

export interface EnvironmentConfig {
  name: string;
  environment: Environment;
  bff_url: string;
}

export interface ServiceFee {
  fees: {
    fee: {
      dr: number;
      cur: string;
      max: number;
      min: number;
      tax: number;
      fixed: number;
      formula: string;
    };
    service: string;
  }[];
}

export interface CollectAccount {
  currency: string;
  account_number: string;
  service_fee: ServiceFee;
}

export interface BalanceAccount {
  psp: string;
  currency: string;
  account_number: string;
  service_id: string;
  account_public_id?: string;
  psp_db_id?: number;
}

export interface ProductConfiguration {
  nombre: string;
  rol_public_id: string;
  product_public_id: string;
}

export interface Branch {
  name: string;
  address: {
    street: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
  phone?: string;
  email?: string;
  preferred?: boolean;
  // Para Opción D: configuración específica por sucursal (futuro)
  party_role_id?: string;
  customer_id?: string;
  agreement_id?: string;
}

export type OnboardingType = 'CORPORATIVO' | 'SUCURSAL';

/**
 * Contact Medium para Individual o Party Role
 */
export interface ContactMedium {
  contact_medium_type_id: number;
  contact_medium_type_name: string;
  email_address?: string;
  phone?: string;
  preferred?: boolean;
}

export interface OnboardingData {
  // Tipo de onboarding
  onboarding_type: OnboardingType;
  
  // Organización
  legal_name: string;
  business_name: string;
  ruc: string;
  document_type: string;
  sub_type: string;
  website: string;
  phone: string;
  email: string;
  country: string;
  other_name: string; // Nombre comercial alternativo
  source_reference: string; // ID de CRM ZOHO
  industry_id: string; // ID de industria
  
  // Dirección completa (según colabs)
  address: {
    country_code: string; // PER, etc.
    region: number;
    state_province: number;
    city: number;
    locality: string;
    postcode: string;
    street_type: number;
    street_name: string;
    street_number: string;
    street_nr_suffix?: string;
    street_nr_last?: string;
    street_nr_last_suffix?: string;
    external_reference_id?: string;
    // Mantener campos simples para compatibilidad
    street: string;
    state: string;
    zip: string;
  };
  
  // Party Role
  party_role_name: string;
  party_role_description: string;
  party_role_status_reason: string;
  party_role_type_id: number;
  party_role_contacts: ContactMedium[]; // Múltiples contactos para Party Role
  
  // Agreement
  agreement_name: string;
  agreement_description: string;
  agreement_document_number: string;
  agreement_product_offering_public_id: string;
  agreement_activation_date: string;
  start_date: string;
  end_date: string;
  agreement_type_id: number;
  agreement_optional?: boolean; // Para hacer Agreement opcional en SUCURSAL
  
  // Contact Medium (legacy - mantener para compatibilidad)
  contact_medium_type_id: number; // 1=Email, 2=Teléfono, 3=Móvil, 4=Fax
  contact_medium_type_name: string;
  contact_medium_email?: string;
  contact_medium_phone?: string;
  
  // Individual (solo CORPORATIVO)
  first_name: string;
  middle_name: string;
  last_name: string;
  title: string;
  birth_country_code: string;
  birth_date: string;
  individual_contacts: ContactMedium[]; // Múltiples contactos para Individual
  
  // Usuario KSEC (solo CORPORATIVO)
  user_phone: string;
  user_type_id: string;
  
  // Relationship (solo SUCURSAL)
  parent_corporativo_party_role_public_id?: string;
  relationship_description?: string;
  relationship_type_id?: number;
  
  // Campos legacy (mantener para compatibilidad pero no usar en colabs)
  branches: Branch[];
  agreement_products: string[];
  prefix: string;
  webhook_url: string;
  notification_webhook_conexion_unica: boolean;
  force_oldest_invoice: boolean;
  notify_invoice_paid: boolean;
  late_fee_formula_pen: string;
  late_fee_formula_usd: string;
  list_6_psp: boolean;
  psp_request_limit: number;
  configuraciones_ksec: ProductConfiguration[];
  bcp_api_key: string;
  bcp_username: string;
  lista_collect: CollectAccount[];
  lista_balance: BalanceAccount[];
}

export interface StepStatus {
  id: string;
  name: string;
  status: 'idle' | 'running' | 'success' | 'error';
  error?: string;
  result?: any;
}

export interface PhaseStatus {
  id: number;
  name: string;
  steps: StepStatus[];
}

export interface OnboardingProgress {
  executionId: string;
  sessionCtx: Record<string, any>;
  completedSteps: string[];
  lastUpdated: string;
  failedStep?: {
    id: string;
    message: string;
  };
  onboardingData: OnboardingData;
  envType: EnvironmentType;
  environment: Environment;
}
