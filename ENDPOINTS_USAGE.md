# Endpoints Usados - KBRM y KSEC

## 📋 Endpoints de KBRM

### 1. Organizations (Organizaciones)
- **GET** `/kbrm/v1/organizations` - Listar organizaciones
- **POST** `/kbrm/v1/organizations` - Crear organización
- **GET** `/kbrm/v1/organizations/:public_id` - Obtener organización por public_id ✅
- **PUT** `/kbrm/v1/organizations/:public_id` - Actualizar organización por public_id ✅
- **DELETE** `/kbrm/v1/organizations/:public_id` - Eliminar organización por public_id ✅

### 2. Party Roles
- **GET** `/kbrm/v1/party-roles` - Listar party roles
- **POST** `/kbrm/v1/party-roles` - Crear party role
- **GET** `/kbrm/v1/party-roles/:id` - Obtener party role por ID (puede ser public_id o ID numérico) ✅

### 3. Customers (Clientes)
- **GET** `/kbrm/v1/customers` - Listar clientes
- **POST** `/kbrm/v1/customers` - Crear cliente
- **GET** `/kbrm/v1/customers/:id` - Obtener cliente por ID
- **GET** `/kbrm/v1/customers/organization/:id` - Obtener cliente por organization_id (puede ser public_id) ✅

### 4. Individuals (Individuos)
- **POST** `/kbrm/v1/individuals` - Crear individuo

### 5. Agreements (Acuerdos)
- **GET** `/kbrm/v1/agreements` - Listar acuerdos
- **POST** `/kbrm/v1/agreements` - Crear acuerdo

### 6. Address (Direcciones)
- **GET** `/kbrm/v1/address` - Listar direcciones
- **POST** `/kbrm/v1/address` - Crear dirección

### 7. Contact Medium (Medios de Contacto)
- **GET** `/kbrm/v1/contact-medium` - Listar medios de contacto
- **POST** `/kbrm/v1/contact-medium` - Crear medio de contacto

### 8. Relationships (Relaciones)
- **GET** `/kbrm/v1/relationships` - Listar relaciones
- **POST** `/kbrm/v1/relationships` - Crear relación

---

## 🔐 Endpoints de KSEC

### 1. Users (Usuarios)
- **POST** `/ksec/v1/users` - Crear usuario
- **POST** `/ksec/v1/users/:user_id/roles` - Asignar roles a usuario (usa public_id del usuario) ✅
- **POST** `/ksec/v1/users/:user_id/menu` - Configurar menú de usuario (usa public_id del usuario) ✅

---

## ✅ Endpoints que usan `public_id`

### KBRM - Endpoints con `public_id`:

1. **Organizations**
   - `GET /kbrm/v1/organizations/:public_id`
   - `PUT /kbrm/v1/organizations/:public_id`
   - `DELETE /kbrm/v1/organizations/:public_id`

2. **Party Roles**
   - `GET /kbrm/v1/party-roles/:id` (puede recibir public_id)

3. **Customers**
   - `GET /kbrm/v1/customers/organization/:id` (puede recibir organization_public_id)

### KSEC - Endpoints con `public_id`:

1. **Users**
   - `POST /ksec/v1/users/:user_id/roles` (usa user_id que es public_id)
   - `POST /ksec/v1/users/:user_id/menu` (usa user_id que es public_id)

---

## 🔄 Endpoints POST que usan `public_id` o IDs de otras entidades

### KBRM - POST con referencias a otras entidades:

1. **POST `/kbrm/v1/agreements`** (Crear Acuerdo)
   - ✅ Usa `assigned_to: party_role_public_id` (public_id del Party Role)
   - ✅ Usa `product_offering_public_id` (public_id del Product Offering)

2. **POST `/kbrm/v1/contact-medium`** (Crear Medio de Contacto)
   - ✅ Usa `party_id: party_role_party_id` (ID numérico del Party Role)
   - ✅ Usa `party_id: individual_party_id` (ID numérico del Individual)
   - ⚠️ Nota: Usa `party_id` (numérico), no `public_id`

3. **POST `/kbrm/v1/address`** (Crear Dirección)
   - ✅ Usa `party_id: organization_party_id` (ID numérico de la Organización)
   - ⚠️ Nota: Usa `party_id` (numérico), no `public_id`

4. **POST `/kbrm/v1/relationships`** (Crear Relación)
   - ✅ Usa `from_party_role_id` (ID numérico del Party Role origen)
   - ✅ Usa `to_party_role_id` (ID numérico del Party Role destino)
   - ⚠️ Nota: Usa IDs numéricos, no `public_id`

### KSEC - POST con referencias a otras entidades:

1. **POST `/ksec/v1/users`** (Crear Usuario)
   - ✅ Usa `organization_id: organization_public_id` (public_id de la Organización)
   - ✅ Usa `individual_id: individual_public_id` (public_id del Individual)

2. **POST `/ksec/v1/users/:user_id/roles`** (Asignar Roles)
   - ✅ Usa `user_id` en la URL (public_id del usuario)
   - ✅ Body contiene `roles: [rol_public_id]` (public_id del rol)

3. **POST `/ksec/v1/users/:user_id/menu`** (Configurar Menú)
   - ✅ Usa `user_id` en la URL (public_id del usuario)
   - ✅ Body contiene `rol_public_id` y `product_public_id` (public_ids)

---

## 📝 Notas

- Los endpoints de **Organizations** son los únicos que explícitamente usan `:public_id` en la ruta del backend (`ms-ath-eng-conexion-unica`).
- Los endpoints de **Party Roles** y **Customers** pueden recibir tanto `public_id` como ID numérico en el parámetro `:id`.
- Los endpoints de **KSEC Users** usan `user_id` que corresponde al `public_id` del usuario creado.
- El frontend usa `public_id` en varios lugares del flujo de onboarding, especialmente para:
  - `organization_public_id`
  - `party_role_public_id`
  - `individual_public_id`
  - `user_id_global` (public_id del usuario KSEC)
- **Endpoints POST que requieren IDs de otras entidades:**
  - `agreements` requiere `party_role_public_id` y `product_offering_public_id`
  - `contact-medium` requiere `party_id` (numérico) del Party Role o Individual
  - `address` requiere `party_id` (numérico) de la Organización
  - `relationships` requiere `from_party_role_id` y `to_party_role_id` (numéricos)
  - `users` (KSEC) requiere `organization_public_id` e `individual_public_id`
  - `users/:user_id/roles` y `users/:user_id/menu` requieren `user_id` (public_id) en la URL
