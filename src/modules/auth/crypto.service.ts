import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  randomInt,
  timingSafeEqual
} from "node:crypto";
import argon2 from "argon2";
import { env } from "../../core/config.js";

const encryptionKey = Buffer.from(env.MFA_ENCRYPTION_KEY, "hex");
if (encryptionKey.length !== 32) {
  throw new Error("MFA_ENCRYPTION_KEY must be a 32-byte hexadecimal key.");
}
const refreshTokenHashSecret = env.JWT_REFRESH_SECRET ?? env.JWT_ACCESS_SECRET;

export const cryptoService = {
  hashPassword(password: string): Promise<string> {
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 65_536,
      timeCost: 3,
      parallelism: 1
    });
  },

  verifyPassword(hash: string, password: string): Promise<boolean> {
    return argon2.verify(hash, password);
  },

  randomToken(bytes = 48): string {
    return randomBytes(bytes).toString("base64url");
  },

  // Generates a fixed-width numeric OTP with Node's cryptographically secure RNG.
  randomNumericCode(length = 6): string {
    const upperBound = 10 ** length;
    return randomInt(0, upperBound).toString().padStart(length, "0");
  },

  hashToken(token: string): string {
    return createHmac("sha256", refreshTokenHashSecret).update(token).digest("hex");
  },

  legacyHashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  },

  safeEqual(left: string, right: string): boolean {
    const a = Buffer.from(left);
    const b = Buffer.from(right);
    return a.length === b.length && timingSafeEqual(a, b);
  },

  encrypt(value: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", encryptionKey, iv);
    const encrypted = Buffer.concat([
      cipher.update(value, "utf8"),
      cipher.final()
    ]);
    const tag = cipher.getAuthTag();
    return [iv, tag, encrypted].map((part) => part.toString("base64url")).join(".");
  },

  decrypt(payload: string): string {
    const [ivValue, tagValue, encryptedValue] = payload.split(".");
    if (!ivValue || !tagValue || !encryptedValue) {
      throw new Error("Invalid encrypted payload.");
    }
    const decipher = createDecipheriv(
      "aes-256-gcm",
      encryptionKey,
      Buffer.from(ivValue, "base64url")
    );
    decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(encryptedValue, "base64url")),
      decipher.final()
    ]).toString("utf8");
  }
};
