import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "../../core/db.js";
import {
  AuthorizationError,
  ConflictError,
  NotFoundError,
  ValidationError
} from "../../core/errors.js";
import {
  assertOrganizationInScope,
  organizationIdWhere,
  resolveOrganizationScope
} from "../../core/organization-scope.js";
import type { RequestContext } from "../../core/request-context.js";
import { auditService } from "../audit/audit.service.js";
import type { AuthorizationAssignment } from "../auth/auth.types.js";

type DatabaseClient = PrismaClient | Prisma.TransactionClient;

interface Actor {
  tenantId: string | null;
  userId: string;
  isPlatformAdmin: boolean;
  permissions: string[];
  assignments: AuthorizationAssignment[];
}

interface ListInput {
  limit: number;
  cursor?: string;
  tenantId?: string;
  cycleId?: string;
  organizationId?: string;
  employeeUserId?: string;
  managerUserId?: string;
  status?: string;
}

export class PerformanceService {
  async listCycles(input: ListInput, actor: Actor) {
    const tenantId = resolveTenant(actor, input.tenantId);
    if (tenantId && input.organizationId) {
      await assertOrganizationInScope(prisma, actor, tenantId, input.organizationId);
    }
    const scope = await resolveOrganizationScope(prisma, actor, tenantId);
    const rows = await prisma.performanceReviewCycle.findMany({
      where: {
        deletedAt: null,
        ...(tenantId ? { tenantId } : {}),
        ...(input.organizationId
          ? { organizationId: input.organizationId }
          : organizationIdWhere(scope)),
        ...(input.status ? { status: input.status as never } : {})
      },
      include: {
        organization: { select: { id: true, code: true, name: true } },
        _count: { select: { goals: true, reviews: true } }
      },
      orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
      take: input.limit + 1,
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {})
    });
    return page(serialize(rows), input.limit);
  }

  async createCycle(
    data: {
      tenantId: string;
      organizationId?: string | null;
      name: string;
      startDate: Date;
      endDate: Date;
      status: "DRAFT" | "ACTIVE" | "CLOSED" | "ARCHIVED";
    },
    actor: Actor,
    context: RequestContext
  ) {
    const tenantId = resolveRequiredTenant(actor, data.tenantId);
    await ensureTenantAndOrganization(prisma, tenantId, data.organizationId);
    await assertOrganizationInScope(prisma, actor, tenantId, data.organizationId);
    return prisma.$transaction(async (tx) => {
      const cycle = await tx.performanceReviewCycle.create({
        data: {
          tenantId,
          organizationId: data.organizationId ?? null,
          name: data.name,
          startDate: data.startDate,
          endDate: data.endDate,
          status: data.status,
          createdBy: actor.userId,
          updatedBy: actor.userId
        }
      });
      await auditService.record(tx, {
        tenantId,
        actorUserId: actor.userId,
        action: "performance.cycle_created",
        entityType: "performance_review_cycle",
        entityId: cycle.id,
        result: "SUCCESS",
        newValues: jsonValue(cycle),
        context
      });
      return serialize(cycle);
    });
  }

  async updateCycle(
    id: string,
    data: Partial<{
      organizationId: string | null;
      name: string;
      startDate: Date;
      endDate: Date;
      status: "DRAFT" | "ACTIVE" | "CLOSED" | "ARCHIVED";
    }>,
    actor: Actor,
    context: RequestContext
  ) {
    const existing = await findCycle(id, actor);
    await ensureTenantAndOrganization(
      prisma,
      existing.tenantId,
      data.organizationId
    );
    if (Object.hasOwn(data, "organizationId")) {
      await assertOrganizationInScope(
        prisma,
        actor,
        existing.tenantId,
        data.organizationId
      );
    }
    return prisma.$transaction(async (tx) => {
      const cycle = await tx.performanceReviewCycle.update({
        where: { id },
        data: {
          ...data,
          updatedBy: actor.userId,
          rowVersion: { increment: 1 }
        }
      });
      await auditService.record(tx, {
        tenantId: existing.tenantId,
        actorUserId: actor.userId,
        action: "performance.cycle_updated",
        entityType: "performance_review_cycle",
        entityId: id,
        result: "SUCCESS",
        oldValues: jsonValue(existing),
        newValues: jsonValue(cycle),
        context
      });
      return serialize(cycle);
    });
  }

  async listGoals(input: ListInput, actor: Actor) {
    const tenantId = resolveTenant(actor, input.tenantId);
    if (tenantId && input.organizationId) {
      await assertOrganizationInScope(prisma, actor, tenantId, input.organizationId);
    }
    const scope = await resolveOrganizationScope(prisma, actor, tenantId);
    const rows = await prisma.performanceGoal.findMany({
      where: {
        deletedAt: null,
        ...(tenantId ? { tenantId } : {}),
        ...(input.organizationId
          ? { organizationId: input.organizationId }
          : organizationIdWhere(scope)),
        ...(input.cycleId ? { cycleId: input.cycleId } : {})
      },
      include: goalInclude,
      orderBy: [{ cycle: { startDate: "desc" } }, { name: "asc" }],
      take: input.limit + 1,
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {})
    });
    return page(serialize(rows), input.limit);
  }

  async createGoal(
    data: {
      tenantId: string;
      cycleId: string;
      organizationId?: string | null;
      ownerUserId?: string | null;
      name: string;
      description?: string | null;
      weightage: number;
    },
    actor: Actor,
    context: RequestContext
  ) {
    const tenantId = resolveRequiredTenant(actor, data.tenantId);
    await ensureCycle(prisma, tenantId, data.cycleId);
    await ensureTenantAndOrganization(prisma, tenantId, data.organizationId);
    await assertOrganizationInScope(prisma, actor, tenantId, data.organizationId);
    await ensureMember(prisma, tenantId, data.ownerUserId);
    await assertWeightageLimit(prisma, "goal", data.cycleId, data.weightage);
    return prisma.$transaction(async (tx) => {
      const goal = await tx.performanceGoal.create({
        data: {
          tenantId,
          cycleId: data.cycleId,
          organizationId: data.organizationId ?? null,
          ownerUserId: data.ownerUserId ?? null,
          name: data.name,
          description: data.description ?? null,
          weightage: new Prisma.Decimal(data.weightage),
          createdBy: actor.userId,
          updatedBy: actor.userId
        },
        include: goalInclude
      });
      await auditService.record(tx, {
        tenantId,
        actorUserId: actor.userId,
        action: "performance.goal_created",
        entityType: "performance_goal",
        entityId: goal.id,
        result: "SUCCESS",
        newValues: jsonValue(goal),
        context
      });
      return serialize(goal);
    });
  }

  async updateGoal(
    id: string,
    data: Partial<{
      organizationId: string | null;
      ownerUserId: string | null;
      name: string;
      description: string | null;
      weightage: number;
    }>,
    actor: Actor,
    context: RequestContext
  ) {
    const existing = await findGoal(id, actor);
    await ensureTenantAndOrganization(
      prisma,
      existing.tenantId,
      data.organizationId
    );
    if (Object.hasOwn(data, "organizationId")) {
      await assertOrganizationInScope(
        prisma,
        actor,
        existing.tenantId,
        data.organizationId
      );
    }
    await ensureMember(prisma, existing.tenantId, data.ownerUserId);
    if (data.weightage !== undefined) {
      await assertWeightageLimit(
        prisma,
        "goal",
        existing.cycleId,
        data.weightage,
        id
      );
    }
    return prisma.$transaction(async (tx) => {
      const goal = await tx.performanceGoal.update({
        where: { id },
        data: {
          ...data,
          ...(data.weightage !== undefined
            ? { weightage: new Prisma.Decimal(data.weightage) }
            : {}),
          updatedBy: actor.userId,
          rowVersion: { increment: 1 }
        },
        include: goalInclude
      });
      await auditService.record(tx, {
        tenantId: existing.tenantId,
        actorUserId: actor.userId,
        action: "performance.goal_updated",
        entityType: "performance_goal",
        entityId: id,
        result: "SUCCESS",
        oldValues: jsonValue(existing),
        newValues: jsonValue(goal),
        context
      });
      return serialize(goal);
    });
  }

  async deleteGoal(id: string, actor: Actor, context: RequestContext) {
    const existing = await findGoal(id, actor);
    await assertNoActivePerformanceEvidence("goal", id);
    await prisma.$transaction(async (tx) => {
      const now = new Date();
      await tx.performanceKpi.updateMany({
        where: { deletedAt: null, kra: { goalId: id } },
        data: { deletedAt: now }
      });
      await tx.performanceKra.updateMany({
        where: { goalId: id, deletedAt: null },
        data: { deletedAt: now }
      });
      await tx.performanceGoal.update({
        where: { id },
        data: {
          deletedAt: now,
          deletedBy: actor.userId,
          updatedBy: actor.userId,
          rowVersion: { increment: 1 }
        }
      });
      await auditService.record(tx, {
        tenantId: existing.tenantId,
        actorUserId: actor.userId,
        action: "performance.goal_deleted",
        entityType: "performance_goal",
        entityId: id,
        result: "SUCCESS",
        oldValues: jsonValue(existing),
        context
      });
    });
  }

  async createKra(
    goalId: string,
    data: { title: string; description?: string | null; weightage: number },
    actor: Actor,
    context: RequestContext
  ) {
    const goal = await findGoal(goalId, actor);
    await assertWeightageLimit(prisma, "kra", goalId, data.weightage);
    return prisma.$transaction(async (tx) => {
      const kra = await tx.performanceKra.create({
        data: {
          tenantId: goal.tenantId,
          goalId,
          title: data.title,
          description: data.description ?? null,
          weightage: new Prisma.Decimal(data.weightage)
        },
        include: { kpis: true }
      });
      await auditService.record(tx, {
        tenantId: goal.tenantId,
        actorUserId: actor.userId,
        action: "performance.kra_created",
        entityType: "performance_kra",
        entityId: kra.id,
        result: "SUCCESS",
        newValues: jsonValue(kra),
        context
      });
      return serialize(kra);
    });
  }

  async updateKra(
    id: string,
    data: Partial<{ title: string; description: string | null; weightage: number }>,
    actor: Actor,
    context: RequestContext
  ) {
    const existing = await findKra(id, actor);
    if (data.weightage !== undefined) {
      await assertWeightageLimit(
        prisma,
        "kra",
        existing.goalId,
        data.weightage,
        id
      );
    }
    return prisma.$transaction(async (tx) => {
      const kra = await tx.performanceKra.update({
        where: { id },
        data: {
          ...data,
          ...(data.weightage !== undefined
            ? { weightage: new Prisma.Decimal(data.weightage) }
            : {})
        },
        include: { kpis: { where: { deletedAt: null } } }
      });
      await auditService.record(tx, {
        tenantId: existing.tenantId,
        actorUserId: actor.userId,
        action: "performance.kra_updated",
        entityType: "performance_kra",
        entityId: id,
        result: "SUCCESS",
        oldValues: jsonValue(existing),
        newValues: jsonValue(kra),
        context
      });
      return serialize(kra);
    });
  }

  async deleteKra(id: string, actor: Actor, context: RequestContext) {
    const existing = await findKra(id, actor);
    await assertNoActivePerformanceEvidence("kra", id);
    await prisma.$transaction(async (tx) => {
      const now = new Date();
      await tx.performanceKpi.updateMany({
        where: { kraId: id, deletedAt: null },
        data: { deletedAt: now }
      });
      await tx.performanceKra.update({
        where: { id },
        data: { deletedAt: now }
      });
      await auditService.record(tx, {
        tenantId: existing.tenantId,
        actorUserId: actor.userId,
        action: "performance.kra_deleted",
        entityType: "performance_kra",
        entityId: id,
        result: "SUCCESS",
        oldValues: jsonValue(existing),
        context
      });
    });
  }

  async createKpi(
    kraId: string,
    data: {
      description: string;
      targetValue?: number | null;
      actualValue?: number | null;
      achievementPercentage?: number | null;
      score?: number | null;
      weightage: number;
    },
    actor: Actor,
    context: RequestContext
  ) {
    const kra = await findKra(kraId, actor);
    await assertWeightageLimit(prisma, "kpi", kraId, data.weightage);
    return prisma.$transaction(async (tx) => {
      const kpi = await tx.performanceKpi.create({
        data: {
          tenantId: kra.tenantId,
          kraId,
          description: data.description,
          targetValue: nullableDecimal(data.targetValue),
          actualValue: nullableDecimal(data.actualValue),
          achievementPercentage: nullableDecimal(data.achievementPercentage),
          score: nullableDecimal(data.score),
          weightage: new Prisma.Decimal(data.weightage)
        }
      });
      await auditService.record(tx, {
        tenantId: kra.tenantId,
        actorUserId: actor.userId,
        action: "performance.kpi_created",
        entityType: "performance_kpi",
        entityId: kpi.id,
        result: "SUCCESS",
        newValues: jsonValue(kpi),
        context
      });
      return serialize(kpi);
    });
  }

  async updateKpi(
    id: string,
    data: Partial<{
      description: string;
      targetValue: number | null;
      actualValue: number | null;
      achievementPercentage: number | null;
      score: number | null;
      weightage: number;
    }>,
    actor: Actor,
    context: RequestContext
  ) {
    const existing = await findKpi(id, actor);
    if (data.weightage !== undefined) {
      await assertWeightageLimit(
        prisma,
        "kpi",
        existing.kraId,
        data.weightage,
        id
      );
    }
    return prisma.$transaction(async (tx) => {
      const kpi = await tx.performanceKpi.update({
        where: { id },
        data: {
          ...(data.description !== undefined ? { description: data.description } : {}),
          ...(data.targetValue !== undefined
            ? { targetValue: nullableDecimal(data.targetValue) }
            : {}),
          ...(data.actualValue !== undefined
            ? { actualValue: nullableDecimal(data.actualValue) }
            : {}),
          ...(data.achievementPercentage !== undefined
            ? { achievementPercentage: nullableDecimal(data.achievementPercentage) }
            : {}),
          ...(data.score !== undefined ? { score: nullableDecimal(data.score) } : {}),
          ...(data.weightage !== undefined
            ? { weightage: new Prisma.Decimal(data.weightage) }
            : {})
        }
      });
      await auditService.record(tx, {
        tenantId: existing.tenantId,
        actorUserId: actor.userId,
        action: "performance.kpi_updated",
        entityType: "performance_kpi",
        entityId: id,
        result: "SUCCESS",
        oldValues: jsonValue(existing),
        newValues: jsonValue(kpi),
        context
      });
      return serialize(kpi);
    });
  }

  async deleteKpi(id: string, actor: Actor, context: RequestContext) {
    const existing = await findKpi(id, actor);
    await assertNoActivePerformanceEvidence("kpi", id);
    await prisma.$transaction(async (tx) => {
      await tx.performanceKpi.update({
        where: { id },
        data: { deletedAt: new Date() }
      });
      await auditService.record(tx, {
        tenantId: existing.tenantId,
        actorUserId: actor.userId,
        action: "performance.kpi_deleted",
        entityType: "performance_kpi",
        entityId: id,
        result: "SUCCESS",
        oldValues: jsonValue(existing),
        context
      });
    });
  }

  async updateKpiProgress(
    id: string,
    data: {
      actualValue?: number | null;
      achievementPercentage?: number | null;
      score?: number | null;
    },
    actor: Actor,
    context: RequestContext
  ) {
    const kpi = await findKpi(id, actor);
    return prisma.$transaction(async (tx) => {
      const updated = await tx.performanceKpi.update({
        where: { id },
        data: {
          ...(data.actualValue !== undefined
            ? { actualValue: nullableDecimal(data.actualValue) }
            : {}),
          ...(data.achievementPercentage !== undefined
            ? {
                achievementPercentage: nullableDecimal(
                  data.achievementPercentage
                )
              }
            : {}),
          ...(data.score !== undefined
            ? { score: nullableDecimal(data.score) }
            : {})
        }
      });
      await auditService.record(tx, {
        tenantId: kpi.tenantId,
        actorUserId: actor.userId,
        action: "performance.kpi_progress_updated",
        entityType: "performance_kpi",
        entityId: id,
        result: "SUCCESS",
        oldValues: jsonValue(kpi),
        newValues: jsonValue(updated),
        context
      });
      return serialize(updated);
    });
  }

  async listReviews(input: ListInput, actor: Actor) {
    const tenantId = resolveTenant(actor, input.tenantId);
    const canReadScopedReviews = canReadTeamOrTenantPerformance(actor);
    if (tenantId && input.organizationId && canReadScopedReviews) {
      await assertOrganizationInScope(prisma, actor, tenantId, input.organizationId);
    }
    const scope = await resolveOrganizationScope(prisma, actor, tenantId);
    const rows = await prisma.performanceReview.findMany({
      where: {
        deletedAt: null,
        ...(tenantId ? { tenantId } : {}),
        ...(input.organizationId && canReadScopedReviews
          ? { organizationId: input.organizationId }
          : reviewScopeWhere(scope, actor)),
        ...(input.cycleId ? { cycleId: input.cycleId } : {}),
        ...(input.employeeUserId ? { employeeUserId: input.employeeUserId } : {}),
        ...(input.managerUserId ? { managerUserId: input.managerUserId } : {}),
        ...(input.status ? { status: input.status as never } : {})
      },
      include: reviewInclude,
      orderBy: [{ createdAt: "desc" }],
      take: input.limit + 1,
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {})
    });
    return page(serialize(rows), input.limit);
  }

  async createReview(
    data: {
      tenantId: string;
      cycleId: string;
      employeeUserId: string;
      managerUserId?: string | null;
      organizationId?: string | null;
    },
    actor: Actor,
    context: RequestContext
  ) {
    const tenantId = resolveRequiredTenant(actor, data.tenantId);
    await ensureCycle(prisma, tenantId, data.cycleId);
    await ensureTenantAndOrganization(prisma, tenantId, data.organizationId);
    await assertOrganizationInScope(prisma, actor, tenantId, data.organizationId);
    await ensureMember(prisma, tenantId, data.employeeUserId);
    await ensureMember(prisma, tenantId, data.managerUserId);
    await assertReviewDoesNotExist(prisma, tenantId, data.cycleId, data.employeeUserId);
    return prisma.$transaction(async (tx) => {
      const review = await tx.performanceReview.create({
        data: {
          tenantId,
          cycleId: data.cycleId,
          employeeUserId: data.employeeUserId,
          managerUserId: data.managerUserId ?? null,
          organizationId: data.organizationId ?? null,
          createdBy: actor.userId,
          updatedBy: actor.userId
        },
        include: reviewInclude
      });
      await auditService.record(tx, {
        tenantId,
        actorUserId: actor.userId,
        action: "performance.review_created",
        entityType: "performance_review",
        entityId: review.id,
        result: "SUCCESS",
        newValues: jsonValue(review),
        context
      });
      return serialize(review);
    });
  }

  async bulkCreateReviews(
    data: {
      tenantId: string;
      cycleId: string;
      employeeUserIds: string[];
      managerUserId?: string | null;
      organizationId?: string | null;
    },
    actor: Actor,
    context: RequestContext
  ) {
    const tenantId = resolveRequiredTenant(actor, data.tenantId);
    const employeeUserIds = [...new Set(data.employeeUserIds)];
    await ensureCycle(prisma, tenantId, data.cycleId);
    await ensureTenantAndOrganization(prisma, tenantId, data.organizationId);
    await assertOrganizationInScope(prisma, actor, tenantId, data.organizationId);
    await Promise.all([
      ...employeeUserIds.map((userId) => ensureMember(prisma, tenantId, userId)),
      ensureMember(prisma, tenantId, data.managerUserId)
    ]);
    const duplicate = await prisma.performanceReview.findFirst({
      where: {
        tenantId,
        cycleId: data.cycleId,
        employeeUserId: { in: employeeUserIds },
        deletedAt: null
      },
      include: {
        employee: { select: { firstName: true, lastName: true, email: true } }
      }
    });
    if (duplicate) {
      throw new ConflictError(
        "REVIEW_EXISTS",
        `A review already exists for ${duplicate.employee.firstName} ${duplicate.employee.lastName} (${duplicate.employee.email}) in this cycle.`
      );
    }

    return prisma.$transaction(async (tx) => {
      await tx.performanceReview.createMany({
        data: employeeUserIds.map((employeeUserId) => ({
          tenantId,
          cycleId: data.cycleId,
          employeeUserId,
          managerUserId: data.managerUserId ?? null,
          organizationId: data.organizationId ?? null,
          createdBy: actor.userId,
          updatedBy: actor.userId
        }))
      });
      const reviews = await tx.performanceReview.findMany({
        where: {
          tenantId,
          cycleId: data.cycleId,
          employeeUserId: { in: employeeUserIds },
          deletedAt: null
        },
        include: reviewInclude,
        orderBy: [{ createdAt: "desc" }]
      });
      await auditService.record(tx, {
        tenantId,
        actorUserId: actor.userId,
        action: "performance.reviews_bulk_created",
        entityType: "performance_review",
        entityId: data.cycleId,
        result: "SUCCESS",
        metadata: { count: reviews.length },
        context
      });
      return serialize(reviews);
    });
  }

  async submitSelfAssessment(
    id: string,
    data: { selfScore: number; employeeComments: string },
    actor: Actor,
    context: RequestContext
  ) {
    const review = await findReview(id, actor);
    assertSelfOrReviewer(actor, review.employeeUserId);
    return prisma.$transaction(async (tx) => {
      const updated = await tx.performanceReview.update({
        where: { id },
        data: {
          selfScore: new Prisma.Decimal(data.selfScore),
          employeeComments: data.employeeComments,
          status: "SELF_ASSESSMENT_SUBMITTED",
          submittedAt: new Date(),
          updatedBy: actor.userId,
          rowVersion: { increment: 1 }
        },
        include: reviewInclude
      });
      await auditService.record(tx, {
        tenantId: review.tenantId,
        actorUserId: actor.userId,
        action: "performance.self_assessment_submitted",
        entityType: "performance_review",
        entityId: id,
        result: "SUCCESS",
        oldValues: jsonValue(review),
        newValues: jsonValue(updated),
        context
      });
      return serialize(updated);
    });
  }

  async submitManagerAssessment(
    id: string,
    data: {
      managerScore: number;
      finalScore?: number | null;
      managerComments: string;
      status: "MANAGER_REVIEWED" | "APPROVED" | "REJECTED";
    },
    actor: Actor,
    context: RequestContext
  ) {
    const review = await findReview(id, actor);
    return prisma.$transaction(async (tx) => {
      const updated = await tx.performanceReview.update({
        where: { id },
        data: {
          managerScore: new Prisma.Decimal(data.managerScore),
          finalScore: new Prisma.Decimal(data.finalScore ?? data.managerScore),
          managerComments: data.managerComments,
          status: data.status,
          reviewedAt: new Date(),
          ...(data.status === "APPROVED" ? { approvedAt: new Date() } : {}),
          updatedBy: actor.userId,
          rowVersion: { increment: 1 }
        },
        include: reviewInclude
      });
      await auditService.record(tx, {
        tenantId: review.tenantId,
        actorUserId: actor.userId,
        action: "performance.manager_assessment_submitted",
        entityType: "performance_review",
        entityId: id,
        result: "SUCCESS",
        oldValues: jsonValue(review),
        newValues: jsonValue(updated),
        context
      });
      return serialize(updated);
    });
  }

  async createEvidence(
    reviewId: string,
    data: {
      kpiId?: string | null;
      title: string;
      fileName: string;
      fileUrl: string;
      mimeType?: string | null;
      sizeBytes?: number | null;
    },
    actor: Actor,
    context: RequestContext
  ) {
    const review = await findReview(reviewId, actor);
    assertSelfOrReviewer(actor, review.employeeUserId);
    if (data.kpiId) await ensureKpi(prisma, review.tenantId, data.kpiId);
    return prisma.$transaction(async (tx) => {
      const evidence = await tx.performanceEvidence.create({
        data: {
          tenantId: review.tenantId,
          reviewId,
          kpiId: data.kpiId ?? null,
          uploadedByUserId: actor.userId,
          title: data.title,
          fileName: data.fileName,
          fileUrl: data.fileUrl,
          mimeType: data.mimeType ?? null,
          sizeBytes:
            data.sizeBytes === undefined || data.sizeBytes === null
              ? null
              : BigInt(data.sizeBytes)
        }
      });
      await auditService.record(tx, {
        tenantId: review.tenantId,
        actorUserId: actor.userId,
        action: "performance.evidence_added",
        entityType: "performance_evidence",
        entityId: evidence.id,
        result: "SUCCESS",
        newValues: jsonValue(evidence),
        context
      });
      return serialize(evidence);
    });
  }

  async dashboard(input: ListInput, actor: Actor) {
    const tenantId = resolveRequiredTenant(actor, input.tenantId);
    if (input.organizationId) {
      await assertOrganizationInScope(prisma, actor, tenantId, input.organizationId);
    }
    const scope = await resolveOrganizationScope(prisma, actor, tenantId);
    const organizationWhere = input.organizationId
      ? { organizationId: input.organizationId }
      : organizationIdWhere(scope);
    const [cycles, goals, reviews, approved, averageScore] = await Promise.all([
      prisma.performanceReviewCycle.count({
        where: { tenantId, deletedAt: null, ...organizationWhere }
      }),
      prisma.performanceGoal.count({
        where: { tenantId, deletedAt: null, ...organizationWhere }
      }),
      prisma.performanceReview.count({
        where: {
          tenantId,
          deletedAt: null,
          ...organizationWhere,
          ...(input.cycleId ? { cycleId: input.cycleId } : {})
        }
      }),
      prisma.performanceReview.count({
        where: {
          tenantId,
          deletedAt: null,
          status: "APPROVED",
          ...organizationWhere,
          ...(input.cycleId ? { cycleId: input.cycleId } : {})
        }
      }),
      prisma.performanceReview.aggregate({
        where: {
          tenantId,
          deletedAt: null,
          finalScore: { not: null },
          ...organizationWhere,
          ...(input.cycleId ? { cycleId: input.cycleId } : {})
        },
        _avg: { finalScore: true }
      })
    ]);
    return serialize({
      data: {
        cycles,
        goals,
        reviews,
        approvedReviews: approved,
        averageFinalScore: averageScore._avg.finalScore
      }
    });
  }
}

const goalInclude = {
  cycle: { select: { id: true, name: true, status: true } },
  organization: { select: { id: true, code: true, name: true } },
  kras: {
    where: { deletedAt: null },
    orderBy: { createdAt: "asc" },
    include: {
      kpis: {
        where: { deletedAt: null },
        orderBy: { createdAt: "asc" }
      }
    }
  }
} satisfies Prisma.PerformanceGoalInclude;

const reviewInclude = {
  cycle: { select: { id: true, name: true, status: true } },
  organization: { select: { id: true, code: true, name: true } },
  employee: {
    select: { id: true, firstName: true, lastName: true, email: true }
  },
  manager: {
    select: { id: true, firstName: true, lastName: true, email: true }
  },
  evidence: {
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" }
  }
} satisfies Prisma.PerformanceReviewInclude;

async function findCycle(id: string, actor: Actor) {
  const scope = await resolveOrganizationScope(prisma, actor, tenantWhere(actor).tenantId);
  const cycle = await prisma.performanceReviewCycle.findFirst({
    where: {
      id,
      deletedAt: null,
      ...tenantWhere(actor),
      ...organizationIdWhere(scope)
    }
  });
  if (!cycle) throw new NotFoundError("Review cycle");
  return cycle;
}

async function findGoal(id: string, actor: Actor) {
  const scope = await resolveOrganizationScope(prisma, actor, tenantWhere(actor).tenantId);
  const goal = await prisma.performanceGoal.findFirst({
    where: {
      id,
      deletedAt: null,
      ...tenantWhere(actor),
      ...organizationIdWhere(scope)
    }
  });
  if (!goal) throw new NotFoundError("Goal");
  return goal;
}

async function findKra(id: string, actor: Actor) {
  const scope = await resolveOrganizationScope(prisma, actor, tenantWhere(actor).tenantId);
  const kra = await prisma.performanceKra.findFirst({
    where: {
      id,
      deletedAt: null,
      goal: {
        deletedAt: null,
        ...tenantWhere(actor),
        ...organizationIdWhere(scope)
      }
    }
  });
  if (!kra) throw new NotFoundError("KRA");
  return kra;
}

async function findKpi(id: string, actor: Actor) {
  const scope = await resolveOrganizationScope(prisma, actor, tenantWhere(actor).tenantId);
  const kpi = await prisma.performanceKpi.findFirst({
    where: {
      id,
      deletedAt: null,
      kra: {
        deletedAt: null,
        goal: {
          deletedAt: null,
          ...tenantWhere(actor),
          ...organizationIdWhere(scope)
        }
      }
    }
  });
  if (!kpi) throw new NotFoundError("KPI");
  return kpi;
}

async function findReview(id: string, actor: Actor) {
  const scope = await resolveOrganizationScope(prisma, actor, tenantWhere(actor).tenantId);
  const review = await prisma.performanceReview.findFirst({
    where: {
      id,
      deletedAt: null,
      ...tenantWhere(actor),
      ...reviewScopeWhere(scope, actor)
    },
    include: reviewInclude
  });
  if (!review) throw new NotFoundError("Performance review");
  return review;
}

async function ensureTenantAndOrganization(
  db: DatabaseClient,
  tenantId: string,
  organizationId?: string | null
) {
  const tenant = await db.tenant.findFirst({
    where: { id: tenantId, deletedAt: null }
  });
  if (!tenant) throw new NotFoundError("Tenant");
  if (!organizationId) return;
  const organization = await db.organization.findFirst({
    where: { id: organizationId, tenantId, deletedAt: null }
  });
  if (!organization) {
    throw new ValidationError([
      {
        field: "organizationId",
        code: "custom",
        message: "Organization must belong to the selected tenant."
      }
    ]);
  }
}

async function ensureCycle(
  db: DatabaseClient,
  tenantId: string,
  cycleId: string
) {
  const cycle = await db.performanceReviewCycle.findFirst({
    where: { id: cycleId, tenantId, deletedAt: null }
  });
  if (!cycle) throw new NotFoundError("Review cycle");
}

async function ensureMember(
  db: DatabaseClient,
  tenantId: string,
  userId?: string | null
) {
  if (!userId) return;
  const membership = await db.tenantMembership.findFirst({
    where: {
      tenantId,
      userId,
      status: "ACTIVE",
      deletedAt: null,
      user: { status: "ACTIVE", deletedAt: null }
    }
  });
  if (!membership) {
    throw new ValidationError([
      {
        field: "userId",
        code: "custom",
        message: "User must be an active member of the selected tenant."
      }
    ]);
  }
}

async function ensureKpi(db: DatabaseClient, tenantId: string, kpiId: string) {
  const kpi = await db.performanceKpi.findFirst({
    where: { id: kpiId, tenantId, deletedAt: null }
  });
  if (!kpi) throw new NotFoundError("KPI");
}

async function assertReviewDoesNotExist(
  db: DatabaseClient,
  tenantId: string,
  cycleId: string,
  employeeUserId: string
) {
  const existing = await db.performanceReview.findFirst({
    where: { tenantId, cycleId, employeeUserId, deletedAt: null }
  });
  if (existing) {
    throw new ConflictError(
      "REVIEW_EXISTS",
      "A review already exists for this employee and cycle."
    );
  }
}

async function assertWeightageLimit(
  db: DatabaseClient,
  kind: "goal" | "kra" | "kpi",
  parentId: string,
  requestedWeightage: number,
  excludedId?: string
) {
  const excluded = excludedId ? { id: { not: excludedId } } : {};
  const aggregate =
    kind === "goal"
      ? await db.performanceGoal.aggregate({
          where: { cycleId: parentId, deletedAt: null, ...excluded },
          _sum: { weightage: true }
        })
      : kind === "kra"
        ? await db.performanceKra.aggregate({
            where: { goalId: parentId, deletedAt: null, ...excluded },
            _sum: { weightage: true }
          })
        : await db.performanceKpi.aggregate({
            where: { kraId: parentId, deletedAt: null, ...excluded },
            _sum: { weightage: true }
          });
  const existingTotal = Number(aggregate._sum.weightage ?? 0);
  if (existingTotal + requestedWeightage > 100) {
    throw new ValidationError([
      {
        field: "weightage",
        code: "custom",
        message: `Total ${kind.toUpperCase()} weightage cannot exceed 100%.`
      }
    ]);
  }
}

async function assertNoActivePerformanceEvidence(
  kind: "goal" | "kra" | "kpi",
  id: string
) {
  const where =
    kind === "goal"
      ? {
          deletedAt: null,
          kpi: { is: { kra: { goalId: id, deletedAt: null } } }
        }
      : kind === "kra"
        ? {
            deletedAt: null,
            kpi: { is: { kraId: id, deletedAt: null } }
          }
        : { deletedAt: null, kpiId: id };

  const evidence = await prisma.performanceEvidence.count({ where });
  if (evidence > 0) {
    throw new ConflictError(
      "PERFORMANCE_EVIDENCE_EXISTS",
      "Archive related performance evidence before deleting this item."
    );
  }
}

function assertSelfOrReviewer(actor: Actor, employeeUserId: string): void {
  if (actor.isPlatformAdmin || actor.userId === employeeUserId) return;
  if (actor.tenantId) return;
  throw new AuthorizationError();
}

function nullableDecimal(value: number | null | undefined) {
  return value === undefined || value === null ? null : new Prisma.Decimal(value);
}

function page<T extends { id: string }>(rows: T[], limit: number) {
  const hasMore = rows.length > limit;
  const data = hasMore ? rows.slice(0, limit) : rows;
  return {
    data,
    meta: {
      pageSize: limit,
      nextCursor: hasMore ? data[data.length - 1]?.id ?? null : null,
      hasMore
    }
  };
}

function serialize<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_key, item: unknown) =>
      typeof item === "bigint" ? item.toString() : item
    )
  ) as T;
}

function jsonValue(value: unknown): Prisma.InputJsonValue {
  return serialize(value) as Prisma.InputJsonValue;
}

function resolveTenant(
  actor: Actor,
  requestedTenantId: string | undefined
): string | undefined {
  if (actor.isPlatformAdmin) return requestedTenantId ?? actor.tenantId ?? undefined;
  const tenantId = requireActorTenant(actor);
  if (requestedTenantId && requestedTenantId !== tenantId) {
    throw new AuthorizationError("Cross-tenant access is forbidden.");
  }
  return tenantId;
}

function resolveRequiredTenant(
  actor: Actor,
  requestedTenantId: string | undefined
): string {
  const tenantId = resolveTenant(actor, requestedTenantId);
  if (!tenantId) {
    throw new ValidationError([
      {
        field: "tenantId",
        code: "custom",
        message: "A tenant must be selected."
      }
    ]);
  }
  return tenantId;
}

function requireActorTenant(actor: Actor): string {
  if (!actor.tenantId) {
    throw new AuthorizationError("An active tenant context is required.");
  }
  return actor.tenantId;
}

function tenantWhere(actor: Actor): { tenantId?: string } {
  if (actor.isPlatformAdmin) {
    return actor.tenantId ? { tenantId: actor.tenantId } : {};
  }
  return { tenantId: requireActorTenant(actor) };
}

function reviewScopeWhere(
  scope: Awaited<ReturnType<typeof resolveOrganizationScope>>,
  actor: Actor
): Prisma.PerformanceReviewWhereInput {
  if (!canReadTeamOrTenantPerformance(actor)) {
    return { employeeUserId: actor.userId };
  }

  if (scope.tenantWide) return {};
  return {
    OR: [
      { organizationId: { in: scope.organizationIds } },
      { employeeUserId: actor.userId },
      { managerUserId: actor.userId }
    ]
  };
}

function canReadTeamOrTenantPerformance(actor: Actor): boolean {
  return (
    actor.isPlatformAdmin ||
    actor.permissions.includes("tenant.performance.read") ||
    actor.permissions.includes("tenant.performance.manage") ||
    actor.permissions.includes("team.performance.review")
  );
}

export const performanceService = new PerformanceService();
