import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "../../core/db.js";
import {
  AuthorizationError,
  ConflictError,
  NotFoundError,
  ValidationError
} from "../../core/errors.js";
import {
  assertOrganizationInScope,
  organizationEntityWhere,
  resolveOrganizationScope
} from "../../core/organization-scope.js";
import type { RequestContext } from "../../core/request-context.js";
import { auditService } from "../audit/audit.service.js";
import { cryptoService } from "../auth/crypto.service.js";
import type { AuthorizationAssignment } from "../auth/auth.types.js";
import { TENANT_ROLES } from "../rbac/rbac.catalog.js";

type Transaction = Prisma.TransactionClient;

interface Actor {
  tenantId: string | null;
  userId: string;
  isPlatformAdmin: boolean;
  assignments: AuthorizationAssignment[];
}

interface ListInput {
  cursor?: string;
  limit: number;
  tenantId?: string;
  departmentId?: string;
  search?: string;
  role?: "employee" | "manager";
  organizationType?: string;
  status?: string;
  sort: "name" | "-name" | "createdAt" | "-createdAt";
}

export class AdminService {
  async listTenants(input: ListInput, actor: Actor) {
    const rows = await prisma.tenant.findMany({
      where: {
        deletedAt: null,
        ...(!actor.isPlatformAdmin
          ? { id: requireActorTenant(actor) }
          : actor.tenantId
            ? { id: actor.tenantId }
            : {}),
        ...(input.status
          ? { status: input.status as "ACTIVE" | "SUSPENDED" | "CLOSED" }
          : {}),
        ...(input.search
          ? {
              OR: [
                { name: { contains: input.search, mode: "insensitive" } },
                { code: { contains: input.search, mode: "insensitive" } }
              ]
            }
          : {}),
        ...(input.organizationType
          ? { organizationType: input.organizationType }
          : {})
      },
      orderBy: tenantOrderBy(input.sort),
      take: input.limit + 1,
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      select: {
        id: true,
        code: true,
        name: true,
        status: true,
        defaultTimezone: true,
        defaultLocale: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { memberships: true, organizations: true } }
      }
    });
    return page(
      rows.map((row) => ({
        ...row,
        _count: {
          users: row._count.memberships,
          organizations: row._count.organizations
        }
      })),
      input.limit
    );
  }

  async createTenant(
    data: {
      code: string;
      name: string;
      defaultTimezone: string;
      defaultLocale: string;
    },
    actor: Actor,
    context: RequestContext
  ) {
    requirePlatformActor(actor);
    return prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: { ...data, settings: { tenantType: "customer" } }
      });
      await provisionTenantRoles(tx, tenant.id, actor.userId);
      await auditService.record(tx, {
        tenantId: actor.tenantId,
        actorUserId: actor.userId,
        effectiveUserId: actor.userId,
        action: "platform.tenant_created",
        entityType: "tenant",
        entityId: tenant.id,
        result: "SUCCESS",
        metadata: { targetTenantId: tenant.id, code: tenant.code },
        context
      });
      return serialize(tenant);
    });
  }

  async updateTenant(
    id: string,
    data: Prisma.TenantUpdateInput,
    actor: Actor,
    context: RequestContext
  ) {
    assertTenantAccess(actor, id);
    if (!actor.isPlatformAdmin) {
      const forbidden = ["status"].filter(
        (field) => field in (data as Record<string, unknown>)
      );
      if (forbidden.length) {
        throw new AuthorizationError(
          "Organization administrators cannot change tenant lifecycle status."
        );
      }
    }
    const existing = await prisma.tenant.findFirst({
      where: {
        id,
        deletedAt: null,
        ...tenantWhere(actor)
      }
    });
    if (!existing) throw new NotFoundError("Tenant");
    return prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.update({
        where: { id },
        data: { ...data, rowVersion: { increment: 1 } }
      });
      await auditService.record(tx, {
        tenantId: actor.tenantId,
        actorUserId: actor.userId,
        effectiveUserId: actor.userId,
        action: "platform.tenant_updated",
        entityType: "tenant",
        entityId: id,
        result: "SUCCESS",
        oldValues: { name: existing.name, status: existing.status },
        newValues: { name: tenant.name, status: tenant.status },
        metadata: { targetTenantId: id },
        context
      });
      return serialize(tenant);
    });
  }

  async listOrganizations(input: ListInput, actor: Actor) {
    const tenantId = resolveTenant(actor, input.tenantId);
    const scope = await resolveOrganizationScope(prisma, actor, tenantId);
    const rows = await prisma.organization.findMany({
      where: {
        deletedAt: null,
        ...(tenantId ? { tenantId } : {}),
        ...organizationEntityWhere(scope),
        ...(input.search
          ? {
              OR: [
                { name: { contains: input.search, mode: "insensitive" } },
                { code: { contains: input.search, mode: "insensitive" } }
              ]
            }
          : {})
      },
      orderBy: organizationOrderBy(input.sort),
      take: input.limit + 1,
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      include: {
        tenant: { select: { id: true, code: true, name: true } },
        parent: { select: { id: true, name: true } },
        manager: {
          select: { id: true, firstName: true, lastName: true, email: true }
        },
        _count: { select: { children: true, roleAssignments: true } }
      }
    });
    return page(rows.map(serialize), input.limit);
  }

  async createOrganization(
    data: Prisma.OrganizationUncheckedCreateInput,
    actor: Actor,
    context: RequestContext
  ) {
    const tenantId = resolveRequiredTenant(actor, data.tenantId);
    await assertOrganizationInScope(prisma, actor, tenantId, data.parentId ?? null);
    await this.validateOrganizationReferences(
      tenantId,
      data.parentId ?? null,
      data.managerUserId ?? null
    );
    return prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          ...data,
          tenantId,
          createdBy: actor.userId,
          updatedBy: actor.userId
        }
      });
      await auditService.record(tx, {
        tenantId: actor.tenantId,
        actorUserId: actor.userId,
        effectiveUserId: actor.userId,
        action: "organization.created",
        entityType: "organization",
        entityId: organization.id,
        result: "SUCCESS",
        metadata: { targetTenantId: organization.tenantId },
        context
      });
      return serialize(organization);
    });
  }

  async updateOrganization(
    id: string,
    data: Prisma.OrganizationUncheckedUpdateInput,
    actor: Actor,
    context: RequestContext
  ) {
    const existing = await prisma.organization.findFirst({
      where: { id, deletedAt: null, ...tenantWhere(actor) }
    });
    if (!existing) throw new NotFoundError("Organization");
    await assertOrganizationInScope(prisma, actor, existing.tenantId, existing.id);
    const parentId =
      data.parentId === undefined
        ? existing.parentId
        : (data.parentId as string | null);
    const managerUserId =
      data.managerUserId === undefined
        ? existing.managerUserId
        : (data.managerUserId as string | null);
    if (parentId === id) {
      throw new ValidationError([
        {
          field: "parentId",
          code: "CYCLE",
          message: "Organization cannot be its own parent."
        }
      ]);
    }
    await this.validateOrganizationReferences(
      existing.tenantId,
      parentId,
      managerUserId
    );
    if (parentId !== existing.parentId) {
      await assertOrganizationInScope(prisma, actor, existing.tenantId, parentId);
    }
    if (parentId) await this.ensureNoOrganizationCycle(id, parentId);
    return prisma.$transaction(async (tx) => {
      const organization = await tx.organization.update({
        where: { tenantId_id: { tenantId: existing.tenantId, id } },
        data: {
          ...data,
          updatedBy: actor.userId,
          rowVersion: { increment: 1 }
        }
      });
      await auditService.record(tx, {
        tenantId: actor.tenantId,
        actorUserId: actor.userId,
        effectiveUserId: actor.userId,
        action: "organization.updated",
        entityType: "organization",
        entityId: id,
        result: "SUCCESS",
        metadata: { targetTenantId: existing.tenantId },
        context
      });
      return serialize(organization);
    });
  }

  async deleteOrganization(
    id: string,
    actor: Actor,
    context: RequestContext
  ): Promise<void> {
    const organization = await prisma.organization.findFirst({
      where: { id, deletedAt: null, ...tenantWhere(actor) }
    });
    if (!organization) throw new NotFoundError("Organization");
    await assertOrganizationInScope(prisma, actor, organization.tenantId, organization.id);
    const dependencies = await organizationDeleteDependencies(
      prisma,
      organization.tenantId,
      id
    );
    const activeDependencies = Object.entries(dependencies)
      .filter(([, count]) => count > 0)
      .map(([name, count]) => ({ name, count }));
    if (activeDependencies.length > 0) {
      throw new ConflictError(
        "ORGANIZATION_IN_USE",
        "Move or archive related records before deleting this organization."
      );
    }
    await prisma.$transaction(async (tx) => {
      await tx.organization.update({
        where: {
          tenantId_id: { tenantId: organization.tenantId, id }
        },
        data: {
          deletedAt: new Date(),
          deletedBy: actor.userId,
          updatedBy: actor.userId,
          rowVersion: { increment: 1 }
        }
      });
      await auditService.record(tx, {
        tenantId: actor.tenantId,
        actorUserId: actor.userId,
        effectiveUserId: actor.userId,
        action: "organization.deleted",
        entityType: "organization",
        entityId: id,
        result: "SUCCESS",
        metadata: { targetTenantId: organization.tenantId },
        context
      });
    });
  }

  async listUsers(input: ListInput, actor: Actor) {
    const tenantId = resolveTenant(actor, input.tenantId);
    const scope = await resolveOrganizationScope(prisma, actor, tenantId);
    const rows = await prisma.user.findMany({
      where: {
        deletedAt: null,
        ...(tenantId
          ? {
              memberships: {
                some: {
                  tenantId,
                  deletedAt: null
                }
              }
            }
          : actor.isPlatformAdmin
            ? {}
            : {
                memberships: {
                  some: {
                    tenantId: requireActorTenant(actor),
                    deletedAt: null
                  }
                }
              }),
        ...(tenantId && !scope.tenantWide
          ? {
              roleAssignments: {
                some: {
                  tenantId,
                  deletedAt: null,
                  OR: [
                    { organizationId: { in: scope.organizationIds } },
                    { role: { departmentId: { in: scope.organizationIds } } }
                  ]
                }
              }
            }
          : {}),
        ...(input.status
          ? {
              status: input.status as
                | "INVITED"
                | "ACTIVE"
                | "LOCKED"
                | "DISABLED"
            }
          : {}),
        ...(input.search
          ? {
              OR: [
                { firstName: { contains: input.search, mode: "insensitive" } },
                { lastName: { contains: input.search, mode: "insensitive" } },
                { email: { contains: input.search, mode: "insensitive" } },
                { username: { contains: input.search, mode: "insensitive" } }
              ]
            }
          : {}),
        ...(input.role
          ? {
              roleAssignments: {
                some: {
                  deletedAt: null,
                  ...(tenantId ? { tenantId } : {}),
                  role:
                    input.role === "manager"
                      ? { roleType: "MANAGER" as const, deletedAt: null }
                      : { code: "EMPLOYEE", deletedAt: null }
                }
              }
            }
          : {})
      },
      orderBy: userOrderBy(input.sort),
      take: input.limit + 1,
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        status: true,
        mfaEnabled: true,
        lastLoginAt: true,
        createdAt: true,
        memberships: {
          where: {
            deletedAt: null,
            ...(tenantId ? { tenantId } : {})
          },
          select: {
            tenantId: true,
            status: true,
            tenant: { select: { code: true, name: true } }
          }
        },
        roleAssignments: {
          where: {
            deletedAt: null,
            ...(tenantId
              ? { tenantId }
              : {})
          },
          select: {
            id: true,
            tenantId: true,
            organizationId: true,
            scopeType: true,
            organization: { select: { id: true, code: true, name: true } },
            role: {
              select: {
                id: true,
                code: true,
                name: true,
                departmentId: true,
                department: { select: { id: true, code: true, name: true } }
              }
            }
          }
        }
      }
    });
    const targetTenant = tenantId
      ? await prisma.tenant.findUnique({
          where: { id: tenantId },
          select: { id: true, code: true, name: true }
        })
      : null;
    return page(
      rows.map((row) => {
        const membership = row.memberships[0];
        return {
          ...row,
          status:
            membership?.status === "SUSPENDED"
              ? "LOCKED"
              : membership?.status ?? row.status,
          tenantId: membership?.tenantId ?? targetTenant?.id ?? null,
          tenant: membership?.tenant ?? targetTenant ?? {
            code: "platform",
            name: "Platform"
          }
        };
      }),
      input.limit
    );
  }

  async listRoles(
    input: { tenantId?: string; departmentId?: string },
    actor: Actor
  ) {
    const targetTenantId = resolveTenant(actor, input.tenantId);
    const scope = await resolveOrganizationScope(prisma, actor, targetTenantId);
    const departmentIdFilter = roleDepartmentFilter(input.departmentId, scope);
    return prisma.role.findMany({
      where: {
        deletedAt: null,
        ...(targetTenantId
          ? { tenantId: targetTenantId }
          : { roleType: "PLATFORM", tenantId: null }),
        ...(departmentIdFilter ? { departmentId: departmentIdFilter } : {}),
        ...(!actor.isPlatformAdmin
          ? { roleType: { not: "TENANT" as const } }
          : {})
      },
      orderBy: [{ name: "asc" }],
      select: {
        id: true,
        tenantId: true,
        departmentId: true,
        department: { select: { id: true, code: true, name: true } },
        code: true,
        name: true,
        description: true,
        roleType: true,
        isSystemRole: true,
        permissions: {
          where: { deletedAt: null, permission: { deletedAt: null } },
          select: {
            permission: {
              select: {
                id: true,
                code: true,
                module: true,
                resource: true,
                action: true,
                description: true,
                sensitivity: true,
                requiresMfa: true
              }
            }
          },
          orderBy: { permission: { code: "asc" } }
        },
        _count: { select: { assignments: true } }
      }
    });
  }

  async listPermissions() {
    return prisma.permission.findMany({
      where: { deletedAt: null },
      orderBy: [{ module: "asc" }, { resource: "asc" }, { action: "asc" }],
      select: {
        id: true,
        code: true,
        module: true,
        resource: true,
        action: true,
        description: true,
        sensitivity: true,
        requiresMfa: true
      }
    });
  }

  async createRole(
    data: {
      tenantId: string;
      code: string;
      name: string;
      description?: string | null;
      roleType: "TENANT" | "ORGANIZATION" | "MANAGER" | "SELF";
      permissionIds: string[];
    },
    actor: Actor,
    context: RequestContext
  ) {
    const tenantId = resolveRequiredTenant(actor, data.tenantId);
    await this.validatePermissionIds(data.permissionIds);
    return prisma.$transaction(async (tx) => {
      const role = await tx.role.create({
        data: {
          tenantId,
          code: data.code,
          name: data.name,
          description: data.description ?? null,
          roleType: data.roleType,
          isSystemRole: false,
          createdBy: actor.userId,
          updatedBy: actor.userId
        }
      });
      await replaceRolePermissions(tx, role.id, data.permissionIds, actor.userId);
      await auditService.record(tx, {
        tenantId: actor.tenantId,
        actorUserId: actor.userId,
        effectiveUserId: actor.userId,
        action: "identity.role_created",
        entityType: "role",
        entityId: role.id,
        result: "SUCCESS",
        metadata: { targetTenantId: tenantId, code: role.code },
        context
      });
      return serialize(await roleWithPermissions(tx, role.id));
    });
  }

  async updateRole(
    id: string,
    data: {
      name?: string;
      description?: string | null;
      roleType?: "TENANT" | "ORGANIZATION" | "MANAGER" | "SELF";
      permissionIds?: string[];
    },
    actor: Actor,
    context: RequestContext
  ) {
    const existing = await prisma.role.findFirst({
      where: { id, deletedAt: null, ...tenantWhere(actor) },
      include: {
        permissions: {
          where: { deletedAt: null },
          select: { permissionId: true }
        }
      }
    });
    if (!existing) throw new NotFoundError("Role");
    if (data.permissionIds) await this.validatePermissionIds(data.permissionIds);
    return prisma.$transaction(async (tx) => {
      await tx.role.update({
        where: { id },
        data: {
          ...(data.name !== undefined ? { name: data.name } : {}),
          ...(data.description !== undefined
            ? { description: data.description }
            : {}),
          ...(data.roleType !== undefined ? { roleType: data.roleType } : {}),
          updatedBy: actor.userId,
          rowVersion: { increment: 1 }
        }
      });
      if (data.permissionIds) {
        await replaceRolePermissions(tx, id, data.permissionIds, actor.userId);
      }
      await auditService.record(tx, {
        tenantId: actor.tenantId,
        actorUserId: actor.userId,
        effectiveUserId: actor.userId,
        action: "identity.role_updated",
        entityType: "role",
        entityId: id,
        result: "SUCCESS",
        metadata: { targetTenantId: existing.tenantId, code: existing.code },
        context
      });
      return serialize(await roleWithPermissions(tx, id));
    });
  }

  async deleteRole(
    id: string,
    actor: Actor,
    context: RequestContext
  ): Promise<void> {
    const role = await prisma.role.findFirst({
      where: { id, deletedAt: null, ...tenantWhere(actor) }
    });
    if (!role) throw new NotFoundError("Role");
    if (role.isSystemRole) {
      throw new ConflictError(
        "SYSTEM_ROLE_DELETE_FORBIDDEN",
        "Default system roles cannot be deleted."
      );
    }
    const activeAssignments = await prisma.roleAssignment.count({
      where: { roleId: id, deletedAt: null }
    });
    if (activeAssignments > 0) {
      throw new ConflictError(
        "ROLE_IN_USE",
        "Remove active user assignments before deleting this role."
      );
    }
    await prisma.$transaction(async (tx) => {
      await tx.role.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          deletedBy: actor.userId,
          updatedBy: actor.userId,
          rowVersion: { increment: 1 }
        }
      });
      await tx.rolePermission.updateMany({
        where: { roleId: id, deletedAt: null },
        data: { deletedAt: new Date(), deletedBy: actor.userId }
      });
      await auditService.record(tx, {
        tenantId: actor.tenantId,
        actorUserId: actor.userId,
        effectiveUserId: actor.userId,
        action: "identity.role_deleted",
        entityType: "role",
        entityId: id,
        result: "SUCCESS",
        metadata: { targetTenantId: role.tenantId, code: role.code },
        context
      });
    });
  }

  async createUser(
    data: {
      tenantId: string;
      email: string;
      username?: string | null;
      password: string;
      firstName: string;
      lastName: string;
      status: "INVITED" | "ACTIVE" | "LOCKED" | "DISABLED";
      roleId: string;
      departmentId?: string;
      organizationId?: string | null;
    },
    actor: Actor,
    context: RequestContext
  ) {
    const tenantId = resolveRequiredTenant(actor, data.tenantId);
    const assignment = await resolveAssignableUserRole(prisma, actor, tenantId, {
      roleId: data.roleId,
      organizationId: data.departmentId ?? data.organizationId ?? null
    });
    await assertOrganizationInScope(
      prisma,
      actor,
      tenantId,
      assignment.departmentId
    );
    await this.validateUserScope(
      tenantId,
      data.roleId,
      assignment.departmentId
    );
    const existing = await prisma.user.findFirst({
      where: { email: data.email, deletedAt: null }
    });
    const usernameOwner = data.username
      ? await prisma.user.findFirst({
          where: { username: data.username, deletedAt: null }
        })
      : null;
    const deletedIdentityCollisions = await prisma.user.findMany({
      where: {
        deletedAt: { not: null },
        OR: [
          { email: data.email },
          ...(data.username ? [{ username: data.username }] : [])
        ]
      },
      select: { id: true }
    });
    if (usernameOwner && usernameOwner.email !== data.email) {
      throw new ConflictError(
        "USERNAME_EXISTS",
        "An account with this username already exists."
      );
    }
    if (
      existing &&
      (await prisma.tenantMembership.findFirst({
        where: {
          tenantId,
          userId: existing.id,
          deletedAt: null
        }
      }))
    ) {
      throw new ConflictError(
        "MEMBERSHIP_EXISTS",
        "User already belongs to the selected tenant."
      );
    }
    if (existing && !actor.isPlatformAdmin) {
      throw new ConflictError(
        "GLOBAL_IDENTITY_EXISTS",
        "An account with this email already exists. A platform administrator must link it to another tenant."
      );
    }
    const passwordHash = existing
      ? undefined
      : await cryptoService.hashPassword(data.password);

    return prisma.$transaction(async (tx) => {
      await releaseDeletedUserIdentities(
        tx,
        deletedIdentityCollisions.map((user) => user.id),
        actor.userId
      );

      const user = existing
        ? await tx.user.update({
            where: { id: existing.id },
            data: {
              deletedAt: null,
              deletedBy: null,
              rowVersion: { increment: 1 }
            }
          })
        : await tx.user.create({
            data: {
              email: data.email,
              username: data.username ?? null,
              passwordHash: passwordHash!,
              firstName: data.firstName,
              lastName: data.lastName,
              status: data.status,
              emailVerifiedAt: data.status === "ACTIVE" ? new Date() : null,
              createdBy: actor.userId,
              updatedBy: actor.userId,
              preferences: { mustChangePassword: true }
            }
          });

      await tx.tenantMembership.upsert({
        where: {
          tenantId_userId: {
            tenantId,
            userId: user.id
          }
        },
        create: {
          tenantId,
          userId: user.id,
          status: membershipStatus(data.status),
          joinedAt: data.status === "ACTIVE" ? new Date() : null,
          createdBy: actor.userId,
          updatedBy: actor.userId
        },
        update: {
          status: membershipStatus(data.status),
          joinedAt: data.status === "ACTIVE" ? new Date() : null,
          deletedAt: null,
          deletedBy: null,
          updatedBy: actor.userId,
          rowVersion: { increment: 1 }
        }
      });

      await tx.roleAssignment.create({
        data: {
          userId: user.id,
          roleId: assignment.role.id,
          tenantId,
          organizationId: assignment.organizationId,
          scopeType: scopeForRole(
            assignment.role.roleType,
            assignment.organizationId
          ),
          includeDescendants:
            assignment.role.roleType === "ORGANIZATION" ||
            assignment.role.roleType === "MANAGER",
          assignedBy: actor.userId
        }
      });
      await auditService.record(tx, {
        tenantId: actor.tenantId,
        actorUserId: actor.userId,
        effectiveUserId: actor.userId,
        action: "identity.user_created",
        entityType: "user",
        entityId: user.id,
        result: "SUCCESS",
        metadata: { targetTenantId: tenantId },
        context
      });
      return serialize(user);
    });
  }

  async updateUser(
    id: string,
    data: {
      email?: string;
      username?: string | null;
      password?: string;
      firstName?: string;
      lastName?: string;
      status?: "INVITED" | "ACTIVE" | "LOCKED" | "DISABLED";
      roleId?: string;
      departmentId?: string;
      organizationId?: string | null;
    },
    actor: Actor,
    context: RequestContext
  ) {
    const tenantId = requireMutationTenant(actor);
    const membership = tenantId
      ? await prisma.tenantMembership.findFirst({
          where: { tenantId, userId: id, deletedAt: null }
        })
      : null;
    if (tenantId && !membership) throw new NotFoundError("User");
    const existing = await prisma.user.findFirst({
      where: { id, deletedAt: null }
    });
    if (!existing) throw new NotFoundError("User");
    if (tenantId) await assertUserInOrganizationScope(prisma, actor, tenantId, id);

    const assignment =
      data.roleId && tenantId
        ? await resolveAssignableUserRole(prisma, actor, tenantId, {
            roleId: data.roleId,
            organizationId: data.departmentId ?? data.organizationId ?? null
          })
        : null;
      if (assignment && tenantId) {
      await assertOrganizationInScope(
        prisma,
        actor,
        tenantId,
        assignment.departmentId
      );
      await this.validateUserScope(
        tenantId,
        assignment.role.id,
        assignment.departmentId
      );
    }

    const { roleId, departmentId, organizationId, password, ...userData } = data;
    if (!actor.isPlatformAdmin && (userData.email || userData.username)) {
      throw new AuthorizationError(
        "Tenant administrators cannot change global login credentials."
      );
    }
    const passwordHash = password
      ? await cryptoService.hashPassword(password)
      : undefined;
    return prisma.$transaction(async (tx) => {
      const { status, ...identityData } = userData;
      const user = await tx.user.update({
        where: { id },
        data: {
          ...identityData,
          ...(passwordHash ? { passwordHash } : {}),
          updatedBy: actor.userId,
          rowVersion: { increment: 1 }
        }
      });

      if (tenantId && status) {
        await tx.tenantMembership.update({
          where: { tenantId_userId: { tenantId, userId: id } },
          data: {
            status: membershipStatus(status),
            updatedBy: actor.userId,
            rowVersion: { increment: 1 }
          }
        });
      } else if (!tenantId && actor.isPlatformAdmin && status) {
        await tx.user.update({
          where: { id },
          data: { status, rowVersion: { increment: 1 } }
        });
      }

      if (roleId !== undefined && tenantId) {
        await tx.roleAssignment.updateMany({
          where: {
            userId: id,
            tenantId,
            deletedAt: null
          },
          data: { deletedAt: new Date(), deletedBy: actor.userId }
        });
        await tx.roleAssignment.create({
          data: {
            userId: id,
            roleId: assignment!.role.id,
            tenantId,
            organizationId: assignment!.organizationId,
            scopeType: scopeForRole(
              assignment!.role.roleType,
              assignment!.organizationId
            ),
            includeDescendants:
              assignment!.role.roleType === "ORGANIZATION" ||
              assignment!.role.roleType === "MANAGER",
            assignedBy: actor.userId
          }
        });
      }

      if (passwordHash || (data.status && data.status !== "ACTIVE")) {
        await tx.authSession.updateMany({
          where: {
            userId: id,
            revokedAt: null,
            ...(tenantId ? { tenantId } : {})
          },
          data: {
            revokedAt: new Date(),
            revocationReason: passwordHash
              ? "PASSWORD_CHANGED"
              : "ADMIN_ACTION"
          }
        });
      }
      await auditService.record(tx, {
        tenantId: actor.tenantId,
        actorUserId: actor.userId,
        effectiveUserId: actor.userId,
        action: "identity.user_updated",
        entityType: "user",
        entityId: id,
        result: "SUCCESS",
        metadata: { targetTenantId: tenantId },
        context
      });
      return serialize(user);
    });
  }

  async deleteUser(
    id: string,
    actor: Actor,
    context: RequestContext
  ): Promise<void> {
    if (id === actor.userId) {
      throw new ConflictError(
        "SELF_DELETE_FORBIDDEN",
        "Administrator cannot delete the active account."
      );
    }
    const tenantId = requireMutationTenant(actor);
    const user = await prisma.user.findFirst({
      where: {
        id,
        deletedAt: null,
        ...(tenantId
          ? {
              memberships: {
                some: { tenantId, deletedAt: null }
              }
            }
          : {})
      }
    });
    if (!user) throw new NotFoundError("User");
    if (tenantId) await assertUserInOrganizationScope(prisma, actor, tenantId, id);
    await prisma.$transaction(async (tx) => {
      await assertUserHasNoOtherAccessForHardDelete(tx, id, tenantId);
      const archive = await buildDeletedUserArchive(tx, id);
      const archived = await tx.deletedUserArchive.create({
        data: {
          originalUserId: id,
          tenantId,
          deletedBy: actor.userId,
          reason: "ADMIN_DELETE",
          user: jsonValue(archive.user),
          relatedData: jsonValue(archive.relatedData),
          metadata: jsonValue({
            deletedFromTenantId: tenantId,
            deletedBy: actor.userId,
            requestId: context.requestId,
            correlationId: context.correlationId
          })
        },
        select: { id: true }
      });

      await tx.performanceEvidence.deleteMany({
        where: {
          OR: [
            { uploadedByUserId: id },
            { review: { employeeUserId: id } }
          ]
        }
      });
      await tx.performanceReview.deleteMany({
        where: { employeeUserId: id }
      });
      await tx.performanceReview.updateMany({
        where: { managerUserId: id },
        data: {
          managerUserId: null,
          updatedBy: actor.userId,
          rowVersion: { increment: 1 }
        }
      });
      await tx.performanceGoal.updateMany({
        where: { ownerUserId: id },
        data: {
          ownerUserId: null,
          updatedBy: actor.userId,
          rowVersion: { increment: 1 }
        }
      });
      await tx.hrmsRecord.updateMany({
        where: { subjectUserId: id },
        data: {
          subjectUserId: null,
          updatedBy: actor.userId,
          rowVersion: { increment: 1 }
        }
      });
      await tx.hrmsRecord.updateMany({
        where: { ownerUserId: id },
        data: {
          ownerUserId: null,
          updatedBy: actor.userId,
          rowVersion: { increment: 1 }
        }
      });
      await tx.hrmsRecord.updateMany({
        where: { assignedToUserId: id },
        data: {
          assignedToUserId: null,
          updatedBy: actor.userId,
          rowVersion: { increment: 1 }
        }
      });
      await tx.organization.updateMany({
        where: { managerUserId: id },
        data: {
          managerUserId: null,
          updatedBy: actor.userId,
          rowVersion: { increment: 1 }
        }
      });
      await tx.auditEvent.updateMany({
        where: { actorUserId: id },
        data: { actorUserId: null }
      });
      await tx.auditEvent.updateMany({
        where: { effectiveUserId: id },
        data: { effectiveUserId: null }
      });
      await tx.roleAssignment.updateMany({
        where: { assignedBy: id },
        data: { assignedBy: null }
      });
      await tx.authSession.deleteMany({ where: { userId: id } });
      await tx.passwordResetToken.deleteMany({ where: { userId: id } });
      await tx.roleAssignment.deleteMany({ where: { userId: id } });
      await tx.tenantMembership.deleteMany({ where: { userId: id } });
      await auditService.record(tx, {
        tenantId: actor.tenantId,
        actorUserId: actor.userId,
        effectiveUserId: actor.userId,
        action: "identity.user_deleted",
        entityType: "user",
        entityId: id,
        result: "SUCCESS",
        metadata: { targetTenantId: tenantId, archiveId: archived.id },
        context
      });
      await tx.user.delete({ where: { id } });
    });
  }

  private async validateOrganizationReferences(
    tenantId: string,
    parentId: string | null,
    managerUserId: string | null
  ) {
    const tenant = await prisma.tenant.findFirst({
      where: { id: tenantId, deletedAt: null }
    });
    if (!tenant) throw new NotFoundError("Tenant");
    if (parentId) {
      const parent = await prisma.organization.findFirst({
        where: { id: parentId, tenantId, deletedAt: null }
      });
      if (!parent) {
        throw new ValidationError([
          {
            field: "parentId",
            code: "INVALID_SCOPE",
            message: "Parent must belong to the selected tenant."
          }
        ]);
      }
    }
    if (managerUserId) {
      const membership = await prisma.tenantMembership.findFirst({
        where: {
          userId: managerUserId,
          tenantId,
          status: "ACTIVE",
          deletedAt: null
        }
      });
      if (!membership) {
        throw new ValidationError([
          {
            field: "managerUserId",
            code: "INVALID_SCOPE",
            message: "Manager must be an active member of the selected tenant."
          }
        ]);
      }
    }
  }

  private async ensureNoOrganizationCycle(id: string, parentId: string) {
    let cursor: string | null = parentId;
    while (cursor) {
      if (cursor === id) {
        throw new ValidationError([
          {
            field: "parentId",
            code: "CYCLE",
            message: "Organization hierarchy cannot contain a cycle."
          }
        ]);
      }
      const parent: { parentId: string | null } | null =
        await prisma.organization.findFirst({
          where: { id: cursor, deletedAt: null },
          select: { parentId: true }
        });
      cursor = parent?.parentId ?? null;
    }
  }

  private async validateUserScope(
    tenantId: string,
    roleId: string,
    departmentId?: string | null
  ) {
    const tenant = await prisma.tenant.findFirst({
      where: { id: tenantId, deletedAt: null }
    });
    if (!tenant) throw new NotFoundError("Tenant");
    const role = await prisma.role.findFirst({
      where: { id: roleId, tenantId, deletedAt: null },
      include: {
        department: { select: { id: true, organizationType: true } }
      }
    });
    if (!role) {
      throw new ValidationError([
        {
          field: "roleId",
          code: "INVALID_SCOPE",
          message: "Role must belong to the selected tenant."
        }
      ]);
    }
    if (!departmentId && role.departmentId) {
      throw new ValidationError([
        {
          field: "departmentId",
          code: "REQUIRED",
          message: "Department is required for the selected role."
        }
      ]);
    }
    if (departmentId) {
      const organization = await prisma.organization.findFirst({
        where: {
          id: departmentId,
          tenantId,
          organizationType: "department",
          deletedAt: null
        }
      });
      if (!organization) {
        throw new ValidationError([
          {
            field: "departmentId",
            code: "INVALID_SCOPE",
            message: "Department must belong to the selected tenant."
          }
        ]);
      }
      if (role.departmentId && role.departmentId !== departmentId) {
        throw new ValidationError([
          {
            field: "roleId",
            code: "INVALID_SCOPE",
            message: "Role must belong to the selected department."
          }
        ]);
      }
    }
  }

  private async validatePermissionIds(permissionIds: string[]) {
    const uniqueIds = [...new Set(permissionIds)];
    if (uniqueIds.length !== permissionIds.length) {
      throw new ValidationError([
        {
          field: "permissionIds",
          code: "DUPLICATE",
          message: "Permission list contains duplicates."
        }
      ]);
    }
    const found = await prisma.permission.count({
      where: { id: { in: uniqueIds }, deletedAt: null }
    });
    if (found !== uniqueIds.length) {
      throw new ValidationError([
        {
          field: "permissionIds",
          code: "INVALID_SCOPE",
          message: "All permissions must exist and be active."
        }
      ]);
    }
  }
}

async function provisionTenantRoles(
  tx: Transaction,
  tenantId: string,
  actorUserId: string
) {
  const permissions = await tx.permission.findMany({
    where: { deletedAt: null },
    select: { id: true, code: true }
  });
  const permissionIds = new Map(
    permissions.map((item) => [item.code.toLowerCase(), item.id])
  );

  for (const template of TENANT_ROLES) {
    const role = await tx.role.create({
      data: {
        tenantId,
        code: template.code,
        name: template.name,
        description: template.description,
        roleType: template.roleType,
        isSystemRole: true,
        createdBy: actorUserId
      }
    });
    for (const permissionCode of template.permissions) {
      const permissionId = permissionIds.get(permissionCode.toLowerCase());
      if (!permissionId) continue;
      await tx.rolePermission.create({
        data: {
          roleId: role.id,
          permissionId,
          createdBy: actorUserId
        }
      });
    }
  }
}

async function replaceRolePermissions(
  tx: Transaction,
  roleId: string,
  permissionIds: string[],
  actorUserId: string
) {
  const uniquePermissionIds = [...new Set(permissionIds)];
  await tx.rolePermission.updateMany({
    where: {
      roleId,
      permissionId: { notIn: uniquePermissionIds },
      deletedAt: null
    },
    data: { deletedAt: new Date(), deletedBy: actorUserId }
  });
  for (const permissionId of uniquePermissionIds) {
    const existing = await tx.rolePermission.findUnique({
      where: { roleId_permissionId: { roleId, permissionId } }
    });
    if (existing) {
      await tx.rolePermission.update({
        where: { id: existing.id },
        data: { deletedAt: null, deletedBy: null }
      });
    } else {
      await tx.rolePermission.create({
        data: { roleId, permissionId, createdBy: actorUserId }
      });
    }
  }
}

async function roleWithPermissions(tx: Transaction, id: string) {
  return tx.role.findUniqueOrThrow({
    where: { id },
    select: {
      id: true,
      tenantId: true,
      code: true,
      name: true,
      description: true,
      roleType: true,
      isSystemRole: true,
      permissions: {
        where: { deletedAt: null, permission: { deletedAt: null } },
        select: {
          permission: {
            select: {
              id: true,
              code: true,
              module: true,
              resource: true,
              action: true,
              description: true,
              sensitivity: true,
              requiresMfa: true
            }
          }
        },
        orderBy: { permission: { code: "asc" } }
      }
    }
  });
}

function scopeForRole(
  roleType: "PLATFORM" | "TENANT" | "ORGANIZATION" | "MANAGER" | "SELF",
  organizationId?: string | null
) {
  if (roleType === "PLATFORM") return "PLATFORM" as const;
  if (roleType === "TENANT") return "TENANT" as const;
  if (roleType === "MANAGER") return "TEAM" as const;
  if (roleType === "SELF") return "SELF" as const;
  return organizationId ? ("ORGANIZATION" as const) : ("TENANT" as const);
}

function tenantOrderBy(
  sort: ListInput["sort"]
): Prisma.Enumerable<Prisma.TenantOrderByWithRelationInput> {
  const descending = sort.startsWith("-");
  const field = sort.replace("-", "") as "name" | "createdAt";
  return [{ [field]: descending ? "desc" : "asc" }, { id: "desc" }];
}

function organizationOrderBy(
  sort: ListInput["sort"]
): Prisma.Enumerable<Prisma.OrganizationOrderByWithRelationInput> {
  const descending = sort.startsWith("-");
  const field = sort.replace("-", "") as "name" | "createdAt";
  return [{ [field]: descending ? "desc" : "asc" }, { id: "desc" }];
}

function userOrderBy(
  sort: ListInput["sort"]
): Prisma.Enumerable<Prisma.UserOrderByWithRelationInput> {
  const descending = sort.startsWith("-");
  const requested = sort.replace("-", "");
  const field = requested === "name" ? "lastName" : "createdAt";
  return [{ [field]: descending ? "desc" : "asc" }, { id: "desc" }];
}

function page<T extends { id: string }>(rows: T[], limit: number) {
  const hasMore = rows.length > limit;
  const data = hasMore ? rows.slice(0, limit) : rows;
  return {
    data,
    meta: {
      pageSize: limit,
      nextCursor: hasMore ? data.at(-1)?.id ?? null : null,
      hasMore
    }
  };
}

function serialize<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_key, item) =>
      typeof item === "bigint" ? item.toString() : item
    )
  ) as T;
}

function jsonValue(value: unknown): Prisma.InputJsonValue {
  return serialize(value) as Prisma.InputJsonValue;
}

async function assertUserHasNoOtherAccessForHardDelete(
  db: Transaction | PrismaClient,
  userId: string,
  tenantId: string | null
): Promise<void> {
  if (!tenantId) return;
  const [otherMemberships, otherRoleAssignments] = await Promise.all([
    db.tenantMembership.count({
      where: { userId, tenantId: { not: tenantId } }
    }),
    db.roleAssignment.count({
      where: {
        userId,
        OR: [{ tenantId: null }, { tenantId: { not: tenantId } }]
      }
    })
  ]);
  if (otherMemberships > 0 || otherRoleAssignments > 0) {
    throw new ConflictError(
      "USER_HAS_OTHER_ACCESS",
      "This user still has access outside the selected tenant. Remove that access or delete the user from a platform-wide context before hard deletion."
    );
  }
}

async function buildDeletedUserArchive(
  db: Transaction | PrismaClient,
  userId: string
) {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) throw new NotFoundError("User");

  const [
    memberships,
    roleAssignments,
    assignedRoleAssignments,
    sessions,
    passwordResetTokens,
    managedOrganizations,
    subjectHrmsRecords,
    ownedHrmsRecords,
    assignedHrmsRecords,
    ownedPerformanceGoals,
    employeeReviews,
    managerReviews,
    uploadedEvidence,
    auditEvents
  ] = await Promise.all([
    db.tenantMembership.findMany({ where: { userId } }),
    db.roleAssignment.findMany({ where: { userId } }),
    db.roleAssignment.findMany({ where: { assignedBy: userId } }),
    db.authSession.findMany({ where: { userId } }),
    db.passwordResetToken.findMany({ where: { userId } }),
    db.organization.findMany({ where: { managerUserId: userId } }),
    db.hrmsRecord.findMany({ where: { subjectUserId: userId } }),
    db.hrmsRecord.findMany({ where: { ownerUserId: userId } }),
    db.hrmsRecord.findMany({ where: { assignedToUserId: userId } }),
    db.performanceGoal.findMany({ where: { ownerUserId: userId } }),
    db.performanceReview.findMany({
      where: { employeeUserId: userId },
      include: { evidence: true }
    }),
    db.performanceReview.findMany({
      where: { managerUserId: userId },
      include: { evidence: true }
    }),
    db.performanceEvidence.findMany({ where: { uploadedByUserId: userId } }),
    db.auditEvent.findMany({
      where: {
        OR: [
          { actorUserId: userId },
          { effectiveUserId: userId },
          { entityType: "user", entityId: userId }
        ]
      },
      orderBy: { occurredAt: "asc" }
    })
  ]);

  return serialize({
    user,
    relatedData: {
      memberships,
      roleAssignments,
      assignedRoleAssignments,
      sessions,
      passwordResetTokens,
      managedOrganizations,
      subjectHrmsRecords,
      ownedHrmsRecords,
      assignedHrmsRecords,
      ownedPerformanceGoals,
      employeeReviews,
      managerReviews,
      uploadedEvidence,
      auditEvents
    }
  });
}

async function organizationDeleteDependencies(
  db: PrismaClient,
  tenantId: string,
  organizationId: string
) {
  const [
    childOrganizations,
    scopedRoleAssignments,
    departmentRoles,
    hrmsRecords,
    reviewCycles,
    performanceGoals,
    performanceReviews
  ] = await Promise.all([
    db.organization.count({
      where: { tenantId, parentId: organizationId, deletedAt: null }
    }),
    db.roleAssignment.count({
      where: { tenantId, organizationId, deletedAt: null }
    }),
    db.role.count({
      where: { tenantId, departmentId: organizationId, deletedAt: null }
    }),
    db.hrmsRecord.count({
      where: { tenantId, organizationId, deletedAt: null }
    }),
    db.performanceReviewCycle.count({
      where: { tenantId, organizationId, deletedAt: null }
    }),
    db.performanceGoal.count({
      where: { tenantId, organizationId, deletedAt: null }
    }),
    db.performanceReview.count({
      where: { tenantId, organizationId, deletedAt: null }
    })
  ]);

  return {
    childOrganizations,
    scopedRoleAssignments,
    departmentRoles,
    hrmsRecords,
    reviewCycles,
    performanceGoals,
    performanceReviews
  };
}

async function releaseDeletedUserIdentities(
  db: Transaction | PrismaClient,
  userIds: string[],
  actorUserId: string
): Promise<void> {
  for (const userId of [...new Set(userIds)]) {
    await db.user.updateMany({
      where: { id: userId, deletedAt: { not: null } },
      data: {
        email: deletedUserEmail(userId),
        username: deletedUsername(userId),
        passwordHash: null,
        status: "DISABLED",
        emailVerifiedAt: null,
        mfaEnabled: false,
        mfaSecretEncrypted: null,
        updatedBy: actorUserId,
        rowVersion: { increment: 1 }
      }
    });
  }
}

function deletedUserEmail(userId: string): string {
  return `deleted+${userId}@example.invalid`;
}

function deletedUsername(userId: string): string {
  return `deleted_${userId.replaceAll("-", "")}`;
}

function resolveTenant(
  actor: Actor,
  requestedTenantId?: string | null
): string | null {
  if (actor.isPlatformAdmin) {
    return requestedTenantId ?? actor.tenantId;
  }
  const tenantId = requireActorTenant(actor);
  if (requestedTenantId && requestedTenantId !== tenantId) {
    throw new AuthorizationError("Cross-tenant access is forbidden.");
  }
  return tenantId;
}

function resolveRequiredTenant(
  actor: Actor,
  requestedTenantId?: string | null
): string {
  const tenantId = resolveTenant(actor, requestedTenantId);
  if (!tenantId) {
    throw new ValidationError([
      {
        field: "tenantId",
        code: "REQUIRED",
        message: "A tenant must be selected."
      }
    ]);
  }
  return tenantId;
}

function requireActorTenant(actor: Actor): string {
  if (!actor.tenantId) {
    throw new AuthorizationError("An active tenant context is required.");
  }
  return actor.tenantId;
}

function requireMutationTenant(actor: Actor): string | null {
  if (actor.isPlatformAdmin) return actor.tenantId;
  return requireActorTenant(actor);
}

function requirePlatformActor(actor: Actor): void {
  if (!actor.isPlatformAdmin) throw new AuthorizationError();
}

function assertTenantAccess(actor: Actor, tenantId: string): void {
  if (!actor.isPlatformAdmin && requireActorTenant(actor) !== tenantId) {
    throw new AuthorizationError("Cross-tenant access is forbidden.");
  }
  if (actor.isPlatformAdmin && actor.tenantId && actor.tenantId !== tenantId) {
    throw new AuthorizationError("Requested tenant does not match context.");
  }
}

function tenantWhere(actor: Actor): { tenantId?: string } {
  if (actor.isPlatformAdmin) {
    return actor.tenantId ? { tenantId: actor.tenantId } : {};
  }
  return { tenantId: requireActorTenant(actor) };
}

function roleDepartmentFilter(
  departmentId: string | undefined,
  scope: Awaited<ReturnType<typeof resolveOrganizationScope>>
): string | { in: string[] } | undefined {
  if (scope.tenantWide) return departmentId;
  if (departmentId) {
    return scope.organizationIds.includes(departmentId) ? departmentId : { in: [] };
  }
  return { in: scope.organizationIds };
}

async function assertUserInOrganizationScope(
  db: Transaction | PrismaClient,
  actor: Actor,
  tenantId: string,
  userId: string
): Promise<void> {
  const scope = await resolveOrganizationScope(db, actor, tenantId);
  if (scope.tenantWide) return;
  const assignments = await db.roleAssignment.count({
    where: {
      tenantId,
      userId,
      deletedAt: null,
      OR: [
        { organizationId: { in: scope.organizationIds } },
        { role: { departmentId: { in: scope.organizationIds } } }
      ]
    }
  });
  if (assignments === 0) throw new NotFoundError("User");
}

async function resolveAssignableUserRole(
  db: Transaction | PrismaClient,
  actor: Actor,
  tenantId: string,
  input: { roleId: string; organizationId?: string | null }
): Promise<{
  role: {
    id: string;
    roleType: "PLATFORM" | "TENANT" | "ORGANIZATION" | "MANAGER" | "SELF";
    departmentId: string | null;
  };
  organizationId: string | null;
  departmentId: string | null;
}> {
  const role = await db.role.findFirst({
    where: { id: input.roleId, tenantId, deletedAt: null },
    select: { id: true, roleType: true, departmentId: true }
  });
  if (!role) throw new NotFoundError("Role");
  if (!actor.isPlatformAdmin && role.roleType === "TENANT") {
    throw new AuthorizationError(
      "Only platform administrators can assign tenant-wide administrator roles."
    );
  }

  if (
    role.roleType === "SELF" &&
    input.organizationId &&
    role.departmentId !== input.organizationId
  ) {
    throw new ValidationError([
      {
        field: "departmentId",
        code: "INVALID_SCOPE",
        message: "Selected department must match the selected role."
      }
    ]);
  }

  const departmentId =
    input.organizationId ??
    role.departmentId ??
    (role.roleType === "ORGANIZATION" || role.roleType === "MANAGER"
      ? inferredActorOrganizationId(actor, tenantId)
      : null);
  if (
    !departmentId &&
    (role.roleType === "ORGANIZATION" || role.roleType === "MANAGER")
  ) {
    throw new ValidationError([
      {
        field: "departmentId",
        code: "REQUIRED",
        message: "Department is required for the selected role."
      }
    ]);
  }

  return {
    role,
    departmentId,
    organizationId:
      role.roleType === "ORGANIZATION" || role.roleType === "MANAGER"
        ? departmentId
        : null
  };
}

function inferredActorOrganizationId(
  actor: Actor,
  tenantId: string
): string | null {
  if (actor.isPlatformAdmin) return null;
  const organizationIds = [
    ...new Set(
      actor.assignments
        .filter((assignment) => assignment.tenantId === tenantId)
        .map((assignment) => assignment.organizationId)
        .filter((organizationId): organizationId is string => Boolean(organizationId))
    )
  ];
  return organizationIds.length === 1 ? organizationIds[0]! : null;
}

function membershipStatus(
  status: "INVITED" | "ACTIVE" | "LOCKED" | "DISABLED"
): "INVITED" | "ACTIVE" | "SUSPENDED" | "DISABLED" {
  return status === "LOCKED" ? "SUSPENDED" : status;
}

export const adminService = new AdminService();
