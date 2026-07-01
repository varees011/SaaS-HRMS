import { describe, expect, it } from "vitest";
import {
  changePasswordSchema,
  loginSchema,
  resetPasswordSchema
} from "./auth.schema";

describe("authentication form validation", () => {
  it("accepts a valid login with an optional MFA code", () => {
    expect(
      loginSchema.safeParse({
        mode: "organization",
        tenant: "venturesoft",
        login: "employee@example.com",
        password: "Password-123!",
        mfaCode: "123456"
      }).success
    ).toBe(true);
  });

  it("rejects weak reset passwords", () => {
    expect(
      resetPasswordSchema.safeParse({
        newPassword: "weak",
        confirmPassword: "weak"
      }).success
    ).toBe(false);
  });

  it("rejects reuse of the current password", () => {
    expect(
      changePasswordSchema.safeParse({
        currentPassword: "Strong-Password-123!",
        newPassword: "Strong-Password-123!",
        confirmPassword: "Strong-Password-123!"
      }).success
    ).toBe(false);
  });
});
