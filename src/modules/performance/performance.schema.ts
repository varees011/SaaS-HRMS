import { z } from "zod";

const uuid = z.string().uuid();
const optionalText = z.string().trim().max(2000).nullable().optional();
const percent = z.coerce.number().min(0).max(100);
const score = z.coerce.number().min(0).max(5);
const date = z.coerce.date();

export const idParamsSchema = z.object({ id: uuid });
export const goalParamsSchema = z.object({ goalId: uuid });
export const kraParamsSchema = z.object({ kraId: uuid });

export const performanceListQuerySchema = z.object({
  cursor: uuid.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  tenantId: uuid.optional(),
  cycleId: uuid.optional(),
  organizationId: uuid.optional(),
  employeeUserId: uuid.optional(),
  managerUserId: uuid.optional(),
  status: z.string().trim().max(40).optional()
});

const cycleBaseSchema = z
  .object({
    tenantId: uuid,
    organizationId: uuid.nullable().optional(),
    name: z.string().trim().min(2).max(200),
    startDate: date,
    endDate: date,
    status: z.enum(["DRAFT", "ACTIVE", "CLOSED", "ARCHIVED"]).default("DRAFT")
  })

export const createCycleSchema = cycleBaseSchema
  .refine((value) => value.endDate > value.startDate, {
    message: "Start date must be before end date.",
    path: ["endDate"]
  });

export const updateCycleSchema = cycleBaseSchema
  .omit({ tenantId: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0, "No changes supplied.")
  .refine(
    (value) =>
      !value.startDate || !value.endDate || value.endDate > value.startDate,
    {
      message: "Start date must be before end date.",
      path: ["endDate"]
    }
  );

export const createGoalSchema = z.object({
  tenantId: uuid,
  cycleId: uuid,
  organizationId: uuid.nullable().optional(),
  ownerUserId: uuid.nullable().optional(),
  name: z.string().trim().min(2).max(200),
  description: optionalText,
  weightage: percent
});

export const updateGoalSchema = createGoalSchema
  .omit({ tenantId: true, cycleId: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0, "No changes supplied.");

export const createKraSchema = z.object({
  title: z.string().trim().min(2).max(200),
  description: optionalText,
  weightage: percent
});

export const updateKraSchema = createKraSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, "No changes supplied.");

export const createKpiSchema = z.object({
  description: z.string().trim().min(2).max(2000),
  targetValue: z.coerce.number().nullable().optional(),
  actualValue: z.coerce.number().nullable().optional(),
  achievementPercentage: percent.nullable().optional(),
  score: score.nullable().optional(),
  weightage: percent
});

export const updateKpiSchema = createKpiSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, "No changes supplied.");

export const updateKpiProgressSchema = z
  .object({
    actualValue: z.coerce.number().nullable().optional(),
    achievementPercentage: percent.nullable().optional(),
    score: score.nullable().optional()
  })
  .refine((value) => Object.keys(value).length > 0, "No changes supplied.");

export const createReviewSchema = z.object({
  tenantId: uuid,
  cycleId: uuid,
  employeeUserId: uuid,
  managerUserId: uuid.nullable().optional(),
  organizationId: uuid.nullable().optional()
});

export const bulkCreateReviewsSchema = z.object({
  tenantId: uuid,
  cycleId: uuid,
  employeeUserIds: z.array(uuid).min(1).max(100),
  managerUserId: uuid.nullable().optional(),
  organizationId: uuid.nullable().optional()
});

export const selfAssessmentSchema = z.object({
  selfScore: score,
  employeeComments: z.string().trim().min(1).max(4000)
});

export const managerAssessmentSchema = z.object({
  managerScore: score,
  finalScore: score.nullable().optional(),
  managerComments: z.string().trim().min(1).max(4000),
  status: z.enum(["MANAGER_REVIEWED", "APPROVED", "REJECTED"]).default("MANAGER_REVIEWED")
});

export const createEvidenceSchema = z.object({
  kpiId: uuid.nullable().optional(),
  title: z.string().trim().min(2).max(200),
  fileName: z.string().trim().min(1).max(255),
  fileUrl: z.string().trim().url().max(2000),
  mimeType: z.string().trim().max(100).nullable().optional(),
  sizeBytes: z.coerce.number().int().nonnegative().nullable().optional()
});
