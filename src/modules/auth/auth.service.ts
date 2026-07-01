import { randomUUID } from "node:crypto";
import type { Prisma, PrismaClient, User } from "@prisma/client";
import { authenticator } from "otplib";
import { env } from "../../core/config.js";
import { prisma } from "../../core/db.js";
import {
  AuthenticationError,
  ConflictError,
  NotFoundError
} from "../../core/errors.js";
import type { RequestContext } from "../../core/request-context.js";
import { auditService } from "../audit/audit.service.js";
import { cryptoService } from "./crypto.service.js";
import { passwordResetNotifier } from "./password-reset-notifier.js";
import { tokenService } from "./token.service.js";
import type {
  ChangePasswordInput,
  ForgotPasswordInput,
  LoginInput,
  ResetPasswordInput
} from "./auth.schema.js";
import type { AuthTokens, ClientMetadata } from "./auth.types.js";

type DatabaseClient = PrismaClient | Prisma.TransactionClient;
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 15;
const dummyPasswordHash = cryptoService.hashPassword(
  "Not-The-Actual-Password-123!"
);

export class AuthService {
  async login(
    input: LoginInput,
    client: ClientMetadata,
    context: RequestContext
  ): Promise<AuthTokens> {
    const requestedTenant = input.tenant?.trim() || null;
    const tenant = requestedTenant
      ? await prisma.tenant.findFirst({
          where: {
            OR: [
              { code: { equals: requestedTenant, mode: "insensitive" } },
              { name: { equals: requestedTenant, mode: "insensitive" } },
              ...(isUuid(requestedTenant) ? [{ id: requestedTenant }] : [])
            ],
            deletedAt: null
          }
        })
      : null;

    if (requestedTenant && (!tenant || tenant.status !== "ACTIVE")) {
      await this.consumeDummyPassword(input.password);
      throw new AuthenticationError("Invalid credentials.");
    }

    const now = new Date();
    const user = await prisma.user.findFirst({
      where: {
        deletedAt: null,
        OR: [
          ...(isUuid(input.login) ? [{ id: input.login }] : []),
          { email: { equals: input.login, mode: "insensitive" } },
          { username: { equals: input.login, mode: "insensitive" } }
        ]
      },
      include: {
        memberships: {
          where: tenant
            ? {
                tenantId: tenant.id,
                status: "ACTIVE",
                deletedAt: null
              }
            : { id: "00000000-0000-0000-0000-000000000000" },
          select: { id: true }
        },
        roleAssignments: {
          where: {
            scopeType: "PLATFORM",
            tenantId: null,
            deletedAt: null,
            validFrom: { lte: now },
            OR: [{ validUntil: null }, { validUntil: { gt: now } }],
            role: { roleType: "PLATFORM", deletedAt: null }
          },
          select: { id: true }
        }
      }
    });

    const passwordValid =
      user?.passwordHash != null
        ? await cryptoService.verifyPassword(user.passwordHash, input.password)
        : await this.consumeDummyPassword(input.password);

    const hasPlatformAssignment = user?.roleAssignments.length
      ? user.roleAssignments.length > 0
      : false;
    const hasTenantMembership = user?.memberships.length
      ? user.memberships.length > 0
      : false;

    if (
      !user ||
      !passwordValid ||
      (tenant
        ? !hasTenantMembership && !hasPlatformAssignment
        : !hasPlatformAssignment) ||
      user.status === "DISABLED" ||
      user.status === "INVITED"
    ) {
      if (user) await this.registerFailedLogin(user, tenant?.id ?? null, context);
      throw new AuthenticationError("Invalid credentials.");
    }

    if (user.lockedUntil && user.lockedUntil > now) {
      throw new AuthenticationError("Account is temporarily locked.");
    }
    if (user.status === "LOCKED" && (!user.lockedUntil || user.lockedUntil <= now)) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          status: "ACTIVE",
          failedLoginCount: 0,
          lockedUntil: null,
          rowVersion: { increment: 1 }
        }
      });
    }

    const methods = ["pwd"];
    if (user.mfaEnabled) {
      if (!input.mfaCode) {
        throw new AuthenticationError("MFA code is required.");
      }
      if (
        !user.mfaSecretEncrypted ||
        !authenticator.check(
          input.mfaCode,
          cryptoService.decrypt(user.mfaSecretEncrypted)
        )
      ) {
        await this.registerFailedLogin(user, tenant?.id ?? null, context);
        throw new AuthenticationError("Invalid credentials.");
      }
      methods.push("otp");
    }

    return prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          failedLoginCount: 0,
          lockedUntil: null,
          status: "ACTIVE",
          lastLoginAt: now,
          rowVersion: { increment: 1 }
        }
      });
      const tokens = await this.createSessionAndTokens(
        tx,
        tenant?.id ?? null,
        user.id,
        methods,
        client
      );
      await auditService.record(tx, {
        tenantId: tenant?.id ?? null,
        actorUserId: user.id,
        effectiveUserId: user.id,
        action: "auth.login",
        entityType: "auth_session",
        result: "SUCCESS",
        context
      });
      return tokens;
    });
  }

  async refresh(
    refreshToken: string,
    client: ClientMetadata,
    context: RequestContext
  ): Promise<AuthTokens> {
    const tokenHash = cryptoService.hashToken(refreshToken);
    const legacyTokenHash = cryptoService.legacyHashToken(refreshToken);
    const existing = await prisma.authSession.findFirst({
      where: {
        OR: [
          { refreshTokenHash: tokenHash },
          ...(legacyTokenHash === tokenHash
            ? []
            : [{ refreshTokenHash: legacyTokenHash }])
        ]
      },
      include: {
        user: true,
        tenant: true
      }
    });

    if (!existing) {
      throw new AuthenticationError("Refresh token is invalid.");
    }

    if (existing.revokedAt) {
      await prisma.authSession.updateMany({
        where: {
          refreshTokenFamily: existing.refreshTokenFamily,
          revokedAt: null
        },
        data: {
          revokedAt: new Date(),
          revocationReason: "REFRESH_TOKEN_REUSE"
        }
      });
      throw new AuthenticationError("Refresh token reuse was detected.");
    }

    if (
      existing.expiresAt <= new Date() ||
      existing.user.status !== "ACTIVE" ||
      existing.user.deletedAt ||
      (existing.tenant &&
        (existing.tenant.status !== "ACTIVE" || existing.tenant.deletedAt)) ||
      !(await this.canAccessTenant(
        prisma,
        existing.userId,
        existing.tenantId
      ))
    ) {
      throw new AuthenticationError("Refresh session is no longer active.");
    }

    return prisma.$transaction(async (tx) => {
      const tokens = await this.createSessionAndTokens(
        tx,
        existing.tenantId,
        existing.userId,
        existing.authenticationMethods,
        client,
        existing.refreshTokenFamily
      );
      const replacementHash = cryptoService.hashToken(tokens.refreshToken);
      const replacement = await tx.authSession.findFirstOrThrow({
        where: { refreshTokenHash: replacementHash }
      });
      await tx.authSession.update({
        where: { id: existing.id },
        data: {
          revokedAt: new Date(),
          revocationReason: "USER_REQUEST",
          replacedBySessionId: replacement.id
        }
      });
      await auditService.record(tx, {
        tenantId: existing.tenantId,
        actorUserId: existing.userId,
        effectiveUserId: existing.userId,
        action: "auth.refresh",
        entityType: "auth_session",
        entityId: replacement.id,
        result: "SUCCESS",
        context
      });
      return tokens;
    });
  }

  async logout(
    userId: string,
    tenantId: string | null,
    sessionId: string,
    allSessions: boolean,
    context: RequestContext
  ): Promise<void> {
    await prisma.$transaction(async (tx) => {
      await tx.authSession.updateMany({
        where: {
          tenantId,
          userId,
          revokedAt: null,
          ...(allSessions ? {} : { id: sessionId })
        },
        data: {
          revokedAt: new Date(),
          revocationReason: "LOGOUT"
        }
      });
      await auditService.record(tx, {
        tenantId,
        actorUserId: userId,
        effectiveUserId: userId,
        action: allSessions ? "auth.logout_all" : "auth.logout",
        entityType: "auth_session",
        entityId: sessionId,
        result: "SUCCESS",
        context
      });
    });
  }

  async forgotPassword(
    input: ForgotPasswordInput,
    context: RequestContext
  ): Promise<void> {
    const tenant = await prisma.tenant.findFirst({
      where: {
        code: { equals: input.tenant, mode: "insensitive" },
        status: "ACTIVE",
        deletedAt: null
      }
    });
    if (!tenant) return;

    const user = await prisma.user.findFirst({
      where: {
        email: { equals: input.email, mode: "insensitive" },
        status: "ACTIVE",
        deletedAt: null,
        memberships: {
          some: {
            tenantId: tenant.id,
            status: "ACTIVE",
            deletedAt: null
          }
        }
      }
    });
    if (!user) return;

    const rawToken = cryptoService.randomToken();
    const expiresAt = addMinutes(new Date(), env.PASSWORD_RESET_TTL_MINUTES);
    await prisma.$transaction(async (tx) => {
      await tx.passwordResetToken.deleteMany({
        where: { tenantId: tenant.id, userId: user.id, usedAt: null }
      });
      await tx.passwordResetToken.create({
        data: {
          tenantId: tenant.id,
          userId: user.id,
          tokenHash: cryptoService.hashToken(rawToken),
          expiresAt
        }
      });
      await auditService.record(tx, {
        tenantId: tenant.id,
        actorUserId: user.id,
        action: "auth.password_reset_requested",
        entityType: "user",
        entityId: user.id,
        result: "SUCCESS",
        context
      });
    });
    await passwordResetNotifier.send({
      email: user.email,
      tenantName: tenant.name,
      resetToken: rawToken,
      expiresAt
    });
  }

  async resetPassword(
    input: ResetPasswordInput,
    context: RequestContext
  ): Promise<void> {
    const record = await prisma.passwordResetToken.findUnique({
      where: { tokenHash: cryptoService.hashToken(input.token) },
      include: { user: true }
    });
    if (!record || record.usedAt || record.expiresAt <= new Date()) {
      throw new AuthenticationError("Password reset token is invalid or expired.");
    }
    const passwordHash = await cryptoService.hashPassword(input.newPassword);
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: record.userId },
        data: {
          passwordHash,
          failedLoginCount: 0,
          lockedUntil: null,
          status: "ACTIVE",
          rowVersion: { increment: 1 }
        }
      });
      await tx.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() }
      });
      await this.revokeUserSessions(tx, record.tenantId, record.userId);
      await auditService.record(tx, {
        tenantId: record.tenantId,
        actorUserId: record.userId,
        action: "auth.password_reset_completed",
        entityType: "user",
        entityId: record.userId,
        result: "SUCCESS",
        context
      });
    });
  }

  async changePassword(
    tenantId: string | null,
    userId: string,
    currentSessionId: string,
    input: ChangePasswordInput,
    context: RequestContext
  ): Promise<void> {
    const user = await prisma.user.findFirst({
      where: { id: userId, status: "ACTIVE", deletedAt: null }
    });
    if (
      !user?.passwordHash ||
      !(await cryptoService.verifyPassword(user.passwordHash, input.currentPassword))
    ) {
      throw new AuthenticationError("Current password is incorrect.");
    }
    const passwordHash = await cryptoService.hashPassword(input.newPassword);
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { passwordHash, rowVersion: { increment: 1 } }
      });
      await tx.authSession.updateMany({
        where: {
          tenantId,
          userId,
          id: { not: currentSessionId },
          revokedAt: null
        },
        data: {
          revokedAt: new Date(),
          revocationReason: "PASSWORD_CHANGED"
        }
      });
      await auditService.record(tx, {
        tenantId,
        actorUserId: userId,
        effectiveUserId: userId,
        action: "auth.password_changed",
        entityType: "user",
        entityId: userId,
        result: "SUCCESS",
        context
      });
    });
  }

  async getCurrentUser(tenantId: string | null, userId: string) {
    const now = new Date();
    const user = await prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        status: true,
        emailVerifiedAt: true,
        lastLoginAt: true,
        mfaEnabled: true,
        preferences: true,
        memberships: {
          where: {
            deletedAt: null,
            ...(tenantId ? { tenantId } : {})
          },
          select: {
            tenantId: true,
            status: true,
            tenant: { select: { code: true, name: true, status: true } }
          }
        },
        roleAssignments: {
          where: {
            deletedAt: null,
            validFrom: { lte: now },
            OR: [{ validUntil: null }, { validUntil: { gt: now } }],
            AND: [
              {
                OR: [
                  { scopeType: "PLATFORM", tenantId: null },
                  ...(tenantId ? [{ tenantId }] : [])
                ]
              }
            ]
          },
          select: {
            tenantId: true,
            organizationId: true,
            organization: { select: { id: true, code: true, name: true } },
            scopeType: true,
            includeDescendants: true,
            validFrom: true,
            validUntil: true,
            role: {
              select: {
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
    if (!user) throw new NotFoundError("User");
    return user;
  }

  async listSessions(
    tenantId: string | null,
    userId: string,
    cursor: string | undefined,
    limit: number,
    currentSessionId: string
  ) {
    const sessions = await prisma.authSession.findMany({
      where: { tenantId, userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        userAgent: true,
        ipAddress: true,
        authenticationMethods: true,
        createdAt: true,
        lastUsedAt: true,
        expiresAt: true
      }
    });
    const hasMore = sessions.length > limit;
    const data = hasMore ? sessions.slice(0, limit) : sessions;
    return {
      data: data.map((session) => ({
        ...session,
        isCurrent: session.id === currentSessionId
      })),
      meta: {
        pageSize: limit,
        nextCursor: hasMore ? data.at(-1)?.id ?? null : null,
        hasMore
      }
    };
  }

  async revokeSession(
    tenantId: string | null,
    userId: string,
    sessionId: string,
    context: RequestContext
  ): Promise<void> {
    const result = await prisma.$transaction(async (tx) => {
      const update = await tx.authSession.updateMany({
        where: { id: sessionId, tenantId, userId, revokedAt: null },
        data: {
          revokedAt: new Date(),
          revocationReason: "USER_REQUEST"
        }
      });
      if (update.count > 0) {
        await auditService.record(tx, {
          tenantId,
          actorUserId: userId,
          effectiveUserId: userId,
          action: "auth.session_revoked",
          entityType: "auth_session",
          entityId: sessionId,
          result: "SUCCESS",
          context
        });
      }
      return update;
    });
    if (result.count === 0) throw new NotFoundError("Session");
  }

  async setupMfa(tenantId: string | null, userId: string) {
    const user = await prisma.user.findFirst({
      where: { id: userId, status: "ACTIVE", deletedAt: null }
    });
    if (!user) throw new NotFoundError("User");
    if (user.mfaEnabled) {
      throw new ConflictError("MFA_ALREADY_ENABLED", "MFA is already enabled.");
    }
    const secret = authenticator.generateSecret();
    const tenant = tenantId
      ? await prisma.tenant.findUnique({ where: { id: tenantId } })
      : null;
    await prisma.user.update({
      where: { id: userId },
      data: {
        mfaSecretEncrypted: cryptoService.encrypt(secret),
        rowVersion: { increment: 1 }
      }
    });
    return {
      secret,
      otpauthUri: authenticator.keyuri(
        `${user.email}:${tenant?.code ?? "platform"}`,
        env.MFA_ISSUER,
        secret
      )
    };
  }

  async confirmMfa(
    tenantId: string | null,
    userId: string,
    code: string,
    context: RequestContext
  ): Promise<void> {
    const user = await prisma.user.findFirst({
      where: { id: userId, status: "ACTIVE", deletedAt: null }
    });
    if (!user?.mfaSecretEncrypted) {
      throw new ConflictError("MFA_SETUP_REQUIRED", "Start MFA setup first.");
    }
    if (
      !authenticator.check(code, cryptoService.decrypt(user.mfaSecretEncrypted))
    ) {
      throw new AuthenticationError("MFA code is invalid.");
    }
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { mfaEnabled: true, rowVersion: { increment: 1 } }
      });
      await auditService.record(tx, {
        tenantId,
        actorUserId: userId,
        effectiveUserId: userId,
        action: "auth.mfa_enabled",
        entityType: "user",
        entityId: userId,
        result: "SUCCESS",
        context
      });
    });
  }

  async disableMfa(
    tenantId: string | null,
    userId: string,
    password: string,
    code: string,
    context: RequestContext
  ): Promise<void> {
    const user = await prisma.user.findFirst({
      where: { id: userId, status: "ACTIVE", deletedAt: null }
    });
    if (
      !user?.passwordHash ||
      !user.mfaEnabled ||
      !user.mfaSecretEncrypted ||
      !(await cryptoService.verifyPassword(user.passwordHash, password)) ||
      !authenticator.check(code, cryptoService.decrypt(user.mfaSecretEncrypted))
    ) {
      throw new AuthenticationError("MFA verification failed.");
    }
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          mfaEnabled: false,
          mfaSecretEncrypted: null,
          rowVersion: { increment: 1 }
        }
      });
      await auditService.record(tx, {
        tenantId,
        actorUserId: userId,
        effectiveUserId: userId,
        action: "auth.mfa_disabled",
        entityType: "user",
        entityId: userId,
        result: "SUCCESS",
        context
      });
    });
  }

  private async createSessionAndTokens(
    db: DatabaseClient,
    tenantId: string | null,
    userId: string,
    methods: string[],
    client: ClientMetadata,
    family: string = randomUUID()
  ): Promise<AuthTokens> {
    const refreshToken = cryptoService.randomToken();
    const session = await db.authSession.create({
      data: {
        tenantId,
        userId,
        refreshTokenHash: cryptoService.hashToken(refreshToken),
        refreshTokenFamily: family,
        authenticationMethods: methods,
        expiresAt: addDays(new Date(), env.REFRESH_TOKEN_TTL_DAYS),
        ipAddress: client.ipAddress ?? null,
        userAgent: client.userAgent ?? null
      }
    });
    const profile = await this.getAccessProfile(db, tenantId, userId);
    const accessToken = await tokenService.signAccessToken({
      sub: userId,
      tenant_id: tenantId,
      session_id: session.id,
      role_ids: profile.roleIds,
      roles: profile.roleCodes,
      role_names: profile.roleNames,
      permissions: profile.permissions,
      is_platform_admin: profile.isPlatformAdmin,
      amr: methods
    });
    return tokenService.response(accessToken, refreshToken);
  }

  private async getAccessProfile(
    db: DatabaseClient,
    tenantId: string | null,
    userId: string
  ): Promise<{
    roleIds: string[];
    roleCodes: string[];
    roleNames: string[];
    permissions: string[];
    isPlatformAdmin: boolean;
  }> {
    const now = new Date();
    const assignments = await db.roleAssignment.findMany({
      where: {
        userId,
        deletedAt: null,
        validFrom: { lte: now },
        OR: [{ validUntil: null }, { validUntil: { gt: now } }],
        AND: [
          {
            OR: [
              { scopeType: "PLATFORM", tenantId: null },
              ...(tenantId ? [{ tenantId }] : [])
            ]
          }
        ],
        role: { deletedAt: null }
      },
      select: {
        scopeType: true,
        role: {
          select: {
            id: true,
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
    });
    return {
      roleIds: [...new Set(assignments.map((assignment) => assignment.role.id))],
      roleCodes: [
        ...new Set(assignments.map((assignment) => assignment.role.code))
      ],
      roleNames: [
        ...new Set(assignments.map((assignment) => assignment.role.name))
      ],
      permissions: [
        ...new Set(
          assignments.flatMap((assignment) =>
            assignment.role.permissions.map(
              (rolePermission) => rolePermission.permission.code
            )
          )
        )
      ],
      isPlatformAdmin: assignments.some(
        (assignment) =>
          assignment.scopeType === "PLATFORM" &&
          assignment.role.roleType === "PLATFORM"
      )
    };
  }

  private async registerFailedLogin(
    user: User,
    tenantId: string | null,
    context: RequestContext
  ): Promise<void> {
    const attempts = user.failedLoginCount + 1;
    const locked = attempts >= MAX_FAILED_ATTEMPTS;
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          failedLoginCount: attempts,
          ...(locked
            ? {
                status: "LOCKED",
                lockedUntil: addMinutes(new Date(), LOCK_MINUTES)
              }
            : {}),
          rowVersion: { increment: 1 }
        }
      });
      await auditService.record(tx, {
        tenantId,
        actorUserId: user.id,
        action: "auth.login_failed",
        entityType: "user",
        entityId: user.id,
        result: "FAILURE",
        reason: locked ? "ACCOUNT_LOCKED" : "INVALID_CREDENTIALS",
        metadata: { failedAttempts: attempts },
        context
      });
    });
  }

  private async consumeDummyPassword(password: string): Promise<boolean> {
    return cryptoService.verifyPassword(await dummyPasswordHash, password);
  }

  private revokeUserSessions(
    db: DatabaseClient,
    tenantId: string | null,
    userId: string
  ) {
    return db.authSession.updateMany({
      where: { tenantId, userId, revokedAt: null },
      data: {
        revokedAt: new Date(),
        revocationReason: "PASSWORD_CHANGED"
      }
    });
  }

  private async canAccessTenant(
    db: DatabaseClient,
    userId: string,
    tenantId: string | null
  ): Promise<boolean> {
    const now = new Date();
    const platformAssignment = await db.roleAssignment.findFirst({
      where: {
        userId,
        scopeType: "PLATFORM",
        tenantId: null,
        deletedAt: null,
        validFrom: { lte: now },
        OR: [{ validUntil: null }, { validUntil: { gt: now } }],
        role: { roleType: "PLATFORM", deletedAt: null }
      },
      select: { id: true }
    });
    if (platformAssignment) return true;
    if (!tenantId) return false;
    const membership = await db.tenantMembership.findFirst({
      where: {
        userId,
        tenantId,
        status: "ACTIVE",
        deletedAt: null,
        tenant: { status: "ACTIVE", deletedAt: null }
      },
      select: { id: true }
    });
    return Boolean(membership);
  }
}

function addMinutes(value: Date, minutes: number): Date {
  return new Date(value.getTime() + minutes * 60_000);
}

function addDays(value: Date, days: number): Date {
  return new Date(value.getTime() + days * 86_400_000);
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

export const authService = new AuthService();
