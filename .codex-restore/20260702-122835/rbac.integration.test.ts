import { createServer, type Server } from "node:http";
import { randomUUID } from "node:crypto";
import { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  PERMISSIONS,
  PLATFORM_ROLE,
  TENANT_ROLES
} from "../../src/modules/rbac/rbac.catalog.js";

const seededPassword =
  process.env.RBAC_TEST_PASSWORD ?? "Qg5Y3LPJ%Xb$rj2DMNEYP!wr";

const canonicalSeedUsers = [
  {
    email: "superadmin@venturesoft.ai",
    username: "superadmin",
    firstName: "Platform",
    lastName: "Super Admin",
    roleCode: PLATFORM_ROLE.code,
    tenantCode: null,
    scopeType: "PLATFORM" as const
  },
  {
    email: "orgadmin@venturesoft.ai",
    username: "orgadmin",
    firstName: "Organization",
    lastName: "Admin",
    roleCode: "ORGANIZATION_ADMIN",
    tenantCode: "venturesoft",
    scopeType: "TENANT" as const
  },
  {
    email: "hrmanager@venturesoft.ai",
    username: "hrmanager",
    firstName: "HR",
    lastName: "Manager",
    roleCode: "HR_MANAGER",
    tenantCode: "venturesoft",
    scopeType: "ORGANIZATION" as const
  },
  {
    email: "recruiter@venturesoft.ai",
    username: "recruiter",
    firstName: "Recruitment",
    lastName: "User",
    roleCode: "RECRUITER",
    tenantCode: "venturesoft",
    scopeType: "ORGANIZATION" as const
  },
  {
    email: "manager@venturesoft.ai",
    username: "manager",
    firstName: "Team",
    lastName: "Manager",
    roleCode: "MANAGER",
    tenantCode: "venturesoft",
    scopeType: "ORGANIZATION" as const
  },
  {
    email: "employee@venturesoft.ai",
    username: "employee",
    firstName: "Sample",
    lastName: "Employee",
    roleCode: "EMPLOYEE",
    tenantCode: "venturesoft",
    scopeType: "SELF" as const
  }
];

let server: Server;
let baseUrl: string;
let prisma: typeof import("../../src/core/db.js").prisma;
let cryptoService: typeof import("../../src/modules/auth/crypto.service.js").cryptoService;
let tokenService: typeof import("../../src/modules/auth/token.service.js").tokenService;

beforeAll(async () => {
  const appModule = await import("../../src/app.js");
  const prismaModule = await import("../../src/core/db.js");
  const cryptoModule = await import("../../src/modules/auth/crypto.service.js");
  const tokenModule = await import("../../src/modules/auth/token.service.js");
  prisma = prismaModule.prisma;
  cryptoService = cryptoModule.cryptoService;
  tokenService = tokenModule.tokenService;
  await ensureCanonicalSeedUsers();
  server = createServer(appModule.createApp());
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await prisma.tenantMembership.deleteMany({
    where: {
      tenant: { code: { startsWith: "inactive-user-" } }
    }
  });
  await prisma.user.deleteMany({
    where: {
      email: { startsWith: "inactive-login-" }
    }
  });
  await prisma.auditEvent.deleteMany({
    where: {
      tenant: {
        OR: [
          { code: { startsWith: "disabled-login-" } },
          { code: { startsWith: "inactive-user-" } }
        ]
      }
    }
  });
  await prisma.tenant.deleteMany({
    where: {
      OR: [
        { code: { startsWith: "disabled-login-" } },
        { code: { startsWith: "inactive-user-" } }
      ]
    }
  });
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  await prisma.$disconnect();
});

describe("RBAC and tenant isolation", () => {
  it("seeds the platform and tenant role-permission catalog", async () => {
    const tenant = await prisma.tenant.findUniqueOrThrow({
      where: { code: "venturesoft" },
      select: { id: true }
    });
    const platformRole = await rolePermissions(null, PLATFORM_ROLE.code);

    expect(sortStrings(platformRole)).toEqual(sortStrings(PLATFORM_ROLE.permissions));
    expect(sortStrings(platformRole)).toEqual(
      sortStrings(PERMISSIONS.map((item) => item.code))
    );
    for (const template of TENANT_ROLES) {
      const permissions = await rolePermissions(tenant.id, template.code);
      expect(sortStrings(permissions)).toEqual(sortStrings(template.permissions));
    }

    const employeePermissions = await rolePermissions(tenant.id, "EMPLOYEE");
    expect(employeePermissions).not.toContain("tenant.users.manage");
    expect(employeePermissions).not.toContain("recruitment.jobs.manage");

    const seededRoleCodes = new Set(
      (
        await prisma.role.findMany({
          where: { tenantId: tenant.id, deletedAt: null },
          select: { code: true }
        })
      ).map((role) => role.code)
    );
    for (const template of TENANT_ROLES) {
      expect(seededRoleCodes.has(template.code)).toBe(true);
    }
  });

  it("allows platform super admin to log in without organization and read cross-tenant data", async () => {
    const token = await login(undefined, "superadmin@venturesoft.ai");
    const currentUser = await api("/api/v1/auth/me", token);
    const response = await api("/api/v1/admin/users?limit=10", token);
    const settingsResponse = await api("/api/v1/admin/tenants?limit=10", token);

    expect((await currentUser.json()).data).toMatchObject({
      tenantId: null,
      organizationId: null,
      isSuperAdmin: true
    });
    expect(response.status).toBe(200);
    expect((await response.json()).data.length).toBeGreaterThan(0);
    expect(settingsResponse.status).toBe(200);
  });

  it("allows platform super admin login when a stale organization value is submitted", async () => {
    const token = await login("venturesoft", "superadmin@venturesoft.ai");
    const currentUser = await api("/api/v1/auth/me", token);
    const settingsResponse = await api("/api/v1/admin/tenants?limit=10", token);

    expect((await currentUser.json()).data).toMatchObject({
      isSuperAdmin: true
    });
    expect(settingsResponse.status).toBe(200);
  });

  it("filters organization lists by organization type", async () => {
    const token = await platformTestAccessToken();
    const tenant = await prisma.tenant.findUniqueOrThrow({
      where: { code: "venturesoft" },
      select: { id: true }
    });

    const companiesResponse = await api(
      `/api/v1/admin/organizations?tenantId=${tenant.id}&organizationType=company&limit=100`,
      token
    );
    const departmentsResponse = await api(
      `/api/v1/admin/organizations?tenantId=${tenant.id}&organizationType=department&limit=100`,
      token
    );

    expect(companiesResponse.status).toBe(200);
    expect(departmentsResponse.status).toBe(200);
    const companies = (await companiesResponse.json()) as {
      data: Array<{ name: string; organizationType: string }>;
    };
    const departments = (await departmentsResponse.json()) as {
      data: Array<{ name: string; organizationType: string }>;
    };
    expect(companies.data).toEqual([
      expect.objectContaining({
        name: "VentureSoft.AI",
        organizationType: "company"
      })
    ]);
    expect(departments.data.length).toBeGreaterThan(0);
    expect(departments.data.every((item) => item.organizationType === "department")).toBe(
      true
    );
  });

  it.each([
    ["Organization Admin", "orgadmin@venturesoft.ai", "ORGANIZATION_ADMIN"],
    ["HR Manager", "hrmanager", "HR_MANAGER"],
    ["Recruiter", "recruiter@venturesoft.ai", "RECRUITER"],
    ["Manager", "manager", "MANAGER"],
    ["Employee", "employee@venturesoft.ai", "EMPLOYEE"]
  ])(
    "allows %s to log in with organization and resolve the correct dashboard context",
    async (_label, loginName, expectedRole) => {
      const token = await login("venturesoft", loginName);
      const currentUser = await api("/api/v1/auth/me", token);

      expect(currentUser.status).toBe(200);
      const payload = (await currentUser.json()) as {
        data: {
          tenantId: string | null;
          roles: string[];
          permissions: string[];
          isSuperAdmin: boolean;
        };
      };
      expect(payload.data.tenantId).toEqual(expect.any(String));
      expect(payload.data.roles).toContain(expectedRole);
      expect(payload.data.permissions.length).toBeGreaterThan(0);
      expect(payload.data.isSuperAdmin).toBe(false);
    }
  );

  it("allows organization login with user id", async () => {
    const user = await prisma.user.findUniqueOrThrow({
      where: { email: "employee@venturesoft.ai" },
      select: { id: true }
    });
    const token = await login("venturesoft", user.id);
    const currentUser = await api("/api/v1/auth/me", token);

    expect(currentUser.status).toBe(200);
    expect((await currentUser.json()).data).toMatchObject({
      id: user.id,
      roles: expect.arrayContaining(["EMPLOYEE"]),
      isSuperAdmin: false
    });
  });

  it("allows tenant admins to create only organization-bound custom roles", async () => {
    const unique = Date.now();
    const token = await testAccessToken("venturesoft", "orgadmin@venturesoft.ai");
    const tenantId = await currentTenantId(token);
    const department = await prisma.organization.findFirstOrThrow({
      where: { tenantId, organizationType: "department", deletedAt: null },
      select: { id: true }
    });
    const permission = await prisma.permission.findFirstOrThrow({
      where: { code: "user.read", deletedAt: null },
      select: { id: true }
    });
    const code = `ORG_BOUND_ROLE_${unique}`;
    let roleId: string | undefined;

    try {
      const tenantWideResponse = await api("/api/v1/admin/roles", token, {
        method: "POST",
        body: {
          tenantId,
          code: `TENANT_ROLE_${unique}`,
          name: `Tenant Role ${unique}`,
          roleType: "TENANT",
          permissionIds: [permission.id]
        }
      });
      expect(tenantWideResponse.status).toBe(403);

      const missingDepartmentResponse = await api("/api/v1/admin/roles", token, {
        method: "POST",
        body: {
          tenantId,
          code: `ORG_ROLE_NO_DEPT_${unique}`,
          name: `Org Role No Dept ${unique}`,
          roleType: "ORGANIZATION",
          permissionIds: [permission.id]
        }
      });
      expect(missingDepartmentResponse.status).toBe(422);

      const response = await api("/api/v1/admin/roles", token, {
        method: "POST",
        body: {
          tenantId,
          departmentId: department.id,
          code,
          name: `Org Bound Role ${unique}`,
          roleType: "ORGANIZATION",
          permissionIds: [permission.id]
        }
      });
      expect(response.status).toBe(201);
      const payload = (await response.json()) as {
        data: { id: string; departmentId: string; roleType: string };
      };
      roleId = payload.data.id;
      expect(payload.data).toMatchObject({
        departmentId: department.id,
        roleType: "ORGANIZATION"
      });
    } finally {
      if (roleId) await cleanupRole(roleId);
      await prisma.role.deleteMany({
        where: {
          tenantId,
          code: { in: [`TENANT_ROLE_${unique}`, `ORG_ROLE_NO_DEPT_${unique}`, code] }
        }
      });
    }
  });

  it("blocks tenant admins from editing default system roles", async () => {
    const token = await testAccessToken("venturesoft", "orgadmin@venturesoft.ai");
    const tenantId = await currentTenantId(token);
    const role = await prisma.role.findFirstOrThrow({
      where: { tenantId, code: "HR_MANAGER", isSystemRole: true, deletedAt: null },
      select: { id: true }
    });

    const response = await api(`/api/v1/admin/roles/${role.id}`, token, {
      method: "PATCH",
      body: { name: "Changed HR Manager" }
    });

    expect(response.status).toBe(409);
  });

  it("rotates refresh tokens, revokes them on logout, and rejects reuse", async () => {
    const loginResult = await loginResponse("venturesoft", "employee@venturesoft.ai");
    expect(loginResult.status).toBe(200);
    const originalCookie = refreshCookie(loginResult);

    const refreshResult = await fetch(`${baseUrl}/api/v1/auth/refresh`, {
      method: "POST",
      headers: { cookie: originalCookie }
    });
    expect(refreshResult.status).toBe(200);
    const rotatedCookie = refreshCookie(refreshResult);
    expect(rotatedCookie).not.toBe(originalCookie);
    const refreshedPayload = (await refreshResult.json()) as {
      data: { accessToken: string };
    };

    const logoutResult = await fetch(`${baseUrl}/api/v1/auth/logout`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${refreshedPayload.data.accessToken}`,
        "content-type": "application/json",
        cookie: rotatedCookie
      },
      body: JSON.stringify({ allSessions: false })
    });
    expect(logoutResult.status).toBe(204);

    const loggedOutRefreshResult = await fetch(`${baseUrl}/api/v1/auth/refresh`, {
      method: "POST",
      headers: { cookie: rotatedCookie }
    });
    expect(loggedOutRefreshResult.status).toBe(401);

    const reuseResult = await fetch(`${baseUrl}/api/v1/auth/refresh`, {
      method: "POST",
      headers: { cookie: originalCookie }
    });
    expect(reuseResult.status).toBe(401);
  });

  it("rejects organization user login for an incorrect organization", async () => {
    const response = await loginResponse("platform", "orgadmin@venturesoft.ai");

    expect(response.status).toBe(401);
  });

  it("rejects login when the selected organization is disabled", async () => {
    const unique = Date.now();
    const tenant = await prisma.tenant.create({
      data: {
        code: `disabled-login-${unique}`,
        name: `Disabled Login ${unique}`,
        status: "SUSPENDED",
        defaultTimezone: "UTC",
        defaultLocale: "en"
      },
      select: { code: true }
    });

    const response = await loginResponse(
      tenant.code,
      "orgadmin@venturesoft.ai"
    );

    expect(response.status).toBe(401);
  });

  it("rejects login for an inactive organization user", async () => {
    const unique = Date.now();
    const tenant = await prisma.tenant.create({
      data: {
        code: `inactive-user-${unique}`,
        name: `Inactive User ${unique}`,
        status: "ACTIVE",
        defaultTimezone: "UTC",
        defaultLocale: "en"
      }
    });
    const user = await prisma.user.create({
      data: {
        email: `inactive-login-${unique}@venturesoft.ai`,
        username: `inactive-login-${unique}`,
        passwordHash: await cryptoService.hashPassword(seededPassword),
        firstName: "Inactive",
        lastName: "User",
        status: "DISABLED"
      }
    });
    await prisma.tenantMembership.create({
      data: {
        tenantId: tenant.id,
        userId: user.id,
        status: "ACTIVE",
        joinedAt: new Date()
      }
    });

    const response = await loginResponse(tenant.code, user.email);

    expect(response.status).toBe(401);
  });

  it("rejects organization user login when organization is omitted", async () => {
    const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        login: "orgadmin@venturesoft.ai",
        password: seededPassword
      })
    });

    expect(response.status).toBe(401);
  });

  it("allows organization admin to read users only inside own tenant", async () => {
    const token = await login("venturesoft", "orgadmin@venturesoft.ai");
    const ownTenantId = await currentTenantId(token);
    const platformTenant = await prisma.tenant.findUniqueOrThrow({
      where: { code: "platform" },
      select: { id: true }
    });

    const ownTenantResponse = await api(
      `/api/v1/admin/users?tenantId=${ownTenantId}`,
      token
    );
    const crossTenantResponse = await api(
      `/api/v1/admin/users?tenantId=${platformTenant.id}`,
      token
    );

    expect(ownTenantResponse.status).toBe(200);
    expect(crossTenantResponse.status).toBe(403);
  });

  it("blocks organization users from reading users across two tenant organizations", async () => {
    const unique = Date.now();
    const platformToken = await issueAccessToken("superadmin@venturesoft.ai", null);
    let tenantAId: string | null = null;
    let tenantBId: string | null = null;
    let orgAdminUserId: string | null = null;

    try {
      const createTenantA = await api("/api/v1/admin/tenants", platformToken.token, {
        method: "POST",
        body: {
          code: `tenant-a-${unique}`,
          name: `Tenant A ${unique}`,
          defaultTimezone: "UTC",
          defaultLocale: "en"
        }
      });
      expect(createTenantA.status).toBe(201);
      tenantAId = ((await createTenantA.json()) as { data: { id: string } }).data.id;

      const createTenantB = await api("/api/v1/admin/tenants", platformToken.token, {
        method: "POST",
        body: {
          code: `tenant-b-${unique}`,
          name: `Tenant B ${unique}`,
          defaultTimezone: "UTC",
          defaultLocale: "en"
        }
      });
      expect(createTenantB.status).toBe(201);
      tenantBId = ((await createTenantB.json()) as { data: { id: string } }).data.id;

      const orgAdminRole = await prisma.role.findFirstOrThrow({
        where: {
          tenantId: tenantAId,
          code: "ORGANIZATION_ADMIN",
          deletedAt: null
        },
        select: { id: true }
      });
      const orgAdminUser = await prisma.user.create({
        data: {
          email: `tenant-a-admin-${unique}@venturesoft.ai`,
          username: `tenant-a-admin-${unique}`,
          passwordHash: await cryptoService.hashPassword(seededPassword),
          firstName: "Tenant",
          lastName: "Admin",
          status: "ACTIVE"
        },
        select: { id: true, email: true }
      });
      orgAdminUserId = orgAdminUser.id;
      await prisma.tenantMembership.create({
        data: {
          tenantId: tenantAId,
          userId: orgAdminUser.id,
          status: "ACTIVE",
          joinedAt: new Date()
        }
      });
      await prisma.roleAssignment.create({
        data: {
          tenantId: tenantAId,
          userId: orgAdminUser.id,
          roleId: orgAdminRole.id,
          scopeType: "TENANT"
        }
      });
      const orgAdminToken = await issueAccessToken(orgAdminUser.email, tenantAId);

      try {
        const ownTenantResponse = await api(
          `/api/v1/admin/users?tenantId=${tenantAId}`,
          orgAdminToken.token
        );
        const crossTenantResponse = await api(
          `/api/v1/admin/users?tenantId=${tenantBId}`,
          orgAdminToken.token
        );

        expect(ownTenantResponse.status).toBe(200);
        expect(crossTenantResponse.status).toBe(403);
      } finally {
        await prisma.authSession.deleteMany({
          where: { id: orgAdminToken.sessionId }
        });
      }
    } finally {
      if (orgAdminUserId) await cleanupUsers([orgAdminUserId]);
      if (tenantAId) await cleanupTenant(tenantAId);
      if (tenantBId) await cleanupTenant(tenantBId);
      await prisma.authSession.deleteMany({ where: { id: platformToken.sessionId } });
    }
  });

  it("authorizes custom roles by permission without relying on role names", async () => {
    const unique = Date.now();
    const tenant = await prisma.tenant.findUniqueOrThrow({
      where: { code: "venturesoft" },
      select: { id: true }
    });
    const permission = await prisma.permission.findUniqueOrThrow({
      where: { code: "tenant.users.read" },
      select: { id: true, code: true }
    });
    const user = await prisma.user.create({
      data: {
        email: `custom-rbac-${unique}@venturesoft.ai`,
        username: `custom-rbac-${unique}`,
        passwordHash: await cryptoService.hashPassword(seededPassword),
        firstName: "Custom",
        lastName: "Rbac",
        status: "ACTIVE"
      },
      select: { id: true }
    });
    const role = await prisma.role.create({
      data: {
        tenantId: tenant.id,
        code: `CUSTOM_USER_READER_${unique}`,
        name: `Custom User Reader ${unique}`,
        roleType: "TENANT",
        isSystemRole: false,
        permissions: {
          create: {
            permissionId: permission.id
          }
        }
      },
      select: { id: true, code: true, name: true }
    });

    try {
      await prisma.tenantMembership.create({
        data: {
          tenantId: tenant.id,
          userId: user.id,
          status: "ACTIVE",
          joinedAt: new Date()
        }
      });
      await prisma.roleAssignment.create({
        data: {
          tenantId: tenant.id,
          userId: user.id,
          roleId: role.id,
          scopeType: "TENANT"
        }
      });
      const session = await prisma.authSession.create({
        data: {
          tenantId: tenant.id,
          userId: user.id,
          refreshTokenHash: "b".repeat(64),
          refreshTokenFamily: randomUUID(),
          expiresAt: new Date(Date.now() + 86_400_000)
        },
        select: { id: true }
      });
      const token = await tokenService.signAccessToken({
        sub: user.id,
        tenant_id: tenant.id,
        session_id: session.id,
        role_ids: [role.id],
        roles: [role.code],
        role_names: [role.name],
        permissions: [permission.code],
        is_platform_admin: false,
        amr: ["pwd"]
      });

      const response = await api(`/api/v1/admin/users?tenantId=${tenant.id}`, token);

      expect(response.status).toBe(200);
    } finally {
      await prisma.authSession.deleteMany({ where: { userId: user.id } });
      await prisma.roleAssignment.deleteMany({ where: { userId: user.id } });
      await prisma.tenantMembership.deleteMany({ where: { userId: user.id } });
      await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
      await prisma.role.deleteMany({ where: { id: role.id } });
      await prisma.user.deleteMany({ where: { id: user.id } });
    }
  });

  it("limits organization-scoped user readers to their assigned department", async () => {
    const unique = Date.now();
    const tenant = await prisma.tenant.findUniqueOrThrow({
      where: { code: "venturesoft" },
      select: { id: true }
    });
    const departments = await prisma.organization.findMany({
      where: {
        tenantId: tenant.id,
        organizationType: "department",
        deletedAt: null
      },
      orderBy: { name: "asc" },
      take: 2,
      select: { id: true }
    });
    expect(departments.length).toBe(2);
    const [ownDepartment, otherDepartment] = departments as [
      { id: string },
      { id: string }
    ];
    const permission = await prisma.permission.findUniqueOrThrow({
      where: { code: "tenant.users.read" },
      select: { id: true }
    });
    const employeeRole = await prisma.role.findFirstOrThrow({
      where: { tenantId: tenant.id, code: "EMPLOYEE", deletedAt: null },
      select: { id: true }
    });
    const scoped = await createScopedUser({
      unique,
      tenantId: tenant.id,
      departmentId: ownDepartment.id,
      permissionIds: [permission.id],
      permissionCodes: ["tenant.users.read"],
      roleCode: `ORG_USER_READER_${unique}`
    });
    const ownUser = await createTenantUser(
      `org-scope-own-${unique}`,
      tenant.id,
      employeeRole.id,
      ownDepartment.id
    );
    const otherUser = await createTenantUser(
      `org-scope-other-${unique}`,
      tenant.id,
      employeeRole.id,
      otherDepartment.id
    );

    try {
      const response = await api(
        `/api/v1/admin/users?tenantId=${tenant.id}&limit=100`,
        scoped.token
      );

      expect(response.status).toBe(200);
      const payload = (await response.json()) as { data: Array<{ id: string }> };
      const ids = payload.data.map((item) => item.id);
      expect(ids).toContain(ownUser.id);
      expect(ids).toContain(scoped.userId);
      expect(ids).not.toContain(otherUser.id);
    } finally {
      await cleanupUsers([scoped.userId, ownUser.id, otherUser.id]);
      await cleanupRole(scoped.roleId);
    }
  });

  it("rejects organization-scoped user creation outside the assigned department", async () => {
    const unique = Date.now();
    const tenant = await prisma.tenant.findUniqueOrThrow({
      where: { code: "venturesoft" },
      select: { id: true }
    });
    const departments = await prisma.organization.findMany({
      where: {
        tenantId: tenant.id,
        organizationType: "department",
        deletedAt: null
      },
      orderBy: { name: "asc" },
      take: 2,
      select: { id: true }
    });
    expect(departments.length).toBe(2);
    const [ownDepartment, otherDepartment] = departments as [
      { id: string },
      { id: string }
    ];
    const permission = await prisma.permission.findUniqueOrThrow({
      where: { code: "tenant.users.manage" },
      select: { id: true }
    });
    const otherDepartmentRole = await prisma.role.findFirstOrThrow({
      where: {
        tenantId: tenant.id,
        departmentId: otherDepartment.id,
        deletedAt: null
      },
      select: { id: true }
    });
    const scoped = await createScopedUser({
      unique,
      tenantId: tenant.id,
      departmentId: ownDepartment.id,
      permissionIds: [permission.id],
      permissionCodes: ["tenant.users.manage"],
      roleCode: `ORG_USER_MANAGER_${unique}`
    });

    try {
      const response = await api("/api/v1/admin/users", scoped.token, {
        method: "POST",
        body: {
          tenantId: tenant.id,
          email: `blocked-org-create-${unique}@venturesoft.ai`,
          username: `blocked-org-create-${unique}`,
          password: "Strong-Test-Password-123!",
          firstName: "Blocked",
          lastName: "Scope",
          status: "ACTIVE",
          roleId: otherDepartmentRole.id,
          departmentId: otherDepartment.id
        }
      });

      expect(response.status).toBe(403);
    } finally {
      await cleanupUsers([scoped.userId]);
      await cleanupRole(scoped.roleId);
      await prisma.user.deleteMany({
        where: { email: `blocked-org-create-${unique}@venturesoft.ai` }
      });
    }
  });

  it("filters performance records by organization scope on the backend", async () => {
    const unique = Date.now();
    const tenant = await prisma.tenant.findUniqueOrThrow({
      where: { code: "venturesoft" },
      select: { id: true }
    });
    const departments = await prisma.organization.findMany({
      where: {
        tenantId: tenant.id,
        organizationType: "department",
        deletedAt: null
      },
      orderBy: { name: "asc" },
      take: 2,
      select: { id: true }
    });
    expect(departments.length).toBe(2);
    const [ownDepartment, otherDepartment] = departments as [
      { id: string },
      { id: string }
    ];
    const permission = await prisma.permission.findUniqueOrThrow({
      where: { code: "tenant.performance.read" },
      select: { id: true }
    });
    const scoped = await createScopedUser({
      unique,
      tenantId: tenant.id,
      departmentId: ownDepartment.id,
      permissionIds: [permission.id],
      permissionCodes: ["tenant.performance.read"],
      roleCode: `ORG_PERFORMANCE_READER_${unique}`
    });
    const ownCycle = await prisma.performanceReviewCycle.create({
      data: {
        tenantId: tenant.id,
        organizationId: ownDepartment.id,
        name: `Org Scoped Cycle Own ${unique}`,
        startDate: new Date("2026-01-01"),
        endDate: new Date("2026-12-31")
      },
      select: { id: true }
    });
    const otherCycle = await prisma.performanceReviewCycle.create({
      data: {
        tenantId: tenant.id,
        organizationId: otherDepartment.id,
        name: `Org Scoped Cycle Other ${unique}`,
        startDate: new Date("2026-01-01"),
        endDate: new Date("2026-12-31")
      },
      select: { id: true }
    });

    try {
      const response = await api(
        `/api/v1/performance/cycles?tenantId=${tenant.id}&limit=100`,
        scoped.token
      );

      expect(response.status).toBe(200);
      const payload = (await response.json()) as { data: Array<{ id: string }> };
      const ids = payload.data.map((item) => item.id);
      expect(ids).toContain(ownCycle.id);
      expect(ids).not.toContain(otherCycle.id);
    } finally {
      await prisma.performanceReviewCycle.deleteMany({
        where: { id: { in: [ownCycle.id, otherCycle.id] } }
      });
      await cleanupUsers([scoped.userId]);
      await cleanupRole(scoped.roleId);
    }
  });

  it("blocks employee privilege escalation into administration endpoints", async () => {
    const token = await login("venturesoft", "employee@venturesoft.ai");
    const response = await api("/api/v1/admin/users", token);

    expect(response.status).toBe(403);
  });

  it("allows organization admin to create users only inside own tenant", async () => {
    const token = await login("venturesoft", "orgadmin@venturesoft.ai");
    const tenantId = await currentTenantId(token);
    const employeeRole = await prisma.role.findFirstOrThrow({
      where: { tenantId, code: "EMPLOYEE", deletedAt: null },
      select: { id: true }
    });
    const unique = Date.now();
    const response = await api("/api/v1/admin/users", token, {
      method: "POST",
      body: {
        tenantId,
        email: `orgadmin-created-${unique}@venturesoft.ai`,
        username: `orgadmin-created-${unique}`,
        password: "Strong-Test-Password-123!",
        firstName: "OrgAdmin",
        lastName: "Created",
        status: "ACTIVE",
        roleId: employeeRole.id
      }
    });

    expect(response.status).toBe(201);
    const payload = (await response.json()) as { data: { id: string } };
    await expect(
      prisma.tenantMembership.findUnique({
        where: {
          tenantId_userId: { tenantId, userId: payload.data.id }
        }
      })
    ).resolves.toMatchObject({ tenantId, userId: payload.data.id });
  });

  it("allows platform super admin to create, edit, deactivate, and activate tenant organizations", async () => {
    const unique = Date.now();
    const platformToken = await issueAccessToken("superadmin@venturesoft.ai", null);
    let tenantId: string | null = null;

    try {
      const createResponse = await api("/api/v1/admin/tenants", platformToken.token, {
        method: "POST",
        body: {
          code: `phase8-org-${unique}`,
          name: `Phase 8 Organization ${unique}`,
          defaultTimezone: "UTC",
          defaultLocale: "en"
        }
      });
      expect(createResponse.status).toBe(201);
      tenantId = ((await createResponse.json()) as { data: { id: string } }).data.id;

      const suspendResponse = await api(
        `/api/v1/admin/tenants/${tenantId}`,
        platformToken.token,
        {
          method: "PATCH",
          body: { name: `Phase 8 Organization Updated ${unique}`, status: "SUSPENDED" }
        }
      );
      expect(suspendResponse.status).toBe(200);
      expect((await suspendResponse.json()) as { data: { status: string } }).toMatchObject({
        data: { status: "SUSPENDED" }
      });

      const activateResponse = await api(
        `/api/v1/admin/tenants/${tenantId}`,
        platformToken.token,
        { method: "PATCH", body: { status: "ACTIVE" } }
      );
      expect(activateResponse.status).toBe(200);
      expect((await activateResponse.json()) as { data: { status: string } }).toMatchObject({
        data: { status: "ACTIVE" }
      });
    } finally {
      if (tenantId) await cleanupTenant(tenantId);
      await prisma.authSession.deleteMany({ where: { id: platformToken.sessionId } });
    }
  });

  it("allows platform super admin to create organization admins", async () => {
    const unique = Date.now();
    const tenant = await prisma.tenant.findUniqueOrThrow({
      where: { code: "venturesoft" },
      select: { id: true }
    });
    const role = await prisma.role.findFirstOrThrow({
      where: { tenantId: tenant.id, code: "ORGANIZATION_ADMIN", deletedAt: null },
      select: { id: true }
    });
    const platformToken = await issueAccessToken("superadmin@venturesoft.ai", null);
    let userId: string | null = null;

    try {
      const response = await api("/api/v1/admin/users", platformToken.token, {
        method: "POST",
        body: {
          tenantId: tenant.id,
          email: `platform-created-org-admin-${unique}@venturesoft.ai`,
          username: `platform-created-org-admin-${unique}`,
          password: "Strong-Test-Password-123!",
          firstName: "Platform",
          lastName: "OrgAdmin",
          status: "ACTIVE",
          roleId: role.id
        }
      });

      expect(response.status).toBe(201);
      userId = ((await response.json()) as { data: { id: string } }).data.id;
      await expect(
        prisma.roleAssignment.findFirst({
          where: {
            tenantId: tenant.id,
            userId,
            roleId: role.id,
            scopeType: "TENANT",
            deletedAt: null
          }
        })
      ).resolves.toMatchObject({ organizationId: null });
    } finally {
      if (userId) await cleanupUsers([userId]);
      await prisma.authSession.deleteMany({ where: { id: platformToken.sessionId } });
    }
  });

  it("prevents organization admins from assigning tenant-wide administrator roles", async () => {
    const unique = Date.now();
    const tenant = await prisma.tenant.findUniqueOrThrow({
      where: { code: "venturesoft" },
      select: { id: true }
    });
    const role = await prisma.role.findFirstOrThrow({
      where: { tenantId: tenant.id, code: "ORGANIZATION_ADMIN", deletedAt: null },
      select: { id: true }
    });
    const orgAdminToken = await issueAccessToken("orgadmin@venturesoft.ai", tenant.id);

    try {
      const response = await api("/api/v1/admin/users", orgAdminToken.token, {
        method: "POST",
        body: {
          tenantId: tenant.id,
          email: `blocked-org-admin-${unique}@venturesoft.ai`,
          username: `blocked-org-admin-${unique}`,
          password: "Strong-Test-Password-123!",
          firstName: "Blocked",
          lastName: "OrgAdmin",
          status: "ACTIVE",
          roleId: role.id
        }
      });

      expect(response.status).toBe(403);
    } finally {
      await prisma.authSession.deleteMany({ where: { id: orgAdminToken.sessionId } });
      await prisma.user.deleteMany({
        where: { email: `blocked-org-admin-${unique}@venturesoft.ai` }
      });
    }
  });

  it("allows organization admins to edit users, reset passwords, assign roles, and activate or deactivate users", async () => {
    const unique = Date.now();
    const tenant = await prisma.tenant.findUniqueOrThrow({
      where: { code: "venturesoft" },
      select: { id: true }
    });
    const role = await prisma.role.findFirstOrThrow({
      where: { tenantId: tenant.id, code: "EMPLOYEE", deletedAt: null },
      select: { id: true }
    });
    const hrManagerRole = await prisma.role.findFirstOrThrow({
      where: { tenantId: tenant.id, code: "HR_MANAGER", deletedAt: null },
      select: { id: true }
    });
    const department = await prisma.organization.findFirstOrThrow({
      where: {
        tenantId: tenant.id,
        organizationType: "department",
        deletedAt: null
      },
      orderBy: { name: "asc" },
      select: { id: true }
    });
    const orgAdminToken = await issueAccessToken("orgadmin@venturesoft.ai", tenant.id);
    let userId: string | null = null;

    try {
      const createResponse = await api("/api/v1/admin/users", orgAdminToken.token, {
        method: "POST",
        body: {
          tenantId: tenant.id,
          email: `orgadmin-managed-${unique}@venturesoft.ai`,
          username: `orgadmin-managed-${unique}`,
          password: "Strong-Test-Password-123!",
          firstName: "OrgAdmin",
          lastName: "Managed",
          status: "ACTIVE",
          roleId: role.id
        }
      });
      expect(createResponse.status).toBe(201);
      userId = ((await createResponse.json()) as { data: { id: string } }).data.id;
      const userSession = await prisma.authSession.create({
        data: {
          tenantId: tenant.id,
          userId,
          refreshTokenHash: "f".repeat(64),
          refreshTokenFamily: randomUUID(),
          expiresAt: new Date(Date.now() + 86_400_000)
        },
        select: { id: true }
      });

      const resetResponse = await api(
        `/api/v1/admin/users/${userId}`,
        orgAdminToken.token,
        { method: "PATCH", body: { password: "Another-Strong-Password-123!" } }
      );
      expect(resetResponse.status).toBe(200);
      await expect(
        prisma.authSession.findUnique({ where: { id: userSession.id } })
      ).resolves.toMatchObject({ revokedAt: expect.any(Date) });

      const editResponse = await api(
        `/api/v1/admin/users/${userId}`,
        orgAdminToken.token,
        {
          method: "PATCH",
          body: {
            firstName: "Updated",
            roleId: hrManagerRole.id,
            departmentId: department.id
          }
        }
      );
      expect(editResponse.status).toBe(200);
      await expect(
        prisma.roleAssignment.findFirst({
          where: {
            tenantId: tenant.id,
            userId,
            roleId: hrManagerRole.id,
            organizationId: department.id,
            deletedAt: null
          }
        })
      ).resolves.toMatchObject({
        scopeType: "ORGANIZATION",
        includeDescendants: true
      });

      const deactivateResponse = await api(
        `/api/v1/admin/users/${userId}`,
        orgAdminToken.token,
        { method: "PATCH", body: { status: "DISABLED" } }
      );
      expect(deactivateResponse.status).toBe(200);
      await expect(
        prisma.tenantMembership.findUnique({
          where: { tenantId_userId: { tenantId: tenant.id, userId } }
        })
      ).resolves.toMatchObject({ status: "DISABLED" });

      const activeUsersResponse = await api(
        `/api/v1/admin/users?tenantId=${tenant.id}&status=ACTIVE&limit=1000`,
        orgAdminToken.token
      );
      expect(activeUsersResponse.status).toBe(200);
      const activeUsers = (await activeUsersResponse.json()) as {
        data: Array<{ id: string }>;
      };
      expect(activeUsers.data.map((item) => item.id)).not.toContain(userId);

      const activateResponse = await api(
        `/api/v1/admin/users/${userId}`,
        orgAdminToken.token,
        { method: "PATCH", body: { status: "ACTIVE" } }
      );
      expect(activateResponse.status).toBe(200);
      await expect(
        prisma.tenantMembership.findUnique({
          where: { tenantId_userId: { tenantId: tenant.id, userId } }
        })
      ).resolves.toMatchObject({ status: "ACTIVE" });
    } finally {
      if (userId) await cleanupUsers([userId]);
      await prisma.authSession.deleteMany({ where: { id: orgAdminToken.sessionId } });
    }
  });

  it("automatically associates scoped-created users with the creator organization", async () => {
    const unique = Date.now();
    const tenant = await prisma.tenant.findUniqueOrThrow({
      where: { code: "venturesoft" },
      select: { id: true }
    });
    const department = await prisma.organization.findFirstOrThrow({
      where: {
        tenantId: tenant.id,
        organizationType: "department",
        deletedAt: null
      },
      orderBy: { name: "asc" },
      select: { id: true }
    });
    const permission = await prisma.permission.findUniqueOrThrow({
      where: { code: "user.create" },
      select: { id: true }
    });
    const organizationRole = await prisma.role.findFirstOrThrow({
      where: { tenantId: tenant.id, code: "HR_MANAGER", deletedAt: null },
      select: { id: true }
    });
    const scoped = await createScopedUser({
      unique,
      tenantId: tenant.id,
      departmentId: department.id,
      permissionIds: [permission.id],
      permissionCodes: ["user.create"],
      roleCode: `ORG_USER_CREATOR_${unique}`
    });
    let createdUserId: string | null = null;

    try {
      const response = await api("/api/v1/admin/users", scoped.token, {
        method: "POST",
        body: {
          tenantId: tenant.id,
          email: `auto-org-user-${unique}@venturesoft.ai`,
          username: `auto-org-user-${unique}`,
          password: "Strong-Test-Password-123!",
          firstName: "Auto",
          lastName: "Scoped",
          status: "ACTIVE",
          roleId: organizationRole.id
        }
      });

      expect(response.status).toBe(201);
      createdUserId = ((await response.json()) as { data: { id: string } }).data.id;
      await expect(
        prisma.roleAssignment.findFirst({
          where: {
            tenantId: tenant.id,
            userId: createdUserId,
            roleId: organizationRole.id,
            deletedAt: null
          }
        })
      ).resolves.toMatchObject({ organizationId: department.id });
    } finally {
      await cleanupUsers([scoped.userId, ...(createdUserId ? [createdUserId] : [])]);
      await cleanupRole(scoped.roleId);
    }
  });

  it("rejects tampered JWT access tokens", async () => {
    const token = await login("venturesoft", "orgadmin@venturesoft.ai");
    const response = await api("/api/v1/auth/me", `${token}tampered`);

    expect(response.status).toBe(401);
  });

  it("rejects valid JWTs when the authenticated user becomes inactive or deleted", async () => {
    const unique = Date.now();
    const tenant = await prisma.tenant.findUniqueOrThrow({
      where: { code: "venturesoft" },
      select: { id: true }
    });
    const role = await prisma.role.findFirstOrThrow({
      where: { tenantId: tenant.id, code: "EMPLOYEE", deletedAt: null },
      select: { id: true, code: true, name: true }
    });
    const user = await prisma.user.create({
      data: {
        email: `middleware-user-${unique}@venturesoft.ai`,
        username: `middleware-user-${unique}`,
        passwordHash: await cryptoService.hashPassword(seededPassword),
        firstName: "Middleware",
        lastName: "User",
        status: "ACTIVE"
      },
      select: { id: true }
    });

    try {
      await prisma.tenantMembership.create({
        data: {
          tenantId: tenant.id,
          userId: user.id,
          status: "ACTIVE",
          joinedAt: new Date()
        }
      });
      await prisma.roleAssignment.create({
        data: {
          tenantId: tenant.id,
          userId: user.id,
          roleId: role.id,
          scopeType: "SELF"
        }
      });
      const session = await prisma.authSession.create({
        data: {
          tenantId: tenant.id,
          userId: user.id,
          refreshTokenHash: "a".repeat(64),
          refreshTokenFamily: randomUUID(),
          expiresAt: new Date(Date.now() + 86_400_000)
        },
        select: { id: true }
      });
      const token = await tokenService.signAccessToken({
        sub: user.id,
        tenant_id: tenant.id,
        session_id: session.id,
        role_ids: [role.id],
        roles: [role.code],
        role_names: [role.name],
        permissions: ["self.profile.read"],
        is_platform_admin: false,
        amr: ["pwd"]
      });

      await prisma.user.update({
        where: { id: user.id },
        data: { status: "DISABLED" }
      });
      expect((await api("/api/v1/auth/me", token)).status).toBe(401);

      await prisma.user.update({
        where: { id: user.id },
        data: { status: "ACTIVE", deletedAt: new Date() }
      });
      expect((await api("/api/v1/auth/me", token)).status).toBe(401);
    } finally {
      await prisma.authSession.deleteMany({ where: { userId: user.id } });
      await prisma.roleAssignment.deleteMany({ where: { userId: user.id } });
      await prisma.tenantMembership.deleteMany({ where: { userId: user.id } });
      await prisma.user.deleteMany({ where: { id: user.id } });
    }
  });
});

async function login(
  tenant: string | undefined,
  login: string
): Promise<string> {
  const response = await loginResponse(tenant, login);
  expect(response.status).toBe(200);
  const payload = (await response.json()) as {
    data: { accessToken: string };
  };
  return payload.data.accessToken;
}

async function testAccessToken(
  tenantCode: string | undefined,
  login: string
): Promise<string> {
  const tenant = tenantCode
    ? await prisma.tenant.findUniqueOrThrow({
        where: { code: tenantCode },
        select: { id: true }
      })
    : null;
  const user = await prisma.user.findFirstOrThrow({
    where: {
      OR: [
        { email: login },
        { username: login },
        ...(isUuid(login) ? [{ id: login }] : [])
      ],
      status: "ACTIVE",
      deletedAt: null
    },
    select: { id: true }
  });
  const session = await prisma.authSession.create({
    data: {
      tenantId: tenant?.id ?? null,
      userId: user.id,
      refreshTokenHash: "f".repeat(64),
      refreshTokenFamily: randomUUID(),
      expiresAt: new Date(Date.now() + 86_400_000)
    },
    select: { id: true }
  });
  return tokenService.signAccessToken({
    sub: user.id,
    tenant_id: tenant?.id ?? null,
    session_id: session.id,
    role_ids: [],
    roles: [],
    role_names: [],
    permissions: [],
    is_platform_admin: false,
    amr: ["pwd"]
  });
}

async function platformTestAccessToken(): Promise<string> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { email: "superadmin@venturesoft.ai" },
    select: { id: true }
  });
  const role = await prisma.role.findFirstOrThrow({
    where: { tenantId: null, code: PLATFORM_ROLE.code, deletedAt: null },
    select: { id: true, name: true }
  });
  const session = await prisma.authSession.create({
    data: {
      tenantId: null,
      userId: user.id,
      refreshTokenHash: "p".repeat(64),
      refreshTokenFamily: randomUUID(),
      expiresAt: new Date(Date.now() + 86_400_000)
    },
    select: { id: true }
  });
  return tokenService.signAccessToken({
    sub: user.id,
    tenant_id: null,
    session_id: session.id,
    role_ids: [role.id],
    roles: [PLATFORM_ROLE.code],
    role_names: [role.name],
    permissions: PERMISSIONS.map((permission) => permission.code),
    is_platform_admin: true,
    amr: ["pwd"]
  });
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function loginResponse(
  tenant: string | undefined,
  login: string
): Promise<Response> {
  return fetch(`${baseUrl}/api/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...(tenant ? { tenant } : {}), login, password: seededPassword })
  });
}

function refreshCookie(response: Response): string {
  const header = response.headers.get("set-cookie");
  expect(header).toEqual(expect.any(String));
  return header!.split(";")[0];
}

async function currentTenantId(token: string): Promise<string> {
  const response = await api("/api/v1/auth/me", token);
  expect(response.status).toBe(200);
  const payload = (await response.json()) as {
    data: { tenantId: string };
  };
  return payload.data.tenantId;
}

async function rolePermissions(tenantId: string | null, code: string): Promise<string[]> {
  const role = await prisma.role.findFirstOrThrow({
    where: { tenantId, code, deletedAt: null },
    select: {
      permissions: {
        where: { deletedAt: null, permission: { deletedAt: null } },
        select: { permission: { select: { code: true } } }
      }
    }
  });
  return role.permissions.map((item) => item.permission.code);
}

function sortStrings(values: string[]): string[] {
  return [...values].sort((left, right) => left.localeCompare(right));
}

async function createScopedUser(input: {
  unique: number;
  tenantId: string;
  departmentId: string;
  permissionIds: string[];
  permissionCodes: string[];
  roleCode: string;
}): Promise<{ userId: string; roleId: string; token: string }> {
  const user = await prisma.user.create({
    data: {
      email: `${input.roleCode.toLowerCase()}@venturesoft.ai`,
      username: input.roleCode.toLowerCase(),
      passwordHash: await cryptoService.hashPassword(seededPassword),
      firstName: "Scoped",
      lastName: "User",
      status: "ACTIVE"
    },
    select: { id: true }
  });
  const role = await prisma.role.create({
    data: {
      tenantId: input.tenantId,
      code: input.roleCode,
      name: input.roleCode.replaceAll("_", " "),
      roleType: "ORGANIZATION",
      isSystemRole: false,
      permissions: {
        create: input.permissionIds.map((permissionId) => ({ permissionId }))
      }
    },
    select: { id: true, code: true, name: true }
  });
  await prisma.tenantMembership.create({
    data: {
      tenantId: input.tenantId,
      userId: user.id,
      status: "ACTIVE",
      joinedAt: new Date()
    }
  });
  await prisma.roleAssignment.create({
    data: {
      tenantId: input.tenantId,
      userId: user.id,
      roleId: role.id,
      organizationId: input.departmentId,
      scopeType: "ORGANIZATION",
      includeDescendants: false
    }
  });
  const session = await prisma.authSession.create({
    data: {
      tenantId: input.tenantId,
      userId: user.id,
      refreshTokenHash: "d".repeat(64),
      refreshTokenFamily: randomUUID(),
      expiresAt: new Date(Date.now() + 86_400_000)
    },
    select: { id: true }
  });
  const token = await tokenService.signAccessToken({
    sub: user.id,
    tenant_id: input.tenantId,
    session_id: session.id,
    role_ids: [role.id],
    roles: [role.code],
    role_names: [role.name],
    permissions: input.permissionCodes,
    is_platform_admin: false,
    amr: ["pwd"]
  });
  return { userId: user.id, roleId: role.id, token };
}

async function createTenantUser(
  prefix: string,
  tenantId: string,
  roleId: string,
  departmentId: string
): Promise<{ id: string }> {
  const user = await prisma.user.create({
    data: {
      email: `${prefix}@venturesoft.ai`,
      username: prefix,
      passwordHash: await cryptoService.hashPassword(seededPassword),
      firstName: "Tenant",
      lastName: "User",
      status: "ACTIVE"
    },
    select: { id: true }
  });
  await prisma.tenantMembership.create({
    data: {
      tenantId,
      userId: user.id,
      status: "ACTIVE",
      joinedAt: new Date()
    }
  });
  await prisma.roleAssignment.create({
    data: {
      tenantId,
      userId: user.id,
      roleId,
      organizationId: departmentId,
      scopeType: "ORGANIZATION",
      includeDescendants: false
    }
  });
  return user;
}

async function cleanupUsers(userIds: string[]): Promise<void> {
  await prisma.authSession.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.roleAssignment.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.tenantMembership.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}

async function cleanupRole(roleId: string): Promise<void> {
  await prisma.rolePermission.deleteMany({ where: { roleId } });
  await prisma.role.deleteMany({ where: { id: roleId } });
}

async function cleanupTenant(tenantId: string): Promise<void> {
  const roles = await prisma.role.findMany({
    where: { tenantId },
    select: { id: true }
  });
  const roleIds = roles.map((role) => role.id);
  await prisma.auditEvent.deleteMany({
    where: { OR: [{ tenantId }, { entityId: tenantId }] }
  });
  await prisma.roleAssignment.deleteMany({ where: { tenantId } });
  await prisma.rolePermission.deleteMany({
    where: { roleId: { in: roleIds } }
  });
  await prisma.role.deleteMany({ where: { tenantId } });
  await prisma.organization.deleteMany({ where: { tenantId } });
  await prisma.tenantMembership.deleteMany({ where: { tenantId } });
  await prisma.authSession.deleteMany({ where: { tenantId } });
  await prisma.tenant.deleteMany({ where: { id: tenantId } });
}

async function ensureCanonicalSeedUsers(): Promise<void> {
  const passwordHash = await cryptoService.hashPassword(seededPassword);
  const tenant = await prisma.tenant.findUniqueOrThrow({
    where: { code: "venturesoft" },
    select: { id: true }
  });
  const rootOrganization = await prisma.organization.findUniqueOrThrow({
    where: {
      tenantId_code: {
        tenantId: tenant.id,
        code: "ROOT"
      }
    },
    select: { id: true }
  });

  for (const fixture of canonicalSeedUsers) {
    const tenantId = fixture.tenantCode ? tenant.id : null;
    const role = await prisma.role.findFirstOrThrow({
      where: {
        tenantId,
        code: fixture.roleCode,
        deletedAt: null
      },
      select: { id: true }
    });
    const user = await prisma.user.upsert({
      where: { email: fixture.email },
      update: {
        username: fixture.username,
        firstName: fixture.firstName,
        lastName: fixture.lastName,
        passwordHash,
        status: "ACTIVE",
        failedLoginCount: 0,
        lockedUntil: null,
        deletedAt: null,
        deletedBy: null
      },
      create: {
        email: fixture.email,
        username: fixture.username,
        firstName: fixture.firstName,
        lastName: fixture.lastName,
        passwordHash,
        status: "ACTIVE",
        emailVerifiedAt: new Date()
      },
      select: { id: true }
    });

    if (tenantId) {
      await prisma.tenantMembership.upsert({
        where: {
          tenantId_userId: {
            tenantId,
            userId: user.id
          }
        },
        update: {
          status: "ACTIVE",
          deletedAt: null,
          deletedBy: null,
          joinedAt: new Date()
        },
        create: {
          tenantId,
          userId: user.id,
          status: "ACTIVE",
          joinedAt: new Date()
        }
      });
    }

    await prisma.roleAssignment.updateMany({
      where: {
        userId: user.id,
        deletedAt: null,
        OR: tenantId
          ? [{ tenantId }, { tenantId: null, scopeType: "PLATFORM" }]
          : [{ tenantId: null, scopeType: "PLATFORM" }]
      },
      data: {
        deletedAt: new Date()
      }
    });
    await prisma.roleAssignment.create({
      data: {
        tenantId,
        userId: user.id,
        roleId: role.id,
        organizationId:
          fixture.scopeType === "ORGANIZATION" ? rootOrganization.id : null,
        scopeType: fixture.scopeType,
        includeDescendants: fixture.scopeType === "ORGANIZATION"
      }
    });
  }
}

async function issueAccessToken(
  email: string,
  tenantId: string | null
): Promise<{ token: string; sessionId: string }> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { email },
    select: {
      id: true,
      roleAssignments: {
        where: {
          deletedAt: null,
          OR: [
            { scopeType: "PLATFORM", tenantId: null },
            ...(tenantId ? [{ tenantId }] : [])
          ]
        },
        select: {
          roleId: true,
          scopeType: true,
          role: {
            select: {
              code: true,
              name: true,
              roleType: true,
              permissions: {
                where: { deletedAt: null, permission: { deletedAt: null } },
                select: { permission: { select: { code: true } } }
              }
            }
          }
        }
      }
    }
  });
  const session = await prisma.authSession.create({
    data: {
      tenantId,
      userId: user.id,
      refreshTokenHash: "e".repeat(64),
      refreshTokenFamily: randomUUID(),
      expiresAt: new Date(Date.now() + 86_400_000)
    },
    select: { id: true }
  });
  const permissions = [
    ...new Set(
      user.roleAssignments.flatMap((assignment) =>
        assignment.role.permissions.map((item) => item.permission.code)
      )
    )
  ];
  const token = await tokenService.signAccessToken({
    sub: user.id,
    tenant_id: tenantId,
    session_id: session.id,
    role_ids: [...new Set(user.roleAssignments.map((assignment) => assignment.roleId))],
    roles: [...new Set(user.roleAssignments.map((assignment) => assignment.role.code))],
    role_names: [
      ...new Set(user.roleAssignments.map((assignment) => assignment.role.name))
    ],
    permissions,
    is_platform_admin: user.roleAssignments.some(
      (assignment) =>
        assignment.scopeType === "PLATFORM" &&
        assignment.role.roleType === "PLATFORM"
    ),
    amr: ["pwd"]
  });
  return { token, sessionId: session.id };
}

async function api(
  path: string,
  token: string,
  options: { method?: string; body?: unknown; headers?: HeadersInit } = {}
): Promise<Response> {
  return fetch(`${baseUrl}${path}`, {
    method: options.method ?? "GET",
    headers: {
      authorization: `Bearer ${token}`,
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...options.headers
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
}
