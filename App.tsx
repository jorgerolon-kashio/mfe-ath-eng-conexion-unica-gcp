import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useIsAuthenticated, useAccount } from '@azure/msal-react';
import { 
  EnvironmentType, 
  EnvironmentConfig, 
  OnboardingData, 
  PhaseStatus, 
  StepStatus,
  OnboardingProgress,
  ProductConfiguration,
  Environment,
  ContactMedium
} from './types';
import { KashioApiService } from './services/kashioApi';
import { buildEnvironmentConfig } from './utils/envHelper';
import { ENV_CONFIGURATIONS } from './config/environments';
import { 
  PARTY_ROLE_TYPES, 
  CONTACT_MEDIUM_TYPES,
  AGREEMENT_TYPES,
  getActivePartyRoleTypes,
  getActiveContactMediumTypes,
  getActiveAgreementTypes
} from './src/data/staticData';
import Login from './components/Login';
import UserProfile from './components/UserProfile';

const PROGRESS_KEY = 'kashio_onboarding_v2';

const INITIAL_ONBOARDING_DATA: OnboardingData = {
  onboarding_type: 'CORPORATIVO',
  legal_name: '', business_name: '', ruc: '', document_type: 'RUC', sub_type: 'PAYMENT_COLLECTOR', 
  website: '', phone: '', email: '', country: 'PER',
  other_name: '', source_reference: '', industry_id: '1',
  address: { 
    country_code: 'PER', region: 1116, state_province: 8096, city: 6813, 
    locality: '', postcode: '', street_type: 6081, street_name: '', street_number: '',
    street: '', state: '', zip: ''
  },
  party_role_name: '', party_role_description: '', party_role_status_reason: 'Active role', party_role_type_id: 1,
  party_role_contacts: [],
  agreement_name: '', agreement_description: '', agreement_document_number: '', 
  agreement_product_offering_public_id: 'po_d1_abc123xyz',
  agreement_activation_date: new Date().toISOString().split('T')[0] + 'T00:00:00Z',
  start_date: new Date().toISOString().split('T')[0], 
  end_date: new Date(new Date().setFullYear(new Date().getFullYear() + 5)).toISOString().split('T')[0],
  agreement_type_id: 1,
  agreement_optional: false,
  contact_medium_type_id: 1, contact_medium_type_name: 'Email', contact_medium_email: '',
  branches: [{ 
    name: 'Sucursal Principal', 
    address: { street: '', city: '', state: '', zip: '', country: 'PE' },
    preferred: true 
  }],
  first_name: '', middle_name: '', last_name: '', title: '', birth_country_code: 'PEN', birth_date: '1990-01-01',
  individual_contacts: [],
  user_phone: '', user_type_id: '1',
  parent_corporativo_party_role_public_id: '', relationship_description: '', relationship_type_id: 2,
  agreement_products: ['PRODUCT-0001'],
  prefix: '', webhook_url: '', notification_webhook_conexion_unica: false, force_oldest_invoice: true, notify_invoice_paid: true,
  late_fee_formula_pen: '', late_fee_formula_usd: '', list_6_psp: true, psp_request_limit: 10,
  configuraciones_ksec: [],
  bcp_api_key: 'sk_N8BkxNJCiRw5Jg5Go8EyRX', bcp_username: 'ukashio',
  lista_collect: [{ currency: 'PEN', account_number: 'PENDING', service_fee: { fees: [{ fee: { dr: 0, cur: 'PEN', max: 0, min: 0, tax: 18, fixed: 0, formula: "fixed + amount * dr / 100" }, service: "payment" }] } }],
  lista_balance: [{ psp: 'BCP', currency: 'PEN', account_number: '3152601001055', service_id: '1053' }]
};

const formatMySQLDateTime = (date: Date, time: string = '00:00:00'): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day} ${time}`;
};

const getOnboardingType = (partyRoleTypeId: number): 'CORPORATIVO' | 'SUCURSAL' => {
  if (partyRoleTypeId === 3) {
    return 'SUCURSAL';
  }
  return 'CORPORATIVO';
};

const App: React.FC = () => {
  const isAuthenticated = useIsAuthenticated();
  const account = useAccount(null);

  const [onboardingData, setOnboardingData] = useState<OnboardingData>(INITIAL_ONBOARDING_DATA);
  const [ctx, setCtx] = useState<Record<string, any>>({});
  const [savedSteps, setSavedSteps] = useState<{step1: boolean, step2: boolean, step3: boolean}>({
    step1: false,
    step2: false,
    step3: false
  });
  const [savingStep, setSavingStep] = useState<number | null>(null);
  const [logs, setLogs] = useState<{msg: string, type: string, time: string}[]>([]);
  const [savedItems, setSavedItems] = useState<{
    individual: boolean;
    address: boolean;
    contact: boolean;
    relationship: boolean;
  }>({
    individual: false,
    address: false,
    contact: false,
    relationship: false
  });

  const [environment] = useState<Environment>(() => {
    const envFromVar = import.meta.env.VITE_ENVIRONMENT;
    if (envFromVar && ['LOCAL', 'd1', 'q3'].includes(envFromVar)) {
      return envFromVar as Environment;
    }
    return 'LOCAL';
  });

  const envConfig = useMemo(() => {
    return buildEnvironmentConfig(environment);
  }, [environment]);

  const api = useMemo(() => new KashioApiService(envConfig, false), [envConfig]);

  const addLog = useCallback((msg: string, type: 'info' | 'error' | 'success' = 'info') => {
    setLogs(prev => [...prev, { msg, type, time: new Date().toLocaleTimeString() }]);
  }, []);

  const saveStep1 = async () => {
    if (savingStep === 1 || savedSteps.step1) return;
    
    if (!onboardingData.legal_name) {
      addLog('Por favor completa la Razón Social', 'error');
      return;
    }
    if (!onboardingData.party_role_type_id) {
      addLog('Por favor selecciona el Tipo de Empresa', 'error');
      return;
    }

    setSavingStep(1);
    addLog('Guardando información de la empresa...', 'info');

    try {
      const sessionCtx: Record<string, any> = { ...ctx, executionId: ctx.executionId || Date.now().toString() };
      
      const allContacts = [
        ...(onboardingData.party_role_contacts || []),
        ...(onboardingData.email ? [{
          contact_medium_type_id: 1,
          contact_medium_type_name: 'Email',
          email_address: onboardingData.email,
          preferred: true
        }] : []),
        ...(onboardingData.phone ? [{
          contact_medium_type_id: 2,
          contact_medium_type_name: 'Phone',
          phone: onboardingData.phone,
          preferred: false
        }] : [])
      ];

      const orgCompletePayload = {
        legal_name: onboardingData.legal_name,
        web_site: onboardingData.website,
        other_name: onboardingData.other_name,
        source_reference: onboardingData.source_reference,
        industry_id: onboardingData.industry_id || '1',
        country_code: onboardingData.country || 'PER',
        address: {
          country_code: onboardingData.address.country_code || 'PER',
          region: onboardingData.address.region || 1116,
          state_province: onboardingData.address.state_province || 8096,
          city: onboardingData.address.city || 6813,
          locality: onboardingData.address.locality || '',
          postcode: onboardingData.address.postcode || '',
          street_type: onboardingData.address.street_type || 6081,
          street_name: onboardingData.address.street_name || '',
          street_number: onboardingData.address.street_number || '',
          street_nr_suffix: onboardingData.address.street_nr_suffix || '',
          street_nr_last: onboardingData.address.street_nr_last || '',
          street_nr_last_suffix: onboardingData.address.street_nr_last_suffix || '',
          external_reference_id: onboardingData.address.external_reference_id || ''
        },
        contacts: allContacts,
        party_role_name: onboardingData.party_role_name || onboardingData.legal_name,
        party_role_description: onboardingData.party_role_description || `Rol para ${onboardingData.legal_name}`,
        party_role_type_id: onboardingData.party_role_type_id,
        parent_corporativo_party_role_public_id: onboardingData.parent_corporativo_party_role_public_id || null,
        relationship_type_id: onboardingData.relationship_type_id || 2,
        relationship_description: onboardingData.relationship_description || 'Relación entre Corporativo y Sucursal'
      };

      const orgCompleteResponse = await api.call('KBRM', '/organizations/complete', 'POST', orgCompletePayload);
      
      // El BFF retorna: { success: true, data: { organization: {...}, party_role: {...} } }
      const orgData = orgCompleteResponse.data || orgCompleteResponse;
      sessionCtx.organization_public_id = orgData.organization?.public_id || orgData.organization_public_id || orgData.data?.organization?.public_id || orgData.data?.organization_public_id;
      sessionCtx.organization_party_id = orgData.organization?.party_id || orgData.organization_party_id || orgData.data?.organization?.party_id || orgData.data?.organization_party_id;
      sessionCtx.party_role_public_id = orgData.party_role?.public_id || orgData.party_role_public_id || orgData.data?.party_role?.public_id || orgData.data?.party_role_public_id;
      sessionCtx.party_role_id = orgData.party_role?.party_role_id || orgData.party_role_id || orgData.data?.party_role?.party_role_id || orgData.data?.party_role_id;
      sessionCtx.address_id = orgData.address_id || orgData.data?.address_id;
      
      setCtx(sessionCtx);
      setSavedSteps(prev => ({ ...prev, step1: true }));
      // Marcar items que ya se crearon en el paso completo
      setSavedItems(prev => ({ ...prev, address: true, contact: true }));
      addLog(`✓ Empresa registrada exitosamente. ID: ${sessionCtx.organization_public_id}`, 'success');
      
    } catch (err: any) {
      const errorMsg = err.message || JSON.stringify(err).substring(0, 200);
      addLog(`Error al guardar empresa: ${errorMsg}`, 'error');
    } finally {
      setSavingStep(null);
    }
  };

  const saveStep2 = async () => {
    if (savingStep === 2 || savedSteps.step2 || !savedSteps.step1) return;
    
    if (!onboardingData.agreement_name) {
      addLog('Por favor completa el Nombre del Contrato', 'error');
      return;
    }
    if (!onboardingData.agreement_document_number) {
      addLog('Por favor completa el Número de Documento', 'error');
      return;
    }

    setSavingStep(2);
    addLog('Guardando contrato...', 'info');

    try {
      const sessionCtx: Record<string, any> = { ...ctx };
      
      if (!sessionCtx.party_role_public_id) {
        throw new Error('Debes completar el Paso 1 primero');
      }

      let activationDate = onboardingData.agreement_activation_date || formatMySQLDateTime(new Date(), '00:00:00');
      if (activationDate.includes('T') && activationDate.includes('Z')) {
        const date = new Date(activationDate);
        activationDate = formatMySQLDateTime(date, '00:00:00');
      }
      
      const productOfferingIds = Array.isArray(onboardingData.agreement_product_offering_public_id) 
        ? onboardingData.agreement_product_offering_public_id 
        : [onboardingData.agreement_product_offering_public_id];
      
      const agreementPayload: any = {
        name: onboardingData.agreement_name,
        description: onboardingData.agreement_description || 'Conéxion Única - Reconciliación - Ánalisis de datos',
        document_number: onboardingData.agreement_document_number,
        assigned_to: sessionCtx.party_role_public_id,
        product_offering_public_id: productOfferingIds.length === 1 ? productOfferingIds[0] : productOfferingIds,
        start_datetime: onboardingData.start_date + ' 00:00:00',
        end_datetime: onboardingData.end_date + ' 23:59:59',
        activation_date: activationDate
      };
      
      if (onboardingData.agreement_type_id) {
        agreementPayload.agreement_type_id = onboardingData.agreement_type_id;
      }
      
      const agreementResponse = await api.call('KBRM', '/kbrm/v2/agreements', 'POST', agreementPayload);
      const agreementData = agreementResponse.data || agreementResponse;
      sessionCtx.agreement_id = agreementData.agreement_id || agreementData.data?.agreement_id;
      sessionCtx.agreement_public_id = agreementData.public_id || agreementData.data?.public_id;
      
      setCtx(sessionCtx);
      setSavedSteps(prev => ({ ...prev, step2: true }));
      addLog(`✓ Contrato creado exitosamente. ID: ${sessionCtx.agreement_id}`, 'success');
      
    } catch (err: any) {
      const errorMsg = err.message || JSON.stringify(err).substring(0, 200);
      addLog(`Error al guardar contrato: ${errorMsg}`, 'error');
    } finally {
      setSavingStep(null);
    }
  };

  const saveStep3 = async () => {
    if (savingStep === 3 || savedSteps.step3 || !savedSteps.step1) return;
    
    if (!onboardingData.first_name) {
      addLog('Por favor completa los Nombres', 'error');
      return;
    }
    if (!onboardingData.last_name) {
      addLog('Por favor completa los Apellidos', 'error');
      return;
    }
    if (!onboardingData.email) {
      addLog('Por favor completa el Email', 'error');
      return;
    }

    setSavingStep(3);
    addLog('Creando usuario administrador...', 'info');

    try {
      const sessionCtx: Record<string, any> = { ...ctx };
      
      if (!sessionCtx.organization_public_id) {
        throw new Error('Debes completar el Paso 1 primero');
      }

      const individualContacts = [
        ...(onboardingData.individual_contacts || []),
        ...(onboardingData.email ? [{
          contact_medium_type_id: 1,
          contact_medium_type_name: 'Email',
          email_address: onboardingData.email,
          preferred: true
        }] : []),
        ...(onboardingData.user_phone || onboardingData.phone ? [{
          contact_medium_type_id: 2,
          contact_medium_type_name: 'Phone',
          phone: onboardingData.user_phone || onboardingData.phone,
          preferred: false
        }] : [])
      ];

      const roles = onboardingData.configuraciones_ksec?.map((c: any) => c.rol_public_id) || [ENV_CONFIGURATIONS[environment].ksec_admin_role];
      const menu = onboardingData.configuraciones_ksec && onboardingData.configuraciones_ksec.length > 0
        ? onboardingData.configuraciones_ksec[0]
        : null;

      const userCompletePayload = {
        organization_public_id: sessionCtx.organization_public_id,
        first_name: onboardingData.first_name,
        last_name: onboardingData.last_name,
        full_name: `${onboardingData.first_name} ${onboardingData.last_name}`.trim(),
        birth_date: onboardingData.birth_date || '1990-01-01',
        email: onboardingData.email,
        phone: onboardingData.user_phone || onboardingData.phone || '',
        user_type_id: onboardingData.user_type_id || '1',
        contacts: individualContacts,
        roles: roles,
        menu: menu
      };

      const userCompleteResponse = await api.call('KSEC', '/users/complete', 'POST', userCompletePayload);
      
      // El BFF retorna: { success: true, data: { individual: {...}, user: {...} } }
      const userData = userCompleteResponse.data || userCompleteResponse;
      sessionCtx.individual_public_id = userData.individual?.public_id || userData.individual_public_id || userData.data?.individual?.public_id || userData.data?.individual_public_id;
      sessionCtx.individual_party_id = userData.individual?.party_id || userData.individual_party_id || userData.data?.individual?.party_id || userData.data?.individual_party_id;
      sessionCtx.user_id_global = userData.user?.public_id || userData.user_public_id || userData.user_id_global || userData.data?.user?.public_id || userData.data?.user_public_id || userData.data?.user_id_global;
      
      setCtx(sessionCtx);
      setSavedSteps(prev => ({ ...prev, step3: true }));
      addLog(`✓ Usuario creado exitosamente. ID: ${sessionCtx.user_id_global}`, 'success');
      addLog('✓ Onboarding Completado', 'success');
      
    } catch (err: any) {
      const errorMsg = err.message || JSON.stringify(err).substring(0, 200);
      addLog(`Error al crear usuario: ${errorMsg}`, 'error');
    } finally {
      setSavingStep(null);
    }
  };

  // Función para crear Individuo
  const createIndividual = async () => {
    if (!onboardingData.first_name || !onboardingData.last_name) {
      addLog('Por favor completa los nombres y apellidos', 'error');
      return;
    }

    try {
      addLog('Creando individuo...', 'info');
      const individualPayload = {
        first_name: onboardingData.first_name,
        last_name: onboardingData.last_name,
        full_name: `${onboardingData.first_name} ${onboardingData.last_name}`.trim(),
        birth_date: onboardingData.birth_date || '1990-01-01',
        status: 1
      };

      const individualResponse = await api.call('KBRM', '/kbrm/v2/individuals', 'POST', individualPayload);
      // El BFF retorna: { is_success: true, data: { public_id, ... } }
      const individualData = individualResponse.data || individualResponse;
      const individualPublicId = individualData.data?.public_id || individualData.public_id;
      const individualPartyId = individualData.data?.party_id || individualData.party_id;

      setCtx(prev => ({
        ...prev,
        individual_public_id: individualPublicId,
        individual_party_id: individualPartyId
      }));

      setSavedItems(prev => ({ ...prev, individual: true }));
      addLog(`✓ Individuo creado exitosamente. ID: ${individualPublicId}`, 'success');
    } catch (err: any) {
      const errorMsg = err.message || JSON.stringify(err).substring(0, 200);
      addLog(`Error al crear individuo: ${errorMsg}`, 'error');
    }
  };

  // Función para guardar Dirección
  const saveAddress = async () => {
    if (!ctx.organization_party_id && !ctx.individual_party_id) {
      addLog('Debes crear primero una Organización o Individuo', 'error');
      return;
    }

    try {
      addLog('Guardando dirección...', 'info');
      const partyId = ctx.organization_party_id || ctx.individual_party_id;
      
      const addressPayload = {
        country_code: onboardingData.address.country_code || 'PER',
        region: onboardingData.address.region || 1116,
        state_province: onboardingData.address.state_province || 8096,
        city: onboardingData.address.city || 6813,
        locality: onboardingData.address.locality || '',
        postcode: onboardingData.address.postcode || '',
        street_type: onboardingData.address.street_type || 6081,
        street_name: onboardingData.address.street_name || '',
        street_number: onboardingData.address.street_number || '',
        street_nr_suffix: onboardingData.address.street_nr_suffix || '',
        street_nr_last: onboardingData.address.street_nr_last || '',
        street_nr_last_suffix: onboardingData.address.street_nr_last_suffix || '',
        geographic_location_id: 1,
        party_id: partyId
      };

      const addressResponse = await api.call('KBRM', '/kbrm/v2/address', 'POST', addressPayload);
      const addressData = addressResponse.data || addressResponse;
      const addressId = addressData.address_id || addressData.data?.address_id;

      setCtx(prev => ({ ...prev, address_id: addressId }));
      setSavedItems(prev => ({ ...prev, address: true }));
      addLog(`✓ Dirección guardada exitosamente. ID: ${addressId}`, 'success');
    } catch (err: any) {
      const errorMsg = err.message || JSON.stringify(err).substring(0, 200);
      addLog(`Error al guardar dirección: ${errorMsg}`, 'error');
    }
  };

  // Función para crear Contact Medium
  const createContactMedium = async () => {
    if (!ctx.organization_party_id && !ctx.individual_party_id) {
      addLog('Debes crear primero una Organización o Individuo', 'error');
      return;
    }

    if (!onboardingData.email && !onboardingData.phone) {
      addLog('Por favor ingresa un email o teléfono', 'error');
      return;
    }

    try {
      addLog('Creando medio de contacto...', 'info');
      const partyId = ctx.organization_party_id || ctx.individual_party_id;
      const startDate = new Date();
      const endDate = new Date(2099, 11, 31);

      const contacts = [];
      
      if (onboardingData.email) {
        contacts.push({
          contact_medium_type_id: 1,
          contact_medium_type_name: 'Email',
          email_address: onboardingData.email,
          party_id: partyId,
          preferred: true,
          start_datetime: formatMySQLDateTime(startDate, '00:00:00'),
          end_datetime: formatMySQLDateTime(endDate, '23:59:59'),
          binding_datetime: formatMySQLDateTime(startDate, '00:00:00'),
          status: 1
        });
      }

      if (onboardingData.phone) {
        contacts.push({
          contact_medium_type_id: 2,
          contact_medium_type_name: 'Phone',
          number: onboardingData.phone,
          party_id: partyId,
          preferred: false,
          start_datetime: formatMySQLDateTime(startDate, '00:00:00'),
          end_datetime: formatMySQLDateTime(endDate, '23:59:59'),
          binding_datetime: formatMySQLDateTime(startDate, '00:00:00'),
          status: 1
        });
      }

      for (const contact of contacts) {
        await api.call('KBRM', '/kbrm/v2/contact-medium', 'POST', contact);
      }

      setSavedItems(prev => ({ ...prev, contact: true }));
      addLog(`✓ Medio de contacto creado exitosamente`, 'success');
    } catch (err: any) {
      const errorMsg = err.message || JSON.stringify(err).substring(0, 200);
      addLog(`Error al crear medio de contacto: ${errorMsg}`, 'error');
    }
  };

  // Función para establecer Relationship
  const createRelationship = async () => {
    if (!onboardingData.parent_corporativo_party_role_public_id) {
      addLog('Por favor ingresa el Party Role del Corporativo', 'error');
      return;
    }

    if (!ctx.party_role_public_id) {
      addLog('Debes crear primero un Party Role', 'error');
      return;
    }

    try {
      addLog('Estableciendo relación...', 'info');
      
      // Primero obtener el party_role_id del corporativo
      const corporativoResponse = await api.call('KBRM', `/kbrm/v2/party-roles/${onboardingData.parent_corporativo_party_role_public_id}`, 'GET');
      const corporativoData = corporativoResponse.data || corporativoResponse;
      const corporativoPartyId = corporativoData.party_id || corporativoData.data?.party_id;

      if (!corporativoPartyId) {
        throw new Error('No se pudo obtener el Party ID del corporativo');
      }

      // Obtener el customer del corporativo
      const customerResponse = await api.call('KBRM', `/kbrm/v2/customers/organization/${corporativoPartyId}`, 'GET');
      const customerData = customerResponse.data || customerResponse;
      const fromPartyRoleId = customerData.party_role?.party_role_id || customerData.data?.party_role?.party_role_id;

      if (!fromPartyRoleId) {
        throw new Error('No se pudo obtener el Party Role ID del corporativo');
      }

      // Obtener el party_role_id actual (del que estamos creando)
      const currentPartyRoleResponse = await api.call('KBRM', `/kbrm/v2/party-roles/${ctx.party_role_public_id}`, 'GET');
      const currentPartyRoleData = currentPartyRoleResponse.data || currentPartyRoleResponse;
      const toPartyRoleId = currentPartyRoleData.party_role_id || currentPartyRoleData.data?.party_role_id;

      if (!toPartyRoleId) {
        throw new Error('No se pudo obtener el Party Role ID actual');
      }

      const relationshipPayload = {
        from_party_role_id: fromPartyRoleId,
        to_party_role_id: toPartyRoleId,
        relationship_type_id: onboardingData.relationship_type_id || 2,
        description: onboardingData.relationship_description || 'Relación entre Corporativo y Sucursal',
        start_datetime: formatMySQLDateTime(new Date(), '00:00:00'),
        end_datetime: formatMySQLDateTime(new Date(2099, 11, 31), '23:59:59'),
        status: 1
      };

      const relationshipResponse = await api.call('KBRM', '/kbrm/v2/relationships', 'POST', relationshipPayload);
      setSavedItems(prev => ({ ...prev, relationship: true }));
      addLog(`✓ Relación establecida exitosamente`, 'success');
    } catch (err: any) {
      const errorMsg = err.message || JSON.stringify(err).substring(0, 200);
      addLog(`Error al establecer relación: ${errorMsg}`, 'error');
    }
  };

  // Omitir login en LOCAL, requerir autenticación en otros entornos
  const shouldRequireAuth = environment !== 'LOCAL';
  if (shouldRequireAuth && !isAuthenticated) {
    return <Login />;
  }

  return (
    <div className="bg-background-light dark:bg-background-dark font-display text-text-main antialiased h-screen overflow-hidden flex">
      <aside className="w-72 bg-white dark:bg-[#1a202c] border-r border-border-light flex flex-col h-full shrink-0 z-20">
        <div className="p-6 border-b border-border-light/50">
          <div className="flex items-center gap-3">
            <div className="size-8 rounded bg-primary flex items-center justify-center text-white">
              <span className="material-symbols-outlined text-[20px]">verified_user</span>
            </div>
            <h1 className="text-text-main text-lg font-bold leading-tight">
              Kashio
              <span className="text-xs font-normal text-text-secondary ml-1">v1.0.0</span>
            </h1>
          </div>
        </div>
        <div className="flex-1"></div>
        <div className="p-4 border-t border-border-light bg-white dark:bg-[#1a202c]">
          <UserProfile />
        </div>
      </aside>
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        <header className="w-full bg-background-light pt-8 pb-4 px-8 flex-shrink-0">
          <div className="max-w-[1400px] mx-auto w-full">
            <div className="flex items-center gap-2 mb-3 text-sm">
              <a className="text-text-secondary hover:text-primary transition-colors" href="#">Gestión de empresas</a>
              <span className="text-text-secondary">/</span>
              <span className="text-text-main font-medium">Nuevo Registro</span>
            </div>
            <div className="flex justify-between items-end">
              <h2 className="text-3xl font-black tracking-tight text-text-main">
                Proceso de Alta (KBRM + KSEC)
              </h2>
              <div className="hidden sm:flex items-center gap-2">
                <span className="px-3 py-1 bg-white border border-border-light rounded-full text-xs font-medium text-text-secondary shadow-sm flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-yellow-400"></span> Draft
                </span>
              </div>
            </div>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-8 pt-2">
          <div className="max-w-[1400px] mx-auto w-full">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 h-full pb-8">
              {/* Columna Izquierda: Datos de la Entidad (KBRM) */}
              <div className="bg-white rounded-xl border border-border-light shadow-sm flex flex-col h-fit xl:h-auto overflow-hidden">
                <div className="px-6 py-5 border-b border-border-light flex justify-between items-center bg-white z-10 sticky top-0">
                  <h3 className="text-lg font-bold text-text-main">
                    1. Datos de la Entidad (KBRM)
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full bg-yellow-50 text-yellow-700 text-xs font-semibold border border-yellow-100">
                    {savedSteps.step1 ? 'Saved' : '7 Steps'}
                  </span>
                </div>
                <div className="p-6 flex flex-col gap-8 flex-1 overflow-y-auto">
                  {/* Step 1: Organización */}
                  <div>
                    <h4 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-4 flex items-center gap-2">
                      <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary text-white text-[10px] font-bold">1</span>
                      Organización
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <label className="md:col-span-2 flex flex-col gap-1.5">
                        <span className="text-sm font-semibold text-text-main">Nombre Legal</span>
                        <input
                          className="form-input w-full rounded-lg border-border-light text-text-main text-sm h-11 focus:ring-primary focus:border-primary"
                          name="legal_name"
                          placeholder="Ej. Kashio S.A.C."
                          type="text"
                          value={onboardingData.legal_name}
                          onChange={e => setOnboardingData({...onboardingData, legal_name: e.target.value})}
                        />
                      </label>
                      <label className="flex flex-col gap-1.5">
                        <span className="text-sm font-semibold text-text-main">Sitio Web</span>
                        <input
                          className="form-input w-full rounded-lg border-border-light text-text-main text-sm h-11 focus:ring-primary focus:border-primary"
                          name="web_site"
                          placeholder="https://"
                          type="url"
                          value={onboardingData.website}
                          onChange={e => setOnboardingData({...onboardingData, website: e.target.value})}
                        />
                      </label>
                      <label className="flex flex-col gap-1.5">
                        <span className="text-sm font-semibold text-text-main">Nombre Comercial/Otro</span>
                        <input
                          className="form-input w-full rounded-lg border-border-light text-text-main text-sm h-11 focus:ring-primary focus:border-primary"
                          name="other_name"
                          placeholder="Ej. Kashio App"
                          type="text"
                          value={onboardingData.other_name}
                          onChange={e => setOnboardingData({...onboardingData, other_name: e.target.value})}
                        />
                      </label>
                      <label className="flex flex-col gap-1.5">
                        <span className="text-sm font-semibold text-text-main">Ref. Externa ZOHO</span>
                        <input
                          className="form-input w-full rounded-lg border-border-light text-text-main text-sm h-11 focus:ring-primary focus:border-primary"
                          name="source_reference"
                          placeholder="ZOHO-ID-001"
                          type="text"
                          value={onboardingData.source_reference}
                          onChange={e => setOnboardingData({...onboardingData, source_reference: e.target.value})}
                        />
                      </label>
                      <label className="flex flex-col gap-1.5">
                        <span className="text-sm font-semibold text-text-main">Industria</span>
                        <select
                          className="form-select w-full rounded-lg border-border-light text-text-main text-sm h-11 focus:ring-primary focus:border-primary bg-white"
                          name="industry_id"
                          value={onboardingData.industry_id}
                          onChange={e => setOnboardingData({...onboardingData, industry_id: e.target.value})}
                        >
                          <option disabled value="">Seleccionar...</option>
                          <option value="1">Fintech</option>
                          <option value="2">Retail</option>
                          <option value="3">Services</option>
                        </select>
                      </label>
                    </div>
                    <div className="mt-4 flex justify-end">
                      <button
                        className="bg-primary hover:bg-blue-600 text-white font-medium py-2 px-4 rounded-lg shadow-sm transition-colors text-sm flex items-center gap-2"
                        onClick={saveStep1}
                        disabled={savingStep === 1 || savedSteps.step1}
                      >
                        <span className="material-symbols-outlined text-[18px]">save</span>
                        {savingStep === 1 ? 'Guardando...' : savedSteps.step1 ? 'Guardado ✓' : 'Guardar Organización'}
                      </button>
                    </div>
                  </div>

                  {/* Step 2: Individuo (Representante) */}
                  <hr className="border-border-light/60 border-dashed" />
                  <div>
                    <h4 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-4 flex items-center gap-2">
                      <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary text-white text-[10px] font-bold">2</span>
                      Individuo (Representante)
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <label className="flex flex-col gap-1.5">
                        <span className="text-sm font-semibold text-text-main">Primer Nombre</span>
                        <input
                          className="form-input w-full rounded-lg border-border-light text-text-main text-sm h-11 focus:ring-primary focus:border-primary"
                          name="first_name"
                          placeholder="Ej. Juan"
                          type="text"
                          value={onboardingData.first_name}
                          onChange={e => setOnboardingData({...onboardingData, first_name: e.target.value})}
                        />
                      </label>
                      <label className="flex flex-col gap-1.5">
                        <span className="text-sm font-semibold text-text-main">Apellido</span>
                        <input
                          className="form-input w-full rounded-lg border-border-light text-text-main text-sm h-11 focus:ring-primary focus:border-primary"
                          name="last_name"
                          placeholder="Ej. Perez"
                          type="text"
                          value={onboardingData.last_name}
                          onChange={e => setOnboardingData({...onboardingData, last_name: e.target.value})}
                        />
                      </label>
                      <label className="md:col-span-2 flex flex-col gap-1.5">
                        <span className="text-sm font-semibold text-text-main">Nombre Completo</span>
                        <input
                          className="form-input w-full rounded-lg border-border-light text-text-main text-sm h-11 focus:ring-primary focus:border-primary"
                          name="full_name"
                          placeholder="Ej. Juan Perez"
                          type="text"
                          value={`${onboardingData.first_name} ${onboardingData.last_name}`.trim()}
                          readOnly
                        />
                      </label>
                      <label className="flex flex-col gap-1.5">
                        <span className="text-sm font-semibold text-text-main">Fecha de Nacimiento</span>
                        <input
                          className="form-input w-full rounded-lg border-border-light text-text-main text-sm h-11 focus:ring-primary focus:border-primary"
                          name="birth_date"
                          type="date"
                          value={onboardingData.birth_date}
                          onChange={e => setOnboardingData({...onboardingData, birth_date: e.target.value})}
                        />
                      </label>
                    </div>
                    <div className="mt-4 flex justify-end">
                      <button
                        onClick={createIndividual}
                        disabled={savedItems.individual}
                        className="bg-primary hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg shadow-sm transition-colors text-sm flex items-center gap-2"
                      >
                        <span className="material-symbols-outlined text-[18px]">person_add</span>
                        {savedItems.individual ? 'Individuo Creado ✓' : 'Crear Individuo'}
                      </button>
                    </div>
                  </div>

                  {/* Step 3: Party Role */}
                  <hr className="border-border-light/60 border-dashed" />
                  <div>
                    <h4 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-4 flex items-center gap-2">
                      <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary text-white text-[10px] font-bold">3</span>
                      Party Role
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <label className="md:col-span-2 flex flex-col gap-1.5 relative group">
                        <span className="text-sm font-semibold text-text-main">Party ID (Search)</span>
                        <div className="relative">
                          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary text-[20px]">search</span>
                          <input
                            className="form-input w-full pl-10 rounded-lg border-border-light text-text-main text-sm h-11 focus:ring-primary focus:border-primary"
                            placeholder="Search Party (Organization/Individual)..."
                            type="text"
                            value={ctx.party_role_public_id || ''}
                            readOnly
                          />
                        </div>
                      </label>
                      <label className="md:col-span-2 flex flex-col gap-1.5">
                        <span className="text-sm font-semibold text-text-main">Role Type</span>
                        <select
                          className="form-select w-full rounded-lg border-border-light text-text-main text-sm h-11 focus:ring-primary focus:border-primary bg-white"
                          value={onboardingData.party_role_type_id}
                          onChange={e => setOnboardingData({...onboardingData, party_role_type_id: parseInt(e.target.value)})}
                        >
                          <option value="">Select Role Type...</option>
                          {getActivePartyRoleTypes().map(type => (
                            <option key={type.party_role_type_id} value={type.party_role_type_id}>
                              {type.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </div>

                  {/* Step 4: Agreement */}
                  <hr className="border-border-light/60 border-dashed" />
                  <div>
                    <h4 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-4 flex items-center gap-2">
                      <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary text-white text-[10px] font-bold">4</span>
                      Agreement
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <label className="flex flex-col gap-1.5">
                        <span className="text-sm font-semibold text-text-main">Nombre del Contrato</span>
                        <input
                          className="form-input w-full rounded-lg border-border-light text-text-main text-sm h-11 focus:ring-primary focus:border-primary"
                          type="text"
                          value={onboardingData.agreement_name}
                          onChange={e => setOnboardingData({...onboardingData, agreement_name: e.target.value})}
                          placeholder="MSA-Standard-2023"
                        />
                      </label>
                      <label className="flex flex-col gap-1.5">
                        <span className="text-sm font-semibold text-text-main">Product Offering (Search)</span>
                        <div className="relative">
                          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary text-[20px]">search</span>
                          <input
                            className="form-input w-full pl-10 rounded-lg border-border-light text-text-main text-sm h-11 focus:ring-primary focus:border-primary"
                            placeholder="Search Product..."
                            type="text"
                            value={onboardingData.agreement_product_offering_public_id}
                            onChange={e => setOnboardingData({...onboardingData, agreement_product_offering_public_id: e.target.value})}
                          />
                        </div>
                      </label>
                      <label className="md:col-span-2 flex flex-col gap-1.5">
                        <span className="text-sm font-semibold text-text-main">Assigned To (Party Role Search)</span>
                        <div className="relative">
                          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary text-[20px]">person_search</span>
                          <input
                            className="form-input w-full pl-10 rounded-lg border-border-light text-text-main text-sm h-11 focus:ring-primary focus:border-primary"
                            placeholder="Search Party Role..."
                            type="text"
                            value={ctx.party_role_public_id || ''}
                            readOnly
                          />
                        </div>
                      </label>
                    </div>
                    <div className="mt-4 flex justify-end">
                      <button
                        className="bg-primary hover:bg-blue-600 text-white font-medium py-2 px-4 rounded-lg shadow-sm transition-colors text-sm flex items-center gap-2"
                        onClick={saveStep2}
                        disabled={savingStep === 2 || savedSteps.step2 || !savedSteps.step1}
                      >
                        <span className="material-symbols-outlined text-[18px]">gavel</span>
                        {savingStep === 2 ? 'Guardando...' : savedSteps.step2 ? 'Guardado ✓' : 'Crear Acuerdo'}
                      </button>
                    </div>
                  </div>

                  {/* Step 5: Dirección */}
                  <hr className="border-border-light/60 border-dashed" />
                  <div>
                    <h4 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-4 flex items-center gap-2">
                      <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary text-white text-[10px] font-bold">5</span>
                      Dirección
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <label className="md:col-span-2 flex flex-col gap-1.5">
                        <span className="text-sm font-semibold text-text-main">Calle</span>
                        <input
                          className="form-input w-full rounded-lg border-border-light text-text-main text-sm h-11 focus:ring-primary focus:border-primary"
                          name="street_name"
                          placeholder="Av. Principal"
                          type="text"
                          value={onboardingData.address.street_name}
                          onChange={e => setOnboardingData({...onboardingData, address: {...onboardingData.address, street_name: e.target.value}})}
                        />
                      </label>
                      <label className="flex flex-col gap-1.5">
                        <span className="text-sm font-semibold text-text-main">Número</span>
                        <input
                          className="form-input w-full rounded-lg border-border-light text-text-main text-sm h-11 focus:ring-primary focus:border-primary"
                          name="street_number"
                          placeholder="123"
                          type="text"
                          value={onboardingData.address.street_number}
                          onChange={e => setOnboardingData({...onboardingData, address: {...onboardingData.address, street_number: e.target.value}})}
                        />
                      </label>
                      <label className="flex flex-col gap-1.5">
                        <span className="text-sm font-semibold text-text-main">Ciudad</span>
                        <input
                          className="form-input w-full rounded-lg border-border-light text-text-main text-sm h-11 focus:ring-primary focus:border-primary"
                          name="city_name"
                          placeholder="Ej. Lima"
                          type="text"
                          value={onboardingData.address.locality}
                          onChange={e => setOnboardingData({...onboardingData, address: {...onboardingData.address, locality: e.target.value}})}
                        />
                      </label>
                      <label className="md:col-span-2 flex flex-col gap-1.5">
                        <span className="text-sm font-semibold text-text-main">País</span>
                        <select
                          className="form-select w-full rounded-lg border-border-light text-text-main text-sm h-11 focus:ring-primary focus:border-primary bg-white"
                          name="country_id"
                          value={onboardingData.country}
                          onChange={e => setOnboardingData({...onboardingData, country: e.target.value, address: {...onboardingData.address, country_code: e.target.value}})}
                        >
                          <option value="PER">Peru</option>
                          <option value="MEX">Mexico</option>
                          <option value="COL">Colombia</option>
                        </select>
                      </label>
                    </div>
                    <div className="mt-4 flex justify-end">
                      <button
                        onClick={saveAddress}
                        disabled={savedItems.address}
                        className="bg-primary hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg shadow-sm transition-colors text-sm flex items-center gap-2"
                      >
                        <span className="material-symbols-outlined text-[18px]">location_on</span>
                        {savedItems.address ? 'Dirección Guardada ✓' : 'Guardar Dirección'}
                      </button>
                    </div>
                  </div>

                  {/* Step 6: Contact Medium */}
                  <hr className="border-border-light/60 border-dashed" />
                  <div>
                    <h4 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-4 flex items-center gap-2">
                      <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary text-white text-[10px] font-bold">6</span>
                      Contact Medium
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <label className="md:col-span-2 flex flex-col gap-1.5">
                        <span className="text-sm font-semibold text-text-main">Tipo de Contacto</span>
                        <select
                          className="form-select w-full rounded-lg border-border-light text-text-main text-sm h-11 focus:ring-primary focus:border-primary bg-white"
                          value={onboardingData.contact_medium_type_id}
                          onChange={e => {
                            const typeId = parseInt(e.target.value);
                            const type = getActiveContactMediumTypes().find(t => t.contact_medium_type_id === typeId);
                            setOnboardingData({...onboardingData, contact_medium_type_id: typeId, contact_medium_type_name: type?.name || ''});
                          }}
                        >
                          {getActiveContactMediumTypes().map(type => (
                            <option key={type.contact_medium_type_id} value={type.contact_medium_type_id}>
                              {type.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="flex flex-col gap-1.5">
                        <span className="text-sm font-semibold text-text-main">Email</span>
                        <input
                          className="form-input w-full rounded-lg border-border-light text-text-main text-sm h-11 focus:ring-primary focus:border-primary"
                          name="contact_medium_email"
                          placeholder="contact@company.com"
                          type="email"
                          value={onboardingData.email}
                          onChange={e => setOnboardingData({...onboardingData, email: e.target.value})}
                        />
                      </label>
                      <label className="flex flex-col gap-1.5">
                        <span className="text-sm font-semibold text-text-main">Teléfono</span>
                        <input
                          className="form-input w-full rounded-lg border-border-light text-text-main text-sm h-11 focus:ring-primary focus:border-primary"
                          name="user_phone"
                          placeholder="+51 ..."
                          type="tel"
                          value={onboardingData.phone}
                          onChange={e => setOnboardingData({...onboardingData, phone: e.target.value})}
                        />
                      </label>
                    </div>
                    <div className="mt-4 flex justify-end">
                      <button
                        onClick={createContactMedium}
                        disabled={savedItems.contact}
                        className="bg-primary hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg shadow-sm transition-colors text-sm flex items-center gap-2"
                      >
                        <span className="material-symbols-outlined text-[18px]">contact_phone</span>
                        {savedItems.contact ? 'Contacto Creado ✓' : 'Crear Medio de Contacto'}
                      </button>
                    </div>
                  </div>

                  {/* Step 7: Relationship */}
                  <hr className="border-border-light/60 border-dashed" />
                  <div>
                    <h4 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-4 flex items-center gap-2">
                      <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary text-white text-[10px] font-bold">7</span>
                      Relationship
                    </h4>
                    <div className="grid grid-cols-1 gap-4">
                      <label className="flex flex-col gap-1.5">
                        <span className="text-sm font-semibold text-text-main">From Party (Search)</span>
                        <div className="relative">
                          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary text-[20px]">search</span>
                          <input
                            className="form-input w-full pl-10 rounded-lg border-border-light text-text-main text-sm h-11 focus:ring-primary focus:border-primary"
                            placeholder="Parent/Owner..."
                            type="text"
                            value={onboardingData.parent_corporativo_party_role_public_id}
                            onChange={e => setOnboardingData({...onboardingData, parent_corporativo_party_role_public_id: e.target.value})}
                          />
                        </div>
                      </label>
                      <label className="flex flex-col gap-1.5">
                        <span className="text-sm font-semibold text-text-main">Tipo de Relación</span>
                        <select
                          className="form-select w-full rounded-lg border-border-light text-text-main text-sm h-11 focus:ring-primary focus:border-primary bg-white"
                          value={onboardingData.relationship_type_id}
                          onChange={e => setOnboardingData({...onboardingData, relationship_type_id: parseInt(e.target.value)})}
                        >
                          <option value="2">Subsidiary</option>
                          <option value="3">Partner</option>
                          <option value="4">Vendor</option>
                        </select>
                      </label>
                    </div>
                    <div className="mt-4 flex justify-end">
                      <button
                        onClick={createRelationship}
                        disabled={savedItems.relationship || !savedSteps.step1}
                        className="bg-primary hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg shadow-sm transition-colors text-sm flex items-center gap-2"
                      >
                        <span className="material-symbols-outlined text-[18px]">handshake</span>
                        {savedItems.relationship ? 'Relación Establecida ✓' : 'Establecer Relación'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Columna Derecha: Seguridad y Accesos (KSEC) */}
              <div className="bg-white rounded-xl border border-border-light shadow-sm flex flex-col relative overflow-hidden">
                <div className="px-6 py-5 border-b border-border-light flex justify-between items-center bg-white z-10 sticky top-0">
                  <h3 className="text-lg font-bold text-text-main">
                    2. Seguridad y Accesos (KSEC)
                  </h3>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                    savedSteps.step3 ? 'bg-green-50 text-green-700 border-green-100' : 'bg-gray-100 text-gray-600 border-gray-200'
                  }`}>
                    {savedSteps.step3 ? 'Completed' : 'Pending'}
                  </span>
                </div>
                <div className="p-6 flex flex-col gap-6 flex-1 z-10 overflow-y-auto">
                  {/* Sección 1: Creación de Usuario */}
                  <div>
                    <h4 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-4 flex items-center gap-2">
                      <span className="material-symbols-outlined text-[16px]">person_add</span>
                      1. Creación de Usuario
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <label className="flex flex-col gap-1.5">
                        <span className="text-sm font-semibold text-text-main">Primer Nombre</span>
                        <input
                          className="form-input w-full rounded-lg border-border-light text-text-main text-sm h-11 focus:ring-primary focus:border-primary"
                          type="text"
                          value={onboardingData.first_name}
                          onChange={e => setOnboardingData({...onboardingData, first_name: e.target.value})}
                        />
                      </label>
                      <label className="flex flex-col gap-1.5">
                        <span className="text-sm font-semibold text-text-main">Apellido</span>
                        <input
                          className="form-input w-full rounded-lg border-border-light text-text-main text-sm h-11 focus:ring-primary focus:border-primary"
                          type="text"
                          value={onboardingData.last_name}
                          onChange={e => setOnboardingData({...onboardingData, last_name: e.target.value})}
                        />
                      </label>
                      <label className="flex flex-col gap-1.5">
                        <span className="text-sm font-semibold text-text-main">Email Corporativo</span>
                        <input
                          className="form-input w-full rounded-lg border-border-light text-text-main text-sm h-11 focus:ring-primary focus:border-primary"
                          placeholder="usuario@empresa.com"
                          type="email"
                          value={onboardingData.email}
                          onChange={e => setOnboardingData({...onboardingData, email: e.target.value})}
                        />
                      </label>
                      <label className="flex flex-col gap-1.5">
                        <span className="text-sm font-semibold text-text-main">Teléfono</span>
                        <input
                          className="form-input w-full rounded-lg border-border-light text-text-main text-sm h-11 focus:ring-primary focus:border-primary"
                          placeholder="+51 999 000 000"
                          type="tel"
                          value={onboardingData.user_phone}
                          onChange={e => setOnboardingData({...onboardingData, user_phone: e.target.value})}
                        />
                      </label>
                      <label className="flex flex-col gap-1.5">
                        <span className="text-sm font-semibold text-text-main">User Type ID</span>
                        <select
                          className="form-select w-full rounded-lg border-border-light text-text-main text-sm h-11 focus:ring-primary focus:border-primary bg-white"
                          value={onboardingData.user_type_id}
                          onChange={e => setOnboardingData({...onboardingData, user_type_id: e.target.value})}
                        >
                          <option value="1">Employee</option>
                          <option value="2">Admin</option>
                          <option value="3">Contractor</option>
                        </select>
                      </label>
                      <label className="flex flex-col gap-1.5">
                        <span className="text-xs font-medium text-text-secondary flex items-center gap-1">
                          Organization ID
                          <span className="text-[10px] bg-blue-100 text-blue-800 px-1 rounded">Linked</span>
                        </span>
                        <div className="relative">
                          <input
                            className="form-input w-full pl-9 rounded-lg border-border-light bg-background-light text-text-secondary text-sm h-11 font-mono focus:outline-none cursor-not-allowed"
                            disabled
                            readOnly
                            type="text"
                            value={ctx.organization_public_id || '88291'}
                          />
                          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary text-[18px]">domain</span>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Sección 2: Asignación de Roles */}
                  <hr className="border-border-light/60 border-dashed" />
                  <div>
                    <h4 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-4 flex items-center gap-2">
                      <span className="material-symbols-outlined text-[16px]">admin_panel_settings</span>
                      2. Asignación de Roles
                    </h4>
                    <label className="flex flex-col gap-1.5">
                      <span className="text-xs font-medium text-text-secondary">Global Role ID</span>
                      <div className="relative">
                        <input
                          className="form-input w-full pr-10 rounded-lg border-border-light bg-white text-text-main text-xs font-mono h-11 focus:ring-primary focus:border-primary"
                          readOnly
                          type="text"
                          value={ENV_CONFIGURATIONS[environment]?.ksec_admin_role || 'rol_d1_YXAvDRbZzwEBcafYwgxiZ6'}
                        />
                        <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-green-600 text-[18px]">check_circle</span>
                      </div>
                    </label>
                  </div>

                  {/* Sección 3: Asignación de Menú/Productos */}
                  <hr className="border-border-light/60 border-dashed" />
                  <div>
                    <h4 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-4 flex items-center gap-2">
                      <span className="material-symbols-outlined text-[16px]">menu_open</span>
                      3. Asignación de Menú/Productos
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <label className="flex flex-col gap-1.5">
                        <span className="text-xs font-medium text-text-secondary">Menu Role Public ID</span>
                        <input
                          className="form-input w-full rounded-lg border-border-light text-text-main text-sm h-11 focus:ring-primary focus:border-primary placeholder:text-text-secondary/50 font-mono"
                          placeholder="MNU-XXXX-XXXX"
                          type="text"
                        />
                      </label>
                      <label className="flex flex-col gap-1.5">
                        <span className="text-xs font-medium text-text-secondary">Product Public ID</span>
                        <input
                          className="form-input w-full rounded-lg border-border-light text-text-main text-sm h-11 focus:ring-primary focus:border-primary placeholder:text-text-secondary/50 font-mono"
                          placeholder="PRD-XXXX-XXXX"
                          type="text"
                        />
                      </label>
                    </div>
                  </div>

                  {/* Botón Finalizar */}
                  <div className="mt-4">
                    <button
                      className="w-full bg-primary hover:bg-blue-600 text-white font-bold text-base py-4 px-6 rounded-lg shadow-lg shadow-blue-200 transition-all flex items-center justify-center gap-2"
                      onClick={saveStep3}
                      disabled={savingStep === 3 || savedSteps.step3 || !savedSteps.step1}
                    >
                      <span>Finalizar Onboarding</span>
                      <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
                    </button>
                    <p className="text-center text-xs text-text-secondary mt-3">
                      This action will trigger welcome emails.
                    </p>
                  </div>

                  {/* Summary */}
                  {savedSteps.step3 && (
                    <div className="mt-2 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                      <h5 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2 border-b border-gray-200 pb-2">
                        <span className="material-symbols-outlined text-[18px] text-primary">terminal</span>
                        Usuario (KSEC) Summary
                      </h5>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3 text-xs">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-gray-500 font-semibold uppercase tracking-wide text-[10px]">User ID</span>
                          <span className="font-mono font-medium text-gray-900 bg-white border border-gray-200 px-2 py-1 rounded">
                            {ctx.user_id_global || 'USR-8829-01'}
                          </span>
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-gray-500 font-semibold uppercase tracking-wide text-[10px]">Public ID</span>
                          <span className="font-mono font-medium text-gray-900 bg-white border border-gray-200 px-2 py-1 rounded">
                            {ctx.organization_public_id || 'PUB-X7Y8Z9'}
                          </span>
                        </div>
                        <div className="flex flex-col gap-0.5 md:col-span-2">
                          <span className="text-gray-500 font-semibold uppercase tracking-wide text-[10px]">Email</span>
                          <span className="font-medium text-gray-900 px-1">{onboardingData.email || 'juan.dev@kashio.com'}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
