import { apiRequest, requireUuid } from "@/shared/api/http";
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
  updateGoal(id: string, input: {
    organizationId?: string | null;
    ownerUserId?: string | null;
    name?: string;
    description?: string | null;
    weightage?: number;
  }) {
    return apiRequest<{ data: PerformanceGoal }>(`/performance/goals/${id}`, {
      method: "PATCH",
      body: input
    });
  },
  deleteGoal(id: string) {
    const goalId = requireUuid(id, "goal");
    return apiRequest<void>(`/performance/goals/${goalId}`, { method: "DELETE" });
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
  updateKra(id: string, input: {
    title?: string;
    description?: string | null;
    weightage?: number;
  }) {
    return apiRequest<{ data: PerformanceKra }>(`/performance/kras/${id}`, {
      method: "PATCH",
      body: input
    });
  },
  deleteKra(id: string) {
    const kraId = requireUuid(id, "KRA");
    return apiRequest<void>(`/performance/kras/${kraId}`, { method: "DELETE" });
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
  updateKpi(id: string, input: {
    description?: string;
    targetValue?: number | null;
    actualValue?: number | null;
    achievementPercentage?: number | null;
    score?: number | null;
    weightage?: number;
  }) {
    return apiRequest<{ data: PerformanceKpi }>(`/performance/kpis/${id}`, {
      method: "PATCH",
      body: input
    });
  },
  deleteKpi(id: string) {
    const kpiId = requireUuid(id, "KPI");
    return apiRequest<void>(`/performance/kpis/${kpiId}`, { method: "DELETE" });
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
  bulkCreateReviews(input: {
    tenantId: string;
    cycleId: string;
    employeeUserIds: string[];
    managerUserId?: string | null;
    organizationId?: string | null;
  }) {
    return apiRequest<{ data: PerformanceReview[] }>("/performance/reviews/bulk", {
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
