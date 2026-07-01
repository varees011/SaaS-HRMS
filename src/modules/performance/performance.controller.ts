import type { Request, Response } from "express";
import { AuthenticationError } from "../../core/errors.js";
import { performanceService } from "./performance.service.js";

export class PerformanceController {
  async dashboard(req: Request, res: Response) {
    res.json(await performanceService.dashboard(listInput(req), actor(req)));
  }

  async listCycles(req: Request, res: Response) {
    res.json(await performanceService.listCycles(listInput(req), actor(req)));
  }

  async createCycle(req: Request, res: Response) {
    res.status(201).json({
      data: await performanceService.createCycle(
        req.body,
        actor(req),
        req.context
      )
    });
  }

  async updateCycle(req: Request, res: Response) {
    res.json({
      data: await performanceService.updateCycle(
        String(req.params.id),
        req.body,
        actor(req),
        req.context
      )
    });
  }

  async listGoals(req: Request, res: Response) {
    res.json(await performanceService.listGoals(listInput(req), actor(req)));
  }

  async createGoal(req: Request, res: Response) {
    res.status(201).json({
      data: await performanceService.createGoal(
        req.body,
        actor(req),
        req.context
      )
    });
  }

  async updateGoal(req: Request, res: Response) {
    res.json({
      data: await performanceService.updateGoal(
        String(req.params.id),
        req.body,
        actor(req),
        req.context
      )
    });
  }

  async deleteGoal(req: Request, res: Response) {
    await performanceService.deleteGoal(
      String(req.params.id),
      actor(req),
      req.context
    );
    res.status(204).send();
  }

  async createKra(req: Request, res: Response) {
    res.status(201).json({
      data: await performanceService.createKra(
        String(req.params.goalId),
        req.body,
        actor(req),
        req.context
      )
    });
  }

  async updateKra(req: Request, res: Response) {
    res.json({
      data: await performanceService.updateKra(
        String(req.params.id),
        req.body,
        actor(req),
        req.context
      )
    });
  }

  async deleteKra(req: Request, res: Response) {
    await performanceService.deleteKra(
      String(req.params.id),
      actor(req),
      req.context
    );
    res.status(204).send();
  }

  async createKpi(req: Request, res: Response) {
    res.status(201).json({
      data: await performanceService.createKpi(
        String(req.params.kraId),
        req.body,
        actor(req),
        req.context
      )
    });
  }

  async updateKpi(req: Request, res: Response) {
    res.json({
      data: await performanceService.updateKpi(
        String(req.params.id),
        req.body,
        actor(req),
        req.context
      )
    });
  }

  async deleteKpi(req: Request, res: Response) {
    await performanceService.deleteKpi(
      String(req.params.id),
      actor(req),
      req.context
    );
    res.status(204).send();
  }

  async updateKpiProgress(req: Request, res: Response) {
    res.json({
      data: await performanceService.updateKpiProgress(
        String(req.params.id),
        req.body,
        actor(req),
        req.context
      )
    });
  }

  async listReviews(req: Request, res: Response) {
    res.json(await performanceService.listReviews(listInput(req), actor(req)));
  }

  async createReview(req: Request, res: Response) {
    res.status(201).json({
      data: await performanceService.createReview(
        req.body,
        actor(req),
        req.context
      )
    });
  }

  async bulkCreateReviews(req: Request, res: Response) {
    res.status(201).json({
      data: await performanceService.bulkCreateReviews(
        req.body,
        actor(req),
        req.context
      )
    });
  }

  async submitSelfAssessment(req: Request, res: Response) {
    res.json({
      data: await performanceService.submitSelfAssessment(
        String(req.params.id),
        req.body,
        actor(req),
        req.context
      )
    });
  }

  async submitManagerAssessment(req: Request, res: Response) {
    res.json({
      data: await performanceService.submitManagerAssessment(
        String(req.params.id),
        req.body,
        actor(req),
        req.context
      )
    });
  }

  async createEvidence(req: Request, res: Response) {
    res.status(201).json({
      data: await performanceService.createEvidence(
        String(req.params.id),
        req.body,
        actor(req),
        req.context
      )
    });
  }
}

function actor(req: Request) {
  if (!req.auth) throw new AuthenticationError();
  return {
    tenantId: req.tenantAccess?.tenantId ?? null,
    userId: req.auth.userId,
    isPlatformAdmin: req.tenantAccess?.isPlatformAdmin ?? false,
    permissions: req.auth.permissions,
    assignments: req.auth.assignments
  };
}

function listInput(req: Request) {
  return {
    limit: Number(req.query.limit) || 25,
    ...(req.query.cursor ? { cursor: String(req.query.cursor) } : {}),
    ...(req.query.tenantId ? { tenantId: String(req.query.tenantId) } : {}),
    ...(req.query.cycleId ? { cycleId: String(req.query.cycleId) } : {}),
    ...(req.query.organizationId
      ? { organizationId: String(req.query.organizationId) }
      : {}),
    ...(req.query.employeeUserId
      ? { employeeUserId: String(req.query.employeeUserId) }
      : {}),
    ...(req.query.managerUserId
      ? { managerUserId: String(req.query.managerUserId) }
      : {}),
    ...(req.query.status ? { status: String(req.query.status) } : {})
  };
}

export const performanceController = new PerformanceController();
