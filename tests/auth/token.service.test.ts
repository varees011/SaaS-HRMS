import { beforeAll, describe, expect, it } from "vitest";

beforeAll(() => {
  process.env.JWT_ACCESS_SECRET ??= "01234567890123456789012345678901";
  process.env.MFA_ENCRYPTION_KEY ??=
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
});

describe("JWT access tokens", () => {
  it("round-trips required tenant and session claims", async () => {
    const { tokenService } = await import(
      "../../src/modules/auth/token.service.js"
    );
    const claims = {
      sub: "8bb7d31a-2c62-4ab0-8a8d-44b729ec981a",
      tenant_id: "8870b751-f97d-4daa-b2c4-d2d87728cebc",
      session_id: "68140ac9-b5fd-4f4e-b639-b601f55f845a",
      role_ids: ["bfa7bf72-6d8e-4283-a93b-638887c68170"],
      roles: ["EMPLOYEE"],
      role_names: ["Employee"],
      permissions: ["self.profile.read"],
      is_platform_admin: false,
      amr: ["pwd"]
    };

    const token = await tokenService.signAccessToken(claims);
    await expect(tokenService.verifyAccessToken(token)).resolves.toEqual(claims);
  });

  it("rejects malformed tokens", async () => {
    const { tokenService } = await import(
      "../../src/modules/auth/token.service.js"
    );
    await expect(tokenService.verifyAccessToken("invalid")).rejects.toMatchObject(
      { code: "AUTHENTICATION_REQUIRED", statusCode: 401 }
    );
  });
});
