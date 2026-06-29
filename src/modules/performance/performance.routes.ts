import { Router, type Router as ExpressRouter } from "express";
import {
  authenticate,
  establishTenantAccess,
  requireAnyPermission
} from "../auth/auth.middleware.js";
import { validate } from "../../shared/middleware/validate.middleware.js";
import { performanceController } from "./performance.controller.js";
import {
  createCycleSchema,
  createEvidenceSchema,
  createGoalSchema,
  createKpiSchema,
  createKraSchema,
  createReviewSchema,
  goalParamsSchema,
  idParamsSchema,
  kraParamsSchema,
  managerAssessmentSchema,
  performanceListQuerySchema,
  selfAssessmentSchema,
  updateCycleSchema,
  updateKpiProgressSchema
} from "./performance.validation.js";

const readPerformance = [
  "tenant.performance.read",
  "tenant.performance.manage",
  "team.performance.review",
  "self.performance.read"
] as const;

const managePerformance = [
  "tenant.performance.manage",
  "team.goals.manage"
] as const;

const reviewPerformance = [
  "tenant.performance.manage",
  "team.performance.review"
] as const;

export const performanceRouter: ExpressRouter = Router();
performanceRouter.use(authenticate);
performanceRouter.use(establishTenantAccess);

performanceRouter.get(
  "/dashboard",
  requireAnyPermission(...readPerformance),
  validate({ query: performanceListQuerySchema }),
  performanceController.dashboard.bind(performanceController)
);

performanceRouter.get(
  "/cycles",
  requireAnyPermission(...readPerformance),
  validate({ query: performanceListQuerySchema }),
  performanceController.listCycles.bind(performanceController)
);
performanceRouter.post(
  "/cycles",
  requireAnyPermission("tenant.performance.manage"),
  validate({ body: createCycleSchema }),
  performanceController.createCycle.bind(performanceController)
);
performanceRouter.patch(
  "/cycles/:id",
  requireAnyPermission("tenant.performance.manage"),
  validate({ params: idParamsSchema, body: updateCycleSchema }),
  performanceController.updateCycle.bind(performanceController)
);

performanceRouter.get(
  "/goals",
  requireAnyPermission(...readPerformance),
  validate({ query: performanceListQuerySchema }),
  performanceController.listGoals.bind(performanceController)
);
performanceRouter.post(
  "/goals",
  requireAnyPermission(...managePerformance),
  validate({ body: createGoalSchema }),
  performanceController.createGoal.bind(performanceController)
);
performanceRouter.post(
  "/goals/:goalId/kras",
  requireAnyPermission(...managePerformance),
  validate({ params: goalParamsSchema, body: createKraSchema }),
  performanceController.createKra.bind(performanceController)
);
performanceRouter.post(
  "/kras/:kraId/kpis",
  requireAnyPermission(...managePerformance),
  validate({ params: kraParamsSchema, body: createKpiSchema }),
  performanceController.createKpi.bind(performanceController)
);
performanceRouter.patch(
  "/kpis/:id/progress",
  requireAnyPermission(
    "tenant.performance.manage",
    "team.performance.review",
    "self.performance.submit"
  ),
  validate({ params: idParamsSchema, body: updateKpiProgressSchema }),
  performanceController.updateKpiProgress.bind(performanceController)
);

performanceRouter.get(
  "/reviews",
  requireAnyPermission(...readPerformance),
  validate({ query: performanceListQuerySchema }),
  performanceController.listReviews.bind(performanceController)
);
performanceRouter.post(
  "/reviews",
  requireAnyPermission(...reviewPerformance),
  validate({ body: createReviewSchema }),
  performanceController.createReview.bind(performanceController)
);
performanceRouter.patch(
  "/reviews/:id/self-assessment",
  requireAnyPermission(
    "tenant.performance.manage",
    "team.performance.review",
    "self.performance.submit"
  ),
  validate({ params: idParamsSchema, body: selfAssessmentSchema }),
  performanceController.submitSelfAssessment.bind(performanceController)
);
performanceRouter.patch(
  "/reviews/:id/manager-assessment",
  requireAnyPermission(...reviewPerformance),
  validate({ params: idParamsSchema, body: managerAssessmentSchema }),
  performanceController.submitManagerAssessment.bind(performanceController)
);
performanceRouter.post(
  "/reviews/:id/evidence",
  requireAnyPermission(
    "tenant.performance.manage",
    "team.performance.review",
    "self.performance.submit"
  ),
  validate({ params: idParamsSchema, body: createEvidenceSchema }),
  performanceController.createEvidence.bind(performanceController)
);
