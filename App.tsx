import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Environment, EnvironmentConfig } from './types';
import { KashioApiService } from './services/kashioApi';
import { buildEnvironmentConfig } from './utils/envHelper';

interface Organization {
  organization_id?: number;
  public_id: string;
  legal_name: string;
  business_name?: string;
  web_site?: string;
  country_code?: string;
  status?: number;
  other_name?: string;
  source_reference?: string;
  created_at?: string;
  updated_at?: string;
  party_id?: number; // Para obtener datos relacionados
  parent_relationship_id?: number | null; // Para identificar si es sucursal
}

interface Individual {
  individual_id?: number;
  public_id: string;
  full_name: string;
  first_name?: string | null;
  middle_name?: string | null;
  last_name?: string | null;
  other_name?: string | null;
  gender?: string | null;
  title?: string | null;
  birth_country_code?: string | null;
  nationality?: string | null;
  marital_status?: string | null;
  language_ability?: string | null;
  external_reference_id?: string | null;
  status?: number;
  created_at?: string | null;
  updated_at?: string | null;
  organizations?: Array<{ public_id: string; legal_name: string }>; // Organizaciones relacionadas
  party_id?: number; // Para obtener datos relacionados
}

interface Address {
  geographic_address_id: number;
  country_code: string;
  region?: string | null;
  state_province?: string | null;
  city?: string | null;
  locality?: string | null;
  postcode?: string | null;
  street_type?: string | null;
  street_name?: string | null;
  street_number?: string | null;
  street_nr_suffix?: string | null;
  street_nr_last?: string | null;
  street_nr_last_suffix?: string | null;
  status: number;
  start_datetime: string | null;
  end_datetime?: string | null;
  party_id?: number | null;
  external_reference_id?: string | null;
  preferred?: boolean | null;
}

interface ContactMedium {
  contact_medium_id: number;
  contact_medium_type_id: number;
  contact_medium_type_name?: string | null;
  number?: string | null;
  email_address?: string | null;
  start_datetime: string | null;
  end_datetime?: string | null;
  geographic_address_id?: number | null;
  status: number;
  party_id?: number | null;
  preferred?: boolean | null;
}

interface PartyRole {
  party_role_id?: number; // Puede no venir en la respuesta del GET
  public_id?: string;
  party_id: number;
  name: string;
  description?: string | null;
  party_role_type_id?: number | null;
  status?: number;
  start_datetime: string | null;
  end_datetime?: string | null;
}

interface Relationship {
  party_relationship_id?: number;
  from_party_role_id: number;
  to_party_role_id: number;
  relationship_type_id?: number;
  description?: string | null;
  status?: string | null;
}

interface RelationshipType {
  relationship_type_id: number;
  name: string;
  description?: string | null;
  status: number;
}

interface OrganizationsResponse {
  is_success: boolean;
  data: Organization[];
  code?: string;
  message?: string;
  metadata?: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

interface IndividualsResponse {
  is_success: boolean;
  data: Individual[];
  code?: string;
  message?: string;
  metadata?: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

type ActiveView = 'organizations' | 'individuals';

const App: React.FC = () => {
  // Navigation state
  const [activeView, setActiveView] = useState<ActiveView>('organizations');

  // Organizations state
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [orgLoading, setOrgLoading] = useState<boolean>(false);
  const [orgError, setOrgError] = useState<string | null>(null);
  const [orgSuccessMessage, setOrgSuccessMessage] = useState<string | null>(null);
  const [orgSearchTerm, setOrgSearchTerm] = useState<string>('');
  const [orgCurrentPage, setOrgCurrentPage] = useState<number>(1);
  const [orgTotalPages, setOrgTotalPages] = useState<number>(1);
  const [orgTotal, setOrgTotal] = useState<number>(0);
  const [showOrgModal, setShowOrgModal] = useState<boolean>(false);
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
  const [orgFormData, setOrgFormData] = useState<Partial<Organization>>({
    legal_name: '',
    business_name: '',
    web_site: '',
    country_code: 'PER',
    other_name: '',
    source_reference: '',
    status: 1
  });

  // Individuals state
  const [individuals, setIndividuals] = useState<Individual[]>([]);
  const [indLoading, setIndLoading] = useState<boolean>(false);
  const [indError, setIndError] = useState<string | null>(null);
  const [indSuccessMessage, setIndSuccessMessage] = useState<string | null>(null);
  const [indSearchTerm, setIndSearchTerm] = useState<string>('');
  const [indCurrentPage, setIndCurrentPage] = useState<number>(1);
  const [indTotalPages, setIndTotalPages] = useState<number>(1);
  const [indTotal, setIndTotal] = useState<number>(0);
  const [showIndModal, setShowIndModal] = useState<boolean>(false);
  const [editingInd, setEditingInd] = useState<Individual | null>(null);
  const [indFormData, setIndFormData] = useState<Partial<Individual>>({
    full_name: '',
    first_name: '',
    middle_name: '',
    last_name: '',
    other_name: '',
    gender: '',
    nationality: '',
    marital_status: '',
    language_ability: '',
    external_reference_id: '',
    status: 1
  });

  // Shared state
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  
  // Delete confirmation modal state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);
  const [deleteTarget, setDeleteTarget] = useState<{
    type: 'organization' | 'individual';
    publicId: string;
    name: string;
  } | null>(null);

  // Detail modal state
  const [showDetailModal, setShowDetailModal] = useState<boolean>(false);
  const [detailEntity, setDetailEntity] = useState<Organization | Individual | null>(null);
  const [detailType, setDetailType] = useState<'organization' | 'individual' | null>(null);
  const [detailTab, setDetailTab] = useState<'info' | 'relationships'>('info');
  
  // Related data state
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [contactMediums, setContactMediums] = useState<ContactMedium[]>([]);
  const [partyRoles, setPartyRoles] = useState<PartyRole[]>([]);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [relatedOrganizations, setRelatedOrganizations] = useState<Organization[]>([]);
  const [relatedIndividuals, setRelatedIndividuals] = useState<Individual[]>([]);
  const [relationshipTypes, setRelationshipTypes] = useState<RelationshipType[]>([]);
  const [loadingRelated, setLoadingRelated] = useState<boolean>(false);
  
  // Address/Contact modals
  const [showAddressModal, setShowAddressModal] = useState<boolean>(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const [addressFormData, setAddressFormData] = useState<Partial<Address>>({
    country_code: 'PER',
    status: 1,
    preferred: false
  });
  
  const [showContactModal, setShowContactModal] = useState<boolean>(false);
  const [editingContact, setEditingContact] = useState<ContactMedium | null>(null);
  const [contactFormData, setContactFormData] = useState<Partial<ContactMedium>>({
    contact_medium_type_id: 1, // 1=Email por defecto
    status: 1,
    preferred: false
  });
  
  // Create subsidiary modal
  const [showSubsidiaryModal, setShowSubsidiaryModal] = useState<boolean>(false);
  const [subsidiaryFormData, setSubsidiaryFormData] = useState<Partial<Organization>>({
    legal_name: '',
    business_name: '',
    web_site: '',
    country_code: 'PER',
    other_name: '',
    source_reference: '',
    status: 1
  });

  // Wizard state for subsidiary creation
  const [subsidiaryWizardStep, setSubsidiaryWizardStep] = useState<number>(1);
  const [subsidiaryWizardData, setSubsidiaryWizardData] = useState<{
    basic: Partial<Organization>;
    additional: Partial<Organization>;
    contact?: Partial<ContactMedium>;
    address?: Partial<Address>;
  }>({
    basic: { legal_name: '', country_code: 'PER', status: 1 },
    additional: {},
    contact: undefined,
    address: undefined
  });

  // Relationship modal state
  const [showRelationshipModal, setShowRelationshipModal] = useState<boolean>(false);
  const [relationshipFormData, setRelationshipFormData] = useState<{
    relationship_type_id?: number;
    target_type: 'organization' | 'individual' | null;
    target_public_id: string;
    target_name: string;
  }>({
    relationship_type_id: undefined,
    target_type: null,
    target_public_id: '',
    target_name: ''
  });
  const [relationshipSearchTerm, setRelationshipSearchTerm] = useState<string>('');
  const [relationshipSearchResults, setRelationshipSearchResults] = useState<Array<Organization | Individual>>([]);
  const [relationshipSearchLoading, setRelationshipSearchLoading] = useState<boolean>(false);

  // Wizard state for organization creation
  const [orgWizardStep, setOrgWizardStep] = useState<number>(1);
  const [orgWizardData, setOrgWizardData] = useState<{
    basic: Partial<Organization>;
    additional: Partial<Organization>;
    contact?: Partial<ContactMedium>;
    address?: Partial<Address>;
  }>({
    basic: { legal_name: '', country_code: 'PER', status: 1 },
    additional: {},
    contact: undefined,
    address: undefined
  });

  // Wizard state for individual creation
  const [indWizardStep, setIndWizardStep] = useState<number>(1);
  const [indWizardData, setIndWizardData] = useState<{
    basic: Partial<Individual>;
    additional: Partial<Individual>;
    contact?: Partial<ContactMedium>;
    address?: Partial<Address>;
  }>({
    basic: { full_name: '', status: 1 },
    additional: {},
    contact: undefined,
    address: undefined
  });

  const [environment] = useState<Environment>(() => {
    const envFromVar = (import.meta as any).env?.VITE_ENVIRONMENT;
    // Si hay una variable de entorno explícita, usarla (incluso en localhost)
    if (envFromVar && ['LOCAL', 'd1', 'q3'].includes(envFromVar)) {
      return envFromVar as Environment;
    }
    // Si no hay variable de entorno, detectar por hostname
    const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    return isLocalhost ? 'LOCAL' : 'd1'; // Por defecto d1 si no es localhost
  });

  const envConfig = useMemo(() => {
    return buildEnvironmentConfig(environment);
  }, [environment]);

  const api = useMemo(() => new KashioApiService(envConfig, false), [envConfig]);

  // ========== ORGANIZATIONS FUNCTIONS ==========
  const loadOrganizations = useCallback(async (page: number = 1, search: string = '') => {
    setOrgLoading(true);
    setOrgError(null);
    setOrgSuccessMessage(null);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        ...(search && { search })
      });
      
      const response = await api.call('KBRM', `/kbrm/v2/organizations?${params}`, 'GET');
      
      let data: OrganizationsResponse;
      
      if (Array.isArray(response)) {
        data = {
          is_success: true,
          data: response,
          metadata: {
            page: page,
            limit: 20,
            total: response.length,
            total_pages: Math.ceil(response.length / 20)
          }
        };
      } else if (response && typeof response === 'object') {
        if ('is_success' in response && 'data' in response) {
          data = response as OrganizationsResponse;
        } else if ('data' in response) {
          const orgs = Array.isArray(response.data) ? response.data : [response.data];
          data = {
            is_success: true,
            data: orgs,
            metadata: response.metadata || {
              page: page,
              limit: 20,
              total: orgs.length,
              total_pages: Math.ceil(orgs.length / 20)
            }
          };
        } else {
          data = response as OrganizationsResponse;
        }
      } else {
        throw new Error('Respuesta inválida del servidor');
      }
      
      if (data.is_success && Array.isArray(data.data)) {
        setOrganizations(data.data);
        setOrgTotalPages(data.metadata?.total_pages || 1);
        setOrgTotal(data.metadata?.total || data.data.length);
        setOrgError(null);
      } else {
        setOrganizations([]);
        setOrgError(data.message || 'Error al cargar organizaciones');
      }
    } catch (err: any) {
      console.error('Error loading organizations:', err);
      setOrgError(err.message || 'Error al cargar organizaciones');
      setOrganizations([]);
    } finally {
      setOrgLoading(false);
    }
  }, [api]);

  useEffect(() => {
    if (activeView === 'organizations') {
      const timeoutId = setTimeout(() => {
        loadOrganizations(1, orgSearchTerm);
        setOrgCurrentPage(1);
      }, 500);
      return () => clearTimeout(timeoutId);
    }
  }, [orgSearchTerm, loadOrganizations, activeView]);

  useEffect(() => {
    if (activeView === 'organizations' && orgCurrentPage > 1) {
      loadOrganizations(orgCurrentPage, orgSearchTerm);
    }
  }, [orgCurrentPage, activeView]);

  const handleCreateOrg = async () => {
    if (!orgFormData.legal_name) {
      setOrgError('El nombre legal es requerido');
      return;
    }

    setLoading(true);
    setOrgError(null);
    try {
      const payload = {
        legal_name: orgFormData.legal_name,
        business_name: orgFormData.business_name,
        web_site: orgFormData.web_site,
        country_code: orgFormData.country_code || 'PER',
        other_name: orgFormData.other_name,
        source_reference: orgFormData.source_reference,
        status: orgFormData.status || 1
      };

      const orgResponse = await api.call('KBRM', '/kbrm/v2/organizations', 'POST', payload);
      const newOrg = orgResponse?.data || orgResponse;
      const partyId = newOrg.party_id || newOrg.organization_id;

      // Crear Party Role automáticamente para la organización
      if (partyId) {
        try {
          const partyRolePayload = {
            party_id: partyId,
            name: orgFormData.legal_name,
            description: `Party Role para ${orgFormData.legal_name}`,
            party_role_type_id: 1, // Tipo por defecto: Cliente Kashio
            start_datetime: new Date().toISOString(),
            status: 1
          };
          await api.call('KBRM', '/kbrm/v2/party-roles', 'POST', partyRolePayload);
        } catch (partyRoleErr: any) {
          console.warn('Error al crear Party Role (puede que ya exista):', partyRoleErr);
          // No fallar la creación de la organización si el party role falla
        }
      }

      setShowOrgModal(false);
      setEditingOrg(null);
      setOrgFormData({
        legal_name: '',
        business_name: '',
        web_site: '',
        country_code: 'PER',
        other_name: '',
        source_reference: '',
        status: 1
      });
      setOrgSuccessMessage('Organización creada exitosamente');
      setTimeout(() => setOrgSuccessMessage(null), 3000);
      loadOrganizations(orgCurrentPage, orgSearchTerm);
    } catch (err: any) {
      setOrgError(err.message || 'Error al crear organización');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateOrg = async () => {
    if (!editingOrg || !orgFormData.legal_name) {
      setOrgError('El nombre legal es requerido');
      return;
    }

    setLoading(true);
    setOrgError(null);
    try {
      const payload = {
        legal_name: orgFormData.legal_name,
        business_name: orgFormData.business_name,
        web_site: orgFormData.web_site,
        country_code: orgFormData.country_code,
        other_name: orgFormData.other_name,
        source_reference: orgFormData.source_reference,
        status: orgFormData.status
      };

      await api.call('KBRM', `/kbrm/v2/organizations/${editingOrg.public_id}`, 'PUT', payload);
      setShowOrgModal(false);
      setEditingOrg(null);
      setOrgFormData({
        legal_name: '',
        business_name: '',
        web_site: '',
        country_code: 'PER',
        other_name: '',
        source_reference: '',
        status: 1
      });
      setOrgSuccessMessage('Organización actualizada exitosamente');
      setTimeout(() => setOrgSuccessMessage(null), 3000);
      loadOrganizations(orgCurrentPage, orgSearchTerm);
    } catch (err: any) {
      setOrgError(err.message || 'Error al actualizar organización');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteOrg = async (publicId: string) => {
    // Buscar la organización para obtener su nombre
    const org = organizations.find(o => o.public_id === publicId);
    if (org) {
      setDeleteTarget({
        type: 'organization',
        publicId,
        name: org.legal_name || org.public_id
      });
      setShowDeleteConfirm(true);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;

    setLoading(true);
    setShowDeleteConfirm(false);
    
    try {
      if (deleteTarget.type === 'organization') {
        setOrgError(null);
        // Obtener primero la organización para tener todos los campos
        const orgResponse = await api.call('KBRM', `/kbrm/v2/organizations/${deleteTarget.publicId}`, 'GET');
        const org = orgResponse?.data || orgResponse;
        
        // Hacer PUT con todos los campos existentes + status: 0
        const updatePayload = {
          legal_name: org.legal_name,
          business_name: org.business_name || null,
          web_site: org.web_site || null,
          country_code: org.country_code || null,
          other_name: org.other_name || null,
          source_reference: org.source_reference || null,
          status: 0
        };
        
        await api.call('KBRM', `/kbrm/v2/organizations/${deleteTarget.publicId}`, 'PUT', updatePayload);
        setOrgSuccessMessage('Organización eliminada exitosamente');
        setTimeout(() => setOrgSuccessMessage(null), 3000);
        loadOrganizations(orgCurrentPage, orgSearchTerm);
      } else {
        setIndError(null);
        // Obtener primero el individuo para tener todos los campos
        const indResponse = await api.call('KBRM', `/kbrm/v2/individuals/${deleteTarget.publicId}`, 'GET');
        const ind = indResponse?.data || indResponse;
        
        // Hacer PUT con todos los campos existentes + status: 0
        const updatePayload: any = {
          full_name: ind.full_name,
          first_name: ind.first_name || null,
          middle_name: ind.middle_name || null,
          last_name: ind.last_name || null,
          other_name: ind.other_name || null,
          gender: ind.gender || null,
          nationality: ind.nationality || null,
          marital_status: ind.marital_status || null,
          language_ability: ind.language_ability || null,
          external_reference_id: ind.external_reference_id || null,
          status: 0
        };
        
        await api.call('KBRM', `/kbrm/v2/individuals/${deleteTarget.publicId}`, 'PUT', updatePayload);
        setIndSuccessMessage('Individuo eliminado exitosamente');
        setTimeout(() => setIndSuccessMessage(null), 3000);
        loadIndividuals(indCurrentPage, indSearchTerm);
      }
    } catch (err: any) {
      if (deleteTarget.type === 'organization') {
        setOrgError(err.message || 'Error al eliminar organización');
      } else {
        setIndError(err.message || 'Error al eliminar individuo');
      }
    } finally {
      setLoading(false);
      setDeleteTarget(null);
    }
  };

  const handleExportOrgCSV = () => {
    const headers = ['Código', 'Nombre Legal', 'Nombre Comercial', 'Sitio Web', 'País', 'Estado', 'Referencia Externa', 'Fecha Creación'];
    const rows = organizations.map(org => [
      org.public_id || '',
      org.legal_name || '',
      org.business_name || '',
      org.web_site || '',
      org.country_code || '',
      org.status === 1 ? 'Activo' : 'Inactivo',
      org.source_reference || '',
      org.created_at ? new Date(org.created_at).toLocaleDateString() : ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `organizaciones_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleEditOrg = (org: Organization) => {
    setEditingOrg(org);
    setOrgFormData({
      legal_name: org.legal_name,
      business_name: org.business_name || '',
      web_site: org.web_site || '',
      country_code: org.country_code || 'PER',
      other_name: org.other_name || '',
      source_reference: org.source_reference || '',
      status: org.status || 1
    });
    setShowOrgModal(true);
  };

  // ========== INDIVIDUALS FUNCTIONS ==========
  const loadIndividuals = useCallback(async (page: number = 1, search: string = '') => {
    setIndLoading(true);
    setIndError(null);
    setIndSuccessMessage(null);
    try {
      // KBRM no soporta parámetro 'search' en GET /individuals
      // Solo soporta: page, limit, sort_by, sort_order, status
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20'
      });
      
      const response = await api.call('KBRM', `/kbrm/v2/individuals?${params}`, 'GET');
      
      let data: IndividualsResponse;
      
      if (Array.isArray(response)) {
        data = {
          is_success: true,
          data: response,
          metadata: {
            page: page,
            limit: 20,
            total: response.length,
            total_pages: Math.ceil(response.length / 20)
          }
        };
      } else if (response && typeof response === 'object') {
        if ('is_success' in response && 'data' in response) {
          data = response as IndividualsResponse;
        } else if ('data' in response) {
          const inds = Array.isArray(response.data) ? response.data : [response.data];
          data = {
            is_success: true,
            data: inds,
            metadata: response.metadata || {
              page: page,
              limit: 20,
              total: inds.length,
              total_pages: Math.ceil(inds.length / 20)
            }
          };
        } else {
          data = response as IndividualsResponse;
        }
      } else {
        throw new Error('Respuesta inválida del servidor');
      }
      
      if (data.is_success && Array.isArray(data.data)) {
        // Construir un mapa inverso: individuo -> organizaciones
        // Primero cargar todas las organizaciones
        try {
          const orgsResponse = await api.call('KBRM', '/kbrm/v2/organizations?limit=1000', 'GET');
          let orgs: Organization[] = [];
          
          if (Array.isArray(orgsResponse)) {
            orgs = orgsResponse;
          } else if (orgsResponse && typeof orgsResponse === 'object' && 'data' in orgsResponse) {
            orgs = Array.isArray(orgsResponse.data) ? orgsResponse.data : [orgsResponse.data];
          }
          
          // Crear un mapa: individual_public_id -> [organizations]
          const individualToOrgsMap = new Map<string, Array<{ public_id: string; legal_name: string }>>();
          
          // Inicializar el mapa para todos los individuos
          data.data.forEach(ind => {
            individualToOrgsMap.set(ind.public_id, []);
          });
          
          // Para cada organización, obtener sus individuos y actualizar el mapa
          for (const org of orgs) {
            try {
              const orgIndsResponse = await api.call('KBRM', `/kbrm/v2/organizations/${org.public_id}/individuals?limit=1000`, 'GET');
              let orgInds: Individual[] = [];
              
              if (Array.isArray(orgIndsResponse)) {
                orgInds = orgIndsResponse;
              } else if (orgIndsResponse && typeof orgIndsResponse === 'object' && 'data' in orgIndsResponse) {
                orgInds = Array.isArray(orgIndsResponse.data) ? orgIndsResponse.data : [orgIndsResponse.data];
              }
              
              // Para cada individuo de esta organización, agregarlo al mapa
              orgInds.forEach(orgInd => {
                const existing = individualToOrgsMap.get(orgInd.public_id);
                if (existing) {
                  existing.push({ public_id: org.public_id, legal_name: org.legal_name });
                }
              });
            } catch (err) {
              console.warn(`Error loading individuals for org ${org.public_id}:`, err);
            }
          }
          
          // Aplicar el mapa a los individuos y filtrar por búsqueda si existe (búsqueda en frontend)
          let filteredData = data.data;
          if (search && search.trim()) {
            const searchLower = search.toLowerCase();
            filteredData = data.data.filter(ind => 
              ind.full_name?.toLowerCase().includes(searchLower) ||
              ind.first_name?.toLowerCase().includes(searchLower) ||
              ind.last_name?.toLowerCase().includes(searchLower) ||
              ind.public_id?.toLowerCase().includes(searchLower)
            );
          }
          
          const individualsWithOrgs = filteredData.map(ind => ({
            ...ind,
            organizations: individualToOrgsMap.get(ind.public_id) || []
          }));
          
          setIndividuals(individualsWithOrgs);
        } catch (err) {
          console.warn('Error loading organizations for individuals:', err);
          // Si falla, mostrar individuos sin organizaciones
          let filteredData = data.data;
          if (search && search.trim()) {
            const searchLower = search.toLowerCase();
            filteredData = data.data.filter(ind => 
              ind.full_name?.toLowerCase().includes(searchLower) ||
              ind.first_name?.toLowerCase().includes(searchLower) ||
              ind.last_name?.toLowerCase().includes(searchLower) ||
              ind.public_id?.toLowerCase().includes(searchLower)
            );
          }
          setIndividuals(filteredData.map(ind => ({ ...ind, organizations: [] })));
          
          // Ajustar totales si hay búsqueda
          const totalForDisplay = search && search.trim() ? filteredData.length : (data.metadata?.total || data.data.length);
          setIndTotalPages(Math.ceil(totalForDisplay / 20));
          setIndTotal(totalForDisplay);
        }
        setIndError(null);
      } else {
        setIndividuals([]);
        setIndError(data.message || 'Error al cargar individuos');
      }
    } catch (err: any) {
      console.error('Error loading individuals:', err);
      setIndError(err.message || 'Error al cargar individuos');
      setIndividuals([]);
    } finally {
      setIndLoading(false);
    }
  }, [api]);

  useEffect(() => {
    if (activeView === 'individuals') {
      const timeoutId = setTimeout(() => {
        loadIndividuals(1, indSearchTerm);
        setIndCurrentPage(1);
      }, 500);
      return () => clearTimeout(timeoutId);
    }
  }, [indSearchTerm, loadIndividuals, activeView]);

  useEffect(() => {
    if (activeView === 'individuals' && indCurrentPage > 1) {
      loadIndividuals(indCurrentPage, indSearchTerm);
    }
  }, [indCurrentPage, activeView]);

  // Load data when switching views
  useEffect(() => {
    if (activeView === 'organizations') {
      loadOrganizations(1, orgSearchTerm);
    } else if (activeView === 'individuals') {
      loadIndividuals(1, indSearchTerm);
    }
  }, [activeView]);

  const handleCreateInd = async () => {
    if (!indFormData.full_name) {
      setIndError('El nombre completo es requerido');
      return;
    }

    setLoading(true);
    setIndError(null);
    try {
      const payload: any = {
        full_name: indFormData.full_name,
        status: indFormData.status || 1
      };

      if (indFormData.first_name) payload.first_name = indFormData.first_name;
      if (indFormData.middle_name) payload.middle_name = indFormData.middle_name;
      if (indFormData.last_name) payload.last_name = indFormData.last_name;
      if (indFormData.other_name) payload.other_name = indFormData.other_name;
      if (indFormData.gender) payload.gender = indFormData.gender;
      if (indFormData.nationality) payload.nationality = indFormData.nationality;
      if (indFormData.marital_status) payload.marital_status = indFormData.marital_status;
      if (indFormData.language_ability) payload.language_ability = indFormData.language_ability;
      if (indFormData.external_reference_id) payload.external_reference_id = indFormData.external_reference_id;

      const indResponse = await api.call('KBRM', '/kbrm/v2/individuals', 'POST', payload);
      const newInd = indResponse?.data || indResponse;
      const partyId = newInd.party_id || newInd.individual_id;

      // Crear Party Role automáticamente para el individuo
      if (partyId) {
        try {
          const partyRolePayload = {
            party_id: partyId,
            name: indFormData.full_name,
            description: `Party Role para ${indFormData.full_name}`,
            party_role_type_id: 1, // Tipo por defecto: Cliente Kashio
            start_datetime: new Date().toISOString(),
            status: 1
          };
          await api.call('KBRM', '/kbrm/v2/party-roles', 'POST', partyRolePayload);
        } catch (partyRoleErr: any) {
          console.warn('Error al crear Party Role (puede que ya exista):', partyRoleErr);
          // No fallar la creación del individuo si el party role falla
        }
      }

      setShowIndModal(false);
      setEditingInd(null);
      setIndFormData({
        full_name: '',
        first_name: '',
        middle_name: '',
        last_name: '',
        other_name: '',
        title: '',
        gender: '',
        birth_country_code: 'PER',
        nationality: '',
        marital_status: '',
        language_ability: '',
        external_reference_id: '',
        status: 1
      });
      setIndSuccessMessage('Individuo creado exitosamente');
      setTimeout(() => setIndSuccessMessage(null), 3000);
      loadIndividuals(indCurrentPage, indSearchTerm);
    } catch (err: any) {
      setIndError(err.message || 'Error al crear individuo');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateInd = async () => {
    if (!editingInd || !indFormData.full_name) {
      setIndError('El nombre completo es requerido');
      return;
    }

    setLoading(true);
    setIndError(null);
    try {
      const payload: any = {
        full_name: indFormData.full_name,
        status: indFormData.status
      };

      if (indFormData.first_name !== undefined) payload.first_name = indFormData.first_name || null;
      if (indFormData.middle_name !== undefined) payload.middle_name = indFormData.middle_name || null;
      if (indFormData.last_name !== undefined) payload.last_name = indFormData.last_name || null;
      if (indFormData.other_name !== undefined) payload.other_name = indFormData.other_name || null;
      if (indFormData.gender !== undefined) payload.gender = indFormData.gender || null;
      if (indFormData.nationality !== undefined) payload.nationality = indFormData.nationality || null;
      if (indFormData.marital_status !== undefined) payload.marital_status = indFormData.marital_status || null;
      if (indFormData.language_ability !== undefined) payload.language_ability = indFormData.language_ability || null;
      if (indFormData.external_reference_id !== undefined) payload.external_reference_id = indFormData.external_reference_id || null;

      await api.call('KBRM', `/kbrm/v2/individuals/${editingInd.public_id}`, 'PUT', payload);
      setShowIndModal(false);
      setEditingInd(null);
      setIndFormData({
        full_name: '',
        first_name: '',
        middle_name: '',
        last_name: '',
        other_name: '',
        title: '',
        gender: '',
        birth_country_code: 'PER',
        nationality: '',
        marital_status: '',
        language_ability: '',
        external_reference_id: '',
        status: 1
      });
      setIndSuccessMessage('Individuo actualizado exitosamente');
      setTimeout(() => setIndSuccessMessage(null), 3000);
      loadIndividuals(indCurrentPage, indSearchTerm);
    } catch (err: any) {
      setIndError(err.message || 'Error al actualizar individuo');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteInd = async (publicId: string) => {
    // Buscar el individuo para obtener su nombre
    const ind = individuals.find(i => i.public_id === publicId);
    if (ind) {
      setDeleteTarget({
        type: 'individual',
        publicId,
        name: ind.full_name || ind.public_id
      });
      setShowDeleteConfirm(true);
    }
  };

  // ========== DETAIL MODAL FUNCTIONS ==========
  const openDetailModal = async (entity: Organization | Individual, type: 'organization' | 'individual') => {
    setDetailEntity(entity);
    setDetailType(type);
    setDetailTab('info');
    setShowDetailModal(true);
    await loadRelatedData(entity, type);
  };

  const loadRelatedData = async (entity: Organization | Individual, type: 'organization' | 'individual') => {
    setLoadingRelated(true);
    try {
      // Primero obtener el detalle completo para tener party_id
      const detailResponse = await api.call('KBRM', `/kbrm/v2/${type === 'organization' ? 'organizations' : 'individuals'}/${entity.public_id}`, 'GET');
      const detail = detailResponse?.data || detailResponse;
      const partyId = detail.party_id || (type === 'organization' ? detail.organization_id : detail.individual_id);

      if (!partyId) {
        console.warn('No party_id found for entity:', entity);
        setLoadingRelated(false);
        return;
      }

      // Cargar direcciones
      // NOTA: El filtro por party_id en el backend no funciona correctamente (devuelve todas las direcciones)
      // Por ahora, cargamos todas y filtramos en el frontend si es necesario
      try {
        const addressesResponse = await api.call('KBRM', `/kbrm/v2/address?party_id=${partyId}&limit=100`, 'GET');
        const addressesData = addressesResponse?.data || (Array.isArray(addressesResponse) ? addressesResponse : []);
        const allAddresses = Array.isArray(addressesData) ? addressesData : [addressesData];
        
        // Filtrar en el frontend si el backend no lo hace correctamente
        // Por ahora, confiamos en que el backend filtre, pero si devuelve todas, aquí podríamos filtrar
        setAddresses(allAddresses);
      } catch (err) {
        console.warn('Error loading addresses:', err);
        setAddresses([]);
      }

      // Cargar party roles
      try {
        const partyRolesResponse = await api.call('KBRM', `/kbrm/v2/party-roles?party_id=${partyId}&limit=100`, 'GET');
        const partyRolesData = partyRolesResponse?.data || (Array.isArray(partyRolesResponse) ? partyRolesResponse : []);
        const roles = Array.isArray(partyRolesData) ? partyRolesData : [partyRolesData];
        
        // Si los party roles no tienen party_role_id, intentar obtenerlo del detalle
        const rolesWithId = await Promise.all(roles.map(async (role: PartyRole) => {
          if (role.party_role_id) {
            return role;
          }
          // Si no tiene party_role_id pero tiene public_id, obtener el detalle
          if (role.public_id) {
            try {
              const detail = await api.call('KBRM', `/kbrm/v2/party-roles/${role.public_id}`, 'GET');
              return { ...role, party_role_id: detail?.data?.party_role_id || detail?.party_role_id || null };
            } catch (err) {
              return role;
            }
          }
          return role;
        }));
        
        setPartyRoles(rolesWithId);
      } catch (err) {
        console.warn('Error loading party roles:', err);
        setPartyRoles([]);
      }

      // Cargar relationship types
      try {
        // Usar /relationship-types en lugar de /relationships (que devuelve 405)
        const relationshipTypesResponse = await api.call('KBRM', '/kbrm/v2/relationship-types', 'GET');
        const typesData = relationshipTypesResponse?.data || (Array.isArray(relationshipTypesResponse) ? relationshipTypesResponse : []);
        setRelationshipTypes(Array.isArray(typesData) ? typesData : [typesData]);
      } catch (err) {
        console.warn('Error loading relationship types:', err);
        setRelationshipTypes([]);
      }


      // Cargar contact mediums
      // NOTA: No hay endpoint GET para listar contact mediums, solo GET por ID
      // Intentamos obtener contact mediums a través de las direcciones geográficas
      // Para cada dirección, intentamos obtener sus contact mediums asociados
      try {
        const contactMediumsList: ContactMedium[] = [];
        
        // Si tenemos direcciones, intentar obtener contact mediums de cada una
        // Nota: Esto es ineficiente pero es la única forma disponible
        for (const address of addresses) {
          if (address.geographic_address_id) {
            try {
              // Intentar obtener contact medium por geographic_address_id
              // Pero no hay endpoint directo, así que por ahora no cargamos
              // Los contact mediums se cargarán cuando se creen nuevos
            } catch (err) {
              // Ignorar errores individuales
            }
          }
        }
        
        setContactMediums(contactMediumsList);
      } catch (err) {
        console.warn('Error loading contact mediums:', err);
        setContactMediums([]);
      }

    } catch (err: any) {
      console.error('Error loading related data:', err);
    } finally {
      setLoadingRelated(false);
    }
  };

  // ========== ADDRESS FUNCTIONS ==========
  const handleCreateAddress = async () => {
    if (!detailEntity || !addressFormData.country_code) {
      setError('El código de país es requerido');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const detailResponse = await api.call('KBRM', `/kbrm/v2/${detailType === 'organization' ? 'organizations' : 'individuals'}/${detailEntity.public_id}`, 'GET');
      const detail = detailResponse?.data || detailResponse;
      const partyId = detail.party_id || (detailType === 'organization' ? detail.organization_id : detail.individual_id);

      // Convertir campos de texto a números si es necesario (city, region, state_province, street_type deben ser IDs)
      const payload: any = {
        country_code: addressFormData.country_code,
        locality: addressFormData.locality || null,
        postcode: addressFormData.postcode || null,
        street_name: addressFormData.street_name || null,
        street_number: addressFormData.street_number || null,
        street_nr_suffix: addressFormData.street_nr_suffix || null,
        street_nr_last: addressFormData.street_nr_last || null,
        street_nr_last_suffix: addressFormData.street_nr_last_suffix || null,
        status: addressFormData.status || 1,
        start_datetime: new Date().toISOString(),
        party_id: partyId,
        preferred: addressFormData.preferred || false,
        external_reference_id: addressFormData.external_reference_id || null
      };

      // Convertir a números si son strings numéricos, o usar valores por defecto para PER
      if (addressFormData.region) {
        payload.region = typeof addressFormData.region === 'string' && !isNaN(Number(addressFormData.region))
          ? Number(addressFormData.region)
          : (addressFormData.country_code === 'PER' ? 1116 : null); // Default para PER: Lima
      } else if (addressFormData.country_code === 'PER') {
        payload.region = 1116; // Default Lima para PER
      }

      if (addressFormData.state_province) {
        payload.state_province = typeof addressFormData.state_province === 'string' && !isNaN(Number(addressFormData.state_province))
          ? Number(addressFormData.state_province)
          : (addressFormData.country_code === 'PER' ? 8096 : null); // Default para PER
      } else if (addressFormData.country_code === 'PER') {
        payload.state_province = 8096; // Default para PER
      }

      if (addressFormData.city) {
        payload.city = typeof addressFormData.city === 'string' && !isNaN(Number(addressFormData.city))
          ? Number(addressFormData.city)
          : (addressFormData.country_code === 'PER' ? 6813 : null); // Default Lima para PER
      } else if (addressFormData.country_code === 'PER') {
        payload.city = 6813; // Default Lima para PER
      }

      if (addressFormData.street_type) {
        payload.street_type = typeof addressFormData.street_type === 'string' && !isNaN(Number(addressFormData.street_type))
          ? Number(addressFormData.street_type)
          : (addressFormData.country_code === 'PER' ? 6081 : null); // Default para PER
      } else if (addressFormData.country_code === 'PER') {
        payload.street_type = 6081; // Default para PER
      }

      await api.call('KBRM', '/kbrm/v2/address', 'POST', payload);
      setShowAddressModal(false);
      setAddressFormData({ country_code: 'PER', status: 1, preferred: false });
      if (detailEntity) await loadRelatedData(detailEntity, detailType!);
      setSuccessMessage('Dirección creada exitosamente');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Error al crear dirección');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateAddress = async () => {
    if (!editingAddress) return;

    setLoading(true);
    setError(null);
    try {
      const payload: any = {};
      if (addressFormData.country_code) payload.country_code = addressFormData.country_code;
      if (addressFormData.region !== undefined) payload.region = addressFormData.region;
      if (addressFormData.state_province !== undefined) payload.state_province = addressFormData.state_province;
      if (addressFormData.city !== undefined) payload.city = addressFormData.city;
      if (addressFormData.locality !== undefined) payload.locality = addressFormData.locality;
      if (addressFormData.postcode !== undefined) payload.postcode = addressFormData.postcode;
      if (addressFormData.street_type !== undefined) payload.street_type = addressFormData.street_type;
      if (addressFormData.street_name !== undefined) payload.street_name = addressFormData.street_name;
      if (addressFormData.street_number !== undefined) payload.street_number = addressFormData.street_number;
      if (addressFormData.status !== undefined) payload.status = addressFormData.status;

      await api.call('KBRM', `/kbrm/v2/address/${editingAddress.geographic_address_id}`, 'PUT', payload);
      setShowAddressModal(false);
      setEditingAddress(null);
      setAddressFormData({ country_code: 'PER', status: 1, preferred: false });
      if (detailEntity) await loadRelatedData(detailEntity, detailType!);
      setSuccessMessage('Dirección actualizada exitosamente');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Error al actualizar dirección');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAddress = async (addressId: number) => {
    if (!confirm('¿Está seguro de eliminar esta dirección?')) return;

    setLoading(true);
    setError(null);
    try {
      await api.call('KBRM', `/kbrm/v2/address/${addressId}`, 'DELETE');
      if (detailEntity) await loadRelatedData(detailEntity, detailType!);
      setSuccessMessage('Dirección eliminada exitosamente');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Error al eliminar dirección');
    } finally {
      setLoading(false);
    }
  };

  // ========== CONTACT MEDIUM FUNCTIONS ==========
  const handleCreateContact = async () => {
    if (!detailEntity || !contactFormData.contact_medium_type_id) {
      setError('El tipo de contacto es requerido');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const detailResponse = await api.call('KBRM', `/kbrm/v2/${detailType === 'organization' ? 'organizations' : 'individuals'}/${detailEntity.public_id}`, 'GET');
      const detail = detailResponse?.data || detailResponse;
      const partyId = detail.party_id || (detailType === 'organization' ? detail.organization_id : detail.individual_id);

      // Obtener el party_role_id del party role asociado
      // Primero intentar obtenerlo de los party roles ya cargados
      let partyRoleId: number | null = null;
      
      if (partyRoles.length > 0 && partyRoles[0].party_role_id) {
        partyRoleId = partyRoles[0].party_role_id;
      } else if (partyId) {
        // Si no tenemos party_role_id, obtenerlo consultando los party roles
        try {
          const partyRolesResponse = await api.call('KBRM', `/kbrm/v2/party-roles?party_id=${partyId}&limit=1`, 'GET');
          const partyRolesData = partyRolesResponse?.data || (Array.isArray(partyRolesResponse) ? partyRolesResponse : []);
          const firstRole = Array.isArray(partyRolesData) ? partyRolesData[0] : partyRolesData;
          
          // El party_role_id puede venir en la respuesta o necesitamos obtenerlo del detalle
          if (firstRole?.party_role_id) {
            partyRoleId = firstRole.party_role_id;
          } else if (firstRole?.public_id) {
            // Intentar obtener el detalle completo que puede incluir party_role_id
            const partyRoleDetail = await api.call('KBRM', `/kbrm/v2/party-roles/${firstRole.public_id}`, 'GET');
            partyRoleId = partyRoleDetail?.data?.party_role_id || partyRoleDetail?.party_role_id || null;
          }
        } catch (err) {
          console.warn('Error obteniendo party role:', err);
        }
      }

      if (!partyRoleId) {
        throw new Error('No se encontró un Party Role asociado. Por favor, asegúrese de que la organización/individuo tenga un Party Role creado.');
      }

      // Necesitamos una dirección geográfica para crear un contact medium
      // Si no hay direcciones, creamos una básica primero
      let geographicAddressId = contactFormData.geographic_address_id;
      if (!geographicAddressId && addresses.length > 0) {
        geographicAddressId = addresses[0].geographic_address_id;
      } else if (!geographicAddressId) {
        // Crear una dirección básica
        const addressPayload: any = {
          country_code: 'PER',
          region: 1116,
          state_province: 8096,
          city: 6813,
          status: 1,
          start_datetime: new Date().toISOString(),
          party_id: partyId
        };
        const newAddress = await api.call('KBRM', '/kbrm/v2/address', 'POST', addressPayload);
        geographicAddressId = newAddress?.data?.geographic_address_id || newAddress?.geographic_address_id;
      }

      const payload = {
        geographic_address_id: geographicAddressId,
        contact_medium_type_id: contactFormData.contact_medium_type_id,
        number: contactFormData.number || null,
        email_address: contactFormData.email_address || null,
        start_datetime: new Date().toISOString(),
        status: contactFormData.status || 1,
        preferred: contactFormData.preferred || false,
        party_role_id: partyRoleId // Agregar party_role_id requerido
      };

      const contactResponse = await api.call('KBRM', '/kbrm/v2/contact-medium', 'POST', payload);
      const newContact = contactResponse?.data || contactResponse;
      
      // Agregar el nuevo contacto a la lista localmente
      if (newContact) {
        setContactMediums(prev => [...prev, newContact as ContactMedium]);
      }
      
      setShowContactModal(false);
      setContactFormData({ contact_medium_type_id: 1, status: 1, preferred: false });
      setSuccessMessage('Contacto creado exitosamente');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Error al crear contacto');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateContact = async () => {
    if (!editingContact) return;

    setLoading(true);
    setError(null);
    try {
      const payload: any = {};
      if (contactFormData.contact_medium_type_id !== undefined) payload.contact_medium_type_id = contactFormData.contact_medium_type_id;
      if (contactFormData.number !== undefined) payload.number = contactFormData.number;
      if (contactFormData.email_address !== undefined) payload.email_address = contactFormData.email_address;
      if (contactFormData.status !== undefined) payload.status = contactFormData.status;
      if (contactFormData.preferred !== undefined) payload.preferred = contactFormData.preferred;

      const updatedResponse = await api.call('KBRM', `/kbrm/v2/contact-medium/${editingContact.contact_medium_id}`, 'PUT', payload);
      const updated = updatedResponse?.data || updatedResponse;
      
      // Actualizar el contacto en la lista localmente
      if (updated) {
        setContactMediums(prev => prev.map(cm => 
          cm.contact_medium_id === editingContact.contact_medium_id 
            ? { ...cm, ...updated } as ContactMedium
            : cm
        ));
      }
      
      setShowContactModal(false);
      setEditingContact(null);
      setContactFormData({ contact_medium_type_id: 1, status: 1, preferred: false });
      setSuccessMessage('Contacto actualizado exitosamente');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Error al actualizar contacto');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteContact = async (contactId: number) => {
    if (!confirm('¿Está seguro de eliminar este contacto?')) return;

    setLoading(true);
    setError(null);
    try {
      // El endpoint de DELETE para contact-medium no está claro, actualizamos el status a 0 (soft delete)
      await api.call('KBRM', `/kbrm/v2/contact-medium/${contactId}`, 'PUT', { status: 0 });
      
      // Remover el contacto de la lista
      setContactMediums(prev => prev.filter(cm => cm.contact_medium_id !== contactId));
      
      setSuccessMessage('Contacto eliminado exitosamente');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Error al eliminar contacto');
    } finally {
      setLoading(false);
    }
  };

  // ========== RELATIONSHIP FUNCTIONS ==========
  const handleSearchForRelationship = async (searchTerm: string, type: 'organization' | 'individual') => {
    if (!searchTerm || searchTerm.length < 2) {
      setRelationshipSearchResults([]);
      return;
    }

    setRelationshipSearchLoading(true);
    try {
      if (type === 'organization') {
        const response = await api.call('KBRM', `/kbrm/v2/organizations?search=${encodeURIComponent(searchTerm)}&limit=10`, 'GET');
        const data = response?.data || (Array.isArray(response) ? response : []);
        setRelationshipSearchResults(Array.isArray(data) ? data : [data]);
      } else {
        const response = await api.call('KBRM', `/kbrm/v2/individuals?search=${encodeURIComponent(searchTerm)}&limit=10`, 'GET');
        const data = response?.data || (Array.isArray(response) ? response : []);
        setRelationshipSearchResults(Array.isArray(data) ? data : [data]);
      }
    } catch (err: any) {
      console.error('Error searching for relationship:', err);
      setRelationshipSearchResults([]);
    } finally {
      setRelationshipSearchLoading(false);
    }
  };

  const handleCreateRelationship = async () => {
    if (!detailEntity || !relationshipFormData.target_public_id || !relationshipFormData.target_type) {
      setError('Debe seleccionar una entidad para relacionar');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      // 1. Obtener party_role_id de la entidad actual (detailEntity)
      const currentDetail = await api.call('KBRM', `/kbrm/v2/${detailType === 'organization' ? 'organizations' : 'individuals'}/${detailEntity.public_id}`, 'GET');
      const currentPartyId = currentDetail?.data?.party_id || currentDetail?.party_id || (detailType === 'organization' ? (detailEntity as Organization).organization_id : (detailEntity as Individual).individual_id);
      
      const currentPartyRolesResponse = await api.call('KBRM', `/kbrm/v2/party-roles?party_id=${currentPartyId}&limit=1`, 'GET');
      const currentPartyRoles = currentPartyRolesResponse?.data || (Array.isArray(currentPartyRolesResponse) ? currentPartyRolesResponse : []);
      const currentPartyRole = Array.isArray(currentPartyRoles) ? currentPartyRoles[0] : currentPartyRoles;
      
      let currentPartyRoleId = currentPartyRole?.party_role_id;
      if (!currentPartyRoleId && currentPartyRole?.public_id) {
        const currentPartyRoleDetail = await api.call('KBRM', `/kbrm/v2/party-roles/${currentPartyRole.public_id}`, 'GET');
        currentPartyRoleId = currentPartyRoleDetail?.data?.party_role_id || currentPartyRoleDetail?.party_role_id;
      }

      if (!currentPartyRoleId) {
        throw new Error('No se encontró un Party Role para la entidad actual');
      }

      // 2. Obtener party_role_id de la entidad objetivo
      const targetDetail = await api.call('KBRM', `/kbrm/v2/${relationshipFormData.target_type === 'organization' ? 'organizations' : 'individuals'}/${relationshipFormData.target_public_id}`, 'GET');
      const targetPartyId = targetDetail?.data?.party_id || targetDetail?.party_id || (relationshipFormData.target_type === 'organization' ? targetDetail?.data?.organization_id : targetDetail?.data?.individual_id);
      
      const targetPartyRolesResponse = await api.call('KBRM', `/kbrm/v2/party-roles?party_id=${targetPartyId}&limit=1`, 'GET');
      const targetPartyRoles = targetPartyRolesResponse?.data || (Array.isArray(targetPartyRolesResponse) ? targetPartyRolesResponse : []);
      const targetPartyRole = Array.isArray(targetPartyRoles) ? targetPartyRoles[0] : targetPartyRoles;
      
      let targetPartyRoleId = targetPartyRole?.party_role_id;
      if (!targetPartyRoleId && targetPartyRole?.public_id) {
        const targetPartyRoleDetail = await api.call('KBRM', `/kbrm/v2/party-roles/${targetPartyRole.public_id}`, 'GET');
        targetPartyRoleId = targetPartyRoleDetail?.data?.party_role_id || targetPartyRoleDetail?.party_role_id;
      }

      if (!targetPartyRoleId) {
        throw new Error('No se encontró un Party Role para la entidad objetivo');
      }

      // 3. Crear la relación usando POST /relationships
      const relationshipPayload: any = {
        from_party_role_id: currentPartyRoleId,
        to_party_role_id: targetPartyRoleId
      };

      if (relationshipFormData.relationship_type_id) {
        relationshipPayload.relationship_type_id = relationshipFormData.relationship_type_id;
      }

      await api.call('KBRM', '/kbrm/v2/relationships', 'POST', relationshipPayload);

      // 4. Recargar datos relacionados
      if (detailEntity) {
        await loadRelatedData(detailEntity, detailType!);
      }

      setShowRelationshipModal(false);
      setRelationshipFormData({
        relationship_type_id: undefined,
        target_type: null,
        target_public_id: '',
        target_name: ''
      });
      setRelationshipSearchTerm('');
      setRelationshipSearchResults([]);
      setSuccessMessage('Relación creada exitosamente');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Error al crear relación');
    } finally {
      setLoading(false);
    }
  };

  // ========== SUBSIDIARY FUNCTIONS ==========
  const handleCreateSubsidiary = async () => {
    if (!detailEntity || detailType !== 'organization' || !subsidiaryWizardData.basic.legal_name) {
      setError('El nombre legal es requerido');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      // 1. Crear la nueva organización (sucursal)
      const orgPayload = {
        legal_name: subsidiaryWizardData.basic.legal_name,
        business_name: subsidiaryWizardData.additional.business_name,
        web_site: subsidiaryWizardData.additional.web_site,
        country_code: subsidiaryWizardData.basic.country_code || 'PER',
        other_name: subsidiaryWizardData.additional.other_name,
        source_reference: subsidiaryWizardData.additional.source_reference,
        status: subsidiaryWizardData.basic.status || 1
      };

      const newOrgResponse = await api.call('KBRM', '/kbrm/v2/organizations', 'POST', orgPayload);
      const newOrg = newOrgResponse?.data || newOrgResponse;
      const newOrgPublicId = newOrg.public_id;
      const newOrgPartyId = newOrg.party_id || newOrg.organization_id;

      // 2. Obtener Party Role de la organización padre
      const parentDetail = await api.call('KBRM', `/kbrm/v2/organizations/${detailEntity.public_id}`, 'GET');
      const parentPartyId = parentDetail?.data?.party_id || parentDetail?.party_id || (detailEntity as Organization).organization_id;
      
      const parentPartyRolesResponse = await api.call('KBRM', `/kbrm/v2/party-roles?party_id=${parentPartyId}&limit=1`, 'GET');
      const parentPartyRoles = parentPartyRolesResponse?.data || (Array.isArray(parentPartyRolesResponse) ? parentPartyRolesResponse : []);
      const parentPartyRole = Array.isArray(parentPartyRoles) ? parentPartyRoles[0] : parentPartyRoles;
      const parentPartyRoleId = parentPartyRole?.party_role_id;

      // 3. Crear Party Role para la sucursal
      const subsidiaryPartyRolePayload = {
        party_id: newOrgPartyId,
        name: subsidiaryWizardData.basic.legal_name,
        description: `Sucursal de ${(detailEntity as Organization).legal_name}`,
        party_role_type_id: 1, // Tipo por defecto
        start_datetime: new Date().toISOString()
      };

      const newPartyRoleResponse = await api.call('KBRM', '/kbrm/v2/party-roles', 'POST', subsidiaryPartyRolePayload);
      const newPartyRole = newPartyRoleResponse?.data || newPartyRoleResponse;
      const newPartyRoleId = newPartyRole.party_role_id;

      // 4. Crear Relationship entre padre e hija
      if (parentPartyRoleId && newPartyRoleId) {
        const relationshipPayload = {
          from_party_role_id: parentPartyRoleId,
          to_party_role_id: newPartyRoleId,
          relationship_type_id: 2 // Tipo de relación padre-hijo
        };

        await api.call('KBRM', '/kbrm/v2/relationships', 'POST', relationshipPayload);
      }

      // 5. Crear contacto si existe
      if (subsidiaryWizardData.contact && (subsidiaryWizardData.contact.email_address || subsidiaryWizardData.contact.number)) {
        try {
          const partyRolesResponse = await api.call('KBRM', `/kbrm/v2/party-roles?party_id=${newOrgPartyId}&limit=1`, 'GET');
          const partyRolesData = partyRolesResponse?.data || (Array.isArray(partyRolesResponse) ? partyRolesResponse : []);
          const firstRole = Array.isArray(partyRolesData) ? partyRolesData[0] : partyRolesData;
          if (firstRole?.public_id) {
            const partyRoleDetail = await api.call('KBRM', `/kbrm/v2/party-roles/${firstRole.public_id}`, 'GET');
            const partyRoleId = partyRoleDetail?.data?.party_role_id || partyRoleDetail?.party_role_id;
            if (partyRoleId) {
              let geographicAddressId = null;
              if (subsidiaryWizardData.address) {
                const addressPayload: any = {
                  country_code: subsidiaryWizardData.address.country_code || 'PER',
                  region: 1116,
                  state_province: 8096,
                  city: 6813,
                  status: 1,
                  start_datetime: new Date().toISOString(),
                  party_id: newOrgPartyId,
                  ...subsidiaryWizardData.address
                };
                const newAddress = await api.call('KBRM', '/kbrm/v2/address', 'POST', addressPayload);
                geographicAddressId = newAddress?.data?.geographic_address_id || newAddress?.geographic_address_id;
              }
              if (!geographicAddressId) {
                const addressPayload: any = {
                  country_code: 'PER',
                  region: 1116,
                  state_province: 8096,
                  city: 6813,
                  status: 1,
                  start_datetime: new Date().toISOString(),
                  party_id: newOrgPartyId
                };
                const newAddress = await api.call('KBRM', '/kbrm/v2/address', 'POST', addressPayload);
                geographicAddressId = newAddress?.data?.geographic_address_id || newAddress?.geographic_address_id;
              }
              const contactPayload = {
                geographic_address_id: geographicAddressId,
                contact_medium_type_id: subsidiaryWizardData.contact.contact_medium_type_id || 1,
                number: subsidiaryWizardData.contact.number || null,
                email_address: subsidiaryWizardData.contact.email_address || null,
                start_datetime: new Date().toISOString(),
                status: 1,
                preferred: subsidiaryWizardData.contact.preferred || false,
                party_role_id: partyRoleId
              };
              await api.call('KBRM', '/kbrm/v2/contact-medium', 'POST', contactPayload);
            }
          }
        } catch (err) {
          console.warn('Error creando contacto:', err);
        }
      }

      // 6. Crear dirección si existe
      if (subsidiaryWizardData.address && subsidiaryWizardData.address.city) {
        try {
          const addressPayload: any = {
            country_code: subsidiaryWizardData.address.country_code || 'PER',
            region: 1116,
            state_province: 8096,
            city: 6813,
            status: 1,
            start_datetime: new Date().toISOString(),
            party_id: newOrgPartyId,
            ...subsidiaryWizardData.address
          };
          await api.call('KBRM', '/kbrm/v2/address', 'POST', addressPayload);
        } catch (err) {
          console.warn('Error creando dirección:', err);
        }
      }

      setShowSubsidiaryModal(false);
      setSubsidiaryWizardStep(1);
      setSubsidiaryWizardData({
        basic: { legal_name: '', country_code: 'PER', status: 1 },
        additional: {},
        contact: undefined,
        address: undefined
      });
      setSuccessMessage('Sucursal creada exitosamente');
      setTimeout(() => setSuccessMessage(null), 3000);
      
      // Recargar datos
      if (activeView === 'organizations') {
        loadOrganizations(orgCurrentPage, orgSearchTerm);
      }
      if (detailEntity) await loadRelatedData(detailEntity, detailType!);
    } catch (err: any) {
      setError(err.message || 'Error al crear sucursal');
    } finally {
      setLoading(false);
    }
  };

  const handleExportIndCSV = () => {
    const headers = ['Código', 'Nombre Completo', 'Primer Nombre', 'Apellido', 'Organizaciones', 'Estado', 'Referencia Externa', 'Fecha Creación'];
    const rows = individuals.map(ind => [
      ind.public_id || '',
      ind.full_name || '',
      ind.first_name || '',
      ind.last_name || '',
      ind.organizations?.map(org => org.legal_name).join('; ') || '-',
      ind.status === 1 ? 'Activo' : 'Inactivo',
      ind.external_reference_id || '',
      ind.created_at ? new Date(ind.created_at).toLocaleDateString() : ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `individuos_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleEditInd = (ind: Individual) => {
    setEditingInd(ind);
    setIndFormData({
      full_name: ind.full_name,
      first_name: ind.first_name || '',
      middle_name: ind.middle_name || '',
      last_name: ind.last_name || '',
      other_name: ind.other_name || '',
      gender: ind.gender || '',
      nationality: ind.nationality || '',
      marital_status: ind.marital_status || '',
      language_ability: ind.language_ability || '',
      external_reference_id: ind.external_reference_id || '',
      status: ind.status || 1
    });
    setShowIndModal(true);
  };

  const getStatusBadge = (status?: number) => {
    if (status === 1) {
      return <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">Activo</span>;
    }
    return <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">Inactivo</span>;
  };

  const currentError = activeView === 'organizations' ? orgError : indError;
  const currentSuccessMessage = activeView === 'organizations' ? orgSuccessMessage : indSuccessMessage;
  const currentLoading = activeView === 'organizations' ? orgLoading : indLoading;

  return (
    <div className="bg-background-light dark:bg-background-dark font-display text-text-main antialiased h-screen overflow-hidden flex flex-col">
      {/* Header */}
      <header className="w-full bg-white dark:bg-[#1a202c] border-b border-border-light flex-shrink-0 z-20">
        <div className="max-w-[1400px] mx-auto w-full px-8">
          <div className="flex items-center justify-between h-16">
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex h-full overflow-hidden relative">
        {/* Sidebar */}
        <aside className="w-64 bg-white dark:bg-[#1a202c] border-r border-border-light flex-shrink-0 flex flex-col">
          <div className="p-4 flex-1">
            <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-2">
              Gestión de Empresas
            </h2>
            <nav className="space-y-1">
              <button
                onClick={() => setActiveView('organizations')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  activeView === 'organizations'
                    ? 'bg-primary/10 text-primary'
                    : 'text-text-secondary hover:bg-gray-50 hover:text-text-main'
                }`}
              >
                <span className="material-symbols-outlined text-xl">business</span>
                <span>Organizaciones</span>
              </button>
              <button
                onClick={() => setActiveView('individuals')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  activeView === 'individuals'
                    ? 'bg-primary/10 text-primary'
                    : 'text-text-secondary hover:bg-gray-50 hover:text-text-main'
                }`}
              >
                <span className="material-symbols-outlined text-xl">person</span>
                <span>Individuos</span>
              </button>
            </nav>
          </div>
          
          {/* Kashio branding al final del sidebar */}
          <div className="p-4 border-t border-border-light">
            <div className="flex items-center gap-3">
              <div className="size-8 rounded bg-primary flex items-center justify-center text-white flex-shrink-0">
                <span className="material-symbols-outlined text-[20px]">verified_user</span>
              </div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-text-main text-lg font-bold leading-tight m-0">
                  Kashio
                </h1>
                <span className="text-xs font-normal text-text-secondary leading-tight">v1.0.0</span>
              </div>
            </div>
          </div>
        </aside>

        {/* Content Area */}
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          <div className="w-full bg-background-light pt-8 pb-4 px-8 flex-shrink-0">
            <div className="max-w-[1400px] mx-auto w-full">
              <div className="flex items-center gap-2 mb-3 text-sm">
                <a className="text-text-secondary hover:text-primary transition-colors" href="#">Gestión de Empresas</a>
                <span className="text-text-secondary">/</span>
                <span className="text-text-main font-medium">
                  {activeView === 'organizations' ? 'Organizaciones' : 'Individuos'}
                </span>
              </div>
              <div className="flex justify-between items-end">
                <div>
                  <h2 className="text-3xl font-black tracking-tight text-text-main">
                    {activeView === 'organizations' ? 'Organizaciones' : 'Individuos'}
                  </h2>
                  <p className="text-text-secondary text-sm mt-1">
                    {activeView === 'organizations'
                      ? 'Gestiona la estructura de organizaciones de tu empresa.'
                      : 'Gestiona el registro de individuos de tu empresa.'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Content Card */}
          <div className="flex-1 overflow-y-auto p-8 pt-2">
            <div className="max-w-[1400px] mx-auto w-full">
              <div className="bg-white rounded-xl border border-border-light shadow-sm">
                {/* Card Header */}
                <div className="px-6 py-5 border-b border-border-light flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <span className={`material-symbols-outlined text-primary text-xl`}>
                        {activeView === 'organizations' ? 'business' : 'person'}
                      </span>
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-text-main">
                        {activeView === 'organizations' ? 'Gestión de Organizaciones' : 'Gestión de Individuos'}
                      </h3>
                      <p className="text-sm text-text-secondary">
                        {activeView === 'organizations' ? 'Registro maestro de organizaciones' : 'Registro maestro de individuos'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={activeView === 'organizations' ? handleExportOrgCSV : handleExportIndCSV}
                      className="px-4 py-2 text-sm font-medium text-text-main bg-white border border-border-light rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
                    >
                      <span className="material-symbols-outlined text-base">download</span>
                      Exportar CSV
                    </button>
                    <button
                      onClick={() => {
                        if (activeView === 'organizations') {
                          setEditingOrg(null);
                          setOrgError(null);
                          setOrgSuccessMessage(null);
                          setOrgFormData({
                            legal_name: '',
                            business_name: '',
                            web_site: '',
                            country_code: 'PER',
                            other_name: '',
                            source_reference: '',
                            status: 1
                          });
                          setShowOrgModal(true);
                        } else {
                          setEditingInd(null);
                          setIndError(null);
                          setIndSuccessMessage(null);
                          setIndFormData({
                            full_name: '',
                            first_name: '',
                            middle_name: '',
                            last_name: '',
                            other_name: '',
                            gender: '',
                            nationality: '',
                            marital_status: '',
                            language_ability: '',
                            external_reference_id: '',
                            status: 1
                          });
                          setShowIndModal(true);
                        }
                      }}
                      className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-2"
                    >
                      <span className="material-symbols-outlined text-base">add</span>
                      {activeView === 'organizations' ? 'Nueva Organización' : 'Nuevo Individuo'}
                    </button>
                  </div>
                </div>

                {/* Search and Filters */}
                <div className="px-6 py-4 border-b border-border-light bg-gray-50">
                  <div className="flex items-center gap-4">
                    {activeView === 'organizations' && (
                      <div className="flex-1 relative">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary text-lg">search</span>
                        <input
                          type="text"
                          placeholder="Buscar organizaciones..."
                          value={orgSearchTerm}
                          onChange={(e) => setOrgSearchTerm(e.target.value)}
                          className="w-full pl-10 pr-4 py-2 border border-border-light rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                        />
                      </div>
                    )}
                    {activeView === 'individuals' && (
                      <div className="flex-1 relative">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary text-lg">search</span>
                        <input
                          type="text"
                          placeholder="Buscar individuos (por nombre o ID)..."
                          value={indSearchTerm}
                          onChange={(e) => setIndSearchTerm(e.target.value)}
                          className="w-full pl-10 pr-4 py-2 border border-border-light rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Success Message */}
                {currentSuccessMessage && (
                  <div className="px-6 py-3 bg-green-50 border-b border-green-200">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-green-700 flex items-center gap-2">
                        <span className="material-symbols-outlined text-base">check_circle</span>
                        {currentSuccessMessage}
                      </p>
                      <button
                        onClick={() => {
                          if (activeView === 'organizations') {
                            setOrgSuccessMessage(null);
                          } else {
                            setIndSuccessMessage(null);
                          }
                        }}
                        className="text-green-700 hover:text-green-900"
                      >
                        <span className="material-symbols-outlined text-base">close</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Error Message */}
                {currentError && (
                  <div className="px-6 py-3 bg-red-50 border-b border-red-200">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-red-700">{currentError}</p>
                      <button
                        onClick={() => {
                          if (activeView === 'organizations') {
                            setOrgError(null);
                          } else {
                            setIndError(null);
                          }
                        }}
                        className="text-red-700 hover:text-red-900"
                      >
                        <span className="material-symbols-outlined text-base">close</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Table */}
                <div className="overflow-x-auto">
                  {activeView === 'organizations' ? (
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-border-light">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider">Código</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider">Nombre Legal</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider">Nombre Comercial</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider">País</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider">Estado</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-border-light">
                        {orgLoading && organizations.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="px-6 py-12 text-center text-text-secondary">
                              <div className="flex flex-col items-center gap-2">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                                <span>Cargando organizaciones...</span>
                              </div>
                            </td>
                          </tr>
                        ) : organizations.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="px-6 py-12 text-center text-text-secondary">
                              No se encontraron organizaciones
                            </td>
                          </tr>
                        ) : (
                          organizations.map((org) => (
                            <tr key={org.public_id} className="hover:bg-gray-50 transition-colors">
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-text-secondary">{org.public_id}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-text-main font-medium">{org.legal_name}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-text-main">{org.business_name || '-'}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary">{org.country_code || '-'}</td>
                              <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(org.status)}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm">
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => openDetailModal(org, 'organization')}
                                    className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                    title="Ver Detalle"
                                  >
                                    <span className="material-symbols-outlined text-base">visibility</span>
                                  </button>
                                  <button
                                    onClick={() => handleEditOrg(org)}
                                    className="p-1.5 text-primary hover:bg-primary/10 rounded transition-colors"
                                    title="Editar"
                                  >
                                    <span className="material-symbols-outlined text-base">edit</span>
                                  </button>
                                  <button
                                    onClick={() => handleDeleteOrg(org.public_id)}
                                    className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                                    title="Eliminar"
                                  >
                                    <span className="material-symbols-outlined text-base">delete</span>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  ) : (
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-border-light">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider">Código</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider">Nombre Completo</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider">Estado</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-border-light">
                        {indLoading && individuals.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="px-6 py-12 text-center text-text-secondary">
                              <div className="flex flex-col items-center gap-2">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                                <span>Cargando individuos...</span>
                              </div>
                            </td>
                          </tr>
                        ) : individuals.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="px-6 py-12 text-center text-text-secondary">
                              No se encontraron individuos
                            </td>
                          </tr>
                        ) : (
                          individuals.map((ind) => (
                            <tr key={ind.public_id} className="hover:bg-gray-50 transition-colors">
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-text-secondary">{ind.public_id}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-text-main font-medium">{ind.full_name}</td>
                              <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(ind.status)}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm">
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => openDetailModal(ind, 'individual')}
                                    className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                    title="Ver Detalle"
                                  >
                                    <span className="material-symbols-outlined text-base">visibility</span>
                                  </button>
                                  <button
                                    onClick={() => handleEditInd(ind)}
                                    className="p-1.5 text-primary hover:bg-primary/10 rounded transition-colors"
                                    title="Editar"
                                  >
                                    <span className="material-symbols-outlined text-base">edit</span>
                                  </button>
                                  <button
                                    onClick={() => handleDeleteInd(ind.public_id)}
                                    className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                                    title="Eliminar"
                                  >
                                    <span className="material-symbols-outlined text-base">delete</span>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* Pagination */}
                {((activeView === 'organizations' && orgTotalPages > 1) || (activeView === 'individuals' && indTotalPages > 1)) && (
                  <div className="px-6 py-4 border-t border-border-light flex items-center justify-between">
                    <div className="text-sm text-text-secondary">
                      Mostrando {activeView === 'organizations' ? organizations.length : individuals.length} de {activeView === 'organizations' ? orgTotal : indTotal} {activeView === 'organizations' ? 'organizaciones' : 'individuos'}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          if (activeView === 'organizations') {
                            setOrgCurrentPage(p => Math.max(1, p - 1));
                          } else {
                            setIndCurrentPage(p => Math.max(1, p - 1));
                          }
                        }}
                        disabled={activeView === 'organizations' ? orgCurrentPage === 1 : indCurrentPage === 1}
                        className="px-3 py-1.5 text-sm font-medium text-text-main bg-white border border-border-light rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Anterior
                      </button>
                      <span className="px-3 py-1.5 text-sm text-text-secondary">
                        Página {activeView === 'organizations' ? orgCurrentPage : indCurrentPage} de {activeView === 'organizations' ? orgTotalPages : indTotalPages}
                      </span>
                      <button
                        onClick={() => {
                          if (activeView === 'organizations') {
                            setOrgCurrentPage(p => Math.min(orgTotalPages, p + 1));
                          } else {
                            setIndCurrentPage(p => Math.min(indTotalPages, p + 1));
                          }
                        }}
                        disabled={activeView === 'organizations' ? orgCurrentPage === orgTotalPages : indCurrentPage === indTotalPages}
                        className="px-3 py-1.5 text-sm font-medium text-text-main bg-white border border-border-light rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Siguiente
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Organization Create/Edit Modal */}
      {showOrgModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {editingOrg ? (
              // Edit Mode - Simple Form
              <>
                <div className="px-6 py-5 border-b border-border-light flex justify-between items-center">
                  <h3 className="text-xl font-bold text-text-main">Editar Organización</h3>
                  <button
                    onClick={() => {
                      setShowOrgModal(false);
                      setEditingOrg(null);
                      setOrgFormData({
                        legal_name: '',
                        business_name: '',
                        web_site: '',
                        country_code: 'PER',
                        other_name: '',
                        source_reference: '',
                        status: 1
                      });
                      setOrgError(null);
                      setOrgSuccessMessage(null);
                    }}
                    className="p-1.5 text-text-secondary hover:bg-gray-100 rounded transition-colors"
                  >
                    <span className="material-symbols-outlined">close</span>
                  </button>
                </div>
                <div className="p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-text-main mb-1.5">
                      Nombre Legal <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={orgFormData.legal_name}
                      onChange={(e) => setOrgFormData({ ...orgFormData, legal_name: e.target.value })}
                      className="w-full px-4 py-2 border border-border-light rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                      placeholder="Ej. Kashio S.A.C."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-text-main mb-1.5">
                      Nombre Comercial
                    </label>
                    <input
                      type="text"
                      value={orgFormData.business_name}
                      onChange={(e) => setOrgFormData({ ...orgFormData, business_name: e.target.value })}
                      className="w-full px-4 py-2 border border-border-light rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                      placeholder="Ej. Kashio App"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-text-main mb-1.5">
                      Sitio Web
                    </label>
                    <input
                      type="url"
                      value={orgFormData.web_site}
                      onChange={(e) => setOrgFormData({ ...orgFormData, web_site: e.target.value })}
                      className="w-full px-4 py-2 border border-border-light rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                      placeholder="https://"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-text-main mb-1.5">
                        País
                      </label>
                      <select
                        value={orgFormData.country_code}
                        onChange={(e) => setOrgFormData({ ...orgFormData, country_code: e.target.value })}
                        className="w-full px-4 py-2 border border-border-light rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                      >
                        <option value="PER">Perú</option>
                        <option value="MEX">México</option>
                        <option value="COL">Colombia</option>
                        <option value="CHL">Chile</option>
                        <option value="ARG">Argentina</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-text-main mb-1.5">
                        Estado
                      </label>
                      <select
                        value={orgFormData.status}
                        onChange={(e) => setOrgFormData({ ...orgFormData, status: parseInt(e.target.value) })}
                        className="w-full px-4 py-2 border border-border-light rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                      >
                        <option value={1}>Activo</option>
                        <option value={2}>Inactivo</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-text-main mb-1.5">
                      Nombre Alternativo
                    </label>
                    <input
                      type="text"
                      value={orgFormData.other_name}
                      onChange={(e) => setOrgFormData({ ...orgFormData, other_name: e.target.value })}
                      className="w-full px-4 py-2 border border-border-light rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                      placeholder="Otro nombre o alias"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-text-main mb-1.5">
                      Referencia Externa
                    </label>
                    <input
                      type="text"
                      value={orgFormData.source_reference}
                      onChange={(e) => setOrgFormData({ ...orgFormData, source_reference: e.target.value })}
                      className="w-full px-4 py-2 border border-border-light rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                      placeholder="Ej. ZOHO-ID-001"
                    />
                  </div>
                </div>
                <div className="px-6 py-4 border-t border-border-light flex justify-end gap-3">
                  <button
                    onClick={() => {
                      setShowOrgModal(false);
                      setEditingOrg(null);
                      setOrgFormData({
                        legal_name: '',
                        business_name: '',
                        web_site: '',
                        country_code: 'PER',
                        other_name: '',
                        source_reference: '',
                        status: 1
                      });
                      setOrgError(null);
                      setOrgSuccessMessage(null);
                    }}
                    className="px-4 py-2 text-sm font-medium text-text-main bg-white border border-border-light rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleUpdateOrg}
                    disabled={loading}
                    className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Guardando...' : 'Actualizar'}
                  </button>
                </div>
              </>
            ) : (
              // Create Mode - Wizard
              <>
                <div className="px-6 py-5 border-b border-border-light">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-text-main">Nueva Organización</h3>
                    <button
                      onClick={() => {
                        setShowOrgModal(false);
                        setOrgWizardStep(1);
                        setOrgWizardData({
                          basic: { legal_name: '', country_code: 'PER', status: 1 },
                          additional: {},
                          contact: undefined,
                          address: undefined
                        });
                        setOrgError(null);
                        setOrgSuccessMessage(null);
                      }}
                      className="p-1.5 text-text-secondary hover:bg-gray-100 rounded transition-colors"
                    >
                      <span className="material-symbols-outlined">close</span>
                    </button>
                  </div>
                  {/* Progress Steps */}
                  <div className="flex items-center justify-between">
                    {[1, 2, 3, 4].map((step) => (
                      <React.Fragment key={step}>
                        <div className="flex items-center">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                            orgWizardStep === step
                              ? 'bg-primary text-white'
                              : orgWizardStep > step
                              ? 'bg-green-500 text-white'
                              : 'bg-gray-200 text-gray-600'
                          }`}>
                            {orgWizardStep > step ? '✓' : step}
                          </div>
                          <span className={`ml-2 text-xs font-medium ${
                            orgWizardStep >= step ? 'text-text-main' : 'text-text-secondary'
                          }`}>
                            {step === 1 && 'Básica'}
                            {step === 2 && 'Adicional'}
                            {step === 3 && 'Contacto'}
                            {step === 4 && 'Dirección'}
                          </span>
                        </div>
                        {step < 4 && (
                          <div className={`flex-1 h-0.5 mx-2 ${
                            orgWizardStep > step ? 'bg-green-500' : 'bg-gray-200'
                          }`} />
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
                <div className="p-6">
                  {orgWizardStep === 1 && (
                    <div className="space-y-4">
                      <div className="mb-6">
                        <h4 className="text-lg font-semibold text-text-main mb-2">📋 Información Básica</h4>
                        <p className="text-sm text-text-secondary">Completa los datos esenciales de la organización</p>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-text-main mb-1.5">
                          Nombre Legal <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={orgWizardData.basic.legal_name || ''}
                          onChange={(e) => setOrgWizardData({
                            ...orgWizardData,
                            basic: { ...orgWizardData.basic, legal_name: e.target.value }
                          })}
                          className="w-full px-4 py-2 border border-border-light rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                          placeholder="Ej. Kashio S.A.C."
                        />
                        <p className="mt-1 text-xs text-text-secondary">💡 Nombre registrado en documentos oficiales</p>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-text-main mb-1.5">
                          País <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={orgWizardData.basic.country_code || 'PER'}
                          onChange={(e) => setOrgWizardData({
                            ...orgWizardData,
                            basic: { ...orgWizardData.basic, country_code: e.target.value }
                          })}
                          className="w-full px-4 py-2 border border-border-light rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                        >
                          <option value="PER">🇵🇪 Perú</option>
                          <option value="MEX">🇲🇽 México</option>
                          <option value="COL">🇨🇴 Colombia</option>
                          <option value="CHL">🇨🇱 Chile</option>
                          <option value="ARG">🇦🇷 Argentina</option>
                        </select>
                      </div>
                    </div>
                  )}
                  {orgWizardStep === 2 && (
                    <div className="space-y-4">
                      <div className="mb-6">
                        <h4 className="text-lg font-semibold text-text-main mb-2">📝 Información Adicional</h4>
                        <p className="text-sm text-text-secondary">Estos campos son opcionales, puedes completarlos más tarde</p>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-text-main mb-1.5">
                          Nombre Comercial
                        </label>
                        <input
                          type="text"
                          value={orgWizardData.additional.business_name || ''}
                          onChange={(e) => setOrgWizardData({
                            ...orgWizardData,
                            additional: { ...orgWizardData.additional, business_name: e.target.value }
                          })}
                          className="w-full px-4 py-2 border border-border-light rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                          placeholder="Ej. Kashio App"
                        />
                        <p className="mt-1 text-xs text-text-secondary">💡 Nombre con el que se conoce públicamente</p>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-text-main mb-1.5">
                          Sitio Web
                        </label>
                        <input
                          type="url"
                          value={orgWizardData.additional.web_site || ''}
                          onChange={(e) => setOrgWizardData({
                            ...orgWizardData,
                            additional: { ...orgWizardData.additional, web_site: e.target.value }
                          })}
                          className="w-full px-4 py-2 border border-border-light rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                          placeholder="https://www.ejemplo.com"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-text-main mb-1.5">
                          Nombre Alternativo
                        </label>
                        <input
                          type="text"
                          value={orgWizardData.additional.other_name || ''}
                          onChange={(e) => setOrgWizardData({
                            ...orgWizardData,
                            additional: { ...orgWizardData.additional, other_name: e.target.value }
                          })}
                          className="w-full px-4 py-2 border border-border-light rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                          placeholder="Otro nombre o alias"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-text-main mb-1.5">
                          Referencia Externa
                        </label>
                        <input
                          type="text"
                          value={orgWizardData.additional.source_reference || ''}
                          onChange={(e) => setOrgWizardData({
                            ...orgWizardData,
                            additional: { ...orgWizardData.additional, source_reference: e.target.value }
                          })}
                          className="w-full px-4 py-2 border border-border-light rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                          placeholder="Ej. ZOHO-ID-001"
                        />
                        <p className="mt-1 text-xs text-text-secondary">💡 ID de otro sistema si aplica</p>
                      </div>
                    </div>
                  )}
                  {orgWizardStep === 3 && (
                    <div className="space-y-4">
                      <div className="mb-6">
                        <h4 className="text-lg font-semibold text-text-main mb-2">📞 Información de Contacto</h4>
                        <p className="text-sm text-text-secondary">Puedes agregar contactos ahora o más tarde desde el detalle</p>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-text-main mb-1.5">
                          Tipo de Contacto
                        </label>
                        <select
                          value={orgWizardData.contact?.contact_medium_type_id ?? 1}
                          onChange={(e) => {
                            const typeId = parseInt(e.target.value);
                            setOrgWizardData({
                              ...orgWizardData,
                              contact: {
                                contact_medium_type_id: typeId,
                                status: 1,
                                preferred: false,
                                email_address: typeId === 1 ? (orgWizardData.contact?.email_address || '') : undefined,
                                number: typeId !== 1 ? (orgWizardData.contact?.number || '') : undefined
                              }
                            });
                          }}
                          className="w-full px-4 py-2 border border-border-light rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                        >
                          <option value={1}>📧 Email</option>
                          <option value={2}>📞 Teléfono</option>
                          <option value={3}>📱 Móvil</option>
                        </select>
                      </div>
                      {(orgWizardData.contact?.contact_medium_type_id ?? 1) === 1 ? (
                        <div>
                          <label className="block text-sm font-semibold text-text-main mb-1.5">
                            Email
                          </label>
                          <input
                            type="email"
                            value={orgWizardData.contact?.email_address || ''}
                            onChange={(e) => setOrgWizardData({
                              ...orgWizardData,
                              contact: { 
                                ...orgWizardData.contact, 
                                contact_medium_type_id: orgWizardData.contact?.contact_medium_type_id ?? 1,
                                email_address: e.target.value,
                                number: undefined
                              }
                            })}
                            className="w-full px-4 py-2 border border-border-light rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                            placeholder="contacto@ejemplo.com"
                          />
                        </div>
                      ) : (
                        <div>
                          <label className="block text-sm font-semibold text-text-main mb-1.5">
                            Número
                          </label>
                          <input
                            type="tel"
                            value={orgWizardData.contact?.number || ''}
                            onChange={(e) => setOrgWizardData({
                              ...orgWizardData,
                              contact: { 
                                ...orgWizardData.contact, 
                                contact_medium_type_id: orgWizardData.contact?.contact_medium_type_id ?? 2,
                                number: e.target.value,
                                email_address: undefined
                              }
                            })}
                            className="w-full px-4 py-2 border border-border-light rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                            placeholder="+51 999 999 999"
                          />
                        </div>
                      )}
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          checked={orgWizardData.contact?.preferred || false}
                          onChange={(e) => setOrgWizardData({
                            ...orgWizardData,
                            contact: { ...orgWizardData.contact, preferred: e.target.checked }
                          })}
                          className="mr-2"
                        />
                        <label className="text-sm text-text-main">Marcar como contacto preferido</label>
                      </div>
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <p className="text-sm text-blue-800">💡 Puedes omitir este paso y agregar contactos después desde el detalle de la organización</p>
                      </div>
                    </div>
                  )}
                  {orgWizardStep === 4 && (
                    <div className="space-y-4">
                      <div className="mb-6">
                        <h4 className="text-lg font-semibold text-text-main mb-2">📍 Dirección</h4>
                        <p className="text-sm text-text-secondary">Puedes agregar la dirección ahora o más tarde desde el detalle</p>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-semibold text-text-main mb-1.5">
                            País
                          </label>
                          <select
                            value={orgWizardData.address?.country_code || 'PER'}
                            onChange={(e) => setOrgWizardData({
                              ...orgWizardData,
                              address: { ...orgWizardData.address, country_code: e.target.value, status: 1 }
                            })}
                            className="w-full px-4 py-2 border border-border-light rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                          >
                            <option value="PER">🇵🇪 Perú</option>
                            <option value="MEX">🇲🇽 México</option>
                            <option value="COL">🇨🇴 Colombia</option>
                            <option value="CHL">🇨🇱 Chile</option>
                            <option value="ARG">🇦🇷 Argentina</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-text-main mb-1.5">
                            Ciudad
                          </label>
                          <input
                            type="text"
                            value={orgWizardData.address?.city || ''}
                            onChange={(e) => setOrgWizardData({
                              ...orgWizardData,
                              address: { ...orgWizardData.address, city: e.target.value }
                            })}
                            className="w-full px-4 py-2 border border-border-light rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                            placeholder="Ej. Lima"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-text-main mb-1.5">
                            Nombre de Calle
                          </label>
                          <input
                            type="text"
                            value={orgWizardData.address?.street_name || ''}
                            onChange={(e) => setOrgWizardData({
                              ...orgWizardData,
                              address: { ...orgWizardData.address, street_name: e.target.value }
                            })}
                            className="w-full px-4 py-2 border border-border-light rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                            placeholder="Ej. Av. Principal"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-text-main mb-1.5">
                            Número
                          </label>
                          <input
                            type="text"
                            value={orgWizardData.address?.street_number || ''}
                            onChange={(e) => setOrgWizardData({
                              ...orgWizardData,
                              address: { ...orgWizardData.address, street_number: e.target.value }
                            })}
                            className="w-full px-4 py-2 border border-border-light rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                            placeholder="123"
                          />
                        </div>
                      </div>
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <p className="text-sm text-blue-800">💡 Puedes omitir este paso y agregar direcciones después desde el detalle de la organización</p>
                      </div>
                    </div>
                  )}
                  {orgError && (
                    <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-sm text-red-800">{orgError}</p>
                    </div>
                  )}
                </div>
                <div className="px-6 py-4 border-t border-border-light flex justify-between">
                  <button
                    onClick={() => {
                      if (orgWizardStep > 1) {
                        setOrgWizardStep(orgWizardStep - 1);
                      } else {
                        setShowOrgModal(false);
                        setOrgWizardStep(1);
                        setOrgWizardData({
                          basic: { legal_name: '', country_code: 'PER', status: 1 },
                          additional: {},
                          contact: undefined,
                          address: undefined
                        });
                      }
                    }}
                    className="px-4 py-2 text-sm font-medium text-text-main bg-white border border-border-light rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    {orgWizardStep === 1 ? 'Cancelar' : 'Anterior'}
                  </button>
                  <div className="flex gap-3">
                    {orgWizardStep < 4 && (
                      <button
                        onClick={() => {
                          if (orgWizardStep === 1 && !orgWizardData.basic.legal_name) {
                            setOrgError('El nombre legal es requerido');
                            return;
                          }
                          setOrgError(null);
                          setOrgWizardStep(orgWizardStep + 1);
                        }}
                        className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors"
                      >
                        Siguiente
                      </button>
                    )}
                    {orgWizardStep === 4 && (
                      <button
                        onClick={async () => {
                          if (!orgWizardData.basic.legal_name) {
                            setOrgError('El nombre legal es requerido');
                            return;
                          }
                          setLoading(true);
                          setOrgError(null);
                          try {
                            const payload = {
                              legal_name: orgWizardData.basic.legal_name,
                              business_name: orgWizardData.additional.business_name,
                              web_site: orgWizardData.additional.web_site,
                              country_code: orgWizardData.basic.country_code || 'PER',
                              other_name: orgWizardData.additional.other_name,
                              source_reference: orgWizardData.additional.source_reference,
                              status: orgWizardData.basic.status || 1
                            };
                            const orgResponse = await api.call('KBRM', '/kbrm/v2/organizations', 'POST', payload);
                            const newOrg = orgResponse?.data || orgResponse;
                            if (newOrg && newOrg.party_id) {
                              const partyRolePayload = {
                                party_id: newOrg.party_id,
                                name: newOrg.legal_name,
                                description: `Party Role para organización ${newOrg.legal_name}`,
                                status: 1,
                                party_role_type_id: 1,
                                start_datetime: new Date().toISOString()
                              };
                              await api.call('KBRM', '/kbrm/v2/party-roles', 'POST', partyRolePayload);
                              // Crear contacto si existe
                              if (orgWizardData.contact && (orgWizardData.contact.email_address || orgWizardData.contact.number)) {
                                try {
                                  const partyRolesResponse = await api.call('KBRM', `/kbrm/v2/party-roles?party_id=${newOrg.party_id}&limit=1`, 'GET');
                                  const partyRolesData = partyRolesResponse?.data || (Array.isArray(partyRolesResponse) ? partyRolesResponse : []);
                                  const firstRole = Array.isArray(partyRolesData) ? partyRolesData[0] : partyRolesData;
                                  if (firstRole?.public_id) {
                                    const partyRoleDetail = await api.call('KBRM', `/kbrm/v2/party-roles/${firstRole.public_id}`, 'GET');
                                    const partyRoleId = partyRoleDetail?.data?.party_role_id || partyRoleDetail?.party_role_id;
                                    if (partyRoleId) {
                                      let geographicAddressId = null;
                                      if (orgWizardData.address) {
                                        const addressPayload: any = {
                                          country_code: orgWizardData.address.country_code || 'PER',
                                          region: 1116,
                                          state_province: 8096,
                                          city: 6813,
                                          status: 1,
                                          start_datetime: new Date().toISOString(),
                                          party_id: newOrg.party_id,
                                          ...orgWizardData.address
                                        };
                                        const newAddress = await api.call('KBRM', '/kbrm/v2/address', 'POST', addressPayload);
                                        geographicAddressId = newAddress?.data?.geographic_address_id || newAddress?.geographic_address_id;
                                      }
                                      if (!geographicAddressId) {
                                        const addressPayload: any = {
                                          country_code: 'PER',
                                          region: 1116,
                                          state_province: 8096,
                                          city: 6813,
                                          status: 1,
                                          start_datetime: new Date().toISOString(),
                                          party_id: newOrg.party_id
                                        };
                                        const newAddress = await api.call('KBRM', '/kbrm/v2/address', 'POST', addressPayload);
                                        geographicAddressId = newAddress?.data?.geographic_address_id || newAddress?.geographic_address_id;
                                      }
                                      const contactPayload = {
                                        geographic_address_id: geographicAddressId,
                                        contact_medium_type_id: orgWizardData.contact.contact_medium_type_id || 1,
                                        number: orgWizardData.contact.number || null,
                                        email_address: orgWizardData.contact.email_address || null,
                                        start_datetime: new Date().toISOString(),
                                        status: 1,
                                        preferred: orgWizardData.contact.preferred || false,
                                        party_role_id: partyRoleId
                                      };
                                      await api.call('KBRM', '/kbrm/v2/contact-medium', 'POST', contactPayload);
                                    }
                                  }
                                } catch (err) {
                                  console.warn('Error creando contacto:', err);
                                }
                              }
                              // Crear dirección si existe
                              if (orgWizardData.address && orgWizardData.address.city) {
                                try {
                                  const addressPayload: any = {
                                    country_code: orgWizardData.address.country_code || 'PER',
                                    region: 1116,
                                    state_province: 8096,
                                    city: 6813,
                                    status: 1,
                                    start_datetime: new Date().toISOString(),
                                    party_id: newOrg.party_id,
                                    ...orgWizardData.address
                                  };
                                  await api.call('KBRM', '/kbrm/v2/address', 'POST', addressPayload);
                                } catch (err) {
                                  console.warn('Error creando dirección:', err);
                                }
                              }
                            }
                            setShowOrgModal(false);
                            setOrgWizardStep(1);
                            setOrgWizardData({
                              basic: { legal_name: '', country_code: 'PER', status: 1 },
                              additional: {},
                              contact: undefined,
                              address: undefined
                            });
                            setOrgSuccessMessage('Organización creada exitosamente');
                            setTimeout(() => setOrgSuccessMessage(null), 3000);
                            loadOrganizations(orgCurrentPage, orgSearchTerm);
                          } catch (err: any) {
                            setOrgError(err.message || 'Error al crear organización');
                          } finally {
                            setLoading(false);
                          }
                        }}
                        disabled={loading}
                        className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {loading ? 'Guardando...' : 'Crear Organización'}
                      </button>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Individual Create/Edit Modal */}
      {showIndModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {editingInd ? (
              // Edit Mode - Simple Form
              <>
                <div className="px-6 py-5 border-b border-border-light flex justify-between items-center">
                  <h3 className="text-xl font-bold text-text-main">Editar Individuo</h3>
                  <button
                    onClick={() => {
                      setShowIndModal(false);
                      setEditingInd(null);
                      setIndFormData({
                        full_name: '',
                        first_name: '',
                        middle_name: '',
                        last_name: '',
                        other_name: '',
                        gender: '',
                        nationality: '',
                        marital_status: '',
                        language_ability: '',
                        external_reference_id: '',
                        status: 1
                      });
                      setIndError(null);
                      setIndSuccessMessage(null);
                    }}
                    className="p-1.5 text-text-secondary hover:bg-gray-100 rounded transition-colors"
                  >
                    <span className="material-symbols-outlined">close</span>
                  </button>
                </div>
                <div className="p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-text-main mb-1.5">
                      Nombre Completo <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={indFormData.full_name}
                      onChange={(e) => setIndFormData({ ...indFormData, full_name: e.target.value })}
                      className="w-full px-4 py-2 border border-border-light rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                      placeholder="Ej. Juan Carlos Pérez García"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-text-main mb-1.5">
                        Primer Nombre
                      </label>
                      <input
                        type="text"
                        value={indFormData.first_name}
                        onChange={(e) => setIndFormData({ ...indFormData, first_name: e.target.value })}
                        className="w-full px-4 py-2 border border-border-light rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                        placeholder="Ej. Juan Carlos"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-text-main mb-1.5">
                        Apellido
                      </label>
                      <input
                        type="text"
                        value={indFormData.last_name}
                        onChange={(e) => setIndFormData({ ...indFormData, last_name: e.target.value })}
                        className="w-full px-4 py-2 border border-border-light rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                        placeholder="Ej. Pérez García"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-text-main mb-1.5">
                      Nombre Medio
                    </label>
                    <input
                      type="text"
                      value={indFormData.middle_name}
                      onChange={(e) => setIndFormData({ ...indFormData, middle_name: e.target.value })}
                      className="w-full px-4 py-2 border border-border-light rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                      placeholder="Ej. Carlos"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-text-main mb-1.5">
                        Género
                      </label>
                      <select
                        value={indFormData.gender}
                        onChange={(e) => setIndFormData({ ...indFormData, gender: e.target.value })}
                        className="w-full px-4 py-2 border border-border-light rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                      >
                        <option value="">Seleccionar...</option>
                        <option value="M">Masculino</option>
                        <option value="F">Femenino</option>
                        <option value="O">Otro</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-text-main mb-1.5">
                        Estado
                      </label>
                      <select
                        value={indFormData.status}
                        onChange={(e) => setIndFormData({ ...indFormData, status: parseInt(e.target.value) })}
                        className="w-full px-4 py-2 border border-border-light rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                      >
                        <option value={1}>Activo</option>
                        <option value={2}>Inactivo</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-text-main mb-1.5">
                      Nombre Alternativo
                    </label>
                    <input
                      type="text"
                      value={indFormData.other_name}
                      onChange={(e) => setIndFormData({ ...indFormData, other_name: e.target.value })}
                      className="w-full px-4 py-2 border border-border-light rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                      placeholder="Otro nombre o alias"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-text-main mb-1.5">
                      Referencia Externa
                    </label>
                    <input
                      type="text"
                      value={indFormData.external_reference_id}
                      onChange={(e) => setIndFormData({ ...indFormData, external_reference_id: e.target.value })}
                      className="w-full px-4 py-2 border border-border-light rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                      placeholder="Ej. DNI-12345678"
                    />
                  </div>
                </div>
                <div className="px-6 py-4 border-t border-border-light flex justify-end gap-3">
                  <button
                    onClick={() => {
                      setShowIndModal(false);
                      setEditingInd(null);
                      setIndFormData({
                        full_name: '',
                        first_name: '',
                        middle_name: '',
                        last_name: '',
                        other_name: '',
                        gender: '',
                        nationality: '',
                        marital_status: '',
                        language_ability: '',
                        external_reference_id: '',
                        status: 1
                      });
                      setIndError(null);
                      setIndSuccessMessage(null);
                    }}
                    className="px-4 py-2 text-sm font-medium text-text-main bg-white border border-border-light rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleUpdateInd}
                    disabled={loading}
                    className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Guardando...' : 'Actualizar'}
                  </button>
                </div>
              </>
            ) : (
              // Create Mode - Wizard
              <>
                <div className="px-6 py-5 border-b border-border-light">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-text-main">Nuevo Individuo</h3>
                    <button
                      onClick={() => {
                        setShowIndModal(false);
                        setIndWizardStep(1);
                        setIndWizardData({
                          basic: { full_name: '', status: 1 },
                          additional: {},
                          contact: undefined,
                          address: undefined
                        });
                        setIndError(null);
                        setIndSuccessMessage(null);
                      }}
                      className="p-1.5 text-text-secondary hover:bg-gray-100 rounded transition-colors"
                    >
                      <span className="material-symbols-outlined">close</span>
                    </button>
                  </div>
                  {/* Progress Steps */}
                  <div className="flex items-center justify-between">
                    {[1, 2, 3, 4, 5].map((step) => (
                      <React.Fragment key={step}>
                        <div className="flex items-center">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                            indWizardStep === step
                              ? 'bg-primary text-white'
                              : indWizardStep > step
                              ? 'bg-green-500 text-white'
                              : 'bg-gray-200 text-gray-600'
                          }`}>
                            {indWizardStep > step ? '✓' : step}
                          </div>
                          <span className={`ml-2 text-xs font-medium ${
                            indWizardStep >= step ? 'text-text-main' : 'text-text-secondary'
                          }`}>
                            {step === 1 && 'Básica'}
                            {step === 2 && 'Adicional'}
                            {step === 3 && 'Contacto'}
                            {step === 4 && 'Dirección'}
                            {step === 5 && 'Organización'}
                          </span>
                        </div>
                        {step < 5 && (
                          <div className={`flex-1 h-0.5 mx-2 ${
                            indWizardStep > step ? 'bg-green-500' : 'bg-gray-200'
                          }`} />
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
                <div className="p-6">
                  {indWizardStep === 1 && (
                    <div className="space-y-4">
                      <div className="mb-6">
                        <h4 className="text-lg font-semibold text-text-main mb-2">👤 Información Básica</h4>
                        <p className="text-sm text-text-secondary">Completa los datos esenciales de la persona</p>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-text-main mb-1.5">
                          Nombre Completo <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={indWizardData.basic.full_name || ''}
                          onChange={(e) => setIndWizardData({
                            ...indWizardData,
                            basic: { ...indWizardData.basic, full_name: e.target.value }
                          })}
                          className="w-full px-4 py-2 border border-border-light rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                          placeholder="Ej. Juan Carlos Pérez García"
                        />
                        <p className="mt-1 text-xs text-text-secondary">💡 Nombre completo de la persona</p>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-text-main mb-1.5">
                          Género
                        </label>
                        <select
                          value={indWizardData.basic.gender || ''}
                          onChange={(e) => setIndWizardData({
                            ...indWizardData,
                            basic: { ...indWizardData.basic, gender: e.target.value }
                          })}
                          className="w-full px-4 py-2 border border-border-light rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                        >
                          <option value="">Seleccionar...</option>
                          <option value="M">Masculino</option>
                          <option value="F">Femenino</option>
                          <option value="O">Otro</option>
                        </select>
                      </div>
                    </div>
                  )}
                  {indWizardStep === 2 && (
                    <div className="space-y-4">
                      <div className="mb-6">
                        <h4 className="text-lg font-semibold text-text-main mb-2">📝 Información Adicional</h4>
                        <p className="text-sm text-text-secondary">Estos campos son opcionales, puedes completarlos más tarde</p>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-semibold text-text-main mb-1.5">
                            Primer Nombre
                          </label>
                          <input
                            type="text"
                            value={indWizardData.additional.first_name || ''}
                            onChange={(e) => setIndWizardData({
                              ...indWizardData,
                              additional: { ...indWizardData.additional, first_name: e.target.value }
                            })}
                            className="w-full px-4 py-2 border border-border-light rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                            placeholder="Ej. Juan Carlos"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-text-main mb-1.5">
                            Apellido
                          </label>
                          <input
                            type="text"
                            value={indWizardData.additional.last_name || ''}
                            onChange={(e) => setIndWizardData({
                              ...indWizardData,
                              additional: { ...indWizardData.additional, last_name: e.target.value }
                            })}
                            className="w-full px-4 py-2 border border-border-light rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                            placeholder="Ej. Pérez García"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-text-main mb-1.5">
                            Nombre Medio
                          </label>
                          <input
                            type="text"
                            value={indWizardData.additional.middle_name || ''}
                            onChange={(e) => setIndWizardData({
                              ...indWizardData,
                              additional: { ...indWizardData.additional, middle_name: e.target.value }
                            })}
                            className="w-full px-4 py-2 border border-border-light rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                            placeholder="Ej. Carlos"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-text-main mb-1.5">
                            Nacionalidad
                          </label>
                          <input
                            type="text"
                            value={indWizardData.additional.nationality || ''}
                            onChange={(e) => setIndWizardData({
                              ...indWizardData,
                              additional: { ...indWizardData.additional, nationality: e.target.value }
                            })}
                            className="w-full px-4 py-2 border border-border-light rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                            placeholder="Ej. PER"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-text-main mb-1.5">
                          Referencia Externa
                        </label>
                        <input
                          type="text"
                          value={indWizardData.additional.external_reference_id || ''}
                          onChange={(e) => setIndWizardData({
                            ...indWizardData,
                            additional: { ...indWizardData.additional, external_reference_id: e.target.value }
                          })}
                          className="w-full px-4 py-2 border border-border-light rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                          placeholder="Ej. DNI-12345678"
                        />
                        <p className="mt-1 text-xs text-text-secondary">💡 ID de documento de identidad si aplica</p>
                      </div>
                    </div>
                  )}
                  {indWizardStep === 3 && (
                    <div className="space-y-4">
                      <div className="mb-6">
                        <h4 className="text-lg font-semibold text-text-main mb-2">📞 Información de Contacto</h4>
                        <p className="text-sm text-text-secondary">Puedes agregar contactos ahora o más tarde desde el detalle</p>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-text-main mb-1.5">
                          Tipo de Contacto
                        </label>
                        <select
                          value={indWizardData.contact?.contact_medium_type_id ?? 1}
                          onChange={(e) => {
                            const typeId = parseInt(e.target.value);
                            setIndWizardData({
                              ...indWizardData,
                              contact: {
                                contact_medium_type_id: typeId,
                                status: 1,
                                preferred: false,
                                email_address: typeId === 1 ? (indWizardData.contact?.email_address || '') : undefined,
                                number: typeId !== 1 ? (indWizardData.contact?.number || '') : undefined
                              }
                            });
                          }}
                          className="w-full px-4 py-2 border border-border-light rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                        >
                          <option value={1}>📧 Email</option>
                          <option value={2}>📞 Teléfono</option>
                          <option value={3}>📱 Móvil</option>
                        </select>
                      </div>
                      {(indWizardData.contact?.contact_medium_type_id ?? 1) === 1 ? (
                        <div>
                          <label className="block text-sm font-semibold text-text-main mb-1.5">
                            Email
                          </label>
                          <input
                            type="email"
                            value={indWizardData.contact?.email_address || ''}
                            onChange={(e) => setIndWizardData({
                              ...indWizardData,
                              contact: { 
                                ...indWizardData.contact, 
                                contact_medium_type_id: indWizardData.contact?.contact_medium_type_id ?? 1,
                                email_address: e.target.value,
                                number: undefined
                              }
                            })}
                            className="w-full px-4 py-2 border border-border-light rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                            placeholder="persona@ejemplo.com"
                          />
                        </div>
                      ) : (
                        <div>
                          <label className="block text-sm font-semibold text-text-main mb-1.5">
                            Número
                          </label>
                          <input
                            type="tel"
                            value={indWizardData.contact?.number || ''}
                            onChange={(e) => setIndWizardData({
                              ...indWizardData,
                              contact: { 
                                ...indWizardData.contact, 
                                contact_medium_type_id: indWizardData.contact?.contact_medium_type_id ?? 2,
                                number: e.target.value,
                                email_address: undefined
                              }
                            })}
                            className="w-full px-4 py-2 border border-border-light rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                            placeholder="+51 999 999 999"
                          />
                        </div>
                      )}
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          checked={indWizardData.contact?.preferred || false}
                          onChange={(e) => setIndWizardData({
                            ...indWizardData,
                            contact: { ...indWizardData.contact, preferred: e.target.checked }
                          })}
                          className="mr-2"
                        />
                        <label className="text-sm text-text-main">Marcar como contacto preferido</label>
                      </div>
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <p className="text-sm text-blue-800">💡 Puedes omitir este paso y agregar contactos después desde el detalle</p>
                      </div>
                    </div>
                  )}
                  {indWizardStep === 4 && (
                    <div className="space-y-4">
                      <div className="mb-6">
                        <h4 className="text-lg font-semibold text-text-main mb-2">📍 Dirección</h4>
                        <p className="text-sm text-text-secondary">Puedes agregar la dirección ahora o más tarde desde el detalle</p>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-semibold text-text-main mb-1.5">
                            País
                          </label>
                          <select
                            value={indWizardData.address?.country_code || 'PER'}
                            onChange={(e) => setIndWizardData({
                              ...indWizardData,
                              address: { ...indWizardData.address, country_code: e.target.value, status: 1 }
                            })}
                            className="w-full px-4 py-2 border border-border-light rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                          >
                            <option value="PER">🇵🇪 Perú</option>
                            <option value="MEX">🇲🇽 México</option>
                            <option value="COL">🇨🇴 Colombia</option>
                            <option value="CHL">🇨🇱 Chile</option>
                            <option value="ARG">🇦🇷 Argentina</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-text-main mb-1.5">
                            Ciudad
                          </label>
                          <input
                            type="text"
                            value={indWizardData.address?.city || ''}
                            onChange={(e) => setIndWizardData({
                              ...indWizardData,
                              address: { ...indWizardData.address, city: e.target.value }
                            })}
                            className="w-full px-4 py-2 border border-border-light rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                            placeholder="Ej. Lima"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-text-main mb-1.5">
                            Nombre de Calle
                          </label>
                          <input
                            type="text"
                            value={indWizardData.address?.street_name || ''}
                            onChange={(e) => setIndWizardData({
                              ...indWizardData,
                              address: { ...indWizardData.address, street_name: e.target.value }
                            })}
                            className="w-full px-4 py-2 border border-border-light rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                            placeholder="Ej. Av. Principal"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-text-main mb-1.5">
                            Número
                          </label>
                          <input
                            type="text"
                            value={indWizardData.address?.street_number || ''}
                            onChange={(e) => setIndWizardData({
                              ...indWizardData,
                              address: { ...indWizardData.address, street_number: e.target.value }
                            })}
                            className="w-full px-4 py-2 border border-border-light rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                            placeholder="123"
                          />
                        </div>
                      </div>
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <p className="text-sm text-blue-800">💡 Puedes omitir este paso y agregar direcciones después desde el detalle</p>
                      </div>
                    </div>
                  )}
                  {indWizardStep === 5 && (
                    <div className="space-y-4">
                      <div className="mb-6">
                        <h4 className="text-lg font-semibold text-text-main mb-2">🏢 Relacionar con Organización</h4>
                        <p className="text-sm text-text-secondary">Puedes relacionar este individuo con una organización existente</p>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-text-main mb-1.5">
                          Buscar Organización
                        </label>
                        <input
                          type="text"
                          value={relationshipSearchTerm}
                          onChange={(e) => {
                            setRelationshipSearchTerm(e.target.value);
                            if (e.target.value.length >= 2) {
                              handleSearchForRelationship(e.target.value, 'organization');
                            } else {
                              setRelationshipSearchResults([]);
                            }
                          }}
                          className="w-full px-4 py-2 border border-border-light rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                          placeholder="Buscar organización por nombre..."
                        />
                        {relationshipSearchLoading && (
                          <p className="mt-2 text-sm text-text-secondary">Buscando...</p>
                        )}
                        {relationshipSearchResults.length > 0 && (
                          <div className="mt-2 border border-border-light rounded-lg max-h-48 overflow-y-auto">
                            {relationshipSearchResults.map((result) => (
                              <button
                                key={result.public_id}
                                onClick={() => {
                                  setIndWizardData({
                                    ...indWizardData,
                                    additional: {
                                      ...indWizardData.additional,
                                      organization_public_id: result.public_id,
                                      organization_name: (result as Organization).legal_name
                                    }
                                  });
                                  setRelationshipSearchResults([]);
                                  setRelationshipSearchTerm((result as Organization).legal_name);
                                }}
                                className="w-full px-3 py-2 text-left hover:bg-gray-50 border-b border-border-light last:border-b-0"
                              >
                                <p className="text-sm font-medium text-text-main">
                                  {(result as Organization).legal_name}
                                </p>
                                <p className="text-xs text-text-secondary">{result.public_id}</p>
                              </button>
                            ))}
                          </div>
                        )}
                        {indWizardData.additional.organization_public_id && (
                          <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                            <p className="text-sm text-green-800">
                              <strong>Organización seleccionada:</strong> {indWizardData.additional.organization_name}
                            </p>
                          </div>
                        )}
                      </div>
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <p className="text-sm text-blue-800">💡 Puedes omitir este paso y relacionar después desde el detalle</p>
                      </div>
                    </div>
                  )}
                  {indError && (
                    <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-sm text-red-800">{indError}</p>
                    </div>
                  )}
                </div>
                <div className="px-6 py-4 border-t border-border-light flex justify-between">
                  <button
                    onClick={() => {
                      if (indWizardStep > 1) {
                        setIndWizardStep(indWizardStep - 1);
                      } else {
                        setShowIndModal(false);
                        setIndWizardStep(1);
                        setIndWizardData({
                          basic: { full_name: '', status: 1 },
                          additional: {},
                          contact: undefined,
                          address: undefined
                        });
                      }
                    }}
                    className="px-4 py-2 text-sm font-medium text-text-main bg-white border border-border-light rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    {indWizardStep === 1 ? 'Cancelar' : 'Anterior'}
                  </button>
                  <div className="flex gap-3">
                    {indWizardStep < 5 && (
                      <button
                        onClick={() => {
                          if (indWizardStep === 1 && !indWizardData.basic.full_name) {
                            setIndError('El nombre completo es requerido');
                            return;
                          }
                          setIndError(null);
                          setIndWizardStep(indWizardStep + 1);
                        }}
                        className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors"
                      >
                        Siguiente
                      </button>
                    )}
                    {indWizardStep === 5 && (
                      <button
                        onClick={async () => {
                          if (!indWizardData.basic.full_name) {
                            setIndError('El nombre completo es requerido');
                            return;
                          }
                          setLoading(true);
                          setIndError(null);
                          try {
                            const payload: any = {
                              full_name: indWizardData.basic.full_name,
                              status: indWizardData.basic.status || 1
                            };

                            if (indWizardData.basic.gender) payload.gender = indWizardData.basic.gender;
                            if (indWizardData.additional.first_name) payload.first_name = indWizardData.additional.first_name;
                            if (indWizardData.additional.middle_name) payload.middle_name = indWizardData.additional.middle_name;
                            if (indWizardData.additional.last_name) payload.last_name = indWizardData.additional.last_name;
                            if (indWizardData.additional.other_name) payload.other_name = indWizardData.additional.other_name;
                            if (indWizardData.additional.nationality) payload.nationality = indWizardData.additional.nationality;
                            if (indWizardData.additional.external_reference_id) payload.external_reference_id = indWizardData.additional.external_reference_id;

                            const indResponse = await api.call('KBRM', '/kbrm/v2/individuals', 'POST', payload);
                            const newInd = indResponse?.data || indResponse;
                            const partyId = newInd.party_id || newInd.individual_id;

                            // Crear Party Role automáticamente
                            if (partyId) {
                              try {
                                const partyRolePayload = {
                                  party_id: partyId,
                                  name: indWizardData.basic.full_name,
                                  description: `Party Role para ${indWizardData.basic.full_name}`,
                                  party_role_type_id: 1,
                                  start_datetime: new Date().toISOString(),
                                  status: 1
                                };
                                await api.call('KBRM', '/kbrm/v2/party-roles', 'POST', partyRolePayload);
                              } catch (partyRoleErr: any) {
                                console.warn('Error al crear Party Role:', partyRoleErr);
                              }
                            }

                            // Crear contacto si existe
                            if (indWizardData.contact && (indWizardData.contact.email_address || indWizardData.contact.number)) {
                              try {
                                const partyRolesResponse = await api.call('KBRM', `/kbrm/v2/party-roles?party_id=${partyId}&limit=1`, 'GET');
                                const partyRolesData = partyRolesResponse?.data || (Array.isArray(partyRolesResponse) ? partyRolesResponse : []);
                                const firstRole = Array.isArray(partyRolesData) ? partyRolesData[0] : partyRolesData;
                                if (firstRole?.public_id) {
                                  const partyRoleDetail = await api.call('KBRM', `/kbrm/v2/party-roles/${firstRole.public_id}`, 'GET');
                                  const partyRoleId = partyRoleDetail?.data?.party_role_id || partyRoleDetail?.party_role_id;
                                  if (partyRoleId) {
                                    let geographicAddressId = null;
                                    if (indWizardData.address && indWizardData.address.city) {
                                      const addressPayload: any = {
                                        country_code: indWizardData.address.country_code || 'PER',
                                        region: 1116,
                                        state_province: 8096,
                                        city: 6813,
                                        status: 1,
                                        start_datetime: new Date().toISOString(),
                                        party_id: partyId,
                                        ...indWizardData.address
                                      };
                                      const newAddress = await api.call('KBRM', '/kbrm/v2/address', 'POST', addressPayload);
                                      geographicAddressId = newAddress?.data?.geographic_address_id || newAddress?.geographic_address_id;
                                    }
                                    if (!geographicAddressId) {
                                      const addressPayload: any = {
                                        country_code: 'PER',
                                        region: 1116,
                                        state_province: 8096,
                                        city: 6813,
                                        status: 1,
                                        start_datetime: new Date().toISOString(),
                                        party_id: partyId
                                      };
                                      const newAddress = await api.call('KBRM', '/kbrm/v2/address', 'POST', addressPayload);
                                      geographicAddressId = newAddress?.data?.geographic_address_id || newAddress?.geographic_address_id;
                                    }
                                    const contactPayload = {
                                      geographic_address_id: geographicAddressId,
                                      contact_medium_type_id: indWizardData.contact.contact_medium_type_id || 1,
                                      number: indWizardData.contact.number || null,
                                      email_address: indWizardData.contact.email_address || null,
                                      start_datetime: new Date().toISOString(),
                                      status: 1,
                                      preferred: indWizardData.contact.preferred || false,
                                      party_role_id: partyRoleId
                                    };
                                    await api.call('KBRM', '/kbrm/v2/contact-medium', 'POST', contactPayload);
                                  }
                                }
                              } catch (err) {
                                console.warn('Error creando contacto:', err);
                              }
                            }

                            // Crear dirección si existe
                            if (indWizardData.address && indWizardData.address.city) {
                              try {
                                const addressPayload: any = {
                                  country_code: indWizardData.address.country_code || 'PER',
                                  region: 1116,
                                  state_province: 8096,
                                  city: 6813,
                                  status: 1,
                                  start_datetime: new Date().toISOString(),
                                  party_id: partyId,
                                  ...indWizardData.address
                                };
                                await api.call('KBRM', '/kbrm/v2/address', 'POST', addressPayload);
                              } catch (err) {
                                console.warn('Error creando dirección:', err);
                              }
                            }

                            // Relacionar con organización si existe
                            if (indWizardData.additional.organization_public_id) {
                              try {
                                await api.call('KBRM', `/kbrm/v2/organizations/${indWizardData.additional.organization_public_id}/individuals`, 'POST', {
                                  public_id: newInd.public_id
                                });
                              } catch (err) {
                                console.warn('Error relacionando con organización:', err);
                              }
                            }

                            setShowIndModal(false);
                            setIndWizardStep(1);
                            setIndWizardData({
                              basic: { full_name: '', status: 1 },
                              additional: {},
                              contact: undefined,
                              address: undefined
                            });
                            setIndSuccessMessage('Individuo creado exitosamente');
                            setTimeout(() => setIndSuccessMessage(null), 3000);
                            loadIndividuals(indCurrentPage, indSearchTerm);
                          } catch (err: any) {
                            setIndError(err.message || 'Error al crear individuo');
                          } finally {
                            setLoading(false);
                          }
                        }}
                        disabled={loading}
                        className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {loading ? 'Guardando...' : 'Crear Individuo'}
                      </button>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && detailEntity && detailType && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#1a202c] rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 border-b border-border-light flex items-center justify-between">
              <h2 className="text-xl font-semibold text-text-main">
                Detalle de {detailType === 'organization' ? 'Organización' : 'Individuo'}
              </h2>
              <button
                onClick={() => {
                  setShowDetailModal(false);
                  setDetailEntity(null);
                  setDetailType(null);
                  setDetailTab('info');
                }}
                className="text-text-secondary hover:text-text-main transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Tabs */}
            <div className="px-6 border-b border-border-light flex gap-4">
              <button
                onClick={() => setDetailTab('info')}
                className={`py-3 px-4 border-b-2 transition-colors ${
                  detailTab === 'info'
                    ? 'border-primary text-primary font-medium'
                    : 'border-transparent text-text-secondary hover:text-text-main'
                }`}
              >
                Información
              </button>
              {detailType === 'organization' && (
                <button
                  onClick={() => setDetailTab('relationships')}
                  className={`py-3 px-4 border-b-2 transition-colors ${
                    detailTab === 'relationships'
                      ? 'border-primary text-primary font-medium'
                      : 'border-transparent text-text-secondary hover:text-text-main'
                  }`}
                >
                  Relaciones
                </button>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {loadingRelated ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                <>
                  {detailTab === 'info' && (
                    <div className="space-y-6">
                      {detailType === 'organization' ? (
                        <>
                          {/* Información Principal */}
                          <div className="bg-gray-50 rounded-lg p-4">
                            <h3 className="text-md font-semibold text-text-main mb-4 flex items-center gap-2">
                              <span className="material-symbols-outlined text-lg">business</span>
                              Información Principal
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="text-xs font-medium text-text-secondary uppercase tracking-wide">Código Único</label>
                                <p className="mt-1 text-text-main font-mono text-sm bg-white px-3 py-2 rounded border">{detailEntity.public_id}</p>
                              </div>
                              <div>
                                <label className="text-xs font-medium text-text-secondary uppercase tracking-wide">Estado</label>
                                <p className="mt-1">{getStatusBadge((detailEntity as Organization).status)}</p>
                              </div>
                              <div className="col-span-2">
                                <label className="text-xs font-medium text-text-secondary uppercase tracking-wide">Nombre Legal</label>
                                <p className="mt-1 text-text-main font-semibold text-lg">{(detailEntity as Organization).legal_name}</p>
                              </div>
                              {(detailEntity as Organization).business_name && (
                                <div className="col-span-2">
                                  <label className="text-xs font-medium text-text-secondary uppercase tracking-wide">Nombre Comercial</label>
                                  <p className="mt-1 text-text-main">{(detailEntity as Organization).business_name}</p>
                                </div>
                              )}
                              {(detailEntity as Organization).other_name && (
                                <div className="col-span-2">
                                  <label className="text-xs font-medium text-text-secondary uppercase tracking-wide">Nombre Alternativo</label>
                                  <p className="mt-1 text-text-main">{(detailEntity as Organization).other_name}</p>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Información de Contacto y Ubicación */}
                          <div className="bg-gray-50 rounded-lg p-4">
                            <h3 className="text-md font-semibold text-text-main mb-4 flex items-center gap-2">
                              <span className="material-symbols-outlined text-lg">public</span>
                              Contacto y Ubicación
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                              {(detailEntity as Organization).web_site && (
                                <div className="col-span-2">
                                  <label className="text-xs font-medium text-text-secondary uppercase tracking-wide">Sitio Web</label>
                                  <p className="mt-1 text-text-main">
                                    <a href={(detailEntity as Organization).web_site} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                                      {(detailEntity as Organization).web_site}
                                    </a>
                                  </p>
                                </div>
                              )}
                              <div>
                                <label className="text-xs font-medium text-text-secondary uppercase tracking-wide">País</label>
                                <p className="mt-1 text-text-main">
                                  {(detailEntity as Organization).country_code === 'PER' && '🇵🇪 Perú'}
                                  {(detailEntity as Organization).country_code === 'MEX' && '🇲🇽 México'}
                                  {(detailEntity as Organization).country_code === 'COL' && '🇨🇴 Colombia'}
                                  {(detailEntity as Organization).country_code === 'CHL' && '🇨🇱 Chile'}
                                  {(detailEntity as Organization).country_code === 'ARG' && '🇦🇷 Argentina'}
                                  {!['PER', 'MEX', 'COL', 'CHL', 'ARG'].includes((detailEntity as Organization).country_code || '') && (detailEntity as Organization).country_code}
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Información Adicional */}
                          <div className="bg-gray-50 rounded-lg p-4">
                            <h3 className="text-md font-semibold text-text-main mb-4 flex items-center gap-2">
                              <span className="material-symbols-outlined text-lg">info</span>
                              Información Adicional
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                              {(detailEntity as Organization).source_reference && (
                                <div>
                                  <label className="text-xs font-medium text-text-secondary uppercase tracking-wide">Referencia Externa</label>
                                  <p className="mt-1 text-text-main font-mono text-sm">{(detailEntity as Organization).source_reference}</p>
                                </div>
                              )}
                              {(detailEntity as Organization).created_at && (
                                <div>
                                  <label className="text-xs font-medium text-text-secondary uppercase tracking-wide">Fecha de Creación</label>
                                  <p className="mt-1 text-text-main text-sm">
                                    {new Date((detailEntity as Organization).created_at!).toLocaleDateString('es-ES', {
                                      year: 'numeric',
                                      month: 'long',
                                      day: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })}
                                  </p>
                                </div>
                              )}
                              {(detailEntity as Organization).updated_at && (
                                <div>
                                  <label className="text-xs font-medium text-text-secondary uppercase tracking-wide">Última Actualización</label>
                                  <p className="mt-1 text-text-main text-sm">
                                    {new Date((detailEntity as Organization).updated_at!).toLocaleDateString('es-ES', {
                                      year: 'numeric',
                                      month: 'long',
                                      day: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Acciones */}
                          <div className="pt-4 border-t border-border-light">
                            <button
                              onClick={() => {
                                setSubsidiaryFormData({
                                  legal_name: '',
                                  business_name: '',
                                  web_site: '',
                                  country_code: 'PER',
                                  other_name: '',
                                  source_reference: '',
                                  status: 1
                                });
                                setShowSubsidiaryModal(true);
                              }}
                              className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-2"
                            >
                              <span className="material-symbols-outlined text-base">add</span>
                              Crear Sucursal
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          {/* Información Principal */}
                          <div className="bg-gray-50 rounded-lg p-4">
                            <h3 className="text-md font-semibold text-text-main mb-4 flex items-center gap-2">
                              <span className="material-symbols-outlined text-lg">person</span>
                              Información Principal
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="text-xs font-medium text-text-secondary uppercase tracking-wide">Código Único</label>
                                <p className="mt-1 text-text-main font-mono text-sm bg-white px-3 py-2 rounded border">{(detailEntity as Individual).public_id}</p>
                              </div>
                              <div>
                                <label className="text-xs font-medium text-text-secondary uppercase tracking-wide">Estado</label>
                                <p className="mt-1">{getStatusBadge((detailEntity as Individual).status)}</p>
                              </div>
                              <div className="col-span-2">
                                <label className="text-xs font-medium text-text-secondary uppercase tracking-wide">Nombre Completo</label>
                                <p className="mt-1 text-text-main font-semibold text-lg">{(detailEntity as Individual).full_name}</p>
                              </div>
                              {(detailEntity as Individual).first_name && (
                                <div>
                                  <label className="text-xs font-medium text-text-secondary uppercase tracking-wide">Primer Nombre</label>
                                  <p className="mt-1 text-text-main">{(detailEntity as Individual).first_name}</p>
                                </div>
                              )}
                              {(detailEntity as Individual).last_name && (
                                <div>
                                  <label className="text-xs font-medium text-text-secondary uppercase tracking-wide">Apellido</label>
                                  <p className="mt-1 text-text-main">{(detailEntity as Individual).last_name}</p>
                                </div>
                              )}
                              {(detailEntity as Individual).middle_name && (
                                <div>
                                  <label className="text-xs font-medium text-text-secondary uppercase tracking-wide">Nombre Medio</label>
                                  <p className="mt-1 text-text-main">{(detailEntity as Individual).middle_name}</p>
                                </div>
                              )}
                              {(detailEntity as Individual).other_name && (
                                <div>
                                  <label className="text-xs font-medium text-text-secondary uppercase tracking-wide">Nombre Alternativo</label>
                                  <p className="mt-1 text-text-main">{(detailEntity as Individual).other_name}</p>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Información Personal */}
                          <div className="bg-gray-50 rounded-lg p-4">
                            <h3 className="text-md font-semibold text-text-main mb-4 flex items-center gap-2">
                              <span className="material-symbols-outlined text-lg">badge</span>
                              Información Personal
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                              {(detailEntity as Individual).gender && (
                                <div>
                                  <label className="text-xs font-medium text-text-secondary uppercase tracking-wide">Género</label>
                                  <p className="mt-1 text-text-main">
                                    {(detailEntity as Individual).gender === 'M' && 'Masculino'}
                                    {(detailEntity as Individual).gender === 'F' && 'Femenino'}
                                    {(detailEntity as Individual).gender === 'O' && 'Otro'}
                                    {!['M', 'F', 'O'].includes((detailEntity as Individual).gender || '') && (detailEntity as Individual).gender}
                                  </p>
                                </div>
                              )}
                              {(detailEntity as Individual).nationality && (
                                <div>
                                  <label className="text-xs font-medium text-text-secondary uppercase tracking-wide">Nacionalidad</label>
                                  <p className="mt-1 text-text-main">{(detailEntity as Individual).nationality}</p>
                                </div>
                              )}
                              {(detailEntity as Individual).marital_status && (
                                <div>
                                  <label className="text-xs font-medium text-text-secondary uppercase tracking-wide">Estado Civil</label>
                                  <p className="mt-1 text-text-main">{(detailEntity as Individual).marital_status}</p>
                                </div>
                              )}
                              {(detailEntity as Individual).language_ability && (
                                <div>
                                  <label className="text-xs font-medium text-text-secondary uppercase tracking-wide">Idioma</label>
                                  <p className="mt-1 text-text-main">{(detailEntity as Individual).language_ability}</p>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Información Adicional */}
                          <div className="bg-gray-50 rounded-lg p-4">
                            <h3 className="text-md font-semibold text-text-main mb-4 flex items-center gap-2">
                              <span className="material-symbols-outlined text-lg">info</span>
                              Información Adicional
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                              {(detailEntity as Individual).external_reference_id && (
                                <div>
                                  <label className="text-xs font-medium text-text-secondary uppercase tracking-wide">Referencia Externa</label>
                                  <p className="mt-1 text-text-main font-mono text-sm">{(detailEntity as Individual).external_reference_id}</p>
                                </div>
                              )}
                              {(detailEntity as Individual).created_at && (
                                <div>
                                  <label className="text-xs font-medium text-text-secondary uppercase tracking-wide">Fecha de Creación</label>
                                  <p className="mt-1 text-text-main text-sm">
                                    {new Date((detailEntity as Individual).created_at!).toLocaleDateString('es-ES', {
                                      year: 'numeric',
                                      month: 'long',
                                      day: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })}
                                  </p>
                                </div>
                              )}
                              {(detailEntity as Individual).updated_at && (
                                <div>
                                  <label className="text-xs font-medium text-text-secondary uppercase tracking-wide">Última Actualización</label>
                                  <p className="mt-1 text-text-main text-sm">
                                    {new Date((detailEntity as Individual).updated_at!).toLocaleDateString('es-ES', {
                                      year: 'numeric',
                                      month: 'long',
                                      day: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  )}


                  {detailTab === 'relationships' && detailType === 'organization' && (
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-text-main">Relaciones</h3>
                      
                      {/* Party Roles */}
                      <div>
                        <h4 className="text-md font-medium text-text-main mb-3">Roles de la Organización</h4>
                        {partyRoles.length === 0 ? (
                          <p className="text-text-secondary">No hay roles registrados</p>
                        ) : (
                          <div className="space-y-2">
                            {partyRoles.map((role) => (
                              <div key={role.public_id} className="border border-border-light rounded-lg p-3">
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <p className="text-text-main font-medium">{role.name}</p>
                                    <p className="text-text-secondary text-sm mt-1">{role.description || '-'}</p>
                                    <div className="flex gap-2 mt-2">
                                      {role.status === 1 && (
                                        <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">
                                          Activo
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <p className="text-text-secondary text-xs font-mono">{role.public_id}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Address Modal */}
      {showAddressModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#1a202c] rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-xl font-semibold text-text-main mb-4">
                {editingAddress ? 'Editar Dirección' : 'Nueva Dirección'}
              </h2>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-text-main mb-1">País *</label>
                    <input
                      type="text"
                      value={addressFormData.country_code || ''}
                      onChange={(e) => setAddressFormData({ ...addressFormData, country_code: e.target.value })}
                      className="w-full px-3 py-2 border border-border-light rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-main mb-1">Región</label>
                    <input
                      type="text"
                      value={addressFormData.region || ''}
                      onChange={(e) => setAddressFormData({ ...addressFormData, region: e.target.value })}
                      className="w-full px-3 py-2 border border-border-light rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-main mb-1">Provincia</label>
                    <input
                      type="text"
                      value={addressFormData.state_province || ''}
                      onChange={(e) => setAddressFormData({ ...addressFormData, state_province: e.target.value })}
                      className="w-full px-3 py-2 border border-border-light rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-main mb-1">Ciudad</label>
                    <input
                      type="text"
                      value={addressFormData.city || ''}
                      onChange={(e) => setAddressFormData({ ...addressFormData, city: e.target.value })}
                      className="w-full px-3 py-2 border border-border-light rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-main mb-1">Localidad</label>
                    <input
                      type="text"
                      value={addressFormData.locality || ''}
                      onChange={(e) => setAddressFormData({ ...addressFormData, locality: e.target.value })}
                      className="w-full px-3 py-2 border border-border-light rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-main mb-1">Código Postal</label>
                    <input
                      type="text"
                      value={addressFormData.postcode || ''}
                      onChange={(e) => setAddressFormData({ ...addressFormData, postcode: e.target.value })}
                      className="w-full px-3 py-2 border border-border-light rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-main mb-1">Tipo de Calle</label>
                    <input
                      type="text"
                      value={addressFormData.street_type || ''}
                      onChange={(e) => setAddressFormData({ ...addressFormData, street_type: e.target.value })}
                      className="w-full px-3 py-2 border border-border-light rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-main mb-1">Nombre de Calle</label>
                    <input
                      type="text"
                      value={addressFormData.street_name || ''}
                      onChange={(e) => setAddressFormData({ ...addressFormData, street_name: e.target.value })}
                      className="w-full px-3 py-2 border border-border-light rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-main mb-1">Número</label>
                    <input
                      type="text"
                      value={addressFormData.street_number || ''}
                      onChange={(e) => setAddressFormData({ ...addressFormData, street_number: e.target.value })}
                      className="w-full px-3 py-2 border border-border-light rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      checked={addressFormData.preferred || false}
                      onChange={(e) => setAddressFormData({ ...addressFormData, preferred: e.target.checked })}
                      className="mr-2"
                    />
                    <label className="text-sm font-medium text-text-main">Dirección Preferida</label>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowAddressModal(false);
                    setEditingAddress(null);
                    setAddressFormData({ country_code: 'PER', status: 1, preferred: false });
                  }}
                  className="px-4 py-2 text-sm font-medium text-text-main bg-white border border-border-light rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={editingAddress ? handleUpdateAddress : handleCreateAddress}
                  disabled={loading}
                  className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Guardando...' : editingAddress ? 'Actualizar' : 'Crear'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Contact Modal */}
      {showContactModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#1a202c] rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-xl font-semibold text-text-main mb-4">
                {editingContact ? 'Editar Contacto' : 'Nuevo Contacto'}
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-text-main mb-1">Tipo de Contacto *</label>
                  <select
                    value={contactFormData.contact_medium_type_id || 1}
                    onChange={(e) => setContactFormData({ ...contactFormData, contact_medium_type_id: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-border-light rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    required
                  >
                    <option value={1}>Email</option>
                    <option value={2}>Teléfono</option>
                    <option value={3}>Móvil</option>
                  </select>
                </div>
                {contactFormData.contact_medium_type_id === 1 ? (
                  <div>
                    <label className="block text-sm font-medium text-text-main mb-1">Email *</label>
                    <input
                      type="email"
                      value={contactFormData.email_address || ''}
                      onChange={(e) => setContactFormData({ ...contactFormData, email_address: e.target.value })}
                      className="w-full px-3 py-2 border border-border-light rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                      required
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-text-main mb-1">Número *</label>
                    <input
                      type="tel"
                      value={contactFormData.number || ''}
                      onChange={(e) => setContactFormData({ ...contactFormData, number: e.target.value })}
                      className="w-full px-3 py-2 border border-border-light rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                      required
                    />
                  </div>
                )}
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={contactFormData.preferred || false}
                    onChange={(e) => setContactFormData({ ...contactFormData, preferred: e.target.checked })}
                    className="mr-2"
                  />
                  <label className="text-sm font-medium text-text-main">Contacto Preferido</label>
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowContactModal(false);
                    setEditingContact(null);
                    setContactFormData({ contact_medium_type_id: 1, status: 1, preferred: false });
                  }}
                  className="px-4 py-2 text-sm font-medium text-text-main bg-white border border-border-light rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={editingContact ? handleUpdateContact : handleCreateContact}
                  disabled={loading}
                  className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Guardando...' : editingContact ? 'Actualizar' : 'Crear'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Relationship Modal */}
      {showRelationshipModal && detailEntity && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#1a202c] rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-xl font-semibold text-text-main mb-4">Agregar Relación</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-text-main mb-1">Tipo de Relación</label>
                  <select
                    value={relationshipFormData.relationship_type_id || ''}
                    onChange={(e) => setRelationshipFormData({
                      ...relationshipFormData,
                      relationship_type_id: e.target.value ? parseInt(e.target.value) : undefined
                    })}
                    className="w-full px-3 py-2 border border-border-light rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  >
                    <option value="">Seleccionar tipo (opcional)</option>
                    {relationshipTypes.map((type) => (
                      <option key={type.relationship_type_id} value={type.relationship_type_id}>
                        {type.name} {type.description ? `- ${type.description}` : ''}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-text-secondary">Si no selecciona un tipo, se usará el tipo por defecto</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-main mb-1">Tipo de Entidad a Relacionar</label>
                  <select
                    value={relationshipFormData.target_type || ''}
                    onChange={(e) => {
                      const newType = e.target.value as 'organization' | 'individual' | '';
                      setRelationshipFormData({
                        ...relationshipFormData,
                        target_type: newType || null,
                        target_public_id: '',
                        target_name: ''
                      });
                      setRelationshipSearchTerm('');
                      setRelationshipSearchResults([]);
                    }}
                    className="w-full px-3 py-2 border border-border-light rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  >
                    <option value="">Seleccionar tipo...</option>
                    <option value="organization">Organización</option>
                    <option value="individual">Individuo</option>
                  </select>
                </div>
                {relationshipFormData.target_type && (
                  <div>
                    <label className="block text-sm font-medium text-text-main mb-1">
                      Buscar {relationshipFormData.target_type === 'organization' ? 'Organización' : 'Individuo'}
                    </label>
                    <input
                      type="text"
                      value={relationshipSearchTerm}
                      onChange={(e) => {
                        setRelationshipSearchTerm(e.target.value);
                        handleSearchForRelationship(e.target.value, relationshipFormData.target_type!);
                      }}
                      className="w-full px-3 py-2 border border-border-light rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                      placeholder={`Buscar ${relationshipFormData.target_type === 'organization' ? 'organización' : 'individuo'}...`}
                    />
                    {relationshipSearchLoading && (
                      <p className="mt-2 text-sm text-text-secondary">Buscando...</p>
                    )}
                    {relationshipSearchResults.length > 0 && (
                      <div className="mt-2 border border-border-light rounded-lg max-h-48 overflow-y-auto">
                        {relationshipSearchResults.map((result) => (
                          <button
                            key={result.public_id}
                            onClick={() => {
                              setRelationshipFormData({
                                ...relationshipFormData,
                                target_public_id: result.public_id,
                                target_name: relationshipFormData.target_type === 'organization' 
                                  ? (result as Organization).legal_name 
                                  : (result as Individual).full_name
                              });
                              setRelationshipSearchResults([]);
                              setRelationshipSearchTerm(relationshipFormData.target_type === 'organization' 
                                ? (result as Organization).legal_name 
                                : (result as Individual).full_name);
                            }}
                            className="w-full px-3 py-2 text-left hover:bg-gray-50 border-b border-border-light last:border-b-0"
                          >
                            <p className="text-sm font-medium text-text-main">
                              {relationshipFormData.target_type === 'organization' 
                                ? (result as Organization).legal_name 
                                : (result as Individual).full_name}
                            </p>
                            <p className="text-xs text-text-secondary">{result.public_id}</p>
                          </button>
                        ))}
                      </div>
                    )}
                    {relationshipFormData.target_public_id && (
                      <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                        <p className="text-sm text-green-800">
                          <strong>Seleccionado:</strong> {relationshipFormData.target_name}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="flex items-center justify-end gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowRelationshipModal(false);
                    setRelationshipFormData({
                      relationship_type_id: undefined,
                      target_type: null,
                      target_public_id: '',
                      target_name: ''
                    });
                    setRelationshipSearchTerm('');
                    setRelationshipSearchResults([]);
                  }}
                  className="px-4 py-2 text-sm font-medium text-text-main bg-white border border-border-light rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCreateRelationship}
                  disabled={loading || !relationshipFormData.target_public_id}
                  className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Creando...' : 'Crear Relación'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Subsidiary Wizard Modal */}
      {showSubsidiaryModal && detailEntity && detailType === 'organization' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#1a202c] rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-text-main">Crear Sucursal</h2>
                  <p className="text-sm text-text-secondary mt-1">
                    Organización padre: <strong className="text-text-main">{(detailEntity as Organization).legal_name}</strong>
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowSubsidiaryModal(false);
                    setSubsidiaryWizardStep(1);
                    setSubsidiaryWizardData({
                      basic: { legal_name: '', country_code: 'PER', status: 1 },
                      additional: {},
                      contact: undefined,
                      address: undefined
                    });
                  }}
                  className="text-text-secondary hover:text-text-main transition-colors"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              {/* Progress Steps */}
              <div className="mb-6 flex items-center justify-between">
                {[1, 2, 3, 4].map((step) => (
                  <div key={step} className="flex items-center flex-1">
                    <div className="flex flex-col items-center flex-1">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm transition-colors ${
                          subsidiaryWizardStep === step
                            ? 'bg-primary text-white'
                            : subsidiaryWizardStep > step
                              ? 'bg-green-500 text-white'
                              : 'bg-gray-200 text-text-secondary'
                        }`}
                      >
                        {subsidiaryWizardStep > step ? '✓' : step}
                      </div>
                      <p
                        className={`mt-2 text-xs text-center ${
                          subsidiaryWizardStep >= step ? 'text-text-main' : 'text-text-secondary'
                        }`}
                      >
                        {step === 1 && 'Básico'}
                        {step === 2 && 'Adicional'}
                        {step === 3 && 'Contacto'}
                        {step === 4 && 'Dirección'}
                      </p>
                    </div>
                    {step < 4 && (
                      <div
                        className={`h-1 flex-1 mx-2 transition-colors ${
                          subsidiaryWizardStep > step ? 'bg-green-500' : 'bg-gray-200'
                        }`}
                      />
                    )}
                  </div>
                ))}
              </div>

              <div className="border-t border-border-light pt-6">
                {subsidiaryWizardStep === 1 && (
                  <div className="space-y-4">
                    <div className="mb-6">
                      <h4 className="text-lg font-semibold text-text-main mb-2">📋 Información Básica</h4>
                      <p className="text-sm text-text-secondary">Completa los datos esenciales de la sucursal</p>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-text-main mb-1.5">
                        Nombre Legal <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={subsidiaryWizardData.basic.legal_name || ''}
                        onChange={(e) => setSubsidiaryWizardData({
                          ...subsidiaryWizardData,
                          basic: { ...subsidiaryWizardData.basic, legal_name: e.target.value }
                        })}
                        className="w-full px-4 py-2 border border-border-light rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                        placeholder="Ej. Sucursal Lima S.A."
                      />
                      <p className="mt-1 text-xs text-text-secondary">💡 Nombre registrado en documentos oficiales</p>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-text-main mb-1.5">
                        País <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={subsidiaryWizardData.basic.country_code || 'PER'}
                        onChange={(e) => setSubsidiaryWizardData({
                          ...subsidiaryWizardData,
                          basic: { ...subsidiaryWizardData.basic, country_code: e.target.value }
                        })}
                        className="w-full px-4 py-2 border border-border-light rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                      >
                        <option value="PER">🇵🇪 Perú</option>
                        <option value="MEX">🇲🇽 México</option>
                        <option value="COL">🇨🇴 Colombia</option>
                        <option value="CHL">🇨🇱 Chile</option>
                        <option value="ARG">🇦🇷 Argentina</option>
                      </select>
                    </div>
                  </div>
                )}
                {subsidiaryWizardStep === 2 && (
                  <div className="space-y-4">
                    <div className="mb-6">
                      <h4 className="text-lg font-semibold text-text-main mb-2">📝 Información Adicional</h4>
                      <p className="text-sm text-text-secondary">Estos campos son opcionales, puedes completarlos más tarde</p>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-text-main mb-1.5">
                        Nombre Comercial
                      </label>
                      <input
                        type="text"
                        value={subsidiaryWizardData.additional.business_name || ''}
                        onChange={(e) => setSubsidiaryWizardData({
                          ...subsidiaryWizardData,
                          additional: { ...subsidiaryWizardData.additional, business_name: e.target.value }
                        })}
                        className="w-full px-4 py-2 border border-border-light rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                        placeholder="Ej. Sucursal Lima"
                      />
                      <p className="mt-1 text-xs text-text-secondary">💡 Nombre con el que se conoce públicamente</p>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-text-main mb-1.5">
                        Sitio Web
                      </label>
                      <input
                        type="url"
                        value={subsidiaryWizardData.additional.web_site || ''}
                        onChange={(e) => setSubsidiaryWizardData({
                          ...subsidiaryWizardData,
                          additional: { ...subsidiaryWizardData.additional, web_site: e.target.value }
                        })}
                        className="w-full px-4 py-2 border border-border-light rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                        placeholder="https://www.ejemplo.com"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-text-main mb-1.5">
                        Nombre Alternativo
                      </label>
                      <input
                        type="text"
                        value={subsidiaryWizardData.additional.other_name || ''}
                        onChange={(e) => setSubsidiaryWizardData({
                          ...subsidiaryWizardData,
                          additional: { ...subsidiaryWizardData.additional, other_name: e.target.value }
                        })}
                        className="w-full px-4 py-2 border border-border-light rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                        placeholder="Otro nombre o alias"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-text-main mb-1.5">
                        Referencia Externa
                      </label>
                      <input
                        type="text"
                        value={subsidiaryWizardData.additional.source_reference || ''}
                        onChange={(e) => setSubsidiaryWizardData({
                          ...subsidiaryWizardData,
                          additional: { ...subsidiaryWizardData.additional, source_reference: e.target.value }
                        })}
                        className="w-full px-4 py-2 border border-border-light rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                        placeholder="Ej. ZOHO-ID-001"
                      />
                      <p className="mt-1 text-xs text-text-secondary">💡 ID de otro sistema si aplica</p>
                    </div>
                  </div>
                )}
                {subsidiaryWizardStep === 3 && (
                  <div className="space-y-4">
                    <div className="mb-6">
                      <h4 className="text-lg font-semibold text-text-main mb-2">📞 Información de Contacto</h4>
                      <p className="text-sm text-text-secondary">Puedes agregar contactos ahora o más tarde desde el detalle</p>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-text-main mb-1.5">
                        Tipo de Contacto
                      </label>
                      <select
                        value={subsidiaryWizardData.contact?.contact_medium_type_id ?? 1}
                        onChange={(e) => {
                          const typeId = parseInt(e.target.value);
                          setSubsidiaryWizardData({
                            ...subsidiaryWizardData,
                            contact: {
                              contact_medium_type_id: typeId,
                              status: 1,
                              preferred: false,
                              email_address: typeId === 1 ? (subsidiaryWizardData.contact?.email_address || '') : undefined,
                              number: typeId !== 1 ? (subsidiaryWizardData.contact?.number || '') : undefined
                            }
                          });
                        }}
                        className="w-full px-4 py-2 border border-border-light rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                      >
                        <option value={1}>📧 Email</option>
                        <option value={2}>📞 Teléfono</option>
                        <option value={3}>📱 Móvil</option>
                      </select>
                    </div>
                    {(subsidiaryWizardData.contact?.contact_medium_type_id ?? 1) === 1 ? (
                      <div>
                        <label className="block text-sm font-semibold text-text-main mb-1.5">
                          Email
                        </label>
                        <input
                          type="email"
                          value={subsidiaryWizardData.contact?.email_address || ''}
                          onChange={(e) => setSubsidiaryWizardData({
                            ...subsidiaryWizardData,
                            contact: { 
                              ...subsidiaryWizardData.contact, 
                              contact_medium_type_id: subsidiaryWizardData.contact?.contact_medium_type_id ?? 1,
                              email_address: e.target.value,
                              number: undefined
                            }
                          })}
                          className="w-full px-4 py-2 border border-border-light rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                          placeholder="contacto@ejemplo.com"
                        />
                      </div>
                    ) : (
                      <div>
                        <label className="block text-sm font-semibold text-text-main mb-1.5">
                          Número
                        </label>
                        <input
                          type="tel"
                          value={subsidiaryWizardData.contact?.number || ''}
                          onChange={(e) => setSubsidiaryWizardData({
                            ...subsidiaryWizardData,
                            contact: { 
                              ...subsidiaryWizardData.contact, 
                              contact_medium_type_id: subsidiaryWizardData.contact?.contact_medium_type_id ?? 2,
                              number: e.target.value,
                              email_address: undefined
                            }
                          })}
                          className="w-full px-4 py-2 border border-border-light rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                          placeholder="+51 999 999 999"
                        />
                      </div>
                    )}
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        checked={subsidiaryWizardData.contact?.preferred || false}
                        onChange={(e) => setSubsidiaryWizardData({
                          ...subsidiaryWizardData,
                          contact: { ...subsidiaryWizardData.contact, preferred: e.target.checked }
                        })}
                        className="mr-2"
                      />
                      <label className="text-sm text-text-main">Marcar como contacto preferido</label>
                    </div>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <p className="text-sm text-blue-800">💡 Puedes omitir este paso y agregar contactos después desde el detalle de la sucursal</p>
                    </div>
                  </div>
                )}
                {subsidiaryWizardStep === 4 && (
                  <div className="space-y-4">
                    <div className="mb-6">
                      <h4 className="text-lg font-semibold text-text-main mb-2">📍 Dirección</h4>
                      <p className="text-sm text-text-secondary">Puedes agregar la dirección ahora o más tarde desde el detalle</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-text-main mb-1.5">
                          País
                        </label>
                        <select
                          value={subsidiaryWizardData.address?.country_code || 'PER'}
                          onChange={(e) => setSubsidiaryWizardData({
                            ...subsidiaryWizardData,
                            address: { ...subsidiaryWizardData.address, country_code: e.target.value, status: 1 }
                          })}
                          className="w-full px-4 py-2 border border-border-light rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                        >
                          <option value="PER">🇵🇪 Perú</option>
                          <option value="MEX">🇲🇽 México</option>
                          <option value="COL">🇨🇴 Colombia</option>
                          <option value="CHL">🇨🇱 Chile</option>
                          <option value="ARG">🇦🇷 Argentina</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-text-main mb-1.5">
                          Ciudad
                        </label>
                        <input
                          type="text"
                          value={subsidiaryWizardData.address?.city || ''}
                          onChange={(e) => setSubsidiaryWizardData({
                            ...subsidiaryWizardData,
                            address: { ...subsidiaryWizardData.address, city: e.target.value }
                          })}
                          className="w-full px-4 py-2 border border-border-light rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                          placeholder="Ej. Lima"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-text-main mb-1.5">
                          Nombre de Calle
                        </label>
                        <input
                          type="text"
                          value={subsidiaryWizardData.address?.street_name || ''}
                          onChange={(e) => setSubsidiaryWizardData({
                            ...subsidiaryWizardData,
                            address: { ...subsidiaryWizardData.address, street_name: e.target.value }
                          })}
                          className="w-full px-4 py-2 border border-border-light rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                          placeholder="Ej. Av. Principal"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-text-main mb-1.5">
                          Número
                        </label>
                        <input
                          type="text"
                          value={subsidiaryWizardData.address?.street_number || ''}
                          onChange={(e) => setSubsidiaryWizardData({
                            ...subsidiaryWizardData,
                            address: { ...subsidiaryWizardData.address, street_number: e.target.value }
                          })}
                          className="w-full px-4 py-2 border border-border-light rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                          placeholder="123"
                        />
                      </div>
                    </div>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <p className="text-sm text-blue-800">💡 Puedes omitir este paso y agregar direcciones después desde el detalle de la sucursal</p>
                    </div>
                  </div>
                )}
                {error && (
                  <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-800">{error}</p>
                  </div>
                )}
              </div>
              <div className="px-6 py-4 border-t border-border-light flex justify-between">
                <button
                  onClick={() => {
                    if (subsidiaryWizardStep > 1) {
                      setSubsidiaryWizardStep(subsidiaryWizardStep - 1);
                    } else {
                      setShowSubsidiaryModal(false);
                      setSubsidiaryWizardStep(1);
                      setSubsidiaryWizardData({
                        basic: { legal_name: '', country_code: 'PER', status: 1 },
                        additional: {},
                        contact: undefined,
                        address: undefined
                      });
                    }
                  }}
                  className="px-4 py-2 text-sm font-medium text-text-main bg-white border border-border-light rounded-lg hover:bg-gray-50 transition-colors"
                >
                  {subsidiaryWizardStep === 1 ? 'Cancelar' : 'Anterior'}
                </button>
                <div className="flex gap-3">
                  {subsidiaryWizardStep < 4 && (
                    <button
                      onClick={() => {
                        if (subsidiaryWizardStep === 1 && !subsidiaryWizardData.basic.legal_name) {
                          setError('El nombre legal es requerido');
                          return;
                        }
                        setError(null);
                        setSubsidiaryWizardStep(subsidiaryWizardStep + 1);
                      }}
                      className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors"
                    >
                      Siguiente
                    </button>
                  )}
                  {subsidiaryWizardStep === 4 && (
                    <button
                      onClick={handleCreateSubsidiary}
                      disabled={loading || !subsidiaryWizardData.basic.legal_name}
                      className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? 'Creando...' : 'Crear Sucursal'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && deleteTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="px-6 py-5 border-b border-border-light">
              <h3 className="text-lg font-bold text-text-main">Confirmar Eliminación</h3>
            </div>
            <div className="px-6 py-5">
              <p className="text-text-main mb-4">
                ¿Estás seguro de eliminar {deleteTarget.type === 'organization' ? 'la organización' : 'el individuo'} <strong>{deleteTarget.name}</strong>?
              </p>
              <p className="text-sm text-text-secondary">
                Esta acción no se puede deshacer.
              </p>
            </div>
            <div className="px-6 py-4 border-t border-border-light flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteTarget(null);
                }}
                className="px-4 py-2 text-sm font-medium text-text-main bg-white border border-border-light rounded-lg hover:bg-gray-50 transition-colors"
                disabled={loading}
              >
                Cancelar
              </button>
              <button
                onClick={confirmDelete}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
