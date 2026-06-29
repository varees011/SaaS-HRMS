import { z } from "zod";

const password = z
  .string()
  .min(12)
  .max(128)
  .regex(/[a-z]/, "Password must contain a lowercase letter.")
  .regex(/[A-Z]/, "Password must contain an uppercase letter.")
  .regex(/[0-9]/, "Password must contain a number.")
  .regex(/[^A-Za-z0-9]/, "Password must contain a special character.");

export const loginSchema = z.object({
  tenant: z.string().trim().max(200).optional(),
  login: z.string().trim().min(1).max(320),
  password: z.string().min(1).max(128),
  mfaCode: z.string().regex(/^\d{6}$/).optional()
});

export const refreshSchema = z.preprocess(
  (value) => value ?? {},
  z.object({
    refreshToken: z.string().min(32).optional()
  })
);

export const logoutSchema = z.object({
  refreshToken: z.string().min(32).optional(),
  allSessions: z.boolean().default(false)
});

export const forgotPasswordSchema = z.object({
  tenant: z.string().trim().min(1).max(200),
  email: z.string().trim().email().max(320)
});

export const resetPasswordSchema = z
  .object({
    token: z.string().min(32),
    newPassword: password,
    confirmPassword: z.string()
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match."
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1).max(128),
    newPassword: password,
    confirmPassword: z.string()
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match."
  })
  .refine((value) => value.currentPassword !== value.newPassword, {
    path: ["newPassword"],
    message: "New password must differ from the current password."
  });

export const mfaCodeSchema = z.object({
  code: z.string().regex(/^\d{6}$/)
});

export const disableMfaSchema = z.object({
  password: z.string().min(1).max(128),
  code: z.string().regex(/^\d{6}$/)
});

export const sessionParamsSchema = z.object({
  id: z.string().uuid()
});

export const sessionsQuerySchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25)
});

export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
