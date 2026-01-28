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

  const [environment] = useState<Environment>(() => {
    const envFromVar = (import.meta as any).env?.VITE_ENVIRONMENT;
    const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    const finalEnv = (!envFromVar || !['LOCAL', 'd1', 'q3'].includes(envFromVar) || isLocalhost) ? 'LOCAL' : envFromVar as Environment;
    return finalEnv;
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

      await api.call('KBRM', '/kbrm/v2/organizations', 'POST', payload);
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
    if (!confirm('¿Estás seguro de eliminar esta organización?')) {
      return;
    }

    setLoading(true);
    setOrgError(null);
    try {
      await api.call('KBRM', `/kbrm/v2/organizations/${publicId}`, 'DELETE');
      setOrgSuccessMessage('Organización eliminada exitosamente');
      setTimeout(() => setOrgSuccessMessage(null), 3000);
      loadOrganizations(orgCurrentPage, orgSearchTerm);
    } catch (err: any) {
      setOrgError(err.message || 'Error al eliminar organización');
    } finally {
      setLoading(false);
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
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        ...(search && { search })
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
          
          // Aplicar el mapa a los individuos
          const individualsWithOrgs = data.data.map(ind => ({
            ...ind,
            organizations: individualToOrgsMap.get(ind.public_id) || []
          }));
          
          setIndividuals(individualsWithOrgs);
        } catch (err) {
          console.warn('Error loading organizations for individuals:', err);
          // Si falla, mostrar individuos sin organizaciones
          setIndividuals(data.data.map(ind => ({ ...ind, organizations: [] })));
        }
        
        setIndTotalPages(data.metadata?.total_pages || 1);
        setIndTotal(data.metadata?.total || data.data.length);
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

      await api.call('KBRM', '/kbrm/v2/individuals', 'POST', payload);
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
    if (!confirm('¿Estás seguro de eliminar este individuo?')) {
      return;
    }

    setLoading(true);
    setIndError(null);
    try {
      await api.call('KBRM', `/kbrm/v2/individuals/${publicId}`, 'DELETE');
      setIndSuccessMessage('Individuo eliminado exitosamente');
      setTimeout(() => setIndSuccessMessage(null), 3000);
      loadIndividuals(indCurrentPage, indSearchTerm);
    } catch (err: any) {
      setIndError(err.message || 'Error al eliminar individuo');
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
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex h-full overflow-hidden relative">
        {/* Sidebar */}
        <aside className="w-64 bg-white dark:bg-[#1a202c] border-r border-border-light flex-shrink-0 flex flex-col">
          <div className="p-4">
            <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-2 px-3">
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
                    <div className="flex-1 relative">
                      <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary text-lg">search</span>
                      <input
                        type="text"
                        placeholder={activeView === 'organizations' ? 'Buscar organizaciones...' : 'Buscar individuos...'}
                        value={activeView === 'organizations' ? orgSearchTerm : indSearchTerm}
                        onChange={(e) => {
                          if (activeView === 'organizations') {
                            setOrgSearchTerm(e.target.value);
                          } else {
                            setIndSearchTerm(e.target.value);
                          }
                        }}
                        className="w-full pl-10 pr-4 py-2 border border-border-light rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                      />
                    </div>
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
                          <th className="px-6 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider">Sitio Web</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider">País</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider">Estado</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-border-light">
                        {orgLoading && organizations.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="px-6 py-12 text-center text-text-secondary">
                              <div className="flex flex-col items-center gap-2">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                                <span>Cargando organizaciones...</span>
                              </div>
                            </td>
                          </tr>
                        ) : organizations.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="px-6 py-12 text-center text-text-secondary">
                              No se encontraron organizaciones
                            </td>
                          </tr>
                        ) : (
                          organizations.map((org) => (
                            <tr key={org.public_id} className="hover:bg-gray-50 transition-colors">
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-text-secondary">{org.public_id}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-text-main font-medium">{org.legal_name}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-text-main">{org.business_name || '-'}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary">{org.web_site || '-'}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary">{org.country_code || '-'}</td>
                              <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(org.status)}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm">
                                <div className="flex items-center gap-2">
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
                          <th className="px-6 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider">Primer Nombre</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider">Apellido</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider">Organizaciones</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider">Estado</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-border-light">
                        {indLoading && individuals.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="px-6 py-12 text-center text-text-secondary">
                              <div className="flex flex-col items-center gap-2">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                                <span>Cargando individuos...</span>
                              </div>
                            </td>
                          </tr>
                        ) : individuals.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="px-6 py-12 text-center text-text-secondary">
                              No se encontraron individuos
                            </td>
                          </tr>
                        ) : (
                          individuals.map((ind) => (
                            <tr key={ind.public_id} className="hover:bg-gray-50 transition-colors">
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-text-secondary">{ind.public_id}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-text-main font-medium">{ind.full_name}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-text-main">{ind.first_name || '-'}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-text-main">{ind.last_name || '-'}</td>
                              <td className="px-6 py-4 text-sm text-text-secondary">
                                {ind.organizations && ind.organizations.length > 0 ? (
                                  <div className="flex flex-wrap gap-1">
                                    {ind.organizations.map((org, idx) => (
                                      <span key={org.public_id} className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs">
                                        {org.legal_name}
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-text-secondary">-</span>
                                )}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(ind.status)}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm">
                                <div className="flex items-center gap-2">
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
            <div className="px-6 py-5 border-b border-border-light flex justify-between items-center">
              <h3 className="text-xl font-bold text-text-main">
                {editingOrg ? 'Editar Organización' : 'Nueva Organización'}
              </h3>
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
                onClick={editingOrg ? handleUpdateOrg : handleCreateOrg}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Guardando...' : editingOrg ? 'Actualizar' : 'Crear'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Individual Create/Edit Modal */}
      {showIndModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-5 border-b border-border-light flex justify-between items-center">
              <h3 className="text-xl font-bold text-text-main">
                {editingInd ? 'Editar Individuo' : 'Nuevo Individuo'}
              </h3>
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
                onClick={editingInd ? handleUpdateInd : handleCreateInd}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Guardando...' : editingInd ? 'Actualizar' : 'Crear'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
