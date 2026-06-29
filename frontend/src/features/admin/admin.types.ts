export interface Page<T> {
  data: T[];
  meta: {
    pageSize: number;
    nextCursor: string | null;
    hasMore: boolean;
  };
}

export interface Tenant {
  id: string;
  code: string;
  name: string;
  status: "ACTIVE" | "SUSPENDED" | "CLOSED";
  defaultTimezone: string;
  defaultLocale: string;
  createdAt: string;
  updatedAt: string;
  _count: { users: number; organizations: number };
}

export interface Organization {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  organizationType: string;
  timezone: string;
  countryCode: string | null;
  createdAt: string;
  tenant: { id: string; code: string; name: string };
  parent: { id: string; name: string } | null;
  manager: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
  _count: { children: number; roleAssignments: number };
}

export interface AdminRole {
  id: string;
  tenantId: string;
  departmentId: string | null;
  department: { id: string; code: string; name: string } | null;
  code: string;
  name: string;
  description: string | null;
  roleType: string;
  isSystemRole: boolean;
  permissions: Array<{ permission: AdminPermission }>;
  _count?: { assignments: number };
}

export interface AdminPermission {
  id: string;
  code: string;
  module: string;
  resource: string;
  action: string;
  description: string;
  sensitivity: "STANDARD" | "SENSITIVE" | "RESTRICTED";
  requiresMfa: boolean;
}

export interface AdminUser {
  id: string;
  tenantId: string;
  email: string;
  username: string | null;
  firstName: string;
  lastName: string;
  status: "INVITED" | "ACTIVE" | "LOCKED" | "DISABLED";
  mfaEnabled: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  tenant: { code: string; name: string };
  roleAssignments: Array<{
    id: string;
    organizationId: string | null;
    organization: { id: string; code: string; name: string } | null;
    role: {
      id: string;
      code: string;
      name: string;
      departmentId: string | null;
      department: { id: string; code: string; name: string } | null;
    };
  }>;
}
