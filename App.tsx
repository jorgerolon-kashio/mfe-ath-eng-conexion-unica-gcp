
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
    street: '', state: '', zip: '', country: 'PE'
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
  { id: 1, name: 'KBRM Ecosystem', steps: [
    { id: '1.1', name: 'Crear Organización', status: 'idle' },
    { id: '1.2', name: 'Crear Party Role', status: 'idle' },
    { id: '1.3', name: 'Crear Agreement', status: 'idle' },
    { id: '1.4', name: 'Crear Individual', status: 'idle' },
    { id: '1.5', name: 'Crear Dirección', status: 'idle' },
    { id: '1.6', name: 'Crear Relationship', status: 'idle' },
  ]},
  { id: 2, name: 'KSEC Identity', steps: [
    { id: '2.1', name: 'Registrar Usuario', status: 'idle' },
    { id: '2.2', name: 'Asignar Roles', status: 'idle' },
    { id: '2.3', name: 'Configurar Menús', status: 'idle' },
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
const getNextStep = (currentStep: number, partyRoleTypeId: number): number => {
  const onboardingType = getOnboardingType(partyRoleTypeId);
  if (currentStep === 1) return 2; // Empresa → Party Role
  if (currentStep === 2) return 3; // Party Role → Agreement
  if (currentStep === 3) {
    // Agreement → Individual (CORPORATIVO) o Dirección (SUCURSAL)
    return onboardingType === 'CORPORATIVO' ? 4 : 5;
  }
  if (currentStep === 4) {
    // Individual (solo CORPORATIVO) → Dirección
    return 5;
  }
  if (currentStep === 5) {
    // Dirección → Relationship (SUCURSAL) o Usuario (CORPORATIVO)
    return onboardingType === 'SUCURSAL' ? 6 : 7;
  }
  if (currentStep === 6) {
    // Relationship (solo SUCURSAL) → fin
    return 6; // No hay más pasos para SUCURSAL
  }
  if (currentStep === 7) {
    // Usuario (solo CORPORATIVO) → fin
    return 7; // No hay más pasos para CORPORATIVO
  }
  return currentStep;
};

// Función para calcular el paso anterior válido
const getPreviousStep = (currentStep: number, partyRoleTypeId: number): number => {
  const onboardingType = getOnboardingType(partyRoleTypeId);
  if (currentStep === 1) return 1; // Ya estamos en el primer paso
  if (currentStep === 5) {
    // Dirección → Individual (CORPORATIVO) o Agreement (SUCURSAL)
    return onboardingType === 'CORPORATIVO' ? 4 : 3;
  }
  if (currentStep === 6) return 5; // Relationship → Dirección
  if (currentStep === 7) return 5; // Usuario → Dirección
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
      
      // KBRM PHASE - Paso 1.1: Crear Organización
      await runStep('1.1', async () => {
        const org = await api.call('KBRM', '/kbrm/v1/organizations', 'POST', {
          legal_name: onboardingData.legal_name,
          web_site: onboardingData.website,
          parent_relationship_id: null,
          industry_id: onboardingData.industry_id || '1',
          other_name: onboardingData.other_name,
          source_reference: onboardingData.source_reference,
          status: 1,
          country: { country_code: onboardingData.country }
        });
        sessionCtx.organization_public_id = org.data?.public_id || org.public_id;
        sessionCtx.organization_party_id = org.data?.party_id || org.party_id;
        addLog(`Organización creada: ${sessionCtx.organization_public_id}`, 'success');
      });

      // Paso 1.2: Crear Party Role (explícito, como en colabs)
      await runStep('1.2', async () => {
        // Convertir formato ISO a MySQL datetime (YYYY-MM-DD HH:mm:ss)
        const startDate = new Date();
        const endDate = new Date();
        endDate.setFullYear(endDate.getFullYear() + 1);
        
        const partyRole = await api.call('KBRM', '/kbrm/v1/party-roles', 'POST', {
          name: onboardingData.party_role_name || onboardingData.legal_name,
          description: onboardingData.party_role_description || `relationships ${onboardingData.legal_name}`,
          status_reason: onboardingData.party_role_status_reason || 'Active role',
          status: 1,
          party_role_type_id: onboardingData.party_role_type_id || 1,
          start_datetime: formatMySQLDateTime(startDate, '00:00:00'),
          end_datetime: formatMySQLDateTime(endDate, '23:59:59')
        });
        sessionCtx.party_role_public_id = partyRole.data?.public_id || partyRole.public_id;
        sessionCtx.party_role_party_id = partyRole.data?.party_id || partyRole.party_id;
        sessionCtx.party_role_id = partyRole.data?.party_role_id || partyRole.party_role_id;
        
        // Si no se obtuvo el party_role_id en la respuesta, intentar obtenerlo usando el endpoint de customers
        // que retorna party_role_id asociado a la organización (solo si existe un Customer)
        if (!sessionCtx.party_role_id && sessionCtx.organization_public_id) {
          try {
            const customer = await api.call('KBRM', `/kbrm/v1/customers/organization/${sessionCtx.organization_public_id}`, 'GET');
            sessionCtx.party_role_id = customer.data?.party_role?.party_role_id || customer.party_role?.party_role_id;
            if (sessionCtx.party_role_id) {
              addLog(`Party Role ID obtenido desde Customer: ${sessionCtx.party_role_id}`, 'success');
            } else {
              addLog('⚠️ No se pudo obtener party_role_id. Se necesitará para crear Relationships.', 'warning');
            }
          } catch (e) {
            console.warn('No se pudo obtener party_role_id desde Customer (puede que no exista un Customer aún):', e);
            addLog('⚠️ No se pudo obtener party_role_id desde Customer. Se necesitará para crear Relationships.', 'warning');
          }
        }
        
        addLog(`Party Role creado: ${sessionCtx.party_role_public_id}`, 'success');
        
        // Crear contactos del Party Role
        if (onboardingData.party_role_contacts && onboardingData.party_role_contacts.length > 0) {
          for (let i = 0; i < onboardingData.party_role_contacts.length; i++) {
            const contact = onboardingData.party_role_contacts[i];
            try {
              const contactMedium = await api.call('KBRM', '/kbrm/v1/contact-medium', 'POST', {
                contact_medium_type_id: contact.contact_medium_type_id,
                contact_medium_type_name: contact.contact_medium_type_name,
                email_address: contact.contact_medium_type_id === 1 ? contact.email_address : undefined,
                number: contact.contact_medium_type_id !== 1 ? contact.phone : undefined,
                start_datetime: formatMySQLDateTime(new Date(), '00:00:00'),
                end_datetime: formatMySQLDateTime(new Date(2099, 11, 31), '23:59:59'),
                party_id: sessionCtx.party_role_party_id,
                preferred: contact.preferred || false,
                binding_datetime: formatMySQLDateTime(new Date(), '00:00:00'),
                status: 1
              });
              addLog(`Contacto ${i + 1} del Party Role creado: ${contact.contact_medium_type_name}`, 'success');
            } catch (error: any) {
              addLog(`Error creando contacto ${i + 1} del Party Role: ${error.message}`, 'error');
            }
          }
        }
      });

      // Paso 1.3: Crear Agreement (opcional para SUCURSAL)
      const shouldCreateAgreement = isCorporativo || !onboardingData.agreement_optional;
      if (shouldCreateAgreement) {
        await runStep('1.3', async () => {
          // Convertir activation_date a formato MySQL si viene en formato ISO
          let activationDate = onboardingData.agreement_activation_date || formatMySQLDateTime(new Date(), '00:00:00');
          if (activationDate.includes('T') && activationDate.includes('Z')) {
            // Convertir de ISO a MySQL datetime
            const date = new Date(activationDate);
            activationDate = formatMySQLDateTime(date, '00:00:00');
          }
          
          const agreementPayload: any = {
            name: onboardingData.agreement_name || `Contrato ${onboardingData.legal_name}`,
            description: onboardingData.agreement_description || 'Conéxion Única - Reconciliación - Ánalisis de datos',
            document_number: onboardingData.agreement_document_number || 'AUTO-' + Date.now(),
            assigned_to: sessionCtx.party_role_public_id,
            product_offering_public_id: onboardingData.agreement_product_offering_public_id,
            start_datetime: onboardingData.start_date + ' 00:00:00',
            end_datetime: onboardingData.end_date + ' 23:59:59',
            activation_date: activationDate
          };
          
          // Agregar agreement_type_id si está definido
          if (onboardingData.agreement_type_id) {
            agreementPayload.agreement_type_id = onboardingData.agreement_type_id;
          }
          
          const agreement = await api.call('KBRM', '/kbrm/v1/agreements', 'POST', agreementPayload);
          sessionCtx.agreement_id = agreement.data?.agreement_id || agreement.agreement_id;
          addLog(`Agreement creado: ${sessionCtx.agreement_id}`, 'success');
        });
      } else {
        addLog('Agreement omitido (opcional para SUCURSAL)', 'success');
      }

      // Paso 1.4: Crear Individual (solo CORPORATIVO)
      if (isCorporativo) {
        await runStep('1.4', async () => {
          const ind = await api.call('KBRM', '/kbrm/v1/individuals', 'POST', {
            first_name: onboardingData.first_name || '',
            last_name: onboardingData.last_name || '',
            full_name: `${onboardingData.first_name || ''} ${onboardingData.last_name || ''}`.trim() || '',
            birth_date: onboardingData.birth_date || '1990-01-01',
            status: 1
          });
          sessionCtx.individual_public_id = ind.data?.public_id || ind.public_id;
          sessionCtx.individual_party_id = ind.data?.party_id || ind.party_id;
          addLog(`Individual creado: ${sessionCtx.individual_public_id}`, 'success');
          
          // Crear contactos del Individual
          if (onboardingData.individual_contacts && onboardingData.individual_contacts.length > 0) {
            for (let i = 0; i < onboardingData.individual_contacts.length; i++) {
              const contact = onboardingData.individual_contacts[i];
              try {
                const contactMedium = await api.call('KBRM', '/kbrm/v1/contact-medium', 'POST', {
                  contact_medium_type_id: contact.contact_medium_type_id,
                  contact_medium_type_name: contact.contact_medium_type_name,
                  email_address: contact.contact_medium_type_id === 1 ? contact.email_address : undefined,
                  number: contact.contact_medium_type_id !== 1 ? contact.phone : undefined,
                  start_datetime: formatMySQLDateTime(new Date(), '00:00:00'),
                  end_datetime: formatMySQLDateTime(new Date(2099, 11, 31), '23:59:59'),
                  party_id: sessionCtx.individual_party_id,
                  preferred: contact.preferred || false,
                  binding_datetime: formatMySQLDateTime(new Date(), '00:00:00'),
                  status: 1
                });
                addLog(`Contacto ${i + 1} del Individual creado: ${contact.contact_medium_type_name}`, 'success');
              } catch (error: any) {
                addLog(`Error creando contacto ${i + 1} del Individual: ${error.message}`, 'error');
              }
            }
          }
        });
      }

      // Paso 1.5: Crear Dirección
      await runStep('1.5', async () => {
        // Asegurar que el país siempre sea PER
        const address = await api.call('KBRM', '/kbrm/v1/address', 'POST', {
          country_code: 'PER', // Siempre PER por ahora
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
          status: 1,
          start_datetime: formatMySQLDateTime(new Date(), '00:00:00'),
          end_datetime: formatMySQLDateTime(new Date(2099, 11, 31), '23:59:59'),
          party_id: sessionCtx.organization_party_id,
          external_reference_id: onboardingData.address.external_reference_id || '',
          preferred: true
        });
        sessionCtx.address_id = address.data?.geographic_address_id || address.geographic_address_id;
        addLog(`Dirección creada: ${sessionCtx.address_id}`, 'success');
      });

      // Paso 1.6: Crear Relationship (solo SUCURSAL, opcional)
      if (!isCorporativo && onboardingData.parent_corporativo_party_role_public_id) {
        await runStep('1.6', async () => {
          // Usar el party_role_id de la sucursal (ya guardado en sessionCtx)
          const toPartyRoleId = sessionCtx.party_role_id;
          
          if (!toPartyRoleId) {
            // Intentar obtener el party_role_id haciendo un GET al PartyRole creado
            if (sessionCtx.party_role_public_id) {
              try {
                const partyRoleDetail = await api.call('KBRM', `/kbrm/v1/party-roles/${sessionCtx.party_role_public_id}`, 'GET');
                // El party_role_id no viene directamente en la respuesta, necesitamos obtenerlo de otra forma
                // Por ahora, si no está disponible, lanzamos un error más descriptivo
                if (!partyRoleDetail.data?.party_role_id && !partyRoleDetail.party_role_id) {
                  throw new Error('No se pudo obtener party_role_id de la sucursal. El PartyRole se creó pero no se puede obtener su ID numérico.');
                }
                sessionCtx.party_role_id = partyRoleDetail.data?.party_role_id || partyRoleDetail.party_role_id;
              } catch (e: any) {
                throw new Error(`No se encontró party_role_id de la sucursal: ${e.message}`);
              }
            } else {
              throw new Error('No se encontró party_role_id de la sucursal. Asegúrate de que el Party Role se creó correctamente.');
            }
          }
          
          // Obtener el party_role_id del corporativo padre (Party Role de la organización corporativa)
          // El usuario mencionó que se puede usar el party_role_id de la organización
          // Como KBRM no retorna party_role_id en getPartyRoleById, usamos el endpoint de customers
          // que SÍ retorna party_role_id en party_role.party_role_id
          // Requiere que exista un Customer asociado a la organización del corporativo
          let fromPartyRoleId: number | undefined;
          try {
            // Obtener el PartyRole del corporativo para obtener su party_id
            const corporativoPartyRole = await api.call('KBRM', `/kbrm/v1/party-roles/${onboardingData.parent_corporativo_party_role_public_id}`, 'GET');
            const corporativoPartyId = corporativoPartyRole.data?.party_id || corporativoPartyRole.party_id;
            
            if (!corporativoPartyId) {
              throw new Error('No se pudo obtener party_id del PartyRole del corporativo');
            }
            
            // Buscar la organización asociada a ese party_id
            // El organization_id en KBRM es igual al party_id
            // Intentar obtener el customer usando el organization_id (que es igual al party_id)
            try {
              const customer = await api.call('KBRM', `/kbrm/v1/customers/organization/${corporativoPartyId}`, 'GET');
              fromPartyRoleId = customer.data?.party_role?.party_role_id || customer.party_role?.party_role_id;
              
              if (!fromPartyRoleId) {
                // Si no se encontró con el ID numérico, intentar con el public_id si lo tenemos
                // Pero necesitaríamos el organization_public_id del corporativo, que no tenemos
                throw new Error('No se encontró party_role_id en la respuesta del Customer');
              }
            } catch (customerError: any) {
              // Si no hay customer, no podemos obtener el party_role_id automáticamente
              throw new Error(`No se pudo obtener party_role_id del corporativo: ${customerError.message}. Asegúrese de que existe un Customer asociado a la organización del corporativo, o proporcione el party_role_id directamente.`);
            }
          } catch (e: any) {
            throw new Error(`No se pudo obtener party_role_id del corporativo padre (${onboardingData.parent_corporativo_party_role_public_id}): ${e.message}`);
          }
          
          if (!fromPartyRoleId) {
            throw new Error(`No se encontró party_role_id del corporativo padre: ${onboardingData.parent_corporativo_party_role_public_id}`);
          }
          
          const relationshipPayload: any = {
            from_party_role_id: fromPartyRoleId,
            to_party_role_id: sessionCtx.party_role_id,
          };
          
          // Agregar relationship_type_id si está definido (es opcional según KBRM)
          if (onboardingData.relationship_type_id) {
            relationshipPayload.relationship_type_id = onboardingData.relationship_type_id;
          }
          
          // Agregar description si está definido
          if (onboardingData.relationship_description) {
            relationshipPayload.description = onboardingData.relationship_description;
          }
          
          const relationship = await api.call('KBRM', '/kbrm/v1/relationships', 'POST', relationshipPayload);
          sessionCtx.relationship_id = relationship.data?.party_relationship_id || relationship.party_relationship_id;
          addLog(`Relationship creada: ${sessionCtx.relationship_id}`, 'success');
        });
      } else if (!isCorporativo && !onboardingData.parent_corporativo_party_role_public_id) {
        addLog('Relationship omitida (no se proporcionó party_role_public_id del corporativo padre)', 'success');
      }

      // KSEC PHASE (solo CORPORATIVO)
      if (isCorporativo) {
        // Paso 2.1: Crear Usuario KSEC
        await runStep('2.1', async () => {
          if (!sessionCtx.organization_public_id || !sessionCtx.individual_public_id) {
            throw new Error('Faltan IDs necesarios. Organización e Individual deben ser creados primero.');
          }
          const user = await api.call('KSEC', '/ksec/v1/users', 'POST', {
            first_name: onboardingData.first_name,
            last_name: onboardingData.last_name,
            display_name: `${onboardingData.first_name} ${onboardingData.last_name}`.trim(),
            email: onboardingData.email,
            phone: onboardingData.user_phone || onboardingData.phone,
            user_type_id: onboardingData.user_type_id || '1',
            organization_id: sessionCtx.organization_public_id,
            individual_id: sessionCtx.individual_public_id,
            valid_from: new Date().toISOString(),
            valid_until: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString()
          });
          
          let userId = null;
          if (user?.is_success && user?.data?.public_id) {
            userId = user.data.public_id;
          } else if (user?.data?.is_success && user?.data?.data?.public_id) {
            userId = user.data.data.public_id;
          } else if (user?.data?.public_id) {
            userId = user.data.public_id;
          } else if (user?.public_id) {
            userId = user.public_id;
          }
          
          sessionCtx.user_id_global = userId;
          if (!sessionCtx.user_id_global) {
            throw new Error('No se pudo obtener el ID del usuario creado.');
          }
          addLog(`Usuario KSEC registrado: ${sessionCtx.user_id_global}`, 'success');
        });

        // Paso 2.2: Asignar Roles
        await runStep('2.2', async () => {
          if (!sessionCtx.user_id_global) {
            throw new Error('user_id_global no está definido.');
          }
          await api.call('KSEC', `/ksec/v1/users/${sessionCtx.user_id_global}/roles`, 'POST', { 
            roles: [ENV_CONFIGURATIONS[environment].ksec_admin_role] 
          });
          addLog('Roles administrativos asignados', 'success');
        });

        // Paso 2.3: Configurar Menús
        await runStep('2.3', async () => {
          if (!sessionCtx.user_id_global) {
            throw new Error('user_id_global no está definido.');
          }
          for (const prod of onboardingData.configuraciones_ksec) {
            await api.call('KSEC', `/ksec/v1/users/${sessionCtx.user_id_global}/menu`, 'POST', {
              rol_public_id: prod.rol_public_id,
              product_public_id: prod.product_public_id
            });
          }
          addLog('Menús de productos configurados', 'success');
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
            {(() => {
              const onboardingType = getOnboardingType(onboardingData.party_role_type_id);
              const maxFormStep = onboardingType === 'CORPORATIVO' ? 7 : 6;
              return formStep < maxFormStep;
            })() ? (
              <button 
                onClick={() => startDeployment()} 
                disabled={!onboardingData.legal_name || (getOnboardingType(onboardingData.party_role_type_id) === 'SUCURSAL' && !onboardingData.parent_corporativo_party_role_public_id)}
                className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 disabled:opacity-30 disabled:cursor-not-allowed text-white px-10 py-3.5 rounded-xl font-black text-[12px] uppercase tracking-widest transition-all shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                <RocketLaunchIcon className="w-5 h-5" /> Iniciar Orquestación
              </button>
            ) : (
              <button onClick={() => setFormStep(1)} className="text-[11px] font-black text-slate-600 hover:text-slate-900 uppercase tracking-widest px-5 py-2.5 border-2 border-slate-300 hover:border-slate-400 rounded-xl transition-all hover:bg-slate-100">Editar</button>
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
                      { id: 1, label: 'Empresa', icon: BuildingOfficeIcon },
                      { id: 2, label: 'Party Role', icon: BuildingOfficeIcon },
                      { id: 3, label: 'Agreement', icon: BanknotesIcon },
                      ...(getOnboardingType(onboardingData.party_role_type_id) === 'CORPORATIVO' ? [{ id: 4, label: 'Individual', icon: UserPlusIcon }] : []),
                      { id: 5, label: 'Dirección', icon: GlobeAltIcon },
                      ...(getOnboardingType(onboardingData.party_role_type_id) === 'SUCURSAL' ? [{ id: 6, label: 'Relationship', icon: BuildingOfficeIcon }] : []),
                      ...(getOnboardingType(onboardingData.party_role_type_id) === 'CORPORATIVO' ? [{ id: 7, label: 'Usuario', icon: LockClosedIcon }] : [])
                    ].map((step) => (
                      <button key={step.id} onClick={() => setFormStep(step.id)} className={`flex-1 flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${formStep === step.id ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'}`}>
                        <step.icon className={`w-4 h-4 ${formStep === step.id ? 'text-white' : 'text-slate-500'}`} />
                        {step.label}
                      </button>
                    ))}
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
                            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Datos de la Empresa</h2>
                            <p className="text-xs text-slate-600">Identidad Legal y Website</p>
                          </div>
                        </div>
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
                            <label className="text-[10px] font-black uppercase text-slate-700 tracking-widest ml-1">Source Reference (CRM ZOHO)</label>
                            <input className="w-full bg-white border border-slate-300 rounded-2xl px-6 py-4 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200" value={onboardingData.source_reference} onChange={e => setOnboardingData({...onboardingData, source_reference: e.target.value})} placeholder="ZOHO-12345" />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-slate-700 tracking-widest ml-1">País</label>
                            <select className="w-full bg-white border border-slate-300 rounded-2xl px-6 py-4 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200" value={onboardingData.country} onChange={e => setOnboardingData({...onboardingData, country: e.target.value})}>
                              <option value="PER">Perú (PER)</option>
                              <option value="PEN">Perú (PEN)</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* STEP 2: PARTY ROLE */}
                    {formStep === 2 && (
                      <div className="space-y-8 flex-1">
                        <div className="flex items-center gap-4 border-b border-slate-200 pb-6">
                          <BuildingOfficeIcon className="w-8 h-8 text-blue-600" />
                          <div>
                            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Party Role</h2>
                            <p className="text-xs text-slate-600">Rol de la organización</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-6">
                          <div className="col-span-2 space-y-2">
                            <label className="text-[10px] font-black uppercase text-slate-700 tracking-widest ml-1">Nombre del Party Role *</label>
                            <input className="w-full bg-white border border-slate-300 rounded-2xl px-6 py-4 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200" value={onboardingData.party_role_name || onboardingData.legal_name} onChange={e => setOnboardingData({...onboardingData, party_role_name: e.target.value})} placeholder="Nombre del rol" />
                          </div>
                          <div className="col-span-2 space-y-2">
                            <label className="text-[10px] font-black uppercase text-slate-700 tracking-widest ml-1">Tipo de Party Role *</label>
                            <select className="w-full bg-white border border-slate-300 rounded-2xl px-6 py-4 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200" value={onboardingData.party_role_type_id} onChange={e => setOnboardingData({...onboardingData, party_role_type_id: parseInt(e.target.value)})}>
                              <option value="">Seleccione un tipo</option>
                              {getActivePartyRoleTypes().map(type => (
                                <option key={type.party_role_type_id} value={type.party_role_type_id}>
                                  {type.name} ({type.code})
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="col-span-2 space-y-2">
                            <label className="text-[10px] font-black uppercase text-slate-700 tracking-widest ml-1">Descripción</label>
                            <textarea className="w-full bg-white border border-slate-300 rounded-2xl px-6 py-4 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200" rows={3} value={onboardingData.party_role_description} onChange={e => setOnboardingData({...onboardingData, party_role_description: e.target.value})} placeholder="Descripción del rol" />
                          </div>
                          
                          {/* Sección de Contactos para Party Role */}
                          <div className="col-span-2 space-y-4 border-t border-slate-200 pt-6">
                            <div className="flex items-center justify-between">
                              <label className="text-[10px] font-black uppercase text-slate-700 tracking-widest ml-1">Contactos del Party Role</label>
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
                                    <label className="text-[10px] font-bold uppercase text-slate-600">Preferido</label>
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
                                        placeholder="test@example.com" />
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
                                        placeholder="3210000000" />
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
                      </div>
                    )}

                    {/* STEP 3: AGREEMENT */}
                    {formStep === 3 && (
                      <div className="space-y-8 flex-1">
                        <div className="flex items-center gap-4 border-b border-slate-200 pb-6">
                          <BanknotesIcon className="w-8 h-8 text-blue-600" />
                          <div>
                            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Agreement</h2>
                            <p className="text-xs text-slate-600">Contrato y Productos {getOnboardingType(onboardingData.party_role_type_id) === 'SUCURSAL' && '(Opcional)'}</p>
                          </div>
                        </div>
                        
                        {/* Checkbox para hacer Agreement opcional en SUCURSAL */}
                        {getOnboardingType(onboardingData.party_role_type_id) === 'SUCURSAL' && (
                          <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-xl border border-blue-200">
                            <input type="checkbox" id="agreement_optional" className="w-5 h-5" 
                              checked={!onboardingData.agreement_optional} 
                              onChange={e => setOnboardingData({...onboardingData, agreement_optional: !e.target.checked})} />
                            <label htmlFor="agreement_optional" className="text-sm font-semibold text-slate-700 cursor-pointer">
                              Crear Agreement para esta sucursal
                            </label>
                          </div>
                        )}
                        
                        {!(getOnboardingType(onboardingData.party_role_type_id) === 'SUCURSAL' && onboardingData.agreement_optional) && (
                        <div className="grid grid-cols-2 gap-6">
                          <div className="col-span-2 space-y-2">
                            <label className="text-[10px] font-black uppercase text-slate-700 tracking-widest ml-1">Tipo de Agreement *</label>
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
                            <input className="w-full bg-white border border-slate-300 rounded-2xl px-6 py-4 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200" value={onboardingData.agreement_document_number} onChange={e => setOnboardingData({...onboardingData, agreement_document_number: e.target.value})} placeholder="cONTRATAO_2026-001" />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-slate-700 tracking-widest ml-1">Product Offering Public ID *</label>
                            <input className="w-full bg-white border border-slate-300 rounded-2xl px-6 py-4 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200" value={onboardingData.agreement_product_offering_public_id} onChange={e => setOnboardingData({...onboardingData, agreement_product_offering_public_id: e.target.value})} placeholder="po_d1_abc123xyz" />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-slate-700 tracking-widest ml-1">Fecha Inicio *</label>
                            <input type="date" className="w-full bg-white border border-slate-300 rounded-2xl px-6 py-4 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200" value={onboardingData.start_date} onChange={e => setOnboardingData({...onboardingData, start_date: e.target.value})} />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-slate-700 tracking-widest ml-1">Fecha Fin *</label>
                            <input type="date" className="w-full bg-white border border-slate-300 rounded-2xl px-6 py-4 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200" value={onboardingData.end_date} onChange={e => setOnboardingData({...onboardingData, end_date: e.target.value})} />
                          </div>
                        </div>
                        )}
                      </div>
                    )}

                    {/* STEP 4: INDIVIDUAL (solo CORPORATIVO) */}
                    {formStep === 4 && getOnboardingType(onboardingData.party_role_type_id) === 'CORPORATIVO' && (
                      <div className="space-y-8 flex-1">
                        <div className="flex items-center gap-4 border-b border-slate-200 pb-6">
                          <UserPlusIcon className="w-8 h-8 text-blue-600" />
                          <div>
                            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Individual</h2>
                            <p className="text-xs text-slate-600">Datos personales del usuario</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-6">
                          <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-slate-700 tracking-widest ml-1">Nombres</label>
                            <input className="w-full bg-white border border-slate-300 rounded-2xl px-6 py-4 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200" value={onboardingData.first_name} onChange={e => setOnboardingData({...onboardingData, first_name: e.target.value})} placeholder="Nombres" />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-slate-700 tracking-widest ml-1">Apellidos</label>
                            <input className="w-full bg-white border border-slate-300 rounded-2xl px-6 py-4 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200" value={onboardingData.last_name} onChange={e => setOnboardingData({...onboardingData, last_name: e.target.value})} placeholder="Apellidos" />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-slate-700 tracking-widest ml-1">Fecha de Nacimiento</label>
                            <input type="date" className="w-full bg-white border border-slate-300 rounded-2xl px-6 py-4 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200" value={onboardingData.birth_date} onChange={e => setOnboardingData({...onboardingData, birth_date: e.target.value})} />
                          </div>
                          
                          {/* Sección de Contactos para Individual */}
                          <div className="col-span-2 space-y-4 border-t border-slate-200 pt-6">
                            <div className="flex items-center justify-between">
                              <label className="text-[10px] font-black uppercase text-slate-700 tracking-widest ml-1">Contactos del Individual</label>
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
                        </div>
                      </div>
                    )}

                    {/* STEP 5: DIRECCIÓN */}
                    {formStep === 5 && (
                      <div className="space-y-8 flex-1">
                        <div className="flex items-center gap-4 border-b border-slate-200 pb-6">
                          <GlobeAltIcon className="w-8 h-8 text-blue-600" />
                          <div>
                            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Dirección</h2>
                            <p className="text-xs text-slate-600">Ubicación física</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-6">
                          <div className="col-span-2 space-y-2">
                            <label className="text-[10px] font-black uppercase text-slate-700 tracking-widest ml-1">País *</label>
                            <input className="w-full bg-slate-100 border border-slate-300 rounded-2xl px-6 py-4 text-slate-600 outline-none cursor-not-allowed" value="PER - Perú" disabled />
                            <p className="text-xs text-slate-500 italic">Por ahora solo se permite Perú</p>
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-slate-700 tracking-widest ml-1">Localidad *</label>
                            <input className="w-full bg-white border border-slate-300 rounded-2xl px-6 py-4 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200" value={onboardingData.address.locality} onChange={e => setOnboardingData({...onboardingData, address: {...onboardingData.address, locality: e.target.value}})} placeholder="Lima" />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-slate-700 tracking-widest ml-1">Código Postal</label>
                            <input className="w-full bg-white border border-slate-300 rounded-2xl px-6 py-4 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200" value={onboardingData.address.postcode} onChange={e => setOnboardingData({...onboardingData, address: {...onboardingData.address, postcode: e.target.value}})} placeholder="1010" />
                          </div>
                          <div className="col-span-2 space-y-2">
                            <label className="text-[10px] font-black uppercase text-slate-700 tracking-widest ml-1">Nombre de Calle *</label>
                            <input className="w-full bg-white border border-slate-300 rounded-2xl px-6 py-4 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200" value={onboardingData.address.street_name} onChange={e => setOnboardingData({...onboardingData, address: {...onboardingData.address, street_name: e.target.value}})} placeholder="san jose" />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-slate-700 tracking-widest ml-1">Número *</label>
                            <input className="w-full bg-white border border-slate-300 rounded-2xl px-6 py-4 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200" value={onboardingData.address.street_number} onChange={e => setOnboardingData({...onboardingData, address: {...onboardingData.address, street_number: e.target.value}})} placeholder="22" />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-slate-700 tracking-widest ml-1">Sufijo</label>
                            <input className="w-full bg-white border border-slate-300 rounded-2xl px-6 py-4 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200" value={onboardingData.address.street_nr_suffix || ''} onChange={e => setOnboardingData({...onboardingData, address: {...onboardingData.address, street_nr_suffix: e.target.value}})} placeholder="sj" />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-slate-700 tracking-widest ml-1">External Reference ID</label>
                            <input className="w-full bg-white border border-slate-300 rounded-2xl px-6 py-4 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200" value={onboardingData.address.external_reference_id || ''} onChange={e => setOnboardingData({...onboardingData, address: {...onboardingData.address, external_reference_id: e.target.value}})} placeholder="23213" />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* STEP 6: RELATIONSHIP (solo SUCURSAL) */}
                    {formStep === 6 && getOnboardingType(onboardingData.party_role_type_id) === 'SUCURSAL' && (
                      <div className="space-y-8 flex-1">
                        <div className="flex items-center gap-4 border-b border-slate-200 pb-6">
                          <BuildingOfficeIcon className="w-8 h-8 text-blue-600" />
                          <div>
                            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Relationship</h2>
                            <p className="text-xs text-slate-600">Vincular con Corporativo Padre</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-6">
                          <div className="col-span-2 space-y-2">
                            <label className="text-[10px] font-black uppercase text-slate-700 tracking-widest ml-1">Party Role Public ID del Corporativo Padre *</label>
                            <input className="w-full bg-white border border-slate-300 rounded-2xl px-6 py-4 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200" value={onboardingData.parent_corporativo_party_role_public_id || ''} onChange={e => setOnboardingData({...onboardingData, parent_corporativo_party_role_public_id: e.target.value})} placeholder="prtr_stage_CDxW39jDF4GfxSWsy36VJq" />
                          </div>
                          <div className="col-span-2 space-y-2">
                            <label className="text-[10px] font-black uppercase text-slate-700 tracking-widest ml-1">Descripción</label>
                            <input className="w-full bg-white border border-slate-300 rounded-2xl px-6 py-4 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200" value={onboardingData.relationship_description || ''} onChange={e => setOnboardingData({...onboardingData, relationship_description: e.target.value})} placeholder="Sucursal 1" />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* STEP 7: USUARIO (solo CORPORATIVO) */}
                    {formStep === 7 && getOnboardingType(onboardingData.party_role_type_id) === 'CORPORATIVO' && (
                      <div className="space-y-8 flex-1">
                        <div className="flex items-center gap-4 border-b border-slate-200 pb-6">
                          <LockClosedIcon className="w-8 h-8 text-blue-600" />
                          <div>
                            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Usuario KSEC</h2>
                            <p className="text-xs text-slate-600">Credenciales de acceso</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-6">
                          <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-slate-700 tracking-widest ml-1">Email *</label>
                            <input type="email" className="w-full bg-white border border-slate-300 rounded-2xl px-6 py-4 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200" value={onboardingData.email} onChange={e => setOnboardingData({...onboardingData, email: e.target.value})} placeholder="user@kashio.net" />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-slate-700 tracking-widest ml-1">Teléfono</label>
                            <input className="w-full bg-white border border-slate-300 rounded-2xl px-6 py-4 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200" value={onboardingData.user_phone} onChange={e => setOnboardingData({...onboardingData, user_phone: e.target.value})} placeholder="3210000000" />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* NAV FOOTER */}
                    <div className="mt-auto flex justify-between border-t border-slate-200 pt-10">
                      <button 
                        disabled={formStep === 0} 
                        onClick={() => setFormStep(getPreviousStep(formStep, onboardingData.party_role_type_id))} 
                        className="text-[11px] font-black uppercase tracking-widest text-slate-600 hover:text-slate-900 disabled:opacity-20 transition-all px-4 py-2"
                      >
                        Anterior
                      </button>
                      {(() => {
                        const maxStep = getOnboardingType(onboardingData.party_role_type_id) === 'CORPORATIVO' ? 7 : 6;
                        const nextStep = getNextStep(formStep, onboardingData.party_role_type_id);
                        const isLastStep = formStep >= maxStep;
                        
                        if (!isLastStep) {
                          return (
                            <button 
                              onClick={() => setFormStep(nextStep)} 
                              className="bg-slate-700 hover:bg-slate-800 text-white px-8 py-3 rounded-xl font-black text-[11px] uppercase tracking-widest transition-all shadow-md"
                            >
                              Siguiente
                            </button>
                          );
                        } else {
                          return (
                            <button 
                              onClick={() => startDeployment()} 
                              disabled={!onboardingData.legal_name} 
                              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed text-white px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg"
                            >
                              Iniciar Orquestación
                            </button>
                          );
                        }
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
