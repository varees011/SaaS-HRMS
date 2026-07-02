import { beforeAll, describe, expect, it } from "vitest";

beforeAll(() => {
  process.env.JWT_ACCESS_SECRET ??= "01234567890123456789012345678901";
  process.env.MFA_ENCRYPTION_KEY ??=
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
});

describe("authentication cryptography", () => {
  it("hashes and verifies passwords without storing plaintext", async () => {
    const { cryptoService } = await import(
      "../../src/modules/auth/crypto.service.js"
    );
    const password = "Strong-Password-123!";
    const hash = await cryptoService.hashPassword(password);

    expect(hash).not.toContain(password);
    await expect(cryptoService.verifyPassword(hash, password)).resolves.toBe(
      true
    );
    await expect(
      cryptoService.verifyPassword(hash, "Wrong-Password-123!")
    ).resolves.toBe(false);
  });

  it("encrypts and decrypts MFA secrets", async () => {
    const { cryptoService } = await import(
      "../../src/modules/auth/crypto.service.js"
    );
    const secret = "JBSWY3DPEHPK3PXP";
    const encrypted = cryptoService.encrypt(secret);

    expect(encrypted).not.toContain(secret);
    expect(cryptoService.decrypt(encrypted)).toBe(secret);
  });

  it("creates stable token hashes", async () => {
    const { cryptoService } = await import(
      "../../src/modules/auth/crypto.service.js"
    );
    expect(cryptoService.hashToken("token")).toBe(
      cryptoService.hashToken("token")
    );
    expect(cryptoService.hashToken("token")).not.toBe(
      cryptoService.hashToken("other-token")
    );
  });

  it("generates fixed-width numeric OTP codes", async () => {
    const { cryptoService } = await import(
      "../../src/modules/auth/crypto.service.js"
    );
    const code = cryptoService.randomNumericCode();

    expect(code).toMatch(/^\d{6}$/);
  });
});
