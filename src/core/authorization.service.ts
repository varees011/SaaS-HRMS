import type { Prisma, PrismaClient } from "@prisma/client";
import { AuthorizationError, ValidationError } from "./errors.js";
import {
  organizationIdWhere,
  resolveOrganizationScope
} from "./organization-scope.js";
import type { AuthorizationAssignment } from "../modules/auth/auth.types.js";

type DatabaseClient = PrismaClient | Prisma.TransactionClient;

export interface AuthorizationActor {
  tenantId: string | null;
  userId: string;
  isPlatformAdmin: boolean;
  permissions: string[];
  assignments: AuthorizationAssignment[];
}

export type UserRelationship =
  | "EMPLOYEE"
  | "MANAGER"
  | "SKIP_LEVEL_MANAGER"
  | "DEPARTMENT"
  | "ORGANIZATION"
  | "HR_BUSINESS_PARTNER"
  | "REVIEWER"
  | "PROJECT_MANAGER";

const tenantUserReadPermissions = [
  "platform.users.read",
  "platform.users.update",
  "platform.users.delete",
  "tenant.users.read",
  "tenant.users.manage",
  "user.read",
  "user.update",
  "employees.directory.read",
  "employees.profile.read"
] as const;

const teamUserReadPermissions = [
  "team.members.read",
  "team.performance.review",
  "team.goals.manage"
] as const;

const selfUserReadPermissions = ["self.profile.read"] as const;

const performanceScopedReadPermissions = [
  "tenant.performance.read",
  "tenant.performance.manage"
] as const;

const performanceTeamPermissions = [
  "team.performance.review",
  "team.goals.manage"
] as const;

const performanceSelfPermissions = [
  "self.performance.read",
  "self.performance.submit"
] as const;

const reviewerRolePermissions = [
  "team.performance.review",
  "team.members.read",
  "self.performance.submit",
  "tenant.performance.manage"
] as const;

const legacyManagerRoleKeywords = ["manager", "lead", "head", "supervisor"] as const;

export class AuthorizationService {
  hasAnyPermission(actor: Pick<AuthorizationActor, "permissions">, permissions: readonly string[]) {
    return permissions.some((permission) => actor.permissions.includes(permission));
  }

  resolveTenant(
    actor: Pick<AuthorizationActor, "tenantId" | "isPlatformAdmin">,
    requestedTenantId?: string | null
  ): string | null {
    if (actor.isPlatformAdmin) return requestedTenantId ?? actor.tenantId;
    const tenantId = this.requireActorTenant(actor);
    if (requestedTenantId && requestedTenantId !== tenantId) {
      throw new AuthorizationError("Cross-tenant access is forbidden.");
    }
    return tenantId;
  }

  resolveRequiredTenant(
    actor: Pick<AuthorizationActor, "tenantId" | "isPlatformAdmin">,
    requestedTenantId?: string | null
  ): string {
    const tenantId = this.resolveTenant(actor, requestedTenantId);
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

  requireActorTenant(actor: Pick<AuthorizationActor, "tenantId">): string {
    if (!actor.tenantId) {
      throw new AuthorizationError("An active tenant context is required.");
    }
    return actor.tenantId;
  }

  tenantWhere(
    actor: Pick<AuthorizationActor, "tenantId" | "isPlatformAdmin">
  ): { tenantId?: string } {
    if (actor.isPlatformAdmin) {
      return actor.tenantId ? { tenantId: actor.tenantId } : {};
    }
    return { tenantId: this.requireActorTenant(actor) };
  }

  assertTenantAccess(
    actor: Pick<AuthorizationActor, "tenantId" | "isPlatformAdmin">,
    tenantId: string
  ): void {
    if (!actor.isPlatformAdmin && this.requireActorTenant(actor) !== tenantId) {
      throw new AuthorizationError("Cross-tenant access is forbidden.");
    }
    if (actor.isPlatformAdmin && actor.tenantId && actor.tenantId !== tenantId) {
      throw new AuthorizationError("Requested tenant does not match context.");
    }
  }

  async accessibleUserWhere(
    db: DatabaseClient,
    actor: AuthorizationActor,
    input: { tenantId?: string | null; departmentId?: string | null } = {}
  ): Promise<Prisma.UserWhereInput> {
    const tenantId = this.resolveTenant(actor, input.tenantId);
    const tenantFilter = this.userTenantFilter(actor, tenantId);
    const relationshipFilters: Prisma.UserWhereInput[] = [];

    if (actor.isPlatformAdmin) return tenantFilter;

    const scope = await resolveOrganizationScope(db, actor, tenantId);
    const canReadTenantUsers = this.hasAnyPermission(actor, tenantUserReadPermissions);
    if (canReadTenantUsers) {
      if (scope.tenantWide) {
        relationshipFilters.push({});
      } else {
        relationshipFilters.push(scopedUserWhere(scope.organizationIds));
      }
    }

    if (this.hasAnyPermission(actor, teamUserReadPermissions)) {
      relationshipFilters.push(directReportWhere(actor.userId));
      const directReportIds = await this.directReportIds(db, actor, tenantId);
      if (directReportIds.length) {
        relationshipFilters.push(skipLevelReportWhere(directReportIds));
      }
      if (actor.permissions.includes("team.goals.manage") && !scope.tenantWide) {
        relationshipFilters.push(scopedUserWhere(scope.organizationIds));
      }
    }

    if (this.hasAnyPermission(actor, selfUserReadPermissions)) {
      relationshipFilters.push({ id: actor.userId });
    }

    const relationshipWhere = orWhere(relationshipFilters);
    const departmentWhere = input.departmentId
      ? scopedUserWhere([input.departmentId])
      : {};
    return {
      AND: [tenantFilter, relationshipWhere, departmentWhere]
    };
  }

  async assertUserAccessible(
    db: DatabaseClient,
    actor: AuthorizationActor,
    tenantId: string,
    userId: string
  ): Promise<void> {
    const count = await db.user.count({
      where: {
        id: userId,
        deletedAt: null,
        ...(await this.accessibleUserWhere(db, actor, { tenantId }))
      }
    });
    if (count === 0) throw new AuthorizationError();
  }

  async performanceReviewWhere(
    db: DatabaseClient,
    actor: AuthorizationActor,
    input: { tenantId?: string | null; organizationId?: string | null } = {}
  ): Promise<Prisma.PerformanceReviewWhereInput> {
    const tenantId = this.resolveTenant(actor, input.tenantId);
    const tenantFilter = tenantId ? { tenantId } : this.tenantWhere(actor);

    if (actor.isPlatformAdmin) {
      return {
        ...tenantFilter,
        ...(input.organizationId ? { organizationId: input.organizationId } : {})
      };
    }

    const filters: Prisma.PerformanceReviewWhereInput[] = [];
    const scope = await resolveOrganizationScope(db, actor, tenantId);

    if (this.hasAnyPermission(actor, performanceScopedReadPermissions)) {
      if (input.organizationId) {
        filters.push({ organizationId: input.organizationId });
      } else if (scope.tenantWide) {
        filters.push({});
      } else {
        filters.push(organizationIdWhere(scope));
      }
    }

    if (this.hasAnyPermission(actor, performanceTeamPermissions)) {
      filters.push({ managerUserId: actor.userId });
      const directReportIds = await this.directReportIds(db, actor, tenantId);
      if (directReportIds.length) {
        filters.push({ managerUserId: { in: directReportIds } });
      }
      if (actor.permissions.includes("team.goals.manage") && !scope.tenantWide) {
        filters.push(organizationIdWhere(scope));
      }
    }

    if (this.hasAnyPermission(actor, performanceSelfPermissions)) {
      filters.push({ employeeUserId: actor.userId });
      filters.push({ managerUserId: actor.userId });
    }

    return {
      ...tenantFilter,
      ...orWhere(filters)
    };
  }

  assertCanSubmitSelfAssessment(
    actor: AuthorizationActor,
    review: { employeeUserId: string }
  ): void {
    if (
      actor.userId === review.employeeUserId &&
      actor.permissions.includes("self.performance.submit")
    ) {
      return;
    }
    if (actor.isPlatformAdmin || actor.permissions.includes("tenant.performance.manage")) {
      return;
    }
    throw new AuthorizationError("Only the employee can submit self assessment.");
  }

  assertCanSubmitManagerAssessment(
    actor: AuthorizationActor,
    review: { managerUserId: string | null }
  ): void {
    if (
      review.managerUserId === actor.userId &&
      this.hasAnyPermission(actor, [
        "team.performance.review",
        "self.performance.submit"
      ])
    ) {
      return;
    }
    if (actor.isPlatformAdmin || actor.permissions.includes("tenant.performance.manage")) {
      return;
    }
    throw new AuthorizationError("Only the assigned manager can submit this review.");
  }

  async assertCanAttachEvidence(
    actor: AuthorizationActor,
    review: { employeeUserId: string; managerUserId: string | null }
  ): Promise<void> {
    if (
      actor.userId === review.employeeUserId &&
      actor.permissions.includes("self.performance.submit")
    ) {
      return;
    }
    if (
      review.managerUserId === actor.userId &&
      this.hasAnyPermission(actor, [
        "team.performance.review",
        "self.performance.submit"
      ])
    ) {
      return;
    }
    if (actor.isPlatformAdmin || actor.permissions.includes("tenant.performance.manage")) {
      return;
    }
    throw new AuthorizationError();
  }

  managerEligibleRoleWhere(): Prisma.RoleWhereInput {
    return {
      deletedAt: null,
      OR: [
        { roleType: "MANAGER" },
        legacyManagerRoleWhere(),
        {
          permissions: {
            some: {
              deletedAt: null,
              permission: {
                deletedAt: null,
                code: { in: [...reviewerRolePermissions] }
              }
            }
          }
        }
      ]
    };
  }

  employeeAssignableRoleWhere(): Prisma.RoleWhereInput {
    return {
      deletedAt: null,
      roleType: { notIn: ["PLATFORM", "TENANT", "MANAGER"] },
      NOT: legacyManagerRoleWhere()
    };
  }

  isManagerialRole(role: {
    roleType: "PLATFORM" | "TENANT" | "ORGANIZATION" | "MANAGER" | "SELF";
  }): boolean {
    return role.roleType === "MANAGER";
  }

  private userTenantFilter(
    actor: Pick<AuthorizationActor, "tenantId" | "isPlatformAdmin">,
    tenantId: string | null
  ): Prisma.UserWhereInput {
    if (tenantId) {
      return {
        memberships: {
          some: { tenantId, deletedAt: null }
        }
      };
    }
    if (actor.isPlatformAdmin) return {};
    return {
      memberships: {
        some: {
          tenantId: this.requireActorTenant(actor),
          deletedAt: null
        }
      }
    };
  }

  private async directReportIds(
    db: DatabaseClient,
    actor: Pick<AuthorizationActor, "userId" | "tenantId" | "isPlatformAdmin">,
    tenantId: string | null
  ): Promise<string[]> {
    const rows = await db.user.findMany({
      where: {
        deletedAt: null,
        ...this.userTenantFilter(actor, tenantId),
        ...directReportWhere(actor.userId)
      },
      select: { id: true }
    });
    return rows.map((row) => row.id);
  }
}

function legacyManagerRoleWhere(): Prisma.RoleWhereInput {
  return {
    OR: legacyManagerRoleKeywords.flatMap((keyword) => [
      { name: { contains: keyword, mode: "insensitive" } },
      { code: { contains: keyword, mode: "insensitive" } }
    ])
  };
}

function scopedUserWhere(organizationIds: string[]): Prisma.UserWhereInput {
  if (organizationIds.length === 0) return { id: { in: [] } };
  return {
    roleAssignments: {
      some: {
        deletedAt: null,
        OR: [
          { organizationId: { in: organizationIds } },
          { role: { departmentId: { in: organizationIds } } }
        ]
      }
    }
  };
}

function directReportWhere(managerUserId: string): Prisma.UserWhereInput {
  return {
    preferences: {
      path: ["reportingManagerUserId"],
      equals: managerUserId
    }
  };
}

function skipLevelReportWhere(managerUserIds: string[]): Prisma.UserWhereInput {
  return {
    OR: managerUserIds.map((managerUserId) => directReportWhere(managerUserId))
  };
}

function orWhere<T extends Prisma.UserWhereInput | Prisma.PerformanceReviewWhereInput>(
  filters: T[]
): T {
  if (filters.some((filter) => Object.keys(filter).length === 0)) return {} as T;
  if (filters.length === 0) return { id: { in: [] } } as unknown as T;
  if (filters.length === 1) return filters[0]!;
  return { OR: filters } as unknown as T;
}

export const authorizationService = new AuthorizationService();
