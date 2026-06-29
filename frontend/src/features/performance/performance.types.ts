import type { Page } from "@/features/admin/admin.types";

export type PerformancePage<T> = Page<T>;

export interface PerformanceDashboard {
  cycles: number;
  goals: number;
  reviews: number;
  approvedReviews: number;
  averageFinalScore: string | null;
}

export interface ReviewCycle {
  id: string;
  tenantId: string;
  organizationId: string | null;
  name: string;
  startDate: string;
  endDate: string;
  status: "DRAFT" | "ACTIVE" | "CLOSED" | "ARCHIVED";
  organization: { id: string; code: string; name: string } | null;
  _count: { goals: number; reviews: number };
}

export interface PerformanceKpi {
  id: string;
  tenantId: string;
  kraId: string;
  description: string;
  targetValue: string | null;
  actualValue: string | null;
  achievementPercentage: string | null;
  score: string | null;
  weightage: string;
}

export interface PerformanceKra {
  id: string;
  tenantId: string;
  goalId: string;
  title: string;
  description: string | null;
  weightage: string;
  kpis: PerformanceKpi[];
}

export interface PerformanceGoal {
  id: string;
  tenantId: string;
  cycleId: string;
  organizationId: string | null;
  ownerUserId: string | null;
  name: string;
  description: string | null;
  weightage: string;
  cycle: { id: string; name: string; status: string };
  organization: { id: string; code: string; name: string } | null;
  kras: PerformanceKra[];
}

export interface PerformanceReview {
  id: string;
  tenantId: string;
  cycleId: string;
  employeeUserId: string;
  managerUserId: string | null;
  organizationId: string | null;
  selfScore: string | null;
  managerScore: string | null;
  finalScore: string | null;
  employeeComments: string | null;
  managerComments: string | null;
  status:
    | "DRAFT"
    | "SELF_ASSESSMENT_SUBMITTED"
    | "MANAGER_REVIEWED"
    | "APPROVED"
    | "REJECTED";
  cycle: { id: string; name: string; status: string };
  employee: { id: string; firstName: string; lastName: string; email: string };
  manager: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
  organization: { id: string; code: string; name: string } | null;
  evidence: Array<{
    id: string;
    title: string;
    fileName: string;
    fileUrl: string;
    createdAt: string;
  }>;
}
