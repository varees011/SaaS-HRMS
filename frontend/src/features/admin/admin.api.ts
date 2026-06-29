import { apiRequest } from "@/lib/api-client";
import type {
  AdminPermission,
  AdminRole,
  AdminUser,
  Organization,
  Page,
  Tenant
} from "./admin.types";

interface ListFilters {
  tenantId?: string;
  departmentId?: string;
  search?: string;
  status?: string;
  organizationType?: string;
  cursor?: string;
}

function query(filters: ListFilters = {}) {
  const params = new URLSearchParams({ limit: "100", sort: "name" });
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, value);
  }
  return params.toString();
}

export const adminApi = {
  listTenants(filters: ListFilters = {}) {
    return apiRequest<Page<Tenant>>(`/admin/tenants?${query(filters)}`);
  },
  createTenant(input: {
    code: string;
    name: string;
    defaultTimezone: string;
    defaultLocale: string;
  }) {
    return apiRequest<{ data: Tenant }>("/admin/tenants", {
      method: "POST",
      body: input
    });
  },
  updateTenant(id: string, input: Partial<Pick<Tenant, "name" | "status">>) {
    return apiRequest<{ data: Tenant }>(`/admin/tenants/${id}`, {
      method: "PATCH",
      body: input
    });
  },
  listOrganizations(filters: ListFilters = {}) {
    return apiRequest<Page<Organization>>(
      `/admin/organizations?${query(filters)}`
    );
  },
  createOrganization(input: {
    tenantId: string;
    parentId?: string | null;
    code: string;
    name: string;
    organizationType: string;
    timezone: string;
    countryCode?: string | null;
  }) {
    return apiRequest<{ data: Organization }>("/admin/organizations", {
      method: "POST",
      body: input
    });
  },
  updateOrganization(id: string, input: Partial<Organization>) {
    return apiRequest<{ data: Organization }>(`/admin/organizations/${id}`, {
      method: "PATCH",
      body: input
    });
  },
  deleteOrganization(id: string, tenantId?: string) {
    return apiRequest<void>(`/admin/organizations/${id}`, {
      method: "DELETE",
      headers: tenantId ? { "x-tenant-id": tenantId } : undefined
    });
  },
  listUsers(filters: ListFilters = {}) {
    return apiRequest<Page<AdminUser>>(`/admin/users?${query(filters)}`);
  },
  listRoles(tenantId: string, departmentId?: string) {
    return apiRequest<{ data: AdminRole[] }>(
      `/admin/roles?${query({ tenantId, departmentId })}`
    );
  },
  listPermissions() {
    return apiRequest<{ data: AdminPermission[] }>("/admin/permissions");
  },
  createRole(input: {
    tenantId: string;
    code: string;
    name: string;
    description?: string | null;
    roleType: string;
    permissionIds: string[];
  }) {
    return apiRequest<{ data: AdminRole }>("/admin/roles", {
      method: "POST",
      body: input
    });
  },
  updateRole(id: string, input: {
    name?: string;
    description?: string | null;
    roleType?: string;
    permissionIds?: string[];
  }) {
    return apiRequest<{ data: AdminRole }>(`/admin/roles/${id}`, {
      method: "PATCH",
      body: input
    });
  },
  deleteRole(id: string, tenantId?: string) {
    return apiRequest<void>(`/admin/roles/${id}`, {
      method: "DELETE",
      headers: tenantId ? { "x-tenant-id": tenantId } : undefined
    });
  },
  createUser(input: {
    tenantId: string;
    email: string;
    username?: string | null;
    password: string;
    firstName: string;
    lastName: string;
    status: AdminUser["status"];
    roleId: string;
    departmentId?: string | null;
    organizationId?: string | null;
  }) {
    return apiRequest<{ data: AdminUser }>("/admin/users", {
      method: "POST",
      body: input
    });
  },
  updateUser(id: string, input: Record<string, unknown>, tenantId?: string) {
    return apiRequest<{ data: AdminUser }>(`/admin/users/${id}`, {
      method: "PATCH",
      body: input,
      headers: tenantId ? { "x-tenant-id": tenantId } : undefined
    });
  },
  deleteUser(id: string, tenantId?: string) {
    return apiRequest<void>(`/admin/users/${id}`, {
      method: "DELETE",
      headers: tenantId ? { "x-tenant-id": tenantId } : undefined
    });
  }
};
