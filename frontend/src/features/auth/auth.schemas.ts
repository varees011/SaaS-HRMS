import { z } from "zod";

export const strongPassword = z
  .string()
  .min(12, "Use at least 12 characters.")
  .max(128)
  .regex(/[a-z]/, "Add a lowercase letter.")
  .regex(/[A-Z]/, "Add an uppercase letter.")
  .regex(/[0-9]/, "Add a number.")
  .regex(/[^A-Za-z0-9]/, "Add a special character.");

export const loginSchema = z.object({
  mode: z.enum(["platform", "organization"]),
  tenant: z.string().trim().max(200),
  login: z.string().trim().min(1, "Email or username is required.").max(320),
  password: z.string().min(1, "Password is required.").max(128),
  mfaCode: z
    .string()
    .refine((value) => value === "" || /^\d{6}$/.test(value), {
      message: "Enter a 6-digit code."
    })
}).superRefine((value, context) => {
  if (value.mode === "organization" && !value.tenant.trim()) {
    context.addIssue({
      code: "custom",
      path: ["tenant"],
      message: "Organization is required for organization users."
    });
  }
  if (value.mode === "platform" && !z.string().email().safeParse(value.login).success) {
    context.addIssue({
      code: "custom",
      path: ["login"],
      message: "Platform Super Admin login requires an email address."
    });
  }
});

export const forgotPasswordSchema = z.object({
  tenant: z.string().trim().min(1, "Tenant is required."),
  email: z.string().trim().email("Enter a valid email address.")
});

export const passwordFields = z
  .object({
    newPassword: strongPassword,
    confirmPassword: z.string().min(1, "Confirm your password.")
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match."
  });

export const resetPasswordSchema = passwordFields;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required."),
    newPassword: strongPassword,
    confirmPassword: z.string().min(1, "Confirm your password.")
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match."
  })
  .refine((value) => value.currentPassword !== value.newPassword, {
    path: ["newPassword"],
    message: "Use a password different from your current password."
  });

export const otpSchema = z.object({
  code: z.string().regex(/^\d{6}$/, "Enter a 6-digit code.")
});

export const disableMfaSchema = z.object({
  password: z.string().min(1, "Password is required."),
  code: z.string().regex(/^\d{6}$/, "Enter a 6-digit code.")
});
