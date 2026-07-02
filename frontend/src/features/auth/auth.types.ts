export interface AuthTokens {
  accessToken: string;
  tokenType: "Bearer";
  expiresIn: number;
}

export interface LoginOtpRequired {
  otpRequired: true;
  challengeId: string;
  expiresIn: number;
  resendAfterSeconds: number;
  email: string;
}

export interface LoginSuccess {
  otpRequired?: false;
  accessToken: string;
  tokenType: "Bearer";
  expiresIn: number;
}

export type LoginResponse = LoginSuccess | LoginOtpRequired;

export interface LoginTenant {
  id: string;
  code: string;
  name: string;
}

export interface RoleAssignment {
  organizationId: string | null;
  organization?: { id: string; code: string; name: string } | null;
  validFrom: string;
  validUntil: string | null;
  role: {
    code: string;
    name: string;
    departmentId?: string | null;
    department?: { id: string; code: string; name: string } | null;
  };
}

export interface CurrentUser {
  id: string;
  tenantId: string | null;
  organizationId: string | null;
  roleId: string | null;
  roleName: string | null;
  email: string;
  username: string | null;
  firstName: string;
  lastName: string;
  status: string;
  emailVerifiedAt: string | null;
  lastLoginAt: string | null;
  mfaEnabled: boolean;
  preferences: Record<string, unknown>;
  roleAssignments: RoleAssignment[];
  memberships?: Array<{
    tenantId: string;
    status: string;
    tenant: { code: string; name: string; status: string };
  }>;
  roles: string[];
  roleIds: string[];
  roleNames: string[];
  permissions: string[];
  authenticationMethods: string[];
  isSuperAdmin: boolean;
}

export interface Session {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  authenticationMethods: string[];
  createdAt: string;
  lastUsedAt: string;
  expiresAt: string;
  isCurrent: boolean;
}

export interface SessionPage {
  data: Session[];
  meta: {
    pageSize: number;
    nextCursor: string | null;
    hasMore: boolean;
  };
}

export interface MfaSetup {
  secret: string;
  otpauthUri: string;
}

export interface ApiEnvelope<T> {
  data: T;
}

export interface ApiErrorPayload {
  error: {
    code: string;
    message: string;
    fields?: Array<{
      field: string;
      code: string;
      message: string;
    }>;
    request_id?: string;
  };
}
