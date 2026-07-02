import "dotenv/config";
import { z } from "zod";

const booleanFromString = z
  .enum(["true", "false"])
  .default("false")
  .transform((value) => value === "true");

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().positive().default(3000),
    DATABASE_URL: z.string().min(1),
    JWT_ACCESS_SECRET: z.string().min(32),
    JWT_REFRESH_SECRET: z.string().min(32).optional(),
    JWT_ISSUER: z.string().min(1).default("saas-hrms-api"),
    JWT_AUDIENCE: z.string().min(1).default("saas-hrms-web"),
    JWT_ACCESS_EXPIRY: z.string().optional(),
    JWT_REFRESH_EXPIRY: z.string().optional(),
    ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).optional(),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(90).optional(),
    PASSWORD_RESET_TTL_MINUTES: z.coerce.number().int().min(5).max(120).default(30),
    MFA_ISSUER: z.string().min(1).default("SaaS HRMS"),
    MFA_ENCRYPTION_KEY: z.string().length(64),
    AUTH_COOKIE_SECURE: booleanFromString,
    CORS_ORIGINS: z.string().default("http://localhost:5173"),
    SMTP_HOST: z.string().trim().optional(),
    SMTP_PORT: z.coerce.number().int().positive().optional(),
    SMTP_SECURE: booleanFromString.optional(),
    SMTP_USER: z.string().trim().optional(),
    SMTP_PASS: z.string().optional(),
    SMTP_FROM_EMAIL: z.string().trim().email().optional(),
    SMTP_FROM_NAME: z.string().trim().default("VentureSoft HRMS")
  })
  .superRefine((value, context) => {
    if (value.NODE_ENV === "production" && !value.JWT_REFRESH_SECRET) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["JWT_REFRESH_SECRET"],
        message: "JWT_REFRESH_SECRET is required in production."
      });
    }
    const hasAnySmtp = Boolean(
      value.SMTP_HOST ||
        value.SMTP_PORT ||
        value.SMTP_USER ||
        value.SMTP_PASS ||
        value.SMTP_FROM_EMAIL
    );
    if (hasAnySmtp) {
      for (const key of ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "SMTP_FROM_EMAIL"] as const) {
        if (!value[key]) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: [key],
            message: `${key} is required when SMTP email delivery is configured.`
          });
        }
      }
    }
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  throw new Error(`Invalid environment configuration: ${parsed.error.message}`);
}

const accessTokenTtlSeconds = resolveAccessTokenTtlSeconds(parsed.data);
const refreshTokenTtlDays = resolveRefreshTokenTtlDays(parsed.data);

export const env = {
  ...parsed.data,
  ACCESS_TOKEN_TTL_SECONDS: accessTokenTtlSeconds,
  REFRESH_TOKEN_TTL_DAYS: refreshTokenTtlDays,
  corsOrigins: parsed.data.CORS_ORIGINS.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
};

function resolveAccessTokenTtlSeconds(input: {
  JWT_ACCESS_EXPIRY?: string | undefined;
  ACCESS_TOKEN_TTL_SECONDS?: number | undefined;
}): number {
  const value = input.JWT_ACCESS_EXPIRY
    ? parseDurationSeconds(input.JWT_ACCESS_EXPIRY, "JWT_ACCESS_EXPIRY")
    : input.ACCESS_TOKEN_TTL_SECONDS ?? 900;
  if (value < 60 || value > 3600) {
    throw new Error("JWT_ACCESS_EXPIRY must resolve to 60-3600 seconds.");
  }
  return value;
}

function resolveRefreshTokenTtlDays(input: {
  JWT_REFRESH_EXPIRY?: string | undefined;
  REFRESH_TOKEN_TTL_DAYS?: number | undefined;
}): number {
  const value = input.JWT_REFRESH_EXPIRY
    ? parseDurationDays(input.JWT_REFRESH_EXPIRY, "JWT_REFRESH_EXPIRY")
    : input.REFRESH_TOKEN_TTL_DAYS ?? 30;
  if (value < 1 || value > 90) {
    throw new Error("JWT_REFRESH_EXPIRY must resolve to 1-90 days.");
  }
  return value;
}

function parseDurationSeconds(value: string, variableName: string): number {
  const match = value.trim().match(/^(\d+)(s|m|h)?$/i);
  if (!match) {
    throw new Error(`${variableName} must be a duration such as 900s, 15m, or 1h.`);
  }
  const amount = Number(match[1]);
  const unit = match[2]?.toLowerCase() ?? "s";
  const multiplier = unit === "h" ? 3600 : unit === "m" ? 60 : 1;
  return amount * multiplier;
}

function parseDurationDays(value: string, variableName: string): number {
  const match = value.trim().match(/^(\d+)(d|h)?$/i);
  if (!match) {
    throw new Error(`${variableName} must be a duration such as 30d or 720h.`);
  }
  const amount = Number(match[1]);
  const unit = match[2]?.toLowerCase() ?? "d";
  const days = unit === "h" ? amount / 24 : amount;
  if (!Number.isInteger(days)) {
    throw new Error(`${variableName} must resolve to whole days.`);
  }
  return days;
}
