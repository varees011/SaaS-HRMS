import type { Prisma, PrismaClient } from "@prisma/client";
import { AuthorizationError } from "../errors/app-error.js";
import type { AuthorizationAssignment } from "../../modules/auth/auth.types.js";

type DatabaseClient = PrismaClient | Prisma.TransactionClient;

export interface OrganizationScopedActor {
  tenantId: string | null;
  isPlatformAdmin: boolean;
  assignments: AuthorizationAssignment[];
}

export interface OrganizationScope {
  tenantWide: boolean;
  organizationIds: string[];
}

export async function resolveOrganizationScope(
  db: DatabaseClient,
  actor: OrganizationScopedActor,
  tenantId: string | null | undefined
): Promise<OrganizationScope> {
  if (actor.isPlatformAdmin) {
    return { tenantWide: true, organizationIds: [] };
  }

  const resolvedTenantId = tenantId ?? actor.tenantId;
  if (!resolvedTenantId) {
    throw new AuthorizationError("An active tenant context is required.");
  }

  const assignments = actor.assignments.filter(
    (assignment) => assignment.tenantId === resolvedTenantId
  );
  if (
    assignments.some(
      (assignment) =>
        assignment.scopeType === "TENANT" ||
        (assignment.roleType === "TENANT" && !assignment.organizationId)
    )
  ) {
    return { tenantWide: true, organizationIds: [] };
  }

  const organizationIds = new Set<string>();
  const descendantQueue: string[] = [];
  for (const assignment of assignments) {
    if (!assignment.organizationId) continue;
    organizationIds.add(assignment.organizationId);
    if (assignment.includeDescendants) {
      descendantQueue.push(assignment.organizationId);
    }
  }

  while (descendantQueue.length > 0) {
    const parentIds = descendantQueue.splice(0, 50);
    const children = await db.organization.findMany({
      where: {
        tenantId: resolvedTenantId,
        parentId: { in: parentIds },
        deletedAt: null
      },
      select: { id: true }
    });
    for (const child of children) {
      if (organizationIds.has(child.id)) continue;
      organizationIds.add(child.id);
      descendantQueue.push(child.id);
    }
  }

  return { tenantWide: false, organizationIds: [...organizationIds] };
}

export function organizationIdWhere(
  scope: OrganizationScope
): { organizationId?: { in: string[] } } {
  return scope.tenantWide ? {} : { organizationId: { in: scope.organizationIds } };
}

export function organizationEntityWhere(
  scope: OrganizationScope
): { id?: { in: string[] } } {
  return scope.tenantWide ? {} : { id: { in: scope.organizationIds } };
}

export async function assertOrganizationInScope(
  db: DatabaseClient,
  actor: OrganizationScopedActor,
  tenantId: string,
  organizationId: string | null | undefined
): Promise<void> {
  const scope = await resolveOrganizationScope(db, actor, tenantId);
  if (scope.tenantWide) return;
  if (!organizationId || !scope.organizationIds.includes(organizationId)) {
    throw new AuthorizationError("Organization access is outside authenticated scope.");
  }
}
