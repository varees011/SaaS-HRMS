import type { Request, Response } from "express";
import { env } from "../../core/config.js";
import { AuthenticationError } from "../../core/errors.js";
import { authService } from "./auth.service.js";

const REFRESH_COOKIE = "hrms_refresh_token";

export class AuthController {
  async tenants(_req: Request, res: Response): Promise<void> {
    res.status(200).json({ data: await authService.listLoginTenants() });
  }

  async login(req: Request, res: Response): Promise<void> {
    const result = await authService.login(
      req.body,
      clientMetadata(req),
      req.context
    );
    if (result.otpRequired) {
      res.status(200).json({ data: result });
      return;
    }
    const tokens = result.tokens;
    setRefreshCookie(res, tokens.refreshToken);
    res.status(200).json({ data: publicTokens(tokens) });
  }

  async verifyEmailOtp(req: Request, res: Response): Promise<void> {
    const tokens = await authService.verifyEmailOtp(
      req.body,
      clientMetadata(req),
      req.context
    );
    setRefreshCookie(res, tokens.refreshToken);
    res.status(200).json({ data: publicTokens(tokens) });
  }

  async resendEmailOtp(req: Request, res: Response): Promise<void> {
    const result = await authService.resendEmailOtp(req.body, req.context);
    res.status(200).json({ data: result });
  }

  async refresh(req: Request, res: Response): Promise<void> {
    const refreshToken =
      req.body.refreshToken ?? req.cookies?.[REFRESH_COOKIE];
    if (!refreshToken) {
      throw new AuthenticationError("Refresh token is required.");
    }
    const tokens = await authService.refresh(
      refreshToken,
      clientMetadata(req),
      req.context
    );
    setRefreshCookie(res, tokens.refreshToken);
    res.status(200).json({ data: publicTokens(tokens) });
  }

  async logout(req: Request, res: Response): Promise<void> {
    const auth = requireAuth(req);
    await authService.logout(
      auth.userId,
      auth.tenantId,
      auth.sessionId,
      req.body.allSessions,
      req.context
    );
    res.clearCookie(REFRESH_COOKIE, refreshCookieOptions());
    res.status(204).send();
  }

  async forgotPassword(req: Request, res: Response): Promise<void> {
    await authService.forgotPassword(req.body, req.context);
    res.status(202).json({
      data: {
        message:
          "If the account exists, password reset instructions will be sent."
      }
    });
  }

  async resetPassword(req: Request, res: Response): Promise<void> {
    await authService.resetPassword(req.body, req.context);
    res.clearCookie(REFRESH_COOKIE, refreshCookieOptions());
    res.status(204).send();
  }

  async changePassword(req: Request, res: Response): Promise<void> {
    const auth = requireAuth(req);
    await authService.changePassword(
      auth.tenantId,
      auth.userId,
      auth.sessionId,
      req.body,
      req.context
    );
    res.status(204).send();
  }

  async me(req: Request, res: Response): Promise<void> {
    const auth = requireAuth(req);
    const user = await authService.getCurrentUser(auth.tenantId, auth.userId);
    res.status(200).json({
      data: {
        ...user,
        tenantId: auth.tenantId,
        organizationId: activeOrganizationId(auth),
        roleId: auth.roleIds[0] ?? null,
        roleName: auth.roleNames[0] ?? null,
        roleIds: auth.roleIds,
        roleNames: auth.roleNames,
        roles: auth.roles,
        permissions: auth.permissions,
        authenticationMethods: auth.authenticationMethods,
        isSuperAdmin: auth.isSuperAdmin
      }
    });
  }

  async sessions(req: Request, res: Response): Promise<void> {
    const auth = requireAuth(req);
    const result = await authService.listSessions(
      auth.tenantId,
      auth.userId,
      req.query.cursor as string | undefined,
      Number(req.query.limit),
      auth.sessionId
    );
    res.status(200).json(result);
  }

  async revokeSession(req: Request, res: Response): Promise<void> {
    const auth = requireAuth(req);
    await authService.revokeSession(
      auth.tenantId,
      auth.userId,
      String(req.params.id),
      req.context
    );
    if (String(req.params.id) === auth.sessionId) {
      res.clearCookie(REFRESH_COOKIE, refreshCookieOptions());
    }
    res.status(204).send();
  }

  async setupMfa(req: Request, res: Response): Promise<void> {
    const auth = requireAuth(req);
    const setup = await authService.setupMfa(auth.tenantId, auth.userId);
    res.status(200).json({ data: setup });
  }

  async confirmMfa(req: Request, res: Response): Promise<void> {
    const auth = requireAuth(req);
    await authService.confirmMfa(
      auth.tenantId,
      auth.userId,
      req.body.code,
      req.context
    );
    res.status(204).send();
  }

  async disableMfa(req: Request, res: Response): Promise<void> {
    const auth = requireAuth(req);
    await authService.disableMfa(
      auth.tenantId,
      auth.userId,
      req.body.password,
      req.body.code,
      req.context
    );
    res.status(204).send();
  }
}

function requireAuth(req: Request) {
  if (!req.auth) throw new AuthenticationError();
  return req.auth;
}

function activeOrganizationId(auth: ReturnType<typeof requireAuth>) {
  return (
    auth.assignments.find(
      (assignment) =>
        assignment.tenantId === auth.tenantId && assignment.organizationId
    )?.organizationId ?? null
  );
}

function clientMetadata(req: Request) {
  return {
    ...(req.context.ipAddress ? { ipAddress: req.context.ipAddress } : {}),
    ...(req.context.userAgent ? { userAgent: req.context.userAgent } : {})
  };
}

function setRefreshCookie(res: Response, token: string): void {
  res.cookie(REFRESH_COOKIE, token, {
    ...refreshCookieOptions(),
    maxAge: env.REFRESH_TOKEN_TTL_DAYS * 86_400_000
  });
}

function refreshCookieOptions() {
  return {
    httpOnly: true,
    secure: env.AUTH_COOKIE_SECURE,
    sameSite: "strict" as const,
    path: "/api/v1/auth"
  };
}

function publicTokens(tokens: {
  accessToken: string;
  refreshToken: string;
  tokenType: "Bearer";
  expiresIn: number;
}) {
  return {
    accessToken: tokens.accessToken,
    tokenType: tokens.tokenType,
    expiresIn: tokens.expiresIn
  };
}

export const authController = new AuthController();
