import { apiRequest } from "@/lib/api-client";
import type {
  PerformanceDashboard,
  PerformanceGoal,
  PerformanceKra,
  PerformanceKpi,
  PerformancePage,
  PerformanceReview,
  ReviewCycle
} from "./performance.types";

interface ListFilters {
  tenantId?: string;
  cycleId?: string;
  status?: string;
  limit?: number;
}

function query(filters: ListFilters = {}) {
  const params = new URLSearchParams({
    limit: String(filters.limit ?? 100)
  });
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, String(value));
  }
  return params.toString();
}

export const performanceApi = {
  dashboard(filters: ListFilters) {
    return apiRequest<{ data: PerformanceDashboard }>(
      `/performance/dashboard?${query(filters)}`
    );
  },
  listCycles(filters: ListFilters) {
    return apiRequest<PerformancePage<ReviewCycle>>(
      `/performance/cycles?${query(filters)}`
    );
  },
  createCycle(input: {
    tenantId: string;
    name: string;
    startDate: string;
    endDate: string;
    status: ReviewCycle["status"];
  }) {
    return apiRequest<{ data: ReviewCycle }>("/performance/cycles", {
      method: "POST",
      body: input
    });
  },
  listGoals(filters: ListFilters) {
    return apiRequest<PerformancePage<PerformanceGoal>>(
      `/performance/goals?${query(filters)}`
    );
  },
  createGoal(input: {
    tenantId: string;
    cycleId: string;
    name: string;
    description?: string | null;
    weightage: number;
  }) {
    return apiRequest<{ data: PerformanceGoal }>("/performance/goals", {
      method: "POST",
      body: input
    });
  },
  createKra(goalId: string, input: {
    title: string;
    description?: string | null;
    weightage: number;
  }) {
    return apiRequest<{ data: PerformanceKra }>(
      `/performance/goals/${goalId}/kras`,
      { method: "POST", body: input }
    );
  },
  createKpi(kraId: string, input: {
    description: string;
    targetValue?: number | null;
    weightage: number;
  }) {
    return apiRequest<{ data: PerformanceKpi }>(
      `/performance/kras/${kraId}/kpis`,
      { method: "POST", body: input }
    );
  },
  updateKpiProgress(id: string, input: {
    actualValue?: number | null;
    achievementPercentage?: number | null;
    score?: number | null;
  }) {
    return apiRequest<{ data: PerformanceKpi }>(
      `/performance/kpis/${id}/progress`,
      { method: "PATCH", body: input }
    );
  },
  listReviews(filters: ListFilters) {
    return apiRequest<PerformancePage<PerformanceReview>>(
      `/performance/reviews?${query(filters)}`
    );
  },
  createReview(input: {
    tenantId: string;
    cycleId: string;
    employeeUserId: string;
    managerUserId?: string | null;
    organizationId?: string | null;
  }) {
    return apiRequest<{ data: PerformanceReview }>("/performance/reviews", {
      method: "POST",
      body: input
    });
  },
  submitSelfAssessment(id: string, input: {
    selfScore: number;
    employeeComments: string;
  }) {
    return apiRequest<{ data: PerformanceReview }>(
      `/performance/reviews/${id}/self-assessment`,
      { method: "PATCH", body: input }
    );
  },
  submitManagerAssessment(id: string, input: {
    managerScore: number;
    finalScore?: number | null;
    managerComments: string;
    status: "MANAGER_REVIEWED" | "APPROVED" | "REJECTED";
  }) {
    return apiRequest<{ data: PerformanceReview }>(
      `/performance/reviews/${id}/manager-assessment`,
      { method: "PATCH", body: input }
    );
  }
};
