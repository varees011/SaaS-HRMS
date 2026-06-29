import type { Prisma, PrismaClient } from "@prisma/client";
import type { RequestContext } from "../../shared/request-context.js";

type DatabaseClient = PrismaClient | Prisma.TransactionClient;

export interface AuditInput {
  tenantId?: string | null;
  actorUserId?: string;
  effectiveUserId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  result: "SUCCESS" | "FAILURE";
  reason?: string;
  oldValues?: Prisma.InputJsonValue;
  newValues?: Prisma.InputJsonValue;
  metadata?: Prisma.InputJsonValue;
  context: RequestContext;
}

export class AuditService {
  async record(db: DatabaseClient, input: AuditInput): Promise<void> {
    await db.auditEvent.create({
      data: {
        tenantId: input.tenantId ?? null,
        actorUserId: input.actorUserId ?? null,
        effectiveUserId: input.effectiveUserId ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        requestId: input.context.requestId,
        correlationId: input.context.correlationId,
        ipAddress: input.context.ipAddress ?? null,
        userAgent: input.context.userAgent ?? null,
        result: input.result,
        reason: input.reason ?? null,
        ...(input.oldValues !== undefined ? { oldValues: input.oldValues } : {}),
        ...(input.newValues !== undefined ? { newValues: input.newValues } : {}),
        metadata: input.metadata ?? {}
      }
    });
  }
}

export const auditService = new AuditService();
