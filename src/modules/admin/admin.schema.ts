import { z } from "zod";

const uuid = z.string().uuid();
const organizationTypes = [
  "legal_entity",
  "company",
  "division",
  "department",
  "branch",
  "team"
] as const;

const strongPassword = z
  .string()
  .min(12)
  .max(128)
  .regex(/[a-z]/)
  .regex(/[A-Z]/)
  .regex(/[0-9]/)
  .regex(/[^A-Za-z0-9]/);

export const idParamsSchema = z.object({ id: uuid });

export const adminListQuerySchema = z.object({
  cursor: uuid.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  tenantId: uuid.optional(),
  departmentId: uuid.optional(),
  search: z.string().trim().max(200).optional(),
  role: z.enum(["employee", "manager"]).optional(),
  organizationType: z.enum(organizationTypes).optional(),
  status: z.string().trim().max(30).optional(),
  sort: z
    .enum(["name", "-name", "createdAt", "-createdAt"])
    .default("-createdAt")
});

export const createTenantSchema = z.object({
  code: z.string().trim().min(2).max(50).regex(/^[a-z0-9-]+$/i),
  name: z.string().trim().min(2).max(200),
  defaultTimezone: z.string().trim().min(1).max(64).default("UTC"),
  defaultLocale: z.string().trim().min(2).max(16).default("en")
});

export const updateTenantSchema = z
  .object({
    name: z.string().trim().min(2).max(200).optional(),
    status: z.enum(["ACTIVE", "SUSPENDED", "CLOSED"]).optional(),
    defaultTimezone: z.string().trim().min(1).max(64).optional(),
    defaultLocale: z.string().trim().min(2).max(16).optional()
  })
  .refine((value) => Object.keys(value).length > 0, "No changes supplied.");

export const createOrganizationSchema = z.object({
  tenantId: uuid,
  parentId: uuid.nullable().optional(),
  managerUserId: uuid.nullable().optional(),
  code: z.string().trim().min(1).max(50),
  name: z.string().trim().min(2).max(200),
  organizationType: z.enum(organizationTypes),
  legalName: z.string().trim().max(250).nullable().optional(),
  registrationNumber: z.string().trim().max(100).nullable().optional(),
  email: z.string().trim().email().max(320).nullable().optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  timezone: z.string().trim().min(1).max(64).default("UTC"),
  countryCode: z.string().trim().length(2).toUpperCase().nullable().optional()
});

export const updateOrganizationSchema = createOrganizationSchema
  .omit({ tenantId: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0, "No changes supplied.");

export const createUserSchema = z.object({
  tenantId: uuid,
  email: z.string().trim().email().max(320),
  username: z.string().trim().min(3).max(100).nullable().optional(),
  password: strongPassword,
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  status: z.enum(["INVITED", "ACTIVE", "LOCKED", "DISABLED"]).default("ACTIVE"),
  roleId: uuid,
  departmentId: uuid.optional(),
  organizationId: uuid.nullable().optional()
});

export const updateUserSchema = z
  .object({
    email: z.string().trim().email().max(320).optional(),
    username: z.string().trim().min(3).max(100).nullable().optional(),
    password: strongPassword.optional(),
    firstName: z.string().trim().min(1).max(100).optional(),
    lastName: z.string().trim().min(1).max(100).optional(),
    status: z.enum(["INVITED", "ACTIVE", "LOCKED", "DISABLED"]).optional(),
    roleId: uuid.optional(),
    departmentId: uuid.optional(),
    organizationId: uuid.nullable().optional()
  })
  .refine((value) => Object.keys(value).length > 0, "No changes supplied.");

export const createRoleSchema = z.object({
  tenantId: uuid,
  code: z.string().trim().min(2).max(80).regex(/^[A-Z0-9_]+$/),
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(1000).nullable().optional(),
  roleType: z.enum(["TENANT", "ORGANIZATION", "MANAGER", "SELF"]).default("ORGANIZATION"),
  permissionIds: z.array(uuid).min(1)
});

export const updateRoleSchema = z
  .object({
    name: z.string().trim().min(2).max(100).optional(),
    description: z.string().trim().max(1000).nullable().optional(),
    roleType: z.enum(["TENANT", "ORGANIZATION", "MANAGER", "SELF"]).optional(),
    permissionIds: z.array(uuid).min(1).optional()
  })
  .refine((value) => Object.keys(value).length > 0, "No changes supplied.");
