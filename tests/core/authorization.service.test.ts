import { describe, expect, it, vi } from "vitest";
import {
  authorizationService,
  type AuthorizationActor
} from "../../src/core/authorization.service.js";

const tenantId = "8870b751-f97d-4daa-b2c4-d2d87728cebc";
const actorUserId = "8bb7d31a-2c62-4ab0-8a8d-44b729ec981a";
const directReportId = "68140ac9-b5fd-4f4e-b639-b601f55f845a";
const organizationId = "bfa7bf72-6d8e-4283-a93b-638887c68170";

function actor(input: Partial<AuthorizationActor> = {}): AuthorizationActor {
  return {
    tenantId,
    userId: actorUserId,
    isPlatformAdmin: false,
    permissions: [],
    assignments: [
      {
        roleCode: "EMPLOYEE",
        roleType: "SELF",
        tenantId,
        organizationId,
        scopeType: "SELF",
        includeDescendants: false
      }
    ],
    ...input
  };
}

describe("AuthorizationService", () => {
  it("blocks cross-tenant access for non-platform actors", () => {
    expect(() =>
      authorizationService.resolveTenant(
        actor(),
        "bcb5a655-bbc6-48dd-8952-14865f7b2abc"
      )
    ).toThrow("Cross-tenant access is forbidden.");
  });

  it("keeps manager eligibility out of role-name matching", () => {
    const where = authorizationService.managerEligibleRoleWhere();
    const roleNameFilter = where.OR?.some((filter) => "name" in filter);
    const roleCodeFilter = where.OR?.some((filter) => "code" in filter);

    expect(roleNameFilter).toBe(false);
    expect(roleCodeFilter).toBe(false);
    expect(where.OR).toContainEqual({ roleType: "MANAGER" });
    expect(JSON.stringify(where.OR)).toContain("self.performance.submit");
  });

  it("allows only employee self-submit or explicit performance administrators", () => {
    expect(() =>
      authorizationService.assertCanSubmitSelfAssessment(
        actor({ permissions: ["self.performance.submit"] }),
        { employeeUserId: actorUserId }
      )
    ).not.toThrow();

    expect(() =>
      authorizationService.assertCanSubmitSelfAssessment(
        actor({ permissions: ["self.performance.submit"] }),
        { employeeUserId: directReportId }
      )
    ).toThrow("Only the employee can submit self assessment.");
  });

  it("builds user visibility from self, direct-report, skip-level, and organization relationships", async () => {
    const db = {
      user: {
        findMany: vi.fn().mockResolvedValue([{ id: directReportId }])
      },
      organization: {
        findMany: vi.fn().mockResolvedValue([])
      }
    };

    const where = await authorizationService.accessibleUserWhere(
      db as never,
      actor({
        permissions: ["self.profile.read", "team.members.read"]
      }),
      { tenantId }
    );

    expect(JSON.stringify(where)).toContain(actorUserId);
    expect(JSON.stringify(where)).toContain(directReportId);
    expect(JSON.stringify(where)).toContain("reportingManagerUserId");
  });
});
