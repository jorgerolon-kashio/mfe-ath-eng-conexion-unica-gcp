
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
import { 
  RocketLaunchIcon, 
  Cog6ToothIcon, 
  CheckCircleIcon, 
  XCircleIcon, 
  ArrowPathIcon,
  CommandLineIcon,
  ShieldCheckIcon,
  UserPlusIcon,
  BanknotesIcon,
  BuildingOfficeIcon,
  AdjustmentsHorizontalIcon,
  PlusIcon,
  TrashIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  KeyIcon,
  ArrowRightIcon,
  ArrowLeftIcon,
  ExclamationCircleIcon,
  ClipboardDocumentIcon,
  ArrowUturnLeftIcon,
  LockClosedIcon,
  ClockIcon,
  GlobeAltIcon,
  ShieldExclamationIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline';

const PROGRESS_KEY = 'kashio_onboarding_v2';


const INITIAL_ONBOARDING_DATA: OnboardingData = {
  onboarding_type: 'CORPORATIVO', // Se determina automáticamente por party_role_type_id, pero se mantiene para compatibilidad con types.ts
  legal_name: '', business_name: '', ruc: '', document_type: 'RUC', sub_type: 'PAYMENT_COLLECTOR', 
  website: '', phone: '', email: '', country: 'PER',
  other_name: '', source_reference: '', industry_id: '1',
  address: { 
    country_code: 'PER', region: 1116, state_province: 8096, city: 6813, 
    locality: '', postcode: '', street_type: 6081, street_name: '', street_number: '',
    street: '', state: '', zip: ''
  },
  party_role_name: '', party_role_description: '', party_role_status_reason: 'Active role', party_role_type_id: 1,
  party_role_contacts: [], // Array de contactos para Party Role
  agreement_name: '', agreement_description: '', agreement_document_number: '', 
  agreement_product_offering_public_id: 'po_d1_abc123xyz',
  agreement_activation_date: new Date().toISOString().split('T')[0] + 'T00:00:00Z',
  start_date: new Date().toISOString().split('T')[0], 
  end_date: new Date(new Date().setFullYear(new Date().getFullYear() + 5)).toISOString().split('T')[0],
  agreement_type_id: 1,
  agreement_optional: false, // Por defecto no es opcional
  contact_medium_type_id: 1, contact_medium_type_name: 'Email', contact_medium_email: '',
  branches: [{ 
    name: 'Sucursal Principal', 
    address: { street: '', city: '', state: '', zip: '', country: 'PE' },
    preferred: true 
  }],
  first_name: '', middle_name: '', last_name: '', title: '', birth_country_code: 'PEN', birth_date: '1990-01-01',
  individual_contacts: [], // Array de contactos para Individual
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

const INITIAL_PHASES: PhaseStatus[] = [
  { id: 1, name: 'Información de la Empresa', steps: [
    { id: '1.1', name: 'Crear Organización Completa', status: 'idle' },
  ]},
  { id: 2, name: 'Acuerdo y Productos', steps: [
    { id: '2.1', name: 'Crear Acuerdo', status: 'idle' },
  ]},
  { id: 3, name: 'Usuario Administrador', steps: [
    { id: '3.1', name: 'Crear Usuario Completo', status: 'idle' },
  ]}
];

// Función helper para convertir fechas a formato MySQL datetime
const formatMySQLDateTime = (date: Date, time: string = '00:00:00'): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day} ${time}`;
};

// Función helper para determinar el tipo de onboarding basado en party_role_type_id
// SUCURSAL: party_role_type_id = 3 (Sucursal)
// CORPORATIVO: party_role_type_id = 1 (Holding) o 2 (Corporativo) u otros
const getOnboardingType = (partyRoleTypeId: number): 'CORPORATIVO' | 'SUCURSAL' => {
  // ID 3 = Sucursal
  if (partyRoleTypeId === 3) {
    return 'SUCURSAL';
  }
  // Por defecto es CORPORATIVO (Holding, Corporativo, etc.)
  return 'CORPORATIVO';
};

// Función para calcular el siguiente paso válido según el tipo de onboarding
const getNextStep = (currentStep: number, partyRoleTypeId: number, agreementOptional: boolean): number => {
  const onboardingType = getOnboardingType(partyRoleTypeId);
  if (currentStep === 1) {
    // Empresa → Contrato (si es necesario) o fin (si es Sucursal sin acuerdo)
    if (onboardingType === 'SUCURSAL' && agreementOptional) {
      return 1; // No hay más pasos para Sucursal sin acuerdo
    }
    return 2; // Ir a contrato
  }
  if (currentStep === 2) {
    // Contrato → Usuario (solo si es Corporativo) o fin
    return onboardingType === 'CORPORATIVO' ? 3 : 2; // Si es SUCURSAL, no hay más pasos
  }
  if (currentStep === 3) {
    // Usuario → fin
    return 3;
  }
  return currentStep;
};

// Función para calcular el paso anterior válido
const getPreviousStep = (currentStep: number, partyRoleTypeId: number, agreementOptional: boolean): number => {
  if (currentStep === 1) return 1; // Ya estamos en el primer paso
  if (currentStep === 2) return 1; // Contrato → Empresa
  if (currentStep === 3) {
    // Usuario → Contrato (si existe) o Empresa
    const onboardingType = getOnboardingType(partyRoleTypeId);
    if (onboardingType === 'CORPORATIVO' && !agreementOptional) {
      return 2; // Volver a contrato
    }
    return 1; // Volver a empresa
  }
  return currentStep - 1;
};

const App: React.FC = () => {
  const [formStep, setFormStep] = useState(1); // Empezar directamente en paso 1 (Organización) 
  const [isMock, setIsMock] = useState(false); // BFF handles all requests
  const [onboardingData, setOnboardingData] = useState<OnboardingData>(INITIAL_ONBOARDING_DATA);
  const [isRunning, setIsRunning] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [logs, setLogs] = useState<{msg: string, type: string, time: string}[]>([]);
  const [ctx, setCtx] = useState<Record<string, any>>({});
  const [phases, setPhases] = useState<PhaseStatus[]>(INITIAL_PHASES);
  const [savedSession, setSavedSession] = useState<OnboardingProgress | null>(null);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [savedSteps, setSavedSteps] = useState<{step1: boolean, step2: boolean, step3: boolean}>({
    step1: false,
    step2: false,
    step3: false
  });
  const [savingStep, setSavingStep] = useState<number | null>(null);

  // El environment ahora se determina desde la variable de entorno VITE_ENVIRONMENT
  // Por defecto usa LOCAL si no está definida
  const [environment] = useState<Environment>(() => {
    const envFromVar = import.meta.env.VITE_ENVIRONMENT;
    if (envFromVar && ['LOCAL', 'd1', 'q3'].includes(envFromVar)) {
      return envFromVar as Environment;
    }
    return 'LOCAL';
  });
  
  const logEndRef = useRef<HTMLDivElement>(null);

  const envConfig = useMemo(() => {
    return buildEnvironmentConfig(environment);
  }, [environment]);

  const api = useMemo(() => new KashioApiService(envConfig, isMock), [envConfig, isMock]);

  useEffect(() => {
    // Update KSEC configurations based on environment
    const config = ENV_CONFIGURATIONS[environment];
    if (config) {
      setOnboardingData(prev => ({
        ...prev,
        configuraciones_ksec: [...config.configuraciones]
      }));
    }
  }, [environment]);

  useEffect(() => {
    let interval: any;
    if (isRunning && startTime) {
      interval = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning, startTime]);

  const addLog = useCallback((msg: string, type: 'info' | 'error' | 'success' = 'info') => {
    setLogs(prev => [...prev, { msg, type, time: new Date().toLocaleTimeString() }]);
  }, []);

  useEffect(() => {
    if (logEndRef.current) logEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const persist = useCallback((currentCtx: Record<string, any>, completed: string[], failed?: {id: string, message: string}) => {
    const progress: OnboardingProgress = {
      executionId: currentCtx.executionId || Date.now().toString(),
      sessionCtx: currentCtx,
      completedSteps: completed,
      lastUpdated: new Date().toISOString(),
      onboardingData,
      envType: environment === 'LOCAL' ? 'local' : 'dev',
      environment,
      failedStep: failed
    };
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
    setSavedSession(progress);
  }, [onboardingData, environment]);

  useEffect(() => {
    const saved = localStorage.getItem(PROGRESS_KEY);
    if (saved) {
      const parsed: OnboardingProgress = JSON.parse(saved);
      setSavedSession(parsed);
    }
  }, []);

  const recover = () => {
    if (!savedSession) return;
    setOnboardingData(savedSession.onboardingData);
    // Environment ya no se puede cambiar desde el UI, se lee de variables de entorno
    setCtx(savedSession.sessionCtx);
    setPhases(prev => prev.map(p => ({
      ...p,
      steps: p.steps.map(s => ({
        ...s,
        status: savedSession.completedSteps.includes(s.id) ? 'success' : (savedSession.failedStep?.id === s.id ? 'error' : 'idle'),
        error: savedSession.failedStep?.id === s.id ? savedSession.failedStep.message : undefined
      }))
    })));
    setFormStep(5);
    addLog(`Sesión recuperada: ${savedSession.executionId}`, 'info');
  };

  const updateStepStatus = (id: string, status: StepStatus['status'], error?: string) => {
    setPhases(prev => prev.map(p => ({
      ...p,
      steps: p.steps.map(s => s.id === id ? { ...s, status, error } : s)
    })));
  };

  // Función para guardar Paso 1: Empresa
  const saveStep1 = async () => {
    if (savingStep === 1 || savedSteps.step1) return;
    
    // Validaciones básicas
    if (!onboardingData.legal_name) {
      addLog('Por favor completa la Razón Social', 'error');
      return;
    }
    if (!onboardingData.party_role_type_id) {
      addLog('Por favor selecciona el Tipo de Empresa', 'error');
      return;
    }
    if (getOnboardingType(onboardingData.party_role_type_id) === 'SUCURSAL' && !onboardingData.parent_corporativo_party_role_public_id) {
      addLog('Por favor ingresa la Empresa Principal (Corporativo) para Sucursales', 'error');
      return;
    }

    setSavingStep(1);
    setIsRunning(true);
    addLog('Guardando información de la empresa...', 'info');
    updateStepStatus('1.1', 'running');

    try {
      const sessionCtx: Record<string, any> = { ...ctx, executionId: ctx.executionId || Date.now().toString() };
      
      // Preparar contactos
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
        web_site: onboardingData.website, // BFF espera web_site, no website
        other_name: onboardingData.other_name,
        source_reference: onboardingData.source_reference,
        industry_id: onboardingData.industry_id || '1',
        country_code: onboardingData.country || 'PER', // BFF espera country_code, no country
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
        contacts: allContacts, // BFF espera contacts, no party_role_contacts
        party_role_name: onboardingData.party_role_name || onboardingData.legal_name,
        party_role_description: onboardingData.party_role_description || `Rol para ${onboardingData.legal_name}`,
        party_role_type_id: onboardingData.party_role_type_id,
        parent_corporativo_party_role_public_id: onboardingData.parent_corporativo_party_role_public_id || null,
        relationship_type_id: onboardingData.relationship_type_id || 2,
        relationship_description: onboardingData.relationship_description || 'Relación entre Corporativo y Sucursal'
      };

      const orgCompleteResponse = await api.call('KBRM', '/organizations/complete', 'POST', orgCompletePayload);
      
      const orgData = orgCompleteResponse.data || orgCompleteResponse;
      sessionCtx.organization_public_id = orgData.organization_public_id || orgData.data?.organization_public_id;
      sessionCtx.organization_party_id = orgData.organization_party_id || orgData.data?.organization_party_id;
      sessionCtx.party_role_public_id = orgData.party_role_public_id || orgData.data?.party_role_public_id;
      sessionCtx.party_role_id = orgData.party_role_id || orgData.data?.party_role_id;
      sessionCtx.address_id = orgData.address_id || orgData.data?.address_id;
      
      setCtx(sessionCtx);
      setSavedSteps(prev => ({ ...prev, step1: true }));
      updateStepStatus('1.1', 'success');
      addLog(`✓ Empresa registrada exitosamente. ID: ${sessionCtx.organization_public_id}`, 'success');
      persist(sessionCtx, ['1.1']);
      
    } catch (err: any) {
      const errorMsg = err.message || JSON.stringify(err).substring(0, 200);
      updateStepStatus('1.1', 'error', errorMsg);
      addLog(`Error al guardar empresa: ${errorMsg}`, 'error');
    } finally {
      setSavingStep(null);
      setIsRunning(false);
    }
  };

  // Función para guardar Paso 2: Contrato
  const saveStep2 = async () => {
    if (savingStep === 2 || savedSteps.step2 || !savedSteps.step1) return;
    
    // Validaciones
    if (!onboardingData.agreement_name) {
      addLog('Por favor completa el Nombre del Contrato', 'error');
      return;
    }
    if (!onboardingData.agreement_document_number) {
      addLog('Por favor completa el Número de Documento', 'error');
      return;
    }
    if (!onboardingData.agreement_product_offering_public_id) {
      addLog('Por favor completa el Product Offering Public ID', 'error');
      return;
    }

    setSavingStep(2);
    setIsRunning(true);
    addLog('Guardando contrato...', 'info');
    updateStepStatus('2.1', 'running');

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
      updateStepStatus('2.1', 'success');
      addLog(`✓ Contrato creado exitosamente. ID: ${sessionCtx.agreement_id}`, 'success');
      persist(sessionCtx, ['1.1', '2.1']);
      
    } catch (err: any) {
      const errorMsg = err.message || JSON.stringify(err).substring(0, 200);
      updateStepStatus('2.1', 'error', errorMsg);
      addLog(`Error al guardar contrato: ${errorMsg}`, 'error');
    } finally {
      setSavingStep(null);
      setIsRunning(false);
    }
  };

  // Función para guardar Paso 3: Usuario
  const saveStep3 = async () => {
    if (savingStep === 3 || savedSteps.step3 || !savedSteps.step1) return;
    
    // Validaciones
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
    setIsRunning(true);
    addLog('Creando usuario administrador...', 'info');
    updateStepStatus('3.1', 'running');

    try {
      const sessionCtx: Record<string, any> = { ...ctx };
      
      if (!sessionCtx.organization_public_id) {
        throw new Error('Debes completar el Paso 1 primero');
      }

      // Preparar contactos del individual
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

      const userCompletePayload = {
        organization_public_id: sessionCtx.organization_public_id,
        first_name: onboardingData.first_name,
        last_name: onboardingData.last_name,
        email: onboardingData.email,
        phone: onboardingData.user_phone || onboardingData.phone || '',
        user_type_id: onboardingData.user_type_id || '1',
        individual_contacts: individualContacts,
        ksec_admin_role: ENV_CONFIGURATIONS[environment].ksec_admin_role,
        configuraciones_ksec: onboardingData.configuraciones_ksec || ENV_CONFIGURATIONS[environment].configuraciones
      };

      const userCompleteResponse = await api.call('KSEC', '/users/complete', 'POST', userCompletePayload);
      
      const userData = userCompleteResponse.data || userCompleteResponse;
      sessionCtx.individual_public_id = userData.individual_public_id || userData.data?.individual_public_id;
      sessionCtx.individual_party_id = userData.individual_party_id || userData.data?.individual_party_id;
      sessionCtx.user_id_global = userData.user_id_global || userData.data?.user_id_global;
      
      setCtx(sessionCtx);
      setSavedSteps(prev => ({ ...prev, step3: true }));
      updateStepStatus('3.1', 'success');
      addLog(`✓ Usuario creado exitosamente. ID: ${sessionCtx.user_id_global}`, 'success');
      addLog('✓ Onboarding Completado', 'success');
      persist(sessionCtx, ['1.1', '2.1', '3.1']);
      
      // Limpiar sesión guardada al completar
      localStorage.removeItem(PROGRESS_KEY);
      setSavedSession(null);
      
    } catch (err: any) {
      const errorMsg = err.message || JSON.stringify(err).substring(0, 200);
      updateStepStatus('3.1', 'error', errorMsg);
      addLog(`Error al crear usuario: ${errorMsg}`, 'error');
    } finally {
      setSavingStep(null);
      setIsRunning(false);
    }
  };

  const startDeployment = async (resume: boolean = false) => {
    if (isRunning) return;
    setIsRunning(true);
    setStartTime(Date.now());
    setFormStep(5);

    if (!resume) {
      setLogs([]);
      setPhases(INITIAL_PHASES);
      setElapsed(0);
    }

    const sessionCtx: Record<string, any> = resume ? { ...ctx } : { executionId: Date.now().toString() };
    const completed = resume ? [...(savedSession?.completedSteps || [])] : [];
    
    const runStep = async (id: string, fn: () => Promise<any>) => {
      if (completed.includes(id)) return;
      updateStepStatus(id, 'running');
      try {
        await fn();
        completed.push(id);
        updateStepStatus(id, 'success');
        persist(sessionCtx, completed);
      } catch (err: any) {
        const errorMsg = err.message || JSON.stringify(err).substring(0, 500);
        updateStepStatus(id, 'error', errorMsg);
        persist(sessionCtx, completed, { id, message: errorMsg });
        addLog(`Error en paso ${id}: ${errorMsg}`, 'error');
        setIsRunning(false);
        throw err;
      }
    };

    try {
      addLog('Iniciando Orquestación de Merchant...', 'info');
      
      const isCorporativo = getOnboardingType(onboardingData.party_role_type_id) === 'CORPORATIVO';
      
      // PASO 1: Crear Organización Completa (con Party Role, Dirección y Contactos automáticos)
      await runStep('1.1', async () => {
        addLog('Creando organización y configurando recursos relacionados...', 'info');
        
        // Preparar contactos combinando party_role_contacts y contactos de la organización
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
            number: onboardingData.phone,
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
            country_code: 'PER',
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
          party_role_description: onboardingData.party_role_description || `Party role for ${onboardingData.legal_name}`,
          party_role_type_id: onboardingData.party_role_type_id || 1,
          parent_corporativo_party_role_public_id: onboardingData.parent_corporativo_party_role_public_id || null,
          relationship_type_id: onboardingData.relationship_type_id,
          relationship_description: onboardingData.relationship_description
        };

        const orgCompleteResponse = await api.call('KBRM', '/kbrm/v2/organizations/complete', 'POST', orgCompletePayload);
        
        const orgData = orgCompleteResponse.data || orgCompleteResponse;
        sessionCtx.organization_public_id = orgData.organization?.public_id;
        sessionCtx.organization_party_id = orgData.organization?.party_id;
        sessionCtx.party_role_public_id = orgData.party_role?.public_id;
        sessionCtx.party_role_party_id = orgData.party_role?.party_id;
        sessionCtx.party_role_id = orgData.party_role?.party_role_id;
        
        addLog(`Organización completa creada: ${sessionCtx.organization_public_id}`, 'success');
        addLog(`Party Role creado automáticamente: ${sessionCtx.party_role_public_id}`, 'success');
        addLog(`Dirección y contactos configurados automáticamente`, 'success');
      });

      // PASO 2: Crear Agreement (solo si es necesario)
      const shouldCreateAgreement = isCorporativo || !onboardingData.agreement_optional;
      if (shouldCreateAgreement) {
        await runStep('2.1', async () => {
          let activationDate = onboardingData.agreement_activation_date || formatMySQLDateTime(new Date(), '00:00:00');
          if (activationDate.includes('T') && activationDate.includes('Z')) {
            const date = new Date(activationDate);
            activationDate = formatMySQLDateTime(date, '00:00:00');
          }
          
          // Soporte para múltiples productos
          const productOfferingIds = Array.isArray(onboardingData.agreement_product_offering_public_id) 
            ? onboardingData.agreement_product_offering_public_id 
            : [onboardingData.agreement_product_offering_public_id];
          
          const agreementPayload: any = {
            name: onboardingData.agreement_name || `Contrato ${onboardingData.legal_name}`,
            description: onboardingData.agreement_description || 'Conéxion Única - Reconciliación - Ánalisis de datos',
            document_number: onboardingData.agreement_document_number || 'AUTO-' + Date.now(),
            assigned_to: sessionCtx.party_role_public_id,
            product_offering_public_id: productOfferingIds.length === 1 ? productOfferingIds[0] : productOfferingIds,
            start_datetime: onboardingData.start_date + ' 00:00:00',
            end_datetime: onboardingData.end_date + ' 23:59:59',
            activation_date: activationDate
          };
          
          if (onboardingData.agreement_type_id) {
            agreementPayload.agreement_type_id = onboardingData.agreement_type_id;
          }
          
          const agreement = await api.call('KBRM', '/kbrm/v2/agreements', 'POST', agreementPayload);
          sessionCtx.agreement_id = agreement.data?.agreement_id || agreement.agreement_id;
          addLog(`Acuerdo creado con ${productOfferingIds.length} producto(s): ${sessionCtx.agreement_id}`, 'success');
        });
      } else {
        addLog('Acuerdo omitido (opcional para SUCURSAL)', 'success');
      }

      // PASO 3: Crear Usuario Completo (solo CORPORATIVO)
      if (isCorporativo) {
        await runStep('3.1', async () => {
          addLog('Creando usuario y configurando acceso...', 'info');
          
          // Preparar contactos del individual
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
              number: onboardingData.user_phone || onboardingData.phone,
              preferred: false
            }] : [])
          ];

          // Preparar roles
          const roles = onboardingData.configuraciones_ksec?.map((c: any) => c.rol_public_id) || [ENV_CONFIGURATIONS[environment].ksec_admin_role];
          
          // Preparar menú (tomar el primero de configuraciones_ksec si existe)
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

          const userCompleteResponse = await api.call('KSEC', '/ksec/v1/users/complete', 'POST', userCompletePayload);
          
          const userData = userCompleteResponse.data || userCompleteResponse;
          sessionCtx.individual_public_id = userData.individual?.public_id;
          sessionCtx.user_public_id = userData.user?.public_id;
          sessionCtx.user_id_global = userData.user?.public_id;
          
          addLog(`Usuario completo creado: ${sessionCtx.user_public_id}`, 'success');
          addLog(`Individual y Party Role creados automáticamente`, 'success');
          addLog(`Roles y menús configurados automáticamente`, 'success');
        });
      }

      addLog('ONBOARDING COMPLETADO', 'success');
      localStorage.removeItem(PROGRESS_KEY);
      setSavedSession(null);
    } catch (e) {
      addLog(`Proceso interrumpido.`, 'error');
    } finally {
      setIsRunning(false);
    }
  };

  const totalSteps = phases.flatMap(p => p.steps).length;
  const progressPercent = Math.round((phases.flatMap(p => p.steps).filter(s => s.status === 'success').length / totalSteps) * 100);
  const errorCount = logs.filter(l => l.type === 'error').length;

  return (
    <div className="flex h-screen w-full bg-gradient-to-br from-slate-50 via-white to-slate-100 text-slate-800 overflow-hidden font-sans">
      
      {/* SIDEBAR */}
      <aside className="w-80 bg-gradient-to-b from-white to-slate-50 border-r-2 border-blue-300 flex flex-col backdrop-blur-3xl z-30 overflow-hidden shadow-xl">
        <div className="p-8 border-b-2 border-blue-200 flex items-center gap-3 bg-gradient-to-r from-blue-50 to-purple-50">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
            <RocketLaunchIcon className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="font-black text-xl text-slate-900 leading-none tracking-tight">
              Kashio <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Studio</span>
            </h1>
            <p className="text-[11px] text-blue-600 uppercase tracking-widest font-bold mt-1">Onboarding v2.5</p>
            <p className="text-[9px] text-emerald-600 uppercase tracking-widest font-bold mt-1 flex items-center gap-1">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
              BFF Connected
            </p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
          {phases.map(phase => (
            <div key={phase.id} className="space-y-4">
              <h3 className="text-[11px] font-black text-blue-700 uppercase tracking-[0.2em] px-3 py-2 bg-blue-100 rounded-lg border border-blue-300">
                {phase.name}
              </h3>
              <div className="space-y-2">
                {phase.steps.map(step => (
                  <div key={step.id} className={`group flex items-center gap-3 p-3 rounded-xl border-2 transition-all transform hover:scale-[1.02] ${
                    step.status === 'success' ? 'bg-gradient-to-r from-emerald-50 to-emerald-100 border-emerald-300 shadow-md' :
                    step.status === 'running' ? 'bg-gradient-to-r from-blue-50 to-blue-100 border-blue-400 shadow-md animate-pulse' :
                    step.status === 'error' ? 'bg-gradient-to-r from-rose-50 to-rose-100 border-rose-300 shadow-md' :
                    'bg-slate-100 border-slate-300 opacity-70 hover:opacity-100'
                  }`}>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-mono border-2 shadow-lg ${
                      step.status === 'success' ? 'bg-emerald-500 border-emerald-400 text-white shadow-md' :
                      step.status === 'running' ? 'bg-blue-500 border-blue-400 text-white shadow-md animate-pulse' :
                      step.status === 'error' ? 'bg-rose-500 border-rose-400 text-white shadow-md' :
                      'bg-slate-300 border-slate-400 text-slate-600'
                    }`}>
                      {step.status === 'success' ? <CheckCircleIcon className="w-5 h-5" /> : 
                       step.status === 'error' ? <XCircleIcon className="w-5 h-5" /> : step.id}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-[12px] font-bold truncate ${
                        step.status === 'success' ? 'text-emerald-700' :
                        step.status === 'running' ? 'text-blue-700 font-black' :
                        step.status === 'error' ? 'text-rose-700' :
                        'text-slate-600'
                      }`}>{step.name}</p>
                      {step.error && (
                        <p className="text-[10px] text-rose-400/80 truncate mt-1">{step.error.substring(0, 50)}...</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="p-6 bg-gradient-to-t from-white to-slate-50 border-t-2 border-blue-200">
          <div className="flex justify-between items-center mb-3">
            <span className="text-[11px] uppercase font-black text-blue-700 tracking-widest">Progreso Global</span>
            <span className="text-lg font-mono font-black text-blue-600">{progressPercent}%</span>
          </div>
          <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden border border-slate-300 shadow-inner">
            <div 
              className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-blue-600 transition-all duration-1000 shadow-md" 
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="mt-3 flex items-center justify-between text-[10px] text-slate-600">
            <span>{phases.flatMap(p => p.steps).filter(s => s.status === 'success').length} / {totalSteps} completados</span>
            {errorCount > 0 && (
              <span className="text-rose-400 font-bold">{errorCount} errores</span>
            )}
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col relative bg-gradient-to-br from-slate-50 to-white overflow-hidden">
        
        {/* HEADER */}
        <header className="h-24 border-b-2 border-blue-200 flex items-center justify-between px-10 backdrop-blur-xl bg-white/90 z-20 shadow-sm">
          <div className="flex items-center gap-8">
            <button 
              onClick={() => setShowLogs(!showLogs)} 
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl transition-all border-2 font-black uppercase tracking-widest text-[11px] shadow-md ${
                errorCount > 0 ? 'bg-gradient-to-r from-rose-50 to-rose-100 text-rose-700 border-rose-300 hover:from-rose-100 hover:to-rose-200' : 
                'bg-gradient-to-r from-slate-100 to-slate-200 text-slate-700 border-blue-200 hover:from-slate-200 hover:to-slate-300'
              }`}
            >
              <CommandLineIcon className="w-5 h-5" />
              <span>Logs</span>
              {errorCount > 0 && <span className="bg-rose-500 text-white text-[10px] w-6 h-6 flex items-center justify-center rounded-full ml-1 font-black shadow-md">{errorCount}</span>}
            </button>
            {isRunning && (
              <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-300 rounded-xl">
                <ClockIcon className="w-4 h-4 text-blue-600 animate-spin" />
                <span className="text-[11px] font-black text-blue-700 uppercase tracking-widest">
                  {Math.floor(elapsed / 60)}m {elapsed % 60}s
                </span>
              </div>
            )}
          </div>

          <div className="flex gap-4">
            {savedSession && formStep < 5 && (
              <button onClick={recover} className="flex items-center gap-2 bg-gradient-to-r from-amber-50 to-amber-100 hover:from-amber-100 hover:to-amber-200 text-amber-700 px-5 py-2.5 rounded-xl border-2 border-amber-300 transition-all text-[11px] font-black uppercase tracking-widest shadow-md">
                <ArrowUturnLeftIcon className="w-5 h-5" /> Recuperar
              </button>
            )}
            {formStep > 1 && (
              <button 
                onClick={() => {
                  setFormStep(1);
                  setLogs([]);
                  setPhases(INITIAL_PHASES);
                  setIsRunning(false);
                  setElapsed(0);
                  setStartTime(null);
                }}
                className="flex items-center gap-2 bg-gradient-to-r from-slate-100 to-slate-200 hover:from-slate-200 hover:to-slate-300 text-slate-700 px-5 py-2.5 rounded-xl border-2 border-slate-300 transition-all text-[11px] font-black uppercase tracking-widest shadow-md"
              >
                <ArrowUturnLeftIcon className="w-5 h-5" /> Reiniciar
              </button>
            )}
          </div>
        </header>


        {/* MAIN CONTENT FORM */}
        <div className="flex-1 overflow-y-auto p-12 custom-scrollbar">
          <div className="max-w-4xl mx-auto">
            {(() => {
              // Mostrar vista de ejecución solo cuando el proceso está corriendo o cuando hay logs (proceso completado)
              // No mostrar vista de ejecución solo por el formStep
              const shouldShowExecutionView = isRunning || logs.length > 0;
              return !shouldShowExecutionView;
            })() ? (
              <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {(
                  <div className="flex items-center justify-between bg-white p-2 rounded-2xl border border-slate-200 shadow-lg backdrop-blur-md">
                    {[
                      { id: 1, label: 'Empresa', icon: BuildingOfficeIcon, saved: savedSteps.step1 },
                      ...(getOnboardingType(onboardingData.party_role_type_id) === 'CORPORATIVO' || !onboardingData.agreement_optional ? [{ id: 2, label: 'Contrato', icon: BanknotesIcon, saved: savedSteps.step2 }] : []),
                      ...(getOnboardingType(onboardingData.party_role_type_id) === 'CORPORATIVO' ? [{ id: 3, label: 'Usuario', icon: LockClosedIcon, saved: savedSteps.step3 }] : [])
                    ].map((step) => {
                      const canAccess = step.id === 1 || (step.id === 2 && savedSteps.step1) || (step.id === 3 && savedSteps.step1 && savedSteps.step2);
                      return (
                        <button 
                          key={step.id} 
                          onClick={() => canAccess && setFormStep(step.id)} 
                          disabled={!canAccess}
                          className={`flex-1 flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all relative ${
                            formStep === step.id ? 'bg-blue-600 text-white shadow-md' : 
                            !canAccess ? 'text-slate-400 cursor-not-allowed opacity-50' : 
                            'text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          <step.icon className={`w-4 h-4 ${formStep === step.id ? 'text-white' : 'text-slate-500'}`} />
                          {step.label}
                          {step.saved && (
                            <CheckCircleIcon className="absolute top-1 right-1 w-3 h-3 text-emerald-500" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                {formStep > 0 && (
                  <div className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-xl backdrop-blur-xl min-h-[500px] flex flex-col">
                    {/* STEP 1: EMPRESA */}
                    {formStep === 1 && (
                      <div className="space-y-8 flex-1">
                        <div className="flex items-center gap-4 border-b border-slate-200 pb-6">
                          <BuildingOfficeIcon className="w-8 h-8 text-blue-600" />
                          <div>
                            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Registrar Nueva Empresa</h2>
                            <p className="text-xs text-slate-600">Información legal y comercial</p>
                          </div>
                        </div>

                        {/* Sección 1: Información Legal */}
                        <div className="space-y-6">
                          <h3 className="text-sm font-black uppercase text-slate-700 tracking-widest border-b border-slate-200 pb-2">Información Legal</h3>
                          <div className="grid grid-cols-2 gap-6">
                            <div className="col-span-2 space-y-2">
                              <label className="text-[10px] font-black uppercase text-slate-700 tracking-widest ml-1">Razón Social *</label>
                              <input className="w-full bg-white border border-slate-300 rounded-2xl px-6 py-4 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200" value={onboardingData.legal_name} onChange={e => setOnboardingData({...onboardingData, legal_name: e.target.value})} placeholder="Nombre Legal" />
                            </div>
                            <div className="space-y-2">
                              <label className="text-[10px] font-black uppercase text-slate-700 tracking-widest ml-1">Nombre Comercial</label>
                              <input className="w-full bg-white border border-slate-300 rounded-2xl px-6 py-4 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200" value={onboardingData.other_name} onChange={e => setOnboardingData({...onboardingData, other_name: e.target.value})} placeholder="Otro nombre" />
                            </div>
                            <div className="space-y-2">
                              <label className="text-[10px] font-black uppercase text-slate-700 tracking-widest ml-1">Website</label>
                              <input className="w-full bg-white border border-slate-300 rounded-2xl px-6 py-4 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200" value={onboardingData.website} onChange={e => setOnboardingData({...onboardingData, website: e.target.value})} placeholder="www.example.com" />
                            </div>
                            <div className="space-y-2">
                              <label className="text-[10px] font-black uppercase text-slate-700 tracking-widest ml-1">Referencia CRM (ZOHO)</label>
                              <input className="w-full bg-white border border-slate-300 rounded-2xl px-6 py-4 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200" value={onboardingData.source_reference} onChange={e => setOnboardingData({...onboardingData, source_reference: e.target.value})} placeholder="ZOHO-12345" />
                            </div>
                            <div className="space-y-2">
                              <label className="text-[10px] font-black uppercase text-slate-700 tracking-widest ml-1">País *</label>
                              <select className="w-full bg-white border border-slate-300 rounded-2xl px-6 py-4 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200" value={onboardingData.country} onChange={e => setOnboardingData({...onboardingData, country: e.target.value})}>
                                <option value="PER">Perú (PER)</option>
                                <option value="PEN">Perú (PEN)</option>
                              </select>
                            </div>
                          </div>
                        </div>

                        {/* Sección 2: Tipo de Empresa (reemplaza Party Role) */}
                        <div className="space-y-6 border-t border-slate-200 pt-6">
                          <h3 className="text-sm font-black uppercase text-slate-700 tracking-widest border-b border-slate-200 pb-2">Tipo de Empresa</h3>
                          <div className="grid grid-cols-2 gap-6">
                            <div className="col-span-2 space-y-2">
                              <label className="text-[10px] font-black uppercase text-slate-700 tracking-widest ml-1">¿Qué tipo de empresa es? *</label>
                              <select className="w-full bg-white border border-slate-300 rounded-2xl px-6 py-4 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200" value={onboardingData.party_role_type_id} onChange={e => setOnboardingData({...onboardingData, party_role_type_id: parseInt(e.target.value)})}>
                                <option value="">Seleccione un tipo</option>
                                {getActivePartyRoleTypes().map(type => (
                                  <option key={type.party_role_type_id} value={type.party_role_type_id}>
                                    {type.name} {type.code === 'HOLDING' ? '(Empresa Principal)' : type.code === 'CORPORATIVO' ? '(Corporativo)' : type.code === 'SUCURSAL' ? '(Sucursal)' : ''}
                                  </option>
                                ))}
                              </select>
                            </div>
                            
                            {/* Si es SUCURSAL, mostrar campo para Empresa Principal */}
                            {getOnboardingType(onboardingData.party_role_type_id) === 'SUCURSAL' && (
                              <div className="col-span-2 space-y-2 p-4 bg-blue-50 rounded-xl border border-blue-200">
                                <label className="text-[10px] font-black uppercase text-slate-700 tracking-widest ml-1">Empresa Principal (Corporativo) *</label>
                                <input className="w-full bg-white border border-slate-300 rounded-2xl px-6 py-4 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200" value={onboardingData.parent_corporativo_party_role_public_id || ''} onChange={e => setOnboardingData({...onboardingData, parent_corporativo_party_role_public_id: e.target.value})} placeholder="Buscar por nombre o ID... (ej: prtr_stage_CDxW39jDF4GfxSWsy36VJq)" />
                                <p className="text-xs text-slate-500 italic mt-1">💡 Busca la empresa principal a la que pertenece esta sucursal</p>
                              </div>
                            )}

                            <div className="col-span-2 space-y-2">
                              <label className="text-[10px] font-black uppercase text-slate-700 tracking-widest ml-1">Descripción del Rol</label>
                              <textarea className="w-full bg-white border border-slate-300 rounded-2xl px-6 py-4 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200" rows={2} value={onboardingData.party_role_description} onChange={e => setOnboardingData({...onboardingData, party_role_description: e.target.value})} placeholder="Descripción opcional del rol de la empresa" />
                            </div>
                          </div>
                        </div>

                        {/* Sección 3: Dirección */}
                        <div className="space-y-6 border-t border-slate-200 pt-6">
                          <h3 className="text-sm font-black uppercase text-slate-700 tracking-widest border-b border-slate-200 pb-2">Dirección de la Empresa</h3>
                          <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-2">
                              <label className="text-[10px] font-black uppercase text-slate-700 tracking-widest ml-1">País *</label>
                              <input className="w-full bg-slate-100 border border-slate-300 rounded-2xl px-6 py-4 text-slate-600 outline-none cursor-not-allowed" value="Perú (PER)" disabled />
                            </div>
                            <div className="space-y-2">
                              <label className="text-[10px] font-black uppercase text-slate-700 tracking-widest ml-1">Región *</label>
                              <input className="w-full bg-white border border-slate-300 rounded-2xl px-6 py-4 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200" type="number" value={onboardingData.address.region || 1116} onChange={e => setOnboardingData({...onboardingData, address: {...onboardingData.address, region: parseInt(e.target.value) || 1116}})} placeholder="1116" />
                            </div>
                            <div className="space-y-2">
                              <label className="text-[10px] font-black uppercase text-slate-700 tracking-widest ml-1">Provincia *</label>
                              <input className="w-full bg-white border border-slate-300 rounded-2xl px-6 py-4 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200" type="number" value={onboardingData.address.state_province || 8096} onChange={e => setOnboardingData({...onboardingData, address: {...onboardingData.address, state_province: parseInt(e.target.value) || 8096}})} placeholder="8096" />
                            </div>
                            <div className="space-y-2">
                              <label className="text-[10px] font-black uppercase text-slate-700 tracking-widest ml-1">Ciudad *</label>
                              <input className="w-full bg-white border border-slate-300 rounded-2xl px-6 py-4 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200" type="number" value={onboardingData.address.city || 6813} onChange={e => setOnboardingData({...onboardingData, address: {...onboardingData.address, city: parseInt(e.target.value) || 6813}})} placeholder="6813" />
                            </div>
                            <div className="space-y-2">
                              <label className="text-[10px] font-black uppercase text-slate-700 tracking-widest ml-1">Distrito</label>
                              <input className="w-full bg-white border border-slate-300 rounded-2xl px-6 py-4 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200" value={onboardingData.address.locality || ''} onChange={e => setOnboardingData({...onboardingData, address: {...onboardingData.address, locality: e.target.value}})} placeholder="Lima" />
                            </div>
                            <div className="space-y-2">
                              <label className="text-[10px] font-black uppercase text-slate-700 tracking-widest ml-1">Código Postal</label>
                              <input className="w-full bg-white border border-slate-300 rounded-2xl px-6 py-4 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200" value={onboardingData.address.postcode || ''} onChange={e => setOnboardingData({...onboardingData, address: {...onboardingData.address, postcode: e.target.value}})} placeholder="1010" />
                            </div>
                            <div className="space-y-2">
                              <label className="text-[10px] font-black uppercase text-slate-700 tracking-widest ml-1">Tipo de Calle *</label>
                              <input className="w-full bg-white border border-slate-300 rounded-2xl px-6 py-4 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200" type="number" value={onboardingData.address.street_type || 6081} onChange={e => setOnboardingData({...onboardingData, address: {...onboardingData.address, street_type: parseInt(e.target.value) || 6081}})} placeholder="6081" />
                            </div>
                            <div className="space-y-2">
                              <label className="text-[10px] font-black uppercase text-slate-700 tracking-widest ml-1">Nombre de Calle *</label>
                              <input className="w-full bg-white border border-slate-300 rounded-2xl px-6 py-4 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200" value={onboardingData.address.street_name || ''} onChange={e => setOnboardingData({...onboardingData, address: {...onboardingData.address, street_name: e.target.value}})} placeholder="San José" />
                            </div>
                            <div className="space-y-2">
                              <label className="text-[10px] font-black uppercase text-slate-700 tracking-widest ml-1">Número *</label>
                              <input className="w-full bg-white border border-slate-300 rounded-2xl px-6 py-4 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200" value={onboardingData.address.street_number || ''} onChange={e => setOnboardingData({...onboardingData, address: {...onboardingData.address, street_number: e.target.value}})} placeholder="123" />
                            </div>
                            <div className="space-y-2">
                              <label className="text-[10px] font-black uppercase text-slate-700 tracking-widest ml-1">Referencia</label>
                              <input className="w-full bg-white border border-slate-300 rounded-2xl px-6 py-4 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200" value={onboardingData.address.external_reference_id || ''} onChange={e => setOnboardingData({...onboardingData, address: {...onboardingData.address, external_reference_id: e.target.value}})} placeholder="Referencia adicional" />
                            </div>
                          </div>
                        </div>

                        {/* Sección 4: Contactos de la Empresa */}
                        <div className="space-y-6 border-t border-slate-200 pt-6">
                          <div className="flex items-center justify-between">
                            <h3 className="text-sm font-black uppercase text-slate-700 tracking-widest border-b border-slate-200 pb-2 flex-1">Contactos de la Empresa</h3>
                            <button type="button" onClick={() => {
                              const newContact: ContactMedium = {
                                contact_medium_type_id: 1,
                                contact_medium_type_name: 'Email',
                                email_address: '',
                                preferred: false
                              };
                              setOnboardingData({
                                ...onboardingData,
                                party_role_contacts: [...onboardingData.party_role_contacts, newContact]
                              });
                            }} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition">
                              <PlusIcon className="w-4 h-4" />
                              Agregar Contacto
                            </button>
                          </div>
                          
                          {onboardingData.party_role_contacts.map((contact, idx) => (
                            <div key={idx} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-slate-700">Contacto {idx + 1}</span>
                                <button type="button" onClick={() => {
                                  const newContacts = [...onboardingData.party_role_contacts];
                                  newContacts.splice(idx, 1);
                                  setOnboardingData({...onboardingData, party_role_contacts: newContacts});
                                }} className="text-red-600 hover:text-red-700">
                                  <TrashIcon className="w-4 h-4" />
                                </button>
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                  <label className="text-[10px] font-bold uppercase text-slate-600">Tipo de Contacto *</label>
                                  <select className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2 text-sm text-slate-900 outline-none focus:border-blue-500" 
                                    value={contact.contact_medium_type_id} 
                                    onChange={e => {
                                      const typeId = parseInt(e.target.value);
                                      const type = getActiveContactMediumTypes().find(t => t.contact_medium_type_id === typeId);
                                      const newContacts = [...onboardingData.party_role_contacts];
                                      newContacts[idx] = {
                                        ...contact,
                                        contact_medium_type_id: typeId,
                                        contact_medium_type_name: type?.name || '',
                                        email_address: typeId === 1 ? contact.email_address : undefined,
                                        phone: typeId !== 1 ? contact.phone : undefined
                                      };
                                      setOnboardingData({...onboardingData, party_role_contacts: newContacts});
                                    }}>
                                    {getActiveContactMediumTypes().map(type => (
                                      <option key={type.contact_medium_type_id} value={type.contact_medium_type_id}>
                                        {type.name}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[10px] font-bold uppercase text-slate-600">Contacto Principal</label>
                                  <input type="checkbox" className="w-5 h-5" checked={contact.preferred || false} 
                                    onChange={e => {
                                      const newContacts = [...onboardingData.party_role_contacts];
                                      newContacts[idx] = {...contact, preferred: e.target.checked};
                                      setOnboardingData({...onboardingData, party_role_contacts: newContacts});
                                    }} />
                                </div>
                                {contact.contact_medium_type_id === 1 && (
                                  <div className="col-span-2 space-y-1">
                                    <label className="text-[10px] font-bold uppercase text-slate-600">Email *</label>
                                    <input type="email" className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2 text-sm text-slate-900 outline-none focus:border-blue-500" 
                                      value={contact.email_address || ''} 
                                      onChange={e => {
                                        const newContacts = [...onboardingData.party_role_contacts];
                                        newContacts[idx] = {...contact, email_address: e.target.value};
                                        setOnboardingData({...onboardingData, party_role_contacts: newContacts});
                                      }} 
                                      placeholder="contacto@empresa.com" />
                                  </div>
                                )}
                                {(contact.contact_medium_type_id === 2 || contact.contact_medium_type_id === 3 || contact.contact_medium_type_id === 4) && (
                                  <div className="col-span-2 space-y-1">
                                    <label className="text-[10px] font-bold uppercase text-slate-600">Teléfono *</label>
                                    <input type="tel" className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2 text-sm text-slate-900 outline-none focus:border-blue-500" 
                                      value={contact.phone || ''} 
                                      onChange={e => {
                                        const newContacts = [...onboardingData.party_role_contacts];
                                        newContacts[idx] = {...contact, phone: e.target.value};
                                        setOnboardingData({...onboardingData, party_role_contacts: newContacts});
                                      }} 
                                      placeholder="987654321" />
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                          
                          {onboardingData.party_role_contacts.length === 0 && (
                            <p className="text-xs text-slate-500 italic">No hay contactos agregados. Haz clic en "Agregar Contacto" para agregar uno.</p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* STEP 2: CONTRATO */}
                    {formStep === 2 && (
                      <div className="space-y-8 flex-1">
                        <div className="flex items-center gap-4 border-b border-slate-200 pb-6">
                          <BanknotesIcon className="w-8 h-8 text-blue-600" />
                          <div>
                            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Configurar Contrato</h2>
                            <p className="text-xs text-slate-600">Datos del contrato y productos {getOnboardingType(onboardingData.party_role_type_id) === 'SUCURSAL' && '(Opcional)'}</p>
                          </div>
                        </div>
                        
                        {/* Checkbox para hacer Agreement opcional en SUCURSAL */}
                        {getOnboardingType(onboardingData.party_role_type_id) === 'SUCURSAL' && (
                          <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-xl border border-blue-200">
                            <input type="checkbox" id="agreement_optional" className="w-5 h-5" 
                              checked={!onboardingData.agreement_optional} 
                              onChange={e => setOnboardingData({...onboardingData, agreement_optional: !e.target.checked})} />
                            <label htmlFor="agreement_optional" className="text-sm font-semibold text-slate-700 cursor-pointer">
                              Crear contrato para esta sucursal
                            </label>
                          </div>
                        )}
                        
                        {!(getOnboardingType(onboardingData.party_role_type_id) === 'SUCURSAL' && onboardingData.agreement_optional) && (
                        <div className="space-y-6">
                          <h3 className="text-sm font-black uppercase text-slate-700 tracking-widest border-b border-slate-200 pb-2">Datos del Contrato</h3>
                          <div className="grid grid-cols-2 gap-6">
                            <div className="col-span-2 space-y-2">
                              <label className="text-[10px] font-black uppercase text-slate-700 tracking-widest ml-1">Tipo de Contrato *</label>
                              <select 
                                className="w-full bg-white border border-slate-300 rounded-2xl px-6 py-4 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                                value={onboardingData.agreement_type_id || ''}
                                onChange={e => setOnboardingData({...onboardingData, agreement_type_id: parseInt(e.target.value)})}
                              >
                                <option value="">Seleccione un tipo</option>
                                {getActiveAgreementTypes().map(type => (
                                  <option key={type.agreement_type_id} value={type.agreement_type_id}>
                                    {type.name} - {type.description}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="col-span-2 space-y-2">
                              <label className="text-[10px] font-black uppercase text-slate-700 tracking-widest ml-1">Nombre del Contrato *</label>
                              <input className="w-full bg-white border border-slate-300 rounded-2xl px-6 py-4 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200" value={onboardingData.agreement_name} onChange={e => setOnboardingData({...onboardingData, agreement_name: e.target.value})} placeholder="Contrato Principal" />
                            </div>
                            <div className="col-span-2 space-y-2">
                              <label className="text-[10px] font-black uppercase text-slate-700 tracking-widest ml-1">Descripción</label>
                              <textarea className="w-full bg-white border border-slate-300 rounded-2xl px-6 py-4 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200" rows={3} value={onboardingData.agreement_description} onChange={e => setOnboardingData({...onboardingData, agreement_description: e.target.value})} placeholder="Conéxion Única - Reconciliación - Ánalisis de datos" />
                            </div>
                            <div className="space-y-2">
                              <label className="text-[10px] font-black uppercase text-slate-700 tracking-widest ml-1">Número de Documento *</label>
                              <input className="w-full bg-white border border-slate-300 rounded-2xl px-6 py-4 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200" value={onboardingData.agreement_document_number} onChange={e => setOnboardingData({...onboardingData, agreement_document_number: e.target.value})} placeholder="CONTRATO_2026-001" />
                            </div>
                            <div className="space-y-2">
                              <label className="text-[10px] font-black uppercase text-slate-700 tracking-widest ml-1">Producto a Activar *</label>
                              <input className="w-full bg-white border border-slate-300 rounded-2xl px-6 py-4 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200" value={onboardingData.agreement_product_offering_public_id} onChange={e => setOnboardingData({...onboardingData, agreement_product_offering_public_id: e.target.value})} placeholder="po_d1_abc123xyz" />
                            </div>
                            <div className="col-span-2 space-y-4 border-t border-slate-200 pt-4">
                              <h4 className="text-xs font-black uppercase text-slate-700 tracking-widest">Vigencia del Contrato</h4>
                              <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                  <label className="text-[10px] font-black uppercase text-slate-700 tracking-widest ml-1">Fecha Inicio *</label>
                                  <input type="date" className="w-full bg-white border border-slate-300 rounded-2xl px-6 py-4 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200" value={onboardingData.start_date} onChange={e => setOnboardingData({...onboardingData, start_date: e.target.value})} />
                                </div>
                                <div className="space-y-2">
                                  <label className="text-[10px] font-black uppercase text-slate-700 tracking-widest ml-1">Fecha Fin *</label>
                                  <input type="date" className="w-full bg-white border border-slate-300 rounded-2xl px-6 py-4 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200" value={onboardingData.end_date} onChange={e => setOnboardingData({...onboardingData, end_date: e.target.value})} />
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                        )}
                      </div>
                    )}

                    {/* STEP 3: USUARIO (solo CORPORATIVO) */}
                    {formStep === 3 && getOnboardingType(onboardingData.party_role_type_id) === 'CORPORATIVO' && (
                      <div className="space-y-8 flex-1">
                        <div className="flex items-center gap-4 border-b border-slate-200 pb-6">
                          <LockClosedIcon className="w-8 h-8 text-blue-600" />
                          <div>
                            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Crear Usuario Administrador</h2>
                            <p className="text-xs text-slate-600">Datos personales y acceso del usuario</p>
                          </div>
                        </div>

                        {/* Sección 1: Datos Personales */}
                        <div className="space-y-6">
                          <h3 className="text-sm font-black uppercase text-slate-700 tracking-widest border-b border-slate-200 pb-2">Datos Personales</h3>
                          <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-2">
                              <label className="text-[10px] font-black uppercase text-slate-700 tracking-widest ml-1">Nombres *</label>
                              <input className="w-full bg-white border border-slate-300 rounded-2xl px-6 py-4 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200" value={onboardingData.first_name} onChange={e => setOnboardingData({...onboardingData, first_name: e.target.value})} placeholder="Nombres" />
                            </div>
                            <div className="space-y-2">
                              <label className="text-[10px] font-black uppercase text-slate-700 tracking-widest ml-1">Apellidos *</label>
                              <input className="w-full bg-white border border-slate-300 rounded-2xl px-6 py-4 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200" value={onboardingData.last_name} onChange={e => setOnboardingData({...onboardingData, last_name: e.target.value})} placeholder="Apellidos" />
                            </div>
                            <div className="space-y-2">
                              <label className="text-[10px] font-black uppercase text-slate-700 tracking-widest ml-1">Email *</label>
                              <input type="email" className="w-full bg-white border border-slate-300 rounded-2xl px-6 py-4 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200" value={onboardingData.email} onChange={e => setOnboardingData({...onboardingData, email: e.target.value})} placeholder="user@kashio.net" />
                            </div>
                            <div className="space-y-2">
                              <label className="text-[10px] font-black uppercase text-slate-700 tracking-widest ml-1">Teléfono *</label>
                              <input className="w-full bg-white border border-slate-300 rounded-2xl px-6 py-4 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200" value={onboardingData.user_phone} onChange={e => setOnboardingData({...onboardingData, user_phone: e.target.value})} placeholder="3210000000" />
                            </div>
                            <div className="space-y-2">
                              <label className="text-[10px] font-black uppercase text-slate-700 tracking-widest ml-1">Fecha de Nacimiento</label>
                              <input type="date" className="w-full bg-white border border-slate-300 rounded-2xl px-6 py-4 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200" value={onboardingData.birth_date} onChange={e => setOnboardingData({...onboardingData, birth_date: e.target.value})} />
                            </div>
                          </div>
                        </div>

                        {/* Sección 2: Contactos Adicionales */}
                        <div className="space-y-6 border-t border-slate-200 pt-6">
                          <div className="flex items-center justify-between">
                            <h3 className="text-sm font-black uppercase text-slate-700 tracking-widest border-b border-slate-200 pb-2 flex-1">Contactos Adicionales</h3>
                            <button type="button" onClick={() => {
                              const newContact: ContactMedium = {
                                contact_medium_type_id: 1,
                                contact_medium_type_name: 'Email',
                                email_address: '',
                                preferred: false
                              };
                              setOnboardingData({
                                ...onboardingData,
                                individual_contacts: [...onboardingData.individual_contacts, newContact]
                              });
                            }} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition">
                              <PlusIcon className="w-4 h-4" />
                              Agregar Contacto
                            </button>
                          </div>
                          <p className="text-xs text-slate-500 italic">💡 Puedes agregar emails o teléfonos adicionales</p>
                          
                          {onboardingData.individual_contacts.map((contact, idx) => (
                              <div key={idx} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-bold text-slate-700">Contacto {idx + 1}</span>
                                  <button type="button" onClick={() => {
                                    const newContacts = [...onboardingData.individual_contacts];
                                    newContacts.splice(idx, 1);
                                    setOnboardingData({...onboardingData, individual_contacts: newContacts});
                                  }} className="text-red-600 hover:text-red-700">
                                    <TrashIcon className="w-4 h-4" />
                                  </button>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                  <div className="space-y-1">
                                    <label className="text-[10px] font-bold uppercase text-slate-600">Tipo de Contacto *</label>
                                    <select className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2 text-sm text-slate-900 outline-none focus:border-blue-500" 
                                      value={contact.contact_medium_type_id} 
                                      onChange={e => {
                                        const typeId = parseInt(e.target.value);
                                        const type = getActiveContactMediumTypes().find(t => t.contact_medium_type_id === typeId);
                                        const newContacts = [...onboardingData.individual_contacts];
                                        newContacts[idx] = {
                                          ...contact,
                                          contact_medium_type_id: typeId,
                                          contact_medium_type_name: type?.name || '',
                                          email_address: typeId === 1 ? contact.email_address : undefined,
                                          phone: typeId !== 1 ? contact.phone : undefined
                                        };
                                        setOnboardingData({...onboardingData, individual_contacts: newContacts});
                                      }}>
                                      {getActiveContactMediumTypes().map(type => (
                                        <option key={type.contact_medium_type_id} value={type.contact_medium_type_id}>
                                          {type.name}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-[10px] font-bold uppercase text-slate-600">Preferido</label>
                                    <input type="checkbox" className="w-5 h-5" checked={contact.preferred || false} 
                                      onChange={e => {
                                        const newContacts = [...onboardingData.individual_contacts];
                                        newContacts[idx] = {...contact, preferred: e.target.checked};
                                        setOnboardingData({...onboardingData, individual_contacts: newContacts});
                                      }} />
                                  </div>
                                  {contact.contact_medium_type_id === 1 && (
                                    <div className="col-span-2 space-y-1">
                                      <label className="text-[10px] font-bold uppercase text-slate-600">Email *</label>
                                      <input type="email" className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2 text-sm text-slate-900 outline-none focus:border-blue-500" 
                                        value={contact.email_address || ''} 
                                        onChange={e => {
                                          const newContacts = [...onboardingData.individual_contacts];
                                          newContacts[idx] = {...contact, email_address: e.target.value};
                                          setOnboardingData({...onboardingData, individual_contacts: newContacts});
                                        }} 
                                        placeholder="test@example.com" />
                                    </div>
                                  )}
                                  {(contact.contact_medium_type_id === 2 || contact.contact_medium_type_id === 3 || contact.contact_medium_type_id === 4) && (
                                    <div className="col-span-2 space-y-1">
                                      <label className="text-[10px] font-bold uppercase text-slate-600">Teléfono *</label>
                                      <input type="tel" className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2 text-sm text-slate-900 outline-none focus:border-blue-500" 
                                        value={contact.phone || ''} 
                                        onChange={e => {
                                          const newContacts = [...onboardingData.individual_contacts];
                                          newContacts[idx] = {...contact, phone: e.target.value};
                                          setOnboardingData({...onboardingData, individual_contacts: newContacts});
                                        }} 
                                        placeholder="3210000000" />
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                            
                            {onboardingData.individual_contacts.length === 0 && (
                              <p className="text-xs text-slate-500 italic">No hay contactos agregados. Haz clic en "Agregar Contacto" para agregar uno.</p>
                            )}
                        </div>

                        {/* Sección 3: Configuración de Acceso */}
                        <div className="space-y-6 border-t border-slate-200 pt-6">
                          <h3 className="text-sm font-black uppercase text-slate-700 tracking-widest border-b border-slate-200 pb-2">Configuración de Acceso</h3>
                          <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                            <p className="text-xs text-slate-600 mb-2">💡 El usuario tendrá acceso automático a:</p>
                            <ul className="text-xs text-slate-700 space-y-1 ml-4">
                              <li>• Rol: Administrador</li>
                              <li>• Productos: Conéxion Única</li>
                              <li>• Menús: Configurados automáticamente</li>
                            </ul>
                            <p className="text-xs text-slate-500 italic mt-2">(Esta configuración se asigna automáticamente)</p>
                          </div>
                        </div>
                      </div>
                    )}


                    {/* NAV FOOTER */}
                    <div className="mt-auto flex justify-between border-t border-slate-200 pt-10">
                      <button 
                        disabled={formStep === 1} 
                        onClick={() => {
                          const prevStep = getPreviousStep(formStep, onboardingData.party_role_type_id, onboardingData.agreement_optional || false);
                          setFormStep(prevStep);
                        }} 
                        className="text-[11px] font-black uppercase tracking-widest text-slate-600 hover:text-slate-900 disabled:opacity-20 transition-all px-4 py-2"
                      >
                        ← Volver
                      </button>
                      {(() => {
                        const onboardingType = getOnboardingType(onboardingData.party_role_type_id);
                        const hasAgreement = onboardingType === 'CORPORATIVO' || !onboardingData.agreement_optional;
                        const maxStep = onboardingType === 'CORPORATIVO' ? 3 : (hasAgreement ? 2 : 1);
                        const isLastStep = formStep >= maxStep;
                        const isSaving = savingStep === formStep;
                        
                        if (formStep === 1) {
                          return (
                            <button 
                              onClick={saveStep1}
                              disabled={isSaving || !onboardingData.legal_name || !onboardingData.party_role_type_id}
                              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed text-white px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg flex items-center gap-2"
                            >
                              {isSaving ? (
                                <>
                                  <ArrowPathIcon className="w-4 h-4 animate-spin" />
                                  Guardando...
                                </>
                              ) : savedSteps.step1 ? (
                                <>
                                  <CheckCircleIcon className="w-4 h-4" />
                                  Guardado ✓
                                </>
                              ) : (
                                'Guardar Empresa y Continuar →'
                              )}
                            </button>
                          );
                        } else if (formStep === 2) {
                          return (
                            <button 
                              onClick={saveStep2}
                              disabled={isSaving || !savedSteps.step1 || !onboardingData.agreement_name || !onboardingData.agreement_document_number}
                              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed text-white px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg flex items-center gap-2"
                            >
                              {isSaving ? (
                                <>
                                  <ArrowPathIcon className="w-4 h-4 animate-spin" />
                                  Guardando...
                                </>
                              ) : savedSteps.step2 ? (
                                <>
                                  <CheckCircleIcon className="w-4 h-4" />
                                  Guardado ✓
                                </>
                              ) : (
                                'Guardar Contrato y Continuar →'
                              )}
                            </button>
                          );
                        } else if (formStep === 3) {
                          return (
                            <button 
                              onClick={saveStep3}
                              disabled={isSaving || !savedSteps.step1 || !onboardingData.first_name || !onboardingData.last_name || !onboardingData.email}
                              className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 disabled:cursor-not-allowed text-white px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg flex items-center gap-2"
                            >
                              {isSaving ? (
                                <>
                                  <ArrowPathIcon className="w-4 h-4 animate-spin" />
                                  Creando...
                                </>
                              ) : savedSteps.step3 ? (
                                <>
                                  <CheckCircleIcon className="w-4 h-4" />
                                  Completado ✓
                                </>
                              ) : (
                                'Crear Usuario y Finalizar →'
                              )}
                            </button>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* EXECUTION VIEW */
              <div className="space-y-12 animate-in zoom-in-95 duration-500">
                <div className="bg-white p-16 rounded-[4rem] border border-slate-200 shadow-xl flex flex-col items-center text-center space-y-10 backdrop-blur-3xl">
                  {isRunning ? (
                    <div className="relative">
                      <div className="w-48 h-48 rounded-full border-[6px] border-blue-200 border-t-blue-600 animate-spin" />
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <RocketLaunchIcon className="w-16 h-16 text-blue-600 animate-bounce" />
                      </div>
                    </div>
                  ) : logs.some(l => l.type === 'error') ? (
                    <div className="w-32 h-32 rounded-full bg-rose-100 flex items-center justify-center border-[6px] border-rose-300">
                      <ExclamationCircleIcon className="w-16 h-16 text-rose-600" />
                    </div>
                  ) : (
                    <div className="w-32 h-32 rounded-full bg-emerald-100 flex items-center justify-center border-[6px] border-emerald-300">
                      <CheckCircleIcon className="w-16 h-16 text-emerald-600" />
                    </div>
                  )}
                  
                  <div className="space-y-4">
                    <h2 className="text-4xl font-black text-slate-900 uppercase tracking-tighter">{isRunning ? 'Ejecutando Orquestador' : logs.some(l => l.type === 'error') ? 'Error en Despliegue' : 'Onboarding Exitoso'}</h2>
                    <p className="text-slate-600 text-sm">{isRunning ? `Desplegando infraestructura en ${environment}` : logs.some(l => l.type === 'error') ? 'Se detuvo el proceso por un error de API.' : 'Merchant correctamente registrado.'}</p>
                    <div className="flex justify-center gap-4 text-[10px] font-black uppercase text-slate-700">
                      <span>{Math.floor(elapsed / 60)}m {elapsed % 60}s transcurridos</span>
                    </div>
                  </div>

                  {!isRunning && logs.some(l => l.type === 'error') && (
                    <button onClick={() => startDeployment(true)} className="bg-blue-600 hover:bg-blue-500 text-white px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg">Reintentar</button>
                  )}
                  {!isRunning && !logs.some(l => l.type === 'error') && (
                     <button onClick={() => { setFormStep(0); setLogs([]); setPhases(INITIAL_PHASES); }} className="bg-emerald-600 hover:bg-emerald-500 text-white px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg">Nuevo Merchant</button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* LOGS PANEL */}
        {showLogs && (
          <div className="absolute right-0 bottom-0 top-0 w-[500px] bg-white border-l border-slate-300 shadow-[-30px_0_60px_rgba(0,0,0,0.1)] flex flex-col z-50 animate-in slide-in-from-right duration-300">
             <div className="p-8 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <span className="text-xs font-black uppercase tracking-[0.3em] text-slate-900">Consola de Telemetría</span>
              <button onClick={() => setShowLogs(false)} className="text-slate-500 hover:text-slate-900"><XCircleIcon className="w-6 h-6" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-8 space-y-4 font-mono text-[11px] custom-scrollbar">
               {logs.map((log, i) => (
                  <div key={i} className={`p-4 rounded-2xl border ${log.type === 'error' ? 'bg-rose-50 border-rose-200 text-rose-700' : log.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
                    <span className="opacity-60 mr-2">[{log.time}]</span> {log.msg}
                  </div>
                ))}
                <div ref={logEndRef} />
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
