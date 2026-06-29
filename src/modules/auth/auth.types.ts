export interface AuthContext {
  userId: string;
  user: AuthenticatedUser;
  tenantId: string | null;
  sessionId: string;
  roleIds: string[];
  roles: string[];
  roleNames: string[];
  permissions: string[];
  mfaRequiredPermissions: string[];
  authenticationMethods: string[];
  isSuperAdmin: boolean;
  assignments: AuthorizationAssignment[];
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  username: string | null;
  firstName: string;
  lastName: string;
  status: "INVITED" | "ACTIVE" | "LOCKED" | "DISABLED";
}

export interface TenantAccessContext {
  tenantId: string | null;
  isPlatformAdmin: boolean;
}

export interface AccessTokenClaims {
  sub: string;
  tenant_id: string | null;
  session_id: string;
  role_ids: string[];
  roles: string[];
  role_names: string[];
  permissions: string[];
  is_platform_admin: boolean;
  amr: string[];
}

export interface AuthorizationAssignment {
  roleCode: string;
  roleType: "PLATFORM" | "TENANT" | "ORGANIZATION" | "MANAGER" | "SELF";
  tenantId: string | null;
  organizationId: string | null;
  scopeType: "PLATFORM" | "TENANT" | "ORGANIZATION" | "TEAM" | "SELF";
  includeDescendants: boolean;
}

export interface ClientMetadata {
  ipAddress?: string;
  userAgent?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: "Bearer";
  expiresIn: number;
}
