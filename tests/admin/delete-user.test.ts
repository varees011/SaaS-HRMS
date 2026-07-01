import { describe, expect, it, beforeEach, vi } from "vitest";
import { adminService } from "../../src/modules/admin/admin.service.js";

const mocks = vi.hoisted(() => ({
  prisma: {
    user: {
      findFirst: vi.fn()
    },
    $transaction: vi.fn()
  },
  auditRecord: vi.fn()
}));

vi.mock("../../src/core/db.js", () => ({
  prisma: mocks.prisma
}));

vi.mock("../../src/modules/audit/audit.service.js", () => ({
  auditService: {
    record: mocks.auditRecord
  }
}));

function txMock() {
  const findMany = vi.fn().mockResolvedValue([]);
  const updateMany = vi.fn().mockResolvedValue({ count: 0 });
  const deleteMany = vi.fn().mockResolvedValue({ count: 0 });

  return {
    user: {
      findUnique: vi.fn(),
      delete: vi.fn().mockResolvedValue({})
    },
    deletedUserArchive: {
      create: vi.fn().mockResolvedValue({ id: "archive-1" })
    },
    tenantMembership: {
      count: vi.fn().mockResolvedValue(0),
      findMany,
      deleteMany
    },
    roleAssignment: {
      count: vi.fn().mockResolvedValue(0),
      findMany,
      updateMany,
      deleteMany
    },
    authSession: {
      findMany,
      deleteMany
    },
    passwordResetToken: {
      findMany,
      deleteMany
    },
    organization: {
      findMany,
      updateMany
    },
    hrmsRecord: {
      findMany,
      updateMany
    },
    performanceGoal: {
      findMany,
      updateMany
    },
    performanceReview: {
      findMany,
      updateMany,
      deleteMany
    },
    performanceEvidence: {
      findMany,
      deleteMany
    },
    auditEvent: {
      findMany,
      updateMany
    }
  };
}

describe("AdminService.deleteUser", () => {
  const userId = "11111111-1111-4111-8111-111111111111";
  const actor = {
    tenantId: null,
    userId: "22222222-2222-4222-8222-222222222222",
    isPlatformAdmin: true,
    assignments: []
  };
  const context = {
    requestId: "33333333-3333-4333-8333-333333333333",
    correlationId: "44444444-4444-4444-8444-444444444444"
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("archives user data before hard deleting the user", async () => {
    const tx = txMock();
    const user = {
      id: userId,
      email: "deleted@example.test",
      username: "deleted",
      firstName: "Deleted",
      lastName: "User"
    };
    mocks.prisma.user.findFirst.mockResolvedValue(user);
    tx.user.findUnique.mockResolvedValue(user);
    mocks.prisma.$transaction.mockImplementation(async (callback) => callback(tx));

    await adminService.deleteUser(userId, actor, context);

    expect(tx.deletedUserArchive.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          originalUserId: userId,
          tenantId: null,
          deletedBy: actor.userId,
          reason: "ADMIN_DELETE",
          user: expect.objectContaining({ id: userId, email: user.email }),
          relatedData: expect.objectContaining({
            memberships: [],
            roleAssignments: [],
            sessions: [],
            employeeReviews: [],
            uploadedEvidence: []
          })
        })
      })
    );
    expect(tx.user.delete).toHaveBeenCalledWith({ where: { id: userId } });
    expect(tx.user.delete.mock.invocationCallOrder[0]).toBeGreaterThan(
      tx.deletedUserArchive.create.mock.invocationCallOrder[0]
    );
    expect(mocks.auditRecord).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        action: "identity.user_deleted",
        entityType: "user",
        entityId: userId,
        metadata: { targetTenantId: null, archiveId: "archive-1" }
      })
    );
  });

  it("returns not found when the user does not exist", async () => {
    mocks.prisma.user.findFirst.mockResolvedValue(null);

    await expect(adminService.deleteUser(userId, actor, context)).rejects.toMatchObject({
      statusCode: 404,
      code: "NOT_FOUND"
    });
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
  });
});
