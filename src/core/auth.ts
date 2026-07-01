import type { NextFunction, Request, Response } from "express";
import { prisma } from "./db.js";
import {
  AuthenticationError,
  AuthorizationError
} from "./errors.js";
import { tokenService } from "../modules/auth/token.service.js";

export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authorization = req.header("authorization");
    if (!authorization?.startsWith("Bearer ")) {
      throw new AuthenticationError();
    }

    const claims = await tokenService.verifyAccessToken(
      authorization.slice("Bearer ".length)
    );
    const now = new Date();

    const user = await prisma.user.findFirst({
      where: {
        id: claims.sub,
        status: "ACTIVE",
        deletedAt: null,
        sessions: {
          some: {
            id: claims.session_id,
            tenantId: claims.tenant_id,
            revokedAt: null,
            expiresAt: { gt: now }
          }
        }
      },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        status: true,
        memberships: claims.tenant_id
          ? {
              where: {
                tenantId: claims.tenant_id,
                status: "ACTIVE",
                deletedAt: null,
                tenant: { status: "ACTIVE", deletedAt: null }
              },
              select: { id: true }
            }
          : false,
        roleAssignments: {
          where: {
            deletedAt: null,
            validFrom: { lte: now },
            OR: [{ validUntil: null }, { validUntil: { gt: now } }],
            AND: [
              {
                OR: [
                  { scopeType: "PLATFORM", tenantId: null },
                  ...(claims.tenant_id
                    ? [{ tenantId: claims.tenant_id }]
                    : [])
                ]
              }
            ],
            role: { deletedAt: null }
          },
          select: {
            tenantId: true,
            organizationId: true,
            scopeType: true,
            includeDescendants: true,
            role: {
              select: {
                id: true,
                code: true,
                name: true,
                roleType: true,
                permissions: {
                  where: {
                    deletedAt: null,
                    permission: { deletedAt: null }
                  },
                  select: {
                    permission: {
                      select: {
                        code: true,
                        requiresMfa: true
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!user) {
      throw new AuthenticationError("Session is no longer active.");
    }

    const platformAssignment = user.roleAssignments.some(
      (assignment) =>
        assignment.scopeType === "PLATFORM" &&
        assignment.role.roleType === "PLATFORM"
    );
    if (
      claims.tenant_id &&
      !platformAssignment &&
      (!user.memberships || user.memberships.length === 0)
    ) {
      throw new AuthenticationError("Tenant membership is no longer active.");
    }

    const permissions = [
      ...new Set(
        user.roleAssignments.flatMap((assignment) =>
          assignment.role.permissions.map(
            (rolePermission) => rolePermission.permission.code
          )
        )
      )
    ];
    const mfaRequiredPermissions = [
      ...new Set(
        user.roleAssignments.flatMap((assignment) =>
          assignment.role.permissions
            .filter(
              (rolePermission) => rolePermission.permission.requiresMfa
            )
            .map((rolePermission) => rolePermission.permission.code)
        )
      )
    ];
    const roleIds = [
      ...new Set(
        user.roleAssignments.map((assignment) => assignment.role.id)
      )
    ];
    const roles = [
      ...new Set(
        user.roleAssignments.map((assignment) => assignment.role.code)
      )
    ];
    const roleNames = [
      ...new Set(
        user.roleAssignments.map((assignment) => assignment.role.name)
      )
    ];

    req.auth = {
      userId: claims.sub,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        status: user.status
      },
      tenantId: claims.tenant_id,
      sessionId: claims.session_id,
      authenticationMethods: claims.amr,
      roleIds,
      roles,
      roleNames,
      permissions,
      mfaRequiredPermissions,
      isSuperAdmin: platformAssignment,
      assignments: user.roleAssignments.map((assignment) => ({
        roleCode: assignment.role.code,
        roleType: assignment.role.roleType,
        tenantId: assignment.tenantId,
        organizationId: assignment.organizationId,
        scopeType: assignment.scopeType,
        includeDescendants: assignment.includeDescendants
      }))
    };
    next();
  } catch (error) {
    next(error);
  }
}

export function requirePermissions(...required: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.auth) {
      next(new AuthenticationError());
      return;
    }
    if (
      !required.every((permission) =>
        req.auth!.permissions.includes(permission)
      )
    ) {
      next(new AuthorizationError());
      return;
    }
    if (
      required.some((permission) =>
        req.auth!.mfaRequiredPermissions.includes(permission)
      ) &&
      !req.auth.authenticationMethods.includes("otp")
    ) {
      next(new AuthorizationError("Multi-factor authentication is required."));
      return;
    }
    next();
  };
}

export function requireAnyPermission(...required: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.auth) {
      next(new AuthenticationError());
      return;
    }
    const granted = required.find((permission) =>
      req.auth!.permissions.includes(permission)
    );
    if (!granted) {
      next(new AuthorizationError());
      return;
    }
    if (
      req.auth.mfaRequiredPermissions.includes(granted) &&
      !req.auth.authenticationMethods.includes("otp")
    ) {
      next(new AuthorizationError("Multi-factor authentication is required."));
      return;
    }
    next();
  };
}

export function establishTenantAccess(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  if (!req.auth) {
    next(new AuthenticationError());
    return;
  }

  const requestedTenantIds = [
    normalizeTenantId(req.header("x-tenant-id")),
    normalizeTenantId(req.query.tenantId),
    normalizeTenantId(
      typeof req.body === "object" && req.body !== null
        ? (req.body as Record<string, unknown>).tenantId
        : undefined
    )
  ].filter((value): value is string => Boolean(value));

  if (new Set(requestedTenantIds).size > 1) {
    next(new AuthorizationError("Conflicting tenant identifiers."));
    return;
  }

  const requestedTenantId = requestedTenantIds[0] ?? null;
  if (
    !req.auth.isSuperAdmin &&
    requestedTenantId &&
    requestedTenantId !== req.auth.tenantId
  ) {
    next(new AuthorizationError("Cross-tenant access is forbidden."));
    return;
  }

  req.tenantAccess = {
    tenantId: req.auth.isSuperAdmin
      ? requestedTenantId
      : req.auth.tenantId,
    isPlatformAdmin: req.auth.isSuperAdmin
  };
  next();
}

export function requireMfa(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  if (!req.auth?.authenticationMethods.includes("otp")) {
    next(new AuthorizationError("Multi-factor authentication is required."));
    return;
  }
  next();
}

function normalizeTenantId(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value.trim();
  return undefined;
}
