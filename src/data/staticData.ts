/**
 * Datos estáticos obtenidos de d1-api.kashio-dev.net
 * Estos datos se pueden actualizar ejecutando el script fetch_static_data.js
 * Última actualización: 2026-01-15
 */

export interface PartyRoleType {
  party_role_type_id: number;
  name: string;
  description: string;
  code: string;
  status: number;
  created_at: string;
  updated_at: string;
}

export interface ContactMediumType {
  contact_medium_type_id: number;
  name: string;
  description: string;
  status: number;
  created_at: string;
  updated_at: string;
}

export interface RelationshipType {
  relationship_type_id: number;
  name: string;
  description: string;
  status: number;
  created_at: string;
  updated_at: string;
}

export interface AgreementType {
  agreement_type_id: number;
  name: string;
  description: string;
  status: number;
  created_at: string;
  updated_at: string;
}

/**
 * Tipos de Party Role obtenidos de d1
 * Endpoint: GET /kbrm/v2/party-role-types
 */
export const PARTY_ROLE_TYPES: PartyRoleType[] = [
  {
    party_role_type_id: 4,
    name: "Cliente",
    description: "Cliente de la empresa",
    code: "CLIENT",
    status: 1,
    created_at: "Fri, 19 Dec 2025 17:39:45 GMT",
    updated_at: "Fri, 19 Dec 2025 17:39:45 GMT"
  },
  {
    party_role_type_id: 8,
    name: "ClienteES",
    description: "Cliente de la empresa",
    code: "CLIENT",
    status: 1,
    created_at: "Tue, 23 Dec 2025 19:58:04 GMT",
    updated_at: "Tue, 23 Dec 2025 19:58:04 GMT"
  },
  {
    party_role_type_id: 2,
    name: "Corporativo",
    description: "Empresa corporativa",
    code: "CORPORATE",
    status: 1,
    created_at: "Fri, 19 Dec 2025 17:39:45 GMT",
    updated_at: "Fri, 19 Dec 2025 17:39:45 GMT"
  },
  {
    party_role_type_id: 6,
    name: "Empleado",
    description: "Empleado de la empresa",
    code: "EMPLOYEE",
    status: 1,
    created_at: "Fri, 19 Dec 2025 17:39:45 GMT",
    updated_at: "Fri, 19 Dec 2025 17:39:45 GMT"
  },
  {
    party_role_type_id: 1,
    name: "Holding",
    description: "Empresa matriz o holding",
    code: "HOLDING",
    status: 1,
    created_at: "Fri, 19 Dec 2025 17:39:45 GMT",
    updated_at: "Fri, 19 Dec 2025 17:39:45 GMT"
  },
  {
    party_role_type_id: 5,
    name: "Proveedor",
    description: "Proveedor de servicios",
    code: "VENDOR",
    status: 1,
    created_at: "Fri, 19 Dec 2025 17:39:45 GMT",
    updated_at: "Fri, 19 Dec 2025 17:39:45 GMT"
  },
  {
    party_role_type_id: 3,
    name: "Sucursal",
    description: "Sucursal o empresa asociada al corporativo",
    code: "BRANCH",
    status: 1,
    created_at: "Fri, 19 Dec 2025 17:39:45 GMT",
    updated_at: "Fri, 19 Dec 2025 17:39:45 GMT"
  }
];

/**
 * Tipos de Contact Medium obtenidos de d1
 * Endpoint: GET /kbrm/v2/contact-medium-type
 */
export const CONTACT_MEDIUM_TYPES: ContactMediumType[] = [
  {
    contact_medium_type_id: 1,
    name: "Email",
    description: "Correo electrónico",
    status: 1,
    created_at: "2025-12-19T17:44:23",
    updated_at: "2025-12-19T17:44:23"
  },
  {
    contact_medium_type_id: 2,
    name: "Teléfono",
    description: "Número telefónico",
    status: 1,
    created_at: "2025-12-19T17:44:23",
    updated_at: "2025-12-19T17:44:23"
  },
  {
    contact_medium_type_id: 3,
    name: "Móvil",
    description: "Número de celular",
    status: 1,
    created_at: "2025-12-19T17:44:23",
    updated_at: "2025-12-19T17:44:23"
  },
  {
    contact_medium_type_id: 4,
    name: "Fax",
    description: "Número de fax",
    status: 1,
    created_at: "2025-12-19T17:44:23",
    updated_at: "2025-12-19T17:44:23"
  }
];

/**
 * Helper para obtener un Party Role Type por ID
 */
export function getPartyRoleTypeById(id: number): PartyRoleType | undefined {
  return PARTY_ROLE_TYPES.find(type => type.party_role_type_id === id);
}

/**
 * Helper para obtener un Party Role Type por código
 */
export function getPartyRoleTypeByCode(code: string): PartyRoleType | undefined {
  return PARTY_ROLE_TYPES.find(type => type.code === code);
}

/**
 * Helper para obtener un Contact Medium Type por ID
 */
export function getContactMediumTypeById(id: number): ContactMediumType | undefined {
  return CONTACT_MEDIUM_TYPES.find(type => type.contact_medium_type_id === id);
}

/**
 * Helper para obtener solo los tipos activos
 */
export function getActivePartyRoleTypes(): PartyRoleType[] {
  return PARTY_ROLE_TYPES.filter(type => type.status === 1);
}

/**
 * Tipos de Relationship obtenidos de d1
 * Endpoint: GET /kbrm/v2/relationships
 */
export const RELATIONSHIP_TYPES: RelationshipType[] = [
  {
    relationship_type_id: 1,
    name: "Holding - Sucursal",
    description: "Relación entre empresa holding y el corporativo en el territorio",
    status: 1,
    created_at: "Fri, 19 Dec 2025 17:44:25 GMT",
    updated_at: "Fri, 19 Dec 2025 17:44:25 GMT"
  },
  {
    relationship_type_id: 2,
    name: "Corporativo - Sucursal",
    description: "Relación entre empresa corporativa y sucursal",
    status: 1,
    created_at: "Fri, 19 Dec 2025 17:44:25 GMT",
    updated_at: "Fri, 19 Dec 2025 17:44:25 GMT"
  },
  {
    relationship_type_id: 3,
    name: "Empleador - Empleado",
    description: "Relación laboral entre empleador y empleado",
    status: 1,
    created_at: "Fri, 19 Dec 2025 17:44:25 GMT",
    updated_at: "Fri, 19 Dec 2025 17:44:25 GMT"
  },
  {
    relationship_type_id: 4,
    name: "Proveedor - Cliente",
    description: "Relación comercial entre proveedor y cliente",
    status: 1,
    created_at: "Fri, 19 Dec 2025 17:44:25 GMT",
    updated_at: "Fri, 19 Dec 2025 17:44:25 GMT"
  },
  {
    relationship_type_id: 5,
    name: "Matriz - Subsidiaria",
    description: "Relación corporativa de control",
    status: 1,
    created_at: "Fri, 19 Dec 2025 17:44:25 GMT",
    updated_at: "Fri, 19 Dec 2025 17:44:25 GMT"
  }
];

/**
 * Tipos de Agreement obtenidos de d1
 * Endpoint: GET /kbrm/v2/agreement-types
 */
export const AGREEMENT_TYPES: AgreementType[] = [
  {
    agreement_type_id: 3,
    name: "Acuerdo de Servicio",
    description: "Acuerdo general de prestación de servicios",
    status: 1,
    created_at: "Fri, 19 Dec 2025 17:44:24 GMT",
    updated_at: "Fri, 19 Dec 2025 17:44:24 GMT"
  },
  {
    agreement_type_id: 1,
    name: "Contrato Corporativo",
    description: "Contrato principal con empresa corporativa",
    status: 1,
    created_at: "Fri, 19 Dec 2025 17:44:24 GMT",
    updated_at: "Fri, 19 Dec 2025 17:44:24 GMT"
  },
  {
    agreement_type_id: 6,
    name: "Contrato de Serviciaso",
    description: "Tipo para contratos de servicio",
    status: 1,
    created_at: "Tue, 23 Dec 2025 20:20:29 GMT",
    updated_at: "Tue, 23 Dec 2025 20:20:29 GMT"
  },
  {
    agreement_type_id: 5,
    name: "Contrato de Servicio",
    description: "Tipo para contratos de servicio",
    status: 1,
    created_at: "Mon, 22 Dec 2025 20:04:23 GMT",
    updated_at: "Mon, 22 Dec 2025 20:04:23 GMT"
  },
  {
    agreement_type_id: 2,
    name: "Contrato Sucursal",
    description: "Contrato específico para sucursales",
    status: 1,
    created_at: "Fri, 19 Dec 2025 17:44:24 GMT",
    updated_at: "Fri, 19 Dec 2025 17:44:24 GMT"
  },
  {
    agreement_type_id: 4,
    name: "Nuevo nombre del tipo",
    description: "Nueva descripción",
    status: 1,
    created_at: "Fri, 19 Dec 2025 17:44:24 GMT",
    updated_at: "Mon, 22 Dec 2025 20:07:17 GMT"
  }
];

/**
 * Helper para obtener solo los tipos de contacto activos
 */
export function getActiveContactMediumTypes(): ContactMediumType[] {
  return CONTACT_MEDIUM_TYPES.filter(type => type.status === 1);
}

/**
 * Helper para obtener un Relationship Type por ID
 */
export function getRelationshipTypeById(id: number): RelationshipType | undefined {
  return RELATIONSHIP_TYPES.find(type => type.relationship_type_id === id);
}

/**
 * Helper para obtener solo los tipos de relación activos
 */
export function getActiveRelationshipTypes(): RelationshipType[] {
  return RELATIONSHIP_TYPES.filter(type => type.status === 1);
}

/**
 * Helper para obtener un Agreement Type por ID
 */
export function getAgreementTypeById(id: number): AgreementType | undefined {
  return AGREEMENT_TYPES.find(type => type.agreement_type_id === id);
}

/**
 * Helper para obtener solo los tipos de agreement activos
 */
export function getActiveAgreementTypes(): AgreementType[] {
  return AGREEMENT_TYPES.filter(type => type.status === 1);
}
