import { SignJWT, jwtVerify } from "jose";
import { env } from "../../config/env.js";
import { AuthenticationError } from "../../shared/errors/app-error.js";
import type { AccessTokenClaims, AuthTokens } from "./auth.types.js";

const secret = new TextEncoder().encode(env.JWT_ACCESS_SECRET);

export class TokenService {
  async signAccessToken(claims: AccessTokenClaims): Promise<string> {
    return new SignJWT({
      tenant_id: claims.tenant_id,
      session_id: claims.session_id,
      role_ids: claims.role_ids,
      roles: claims.roles,
      role_names: claims.role_names,
      permissions: claims.permissions,
      is_platform_admin: claims.is_platform_admin,
      amr: claims.amr
    })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setSubject(claims.sub)
      .setIssuer(env.JWT_ISSUER)
      .setAudience(env.JWT_AUDIENCE)
      .setIssuedAt()
      .setExpirationTime(`${env.ACCESS_TOKEN_TTL_SECONDS}s`)
      .setJti(crypto.randomUUID())
      .sign(secret);
  }

  async verifyAccessToken(token: string): Promise<AccessTokenClaims> {
    try {
      const { payload } = await jwtVerify(token, secret, {
        issuer: env.JWT_ISSUER,
        audience: env.JWT_AUDIENCE,
        algorithms: ["HS256"]
      });
      if (
        !payload.sub ||
        (payload.tenant_id !== null &&
          typeof payload.tenant_id !== "string") ||
        typeof payload.session_id !== "string" ||
        !Array.isArray(payload.role_ids) ||
        !Array.isArray(payload.roles) ||
        !Array.isArray(payload.role_names) ||
        !Array.isArray(payload.permissions) ||
        typeof payload.is_platform_admin !== "boolean" ||
        !Array.isArray(payload.amr)
      ) {
        throw new AuthenticationError("Access token claims are invalid.");
      }
      return {
        sub: payload.sub,
        tenant_id: payload.tenant_id ?? null,
        session_id: payload.session_id,
        role_ids: payload.role_ids.filter(
          (roleId): roleId is string => typeof roleId === "string"
        ),
        roles: payload.roles.filter(
          (role): role is string => typeof role === "string"
        ),
        role_names: payload.role_names.filter(
          (roleName): roleName is string => typeof roleName === "string"
        ),
        permissions: payload.permissions.filter(
          (permission): permission is string => typeof permission === "string"
        ),
        is_platform_admin: payload.is_platform_admin,
        amr: payload.amr.filter(
          (method): method is string => typeof method === "string"
        )
      };
    } catch {
      throw new AuthenticationError("Access token is invalid or expired.");
    }
  }

  response(accessToken: string, refreshToken: string): AuthTokens {
    return {
      accessToken,
      refreshToken,
      tokenType: "Bearer",
      expiresIn: env.ACCESS_TOKEN_TTL_SECONDS
    };
  }
}

export const tokenService = new TokenService();
