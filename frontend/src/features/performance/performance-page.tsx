import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  FileCheck2,
  LoaderCircle,
  Pencil,
  Plus,
  Target,
  Trash2,
  Users
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { Alert } from "@/shared/ui/alert";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Select } from "@/shared/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/shared/ui/table";
import { adminApi } from "@/features/admin/admin.api";
import type { AdminUser, Organization } from "@/features/admin/admin.types";
import { performanceApi } from "@/features/performance/performance.api";
import {
  performanceTemplates,
  type PerformanceTemplate
} from "@/features/performance/performance-templates";
import type {
  PerformanceGoal,
  PerformanceKpi,
  PerformanceKra,
  PerformanceReview
} from "@/features/performance/performance.types";
import { useAuthStore } from "@/features/auth/auth.store";
import type { CurrentUser } from "@/features/auth/auth.types";
import { hasAnyPermission } from "@/features/auth/permissions";
import { ApiError } from "@/shared/api/http";
import { cn } from "@/shared/lib/cn";

type Step = 0 | 1 | 2;
type PerformanceSection = "setup" | "hierarchy" | "assignments" | "reviews" | "assessments";

const steps = ["Cycle Details", "Goals, KRAs & KPIs", "Review Assignments"];
const performanceSections = [
  {
    id: "setup",
    label: "Cycle setup",
    description: "Create or select the review cycle.",
    icon: ClipboardCheck
  },
  {
    id: "hierarchy",
    label: "Goal hierarchy",
    description: "Manage goals, KRAs, and KPIs.",
    icon: Target
  },
  {
    id: "assignments",
    label: "Assignments",
    description: "Assign assessments by scope and manager.",
    icon: Users
  },
  {
    id: "reviews",
    label: "Reviews",
    description: "Track employee review status.",
    icon: FileCheck2
  },
  {
    id: "assessments",
    label: "Assessments",
    description: "Submit self and manager scores.",
    icon: BarChart3
  }
] satisfies Array<{
  id: PerformanceSection;
  label: string;
  description: string;
  icon: typeof ClipboardCheck;
}>;

const emptyGoal = { name: "", description: "", weightage: "" };
const emptyKra = { title: "", description: "", weightage: "" };
const emptyKpi = { description: "", targetValue: "", weightage: "" };

function normalizePerformanceSection(value: string | null): PerformanceSection {
  return performanceSections.some((section) => section.id === value)
    ? (value as PerformanceSection)
    : "setup";
}

export function PerformancePage() {
  const user = useAuthStore((state) => state.user)!;
  const [searchParams, setSearchParams] = useSearchParams();
  const activeSection = normalizePerformanceSection(searchParams.get("section"));
  const canSwitchTenants = user.isSuperAdmin;
  const fixedTenantId = user.tenantId ?? user.memberships?.[0]?.tenantId ?? "";
  const [tenantId, setTenantId] = useState(canSwitchTenants ? "" : fixedTenantId);
  const [cycleId, setCycleId] = useState("");
  const [activeStep, setActiveStep] = useState<Step>(0);
  const [error, setError] = useState<string>();
  const [success, setSuccess] = useState<string>();
  const queryClient = useQueryClient();

  function setPerformanceSection(section: PerformanceSection) {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("section", section);
    setSearchParams(nextParams);
  }

  const canListTenants = hasAnyPermission(user, [
    "platform.tenants.read",
    "tenant.settings.read"
  ]);
  const canManagePerformance = hasAnyPermission(user, [
    "tenant.performance.manage"
  ]);
  const canManageGoals = hasAnyPermission(user, [
    "tenant.performance.manage",
    "team.goals.manage"
  ]);
  const canReview = hasAnyPermission(user, [
    "tenant.performance.manage",
    "team.performance.review"
  ]);
  const canReadPerformanceManagement = hasAnyPermission(user, [
    "tenant.performance.read",
    "tenant.performance.manage"
  ]);
  const isManagerRole = hasManagerRole(user);
  const isManagerDashboard =
    !canManagePerformance &&
    !canReadPerformanceManagement &&
    (canReview || isManagerRole);
  const isSelfPerformanceOnly =
    !canReadPerformanceManagement &&
    !isManagerDashboard &&
    hasAnyPermission(user, ["self.performance.read"]);

  const tenants = useQuery({
    queryKey: ["admin", "tenants", "performance"],
    queryFn: () => adminApi.listTenants(),
    enabled: canSwitchTenants && canListTenants
  });
  const cycles = useQuery({
    queryKey: ["performance", "cycles", tenantId],
    queryFn: () => performanceApi.listCycles({ tenantId }),
    enabled: Boolean(tenantId) && !isSelfPerformanceOnly
  });
  const dashboard = useQuery({
    queryKey: ["performance", "dashboard", tenantId, cycleId],
    queryFn: () => performanceApi.dashboard({ tenantId, cycleId }),
    enabled: Boolean(tenantId) && !isSelfPerformanceOnly
  });
  const goals = useQuery({
    queryKey: ["performance", "goals", tenantId, cycleId],
    queryFn: () => performanceApi.listGoals({ tenantId, cycleId }),
    enabled: Boolean(tenantId && cycleId) && !isSelfPerformanceOnly
  });
  const reviews = useQuery({
    queryKey: ["performance", "reviews", tenantId, cycleId],
    queryFn: () => performanceApi.listReviews({ tenantId, cycleId }),
    enabled: Boolean(tenantId)
  });

  useEffect(() => {
    if (!canSwitchTenants) {
      if (fixedTenantId && tenantId !== fixedTenantId) setTenantId(fixedTenantId);
      return;
    }
    if (!tenantId && tenants.data?.data[0]) {
      const customerTenant =
        tenants.data.data.find((tenant) => tenant.code !== "platform") ??
        tenants.data.data[0];
      setTenantId(customerTenant.id);
    }
  }, [canSwitchTenants, fixedTenantId, tenantId, tenants.data]);

  useEffect(() => {
    if (!cycleId && cycles.data?.data[0]) {
      setCycleId(cycles.data.data[0].id);
    }
  }, [cycleId, cycles.data]);

  useEffect(() => {
    if (activeSection === "setup") setActiveStep(0);
    if (activeSection === "hierarchy") setActiveStep(1);
    if (activeSection === "assignments") setActiveStep(2);
  }, [activeSection]);

  const tenantOptions = useMemo(() => {
    if (canSwitchTenants && tenants.data?.data.length) return tenants.data.data;
    return (
      user.memberships?.map((membership) => ({
        id: membership.tenantId,
        code: membership.tenant.code,
        name: membership.tenant.name
      })) ?? []
    );
  }, [canSwitchTenants, tenants.data, user.memberships]);
  const activeTenantLabel =
    tenantOptions.find((tenant) => tenant.id === tenantId)?.name ??
    "Current organization";

  const invalidatePerformance = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["performance"] }),
      queryClient.invalidateQueries({ queryKey: ["admin", "tenants"] })
    ]);
  };

  function showError(reason: unknown) {
    if (reason instanceof ApiError) {
      const fieldMessages =
        reason.fields
          ?.map((field) => `${field.field.replace(/^body\./, "")}: ${field.message}`)
          .join(" ") ?? "";
      setError(fieldMessages ? `${reason.message} ${fieldMessages}` : reason.message);
      return;
    }
    if (reason instanceof Error) {
      setError(reason.message);
      return;
    }
    setError("The performance request failed.");
  }

  const createCycle = useMutation({
    mutationFn: performanceApi.createCycle,
    onSuccess: async (response) => {
      setCycleId(response.data.id);
      setActiveStep(1);
      setPerformanceSection("hierarchy");
      setSuccess("Cycle saved. Add goals, KRAs, and KPIs next.");
      setError(undefined);
      await invalidatePerformance();
    },
    onError: showError
  });
  const createGoal = useMutation({
    mutationFn: performanceApi.createGoal,
    onSuccess: async () => {
      setSuccess("Goal saved.");
      setError(undefined);
      await invalidatePerformance();
    },
    onError: showError
  });
  const updateGoal = useMutation({
    mutationFn: ({ id, input }: {
      id: string;
      input: { name?: string; description?: string | null; weightage?: number };
    }) => performanceApi.updateGoal(id, input),
    onSuccess: async () => {
      setSuccess("Goal updated.");
      setError(undefined);
      await invalidatePerformance();
    },
    onError: showError
  });
  const deleteGoal = useMutation({
    mutationFn: performanceApi.deleteGoal,
    onMutate: () => {
      setError(undefined);
      setSuccess(undefined);
    },
    onSuccess: async () => {
      setSuccess("Goal deleted.");
      setError(undefined);
      await invalidatePerformance();
    },
    onError: showError
  });
  const createKra = useMutation({
    mutationFn: ({ goalId, input }: {
      goalId: string;
      input: { title: string; description?: string | null; weightage: number };
    }) => performanceApi.createKra(goalId, input),
    onSuccess: async () => {
      setSuccess("KRA saved.");
      setError(undefined);
      await invalidatePerformance();
    },
    onError: showError
  });
  const updateKra = useMutation({
    mutationFn: ({ id, input }: {
      id: string;
      input: { title?: string; description?: string | null; weightage?: number };
    }) => performanceApi.updateKra(id, input),
    onSuccess: async () => {
      setSuccess("KRA updated.");
      setError(undefined);
      await invalidatePerformance();
    },
    onError: showError
  });
  const deleteKra = useMutation({
    mutationFn: performanceApi.deleteKra,
    onMutate: () => {
      setError(undefined);
      setSuccess(undefined);
    },
    onSuccess: async () => {
      setSuccess("KRA deleted.");
      setError(undefined);
      await invalidatePerformance();
    },
    onError: showError
  });
  const createKpi = useMutation({
    mutationFn: ({ kraId, input }: {
      kraId: string;
      input: { description: string; targetValue?: number | null; weightage: number };
    }) => performanceApi.createKpi(kraId, input),
    onSuccess: async () => {
      setSuccess("KPI saved.");
      setError(undefined);
      await invalidatePerformance();
    },
    onError: showError
  });
  const updateKpi = useMutation({
    mutationFn: ({ id, input }: {
      id: string;
      input: { description?: string; targetValue?: number | null; weightage?: number };
    }) => performanceApi.updateKpi(id, input),
    onSuccess: async () => {
      setSuccess("KPI updated.");
      setError(undefined);
      await invalidatePerformance();
    },
    onError: showError
  });
  const deleteKpi = useMutation({
    mutationFn: performanceApi.deleteKpi,
    onMutate: () => {
      setError(undefined);
      setSuccess(undefined);
    },
    onSuccess: async () => {
      setSuccess("KPI deleted.");
      setError(undefined);
      await invalidatePerformance();
    },
    onError: showError
  });
  const updateKpiProgress = useMutation({
    mutationFn: ({ id, input }: {
      id: string;
      input: {
        actualValue?: number | null;
        achievementPercentage?: number | null;
        score?: number | null;
      };
    }) => performanceApi.updateKpiProgress(id, input),
    onSuccess: invalidatePerformance,
    onError: showError
  });
  const bulkCreateReviews = useMutation({
    mutationFn: performanceApi.bulkCreateReviews,
    onSuccess: async (response) => {
      setSuccess(`${response.data.length} review(s) created.`);
      setError(undefined);
      await invalidatePerformance();
    },
    onError: showError
  });
  const selfAssessment = useMutation({
    mutationFn: ({ id, input }: {
      id: string;
      input: { selfScore: number; employeeComments: string };
    }) => performanceApi.submitSelfAssessment(id, input),
    onSuccess: invalidatePerformance,
    onError: showError
  });
  const managerAssessment = useMutation({
    mutationFn: ({ id, input }: {
      id: string;
      input: {
        managerScore: number;
        finalScore?: number | null;
        managerComments: string;
        status: "MANAGER_REVIEWED" | "APPROVED" | "REJECTED";
      };
    }) => performanceApi.submitManagerAssessment(id, input),
    onSuccess: invalidatePerformance,
    onError: showError
  });
  const applyTemplate = useMutation({
    mutationFn: async (template: PerformanceTemplate) => {
      if (!tenantId || !cycleId) {
        throw new Error("Select a tenant and cycle before applying a KRA template.");
      }
      if (goals.data?.data.length) {
        throw new Error("Apply templates to an empty cycle. Delete existing goals or create a new cycle first.");
      }

      for (const goalTemplate of template.goals) {
        const goal = await performanceApi.createGoal({
          tenantId,
          cycleId,
          name: goalTemplate.name,
          description: goalTemplate.description,
          weightage: goalTemplate.weightage
        });

        for (const kraTemplate of goalTemplate.kras) {
          const kra = await performanceApi.createKra(goal.data.id, {
            title: kraTemplate.title,
            description: kraTemplate.description,
            weightage: kraTemplate.weightage
          });

          for (const kpiTemplate of kraTemplate.kpis) {
            await performanceApi.createKpi(kra.data.id, {
              description: kpiTemplate.description,
              targetValue: kpiTemplate.targetValue ?? null,
              weightage: kpiTemplate.weightage
            });
          }
        }
      }
    },
    onSuccess: async (_response, template) => {
      setSuccess(`${template.name} template applied.`);
      setError(undefined);
      setPerformanceSection("hierarchy");
      await invalidatePerformance();
    },
    onError: showError
  });

  const goalTotal = totalWeight(goals.data?.data ?? []);
  const hierarchyReady =
    Boolean(goals.data?.data.length) &&
    isTotalComplete(goalTotal) &&
    (goals.data?.data.every((goal) =>
      isTotalComplete(totalWeight(goal.kras)) &&
      goal.kras.every((kra) => isTotalComplete(totalWeight(kra.kpis)))
    ) ??
      false);

  const metrics = [
    { label: "Cycles", value: dashboard.data?.data.cycles ?? 0, icon: ClipboardCheck },
    { label: "Goals", value: dashboard.data?.data.goals ?? 0, icon: Target },
    { label: "Reviews", value: dashboard.data?.data.reviews ?? 0, icon: Users },
    { label: "Avg score", value: dashboard.data?.data.averageFinalScore ?? "0", icon: BarChart3 }
  ];
  const activeSectionMeta =
    performanceSections.find((section) => section.id === activeSection) ??
    performanceSections[0]!;

  if (isManagerDashboard) {
    const visibleReviews = reviews.data?.data ?? [];
    const managerReviews = visibleReviews.filter(
      (review) => review.managerUserId === user.id
    );
    const ownReviews = visibleReviews.filter(
      (review) => review.employeeUserId === user.id
    );
    const pendingManagerReviews = managerReviews.filter(
      (review) => !review.managerScore && review.status !== "APPROVED"
    );
    const completedManagerReviews = managerReviews.filter(
      (review) => review.managerScore || review.status === "APPROVED"
    );
    const scoredReviews = managerReviews.filter((review) => review.finalScore);
    const averageScore = scoredReviews.length
      ? (
          scoredReviews.reduce(
            (sum, review) => sum + Number(review.finalScore ?? 0),
            0
          ) / scoredReviews.length
        ).toFixed(1)
      : "0";

    return (
      <ManagerPerformanceDashboard
        tenantName={activeTenantLabel}
        isLoading={reviews.isLoading}
        managerReviews={managerReviews}
        ownReviews={ownReviews}
        pendingReviews={pendingManagerReviews}
        completedReviews={completedManagerReviews}
        averageScore={averageScore}
        managerPending={managerAssessment.isPending}
        onManager={(id, input) => managerAssessment.mutate({ id, input })}
        error={error}
        success={success}
      />
    );
  }

  if (isSelfPerformanceOnly) {
    const ownReviews = reviews.data?.data ?? [];
    const completedReviews = ownReviews.filter((review) => review.finalScore);
    const averageScore = completedReviews.length
      ? (
          completedReviews.reduce(
            (sum, review) => sum + Number(review.finalScore ?? 0),
            0
          ) / completedReviews.length
        ).toFixed(1)
      : "0";

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold">My performance</h1>
            <p className="text-muted-foreground">
              View your assigned performance reviews and scores.
            </p>
          </div>
          {canSwitchTenants ? (
            <div className="flex min-w-72 flex-wrap gap-2">
              <Select value={tenantId} onChange={(event) => setTenantId(event.target.value)}>
                <option value="">Select tenant</option>
                {tenantOptions.map((tenant) => (
                  <option key={tenant.id} value={tenant.id}>
                    {tenant.name} ({tenant.code})
                  </option>
                ))}
              </Select>
            </div>
          ) : (
            <div className="rounded-md border bg-secondary/40 px-3 py-2 text-sm font-medium">
              {activeTenantLabel}
            </div>
          )}
        </div>

        {error ? <Alert variant="destructive">{error}</Alert> : null}

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="flex items-center gap-4 p-5">
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-accent">
                <FileCheck2 className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm text-muted-foreground">Reviews</p>
                <p className="text-lg font-semibold">{ownReviews.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-5">
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-accent">
                <CheckCircle2 className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm text-muted-foreground">Completed</p>
                <p className="text-lg font-semibold">{completedReviews.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-5">
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-accent">
                <BarChart3 className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm text-muted-foreground">Avg score</p>
                <p className="text-lg font-semibold">{averageScore}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {reviews.isLoading ? (
          <Card>
            <CardContent className="p-6">
              <LoaderCircle className="h-5 w-5 animate-spin" />
            </CardContent>
          </Card>
        ) : (
          <ReviewsTable reviews={ownReviews} />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">Performance management</h1>
          <p className="text-muted-foreground">
            Set up cycles, weighted goals, and employee reviews in a guided flow.
          </p>
        </div>
        <div className="flex min-w-72 flex-wrap gap-2">
          {canSwitchTenants ? (
            <Select
              value={tenantId}
              onChange={(event) => {
                setTenantId(event.target.value);
                setCycleId("");
                setActiveStep(0);
                setPerformanceSection("setup");
              }}
            >
              <option value="">Select tenant</option>
              {tenantOptions.map((tenant) => (
                <option key={tenant.id} value={tenant.id}>
                  {tenant.name} ({tenant.code})
                </option>
              ))}
            </Select>
          ) : (
            <div className="rounded-md border bg-secondary/40 px-3 py-2 text-sm font-medium">
              {activeTenantLabel}
            </div>
          )}
          <Select
            value={cycleId}
            onChange={(event) => {
              setCycleId(event.target.value);
              setActiveStep(event.target.value ? 1 : 0);
              setPerformanceSection(event.target.value ? "hierarchy" : "setup");
            }}
          >
            <option value="">New cycle</option>
            {cycles.data?.data.map((cycle) => (
              <option key={cycle.id} value={cycle.id}>
                {cycle.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {error ? <Alert variant="destructive">{error}</Alert> : null}
      {success ? <Alert>{success}</Alert> : null}

      <div className="grid gap-4 md:grid-cols-4">
        {metrics.map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardContent className="flex items-center gap-4 p-5">
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-accent">
                <Icon className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className="text-lg font-semibold">{value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-2 md:grid-cols-5">
        {performanceSections.map(({ id, label, description, icon: Icon }) => {
          const isActive = activeSection === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setPerformanceSection(id)}
              className={cn(
                "rounded-md border bg-white p-4 text-left transition hover:border-primary/30 hover:bg-accent/25",
                isActive && "border-primary bg-primary text-white shadow-[0_12px_28px_rgba(14,22,63,0.14)]"
              )}
            >
              <span
                className={cn(
                  "mb-3 grid h-9 w-9 place-items-center rounded-md bg-accent text-primary",
                  isActive && "bg-white/15 text-white"
                )}
              >
                <Icon className="h-4 w-4" />
              </span>
              <span className="block text-sm font-semibold">{label}</span>
              <span className={cn("mt-1 block text-xs text-muted-foreground", isActive && "text-white/75")}>
                {description}
              </span>
            </button>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{activeSectionMeta.label}</CardTitle>
          <CardDescription>{activeSectionMeta.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {activeSection === "setup" || activeSection === "hierarchy" || activeSection === "assignments" ? (
            <Stepper
              activeStep={activeStep}
              setActiveStep={(step) => {
                setActiveStep(step);
                setPerformanceSection(
                  step === 0 ? "setup" : step === 1 ? "hierarchy" : "assignments"
                );
              }}
              cycleId={cycleId}
              hierarchyReady={hierarchyReady}
            />
          ) : null}

          {activeSection === "setup" ? (
            <CycleDetailsStep
              tenantId={tenantId}
              disabled={!canManagePerformance}
              isSaving={createCycle.isPending}
              onSubmit={(input) => createCycle.mutate(input)}
            />
          ) : null}

          {activeSection === "hierarchy" ? (
            <>
              <TemplateLibrary
                templates={performanceTemplates}
                disabled={!canManageGoals || !cycleId || Boolean(goals.data?.data.length)}
                isApplying={applyTemplate.isPending}
                onApply={(template) => applyTemplate.mutate(template)}
              />
              <GoalHierarchyStep
                cycleId={cycleId}
                tenantId={tenantId}
                goals={goals.data?.data ?? []}
                isLoading={goals.isLoading}
                canManage={canManageGoals}
                hierarchyReady={hierarchyReady}
                goalTotal={goalTotal}
                onAddGoal={(input) =>
                  createGoal.mutate({
                    tenantId,
                    cycleId,
                    name: input.name,
                    description: input.description || null,
                    weightage: Number(input.weightage)
                  })
                }
                onUpdateGoal={(id, input) =>
                  updateGoal.mutate({
                    id,
                    input: {
                      name: input.name,
                      description: input.description || null,
                      weightage: Number(input.weightage)
                    }
                  })
                }
                onDeleteGoal={(id) => deleteGoal.mutate(id)}
                onAddKra={(goalId, input) =>
                  createKra.mutate({
                    goalId,
                    input: {
                      title: input.title,
                      description: input.description || null,
                      weightage: Number(input.weightage)
                    }
                  })
                }
                onUpdateKra={(id, input) =>
                  updateKra.mutate({
                    id,
                    input: {
                      title: input.title,
                      description: input.description || null,
                      weightage: Number(input.weightage)
                    }
                  })
                }
                onDeleteKra={(id) => deleteKra.mutate(id)}
                onAddKpi={(kraId, input) =>
                  createKpi.mutate({
                    kraId,
                    input: {
                      description: input.description,
                      targetValue: input.targetValue ? Number(input.targetValue) : null,
                      weightage: Number(input.weightage)
                    }
                  })
                }
                onUpdateKpi={(id, input) =>
                  updateKpi.mutate({
                    id,
                    input: {
                      description: input.description,
                      targetValue: input.targetValue ? Number(input.targetValue) : null,
                      weightage: Number(input.weightage)
                    }
                  })
                }
                onDeleteKpi={(id) => deleteKpi.mutate(id)}
                onContinue={() => {
                  setSuccess(undefined);
                  setActiveStep(2);
                  setPerformanceSection("assignments");
                }}
              />
            </>
          ) : null}

          {activeSection === "assignments" ? (
            <>
              {!cycleId ? (
                <Alert>Select or create a cycle before assigning assessments.</Alert>
              ) : null}
              {cycleId && !hierarchyReady ? (
                <Alert>
                  Complete goal, KRA, and KPI weightage totals to 100% before assigning
                  performance assessments.
                </Alert>
              ) : null}
              <ReviewAssignmentStep
                tenantId={tenantId}
                cycleId={cycleId}
                canReview={canReview && hierarchyReady}
                isSaving={bulkCreateReviews.isPending}
                onSubmit={(input) => bulkCreateReviews.mutate(input)}
              />
            </>
          ) : null}

          {activeSection === "reviews" ? (
            <ReviewsTable reviews={reviews.data?.data ?? []} />
          ) : null}

          {activeSection === "assessments" ? (
            <AssessmentsCard
              reviews={reviews.data?.data ?? []}
              canReview={canReview}
              selfPending={selfAssessment.isPending}
              managerPending={managerAssessment.isPending}
              onSelf={(id, input) => selfAssessment.mutate({ id, input })}
              onManager={(id, input) => managerAssessment.mutate({ id, input })}
            />
          ) : null}
        </CardContent>
      </Card>

      {activeSection === "hierarchy" ? (
        <Card>
          <CardHeader>
            <CardTitle>Goal hierarchy</CardTitle>
            <CardDescription>Weighted goal, KRA, and KPI structure.</CardDescription>
          </CardHeader>
          <CardContent>
            {goals.isLoading ? (
              <LoaderCircle className="h-5 w-5 animate-spin" />
            ) : (
              <div className="space-y-4">
                {(goals.data?.data ?? []).map((goal) => (
                  <div key={goal.id} className="rounded-md border p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-semibold">{goal.name}</p>
                        <p className="text-sm text-muted-foreground">{goal.description}</p>
                      </div>
                      <Badge variant="secondary">{formatWeight(goal.weightage)}%</Badge>
                    </div>
                    <div className="mt-4 space-y-3">
                      {goal.kras.map((kra) => (
                        <div key={kra.id} className="border-l-2 pl-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium">{kra.title}</p>
                            <Badge variant="outline">{formatWeight(kra.weightage)}%</Badge>
                          </div>
                          <div className="mt-2 space-y-2">
                            {kra.kpis.map((kpi) => (
                              <div
                                key={kpi.id}
                                className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/40 p-3 text-sm"
                              >
                                <span>{kpi.description}</span>
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline">{formatWeight(kpi.weightage)}%</Badge>
                                  {kpi.score ? <Badge variant="success">Score {kpi.score}</Badge> : null}
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={updateKpiProgress.isPending}
                                    onClick={() =>
                                      updateKpiProgress.mutate({
                                        id: kpi.id,
                                        input: {
                                          actualValue: Number(kpi.targetValue ?? 0),
                                          achievementPercentage: 100,
                                          score: 5
                                        }
                                      })
                                    }
                                  >
                                    Mark met
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                {!goals.data?.data.length ? (
                  <p className="text-sm text-muted-foreground">
                    Select or create a cycle, then add goals in the guided setup.
                  </p>
                ) : null}
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function TemplateLibrary({
  templates,
  disabled,
  isApplying,
  onApply
}: {
  templates: PerformanceTemplate[];
  disabled: boolean;
  isApplying: boolean;
  onApply: (template: PerformanceTemplate) => void;
}) {
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const selectedTemplate =
    templates.find((template) => template.id === templateId) ?? templates[0];

  if (!selectedTemplate) return null;

  const kraCount = selectedTemplate.goals.reduce(
    (count, goal) => count + goal.kras.length,
    0
  );
  const kpiCount = selectedTemplate.goals.reduce(
    (count, goal) =>
      count + goal.kras.reduce((kpiTotal, kra) => kpiTotal + kra.kpis.length, 0),
    0
  );

  return (
    <div className="rounded-md border bg-lime-50/40 p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold">Excel KRA templates</p>
          <p className="text-sm text-muted-foreground">
            Apply a role template from the uploaded workbook to quickly build an
            accurate goal, KRA, and KPI hierarchy.
          </p>
        </div>
        <Badge variant="secondary">{selectedTemplate.source}</Badge>
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
        <Select value={templateId} onChange={(event) => setTemplateId(event.target.value)}>
          {templates.map((template) => (
            <option key={template.id} value={template.id}>
              {template.name}
            </option>
          ))}
        </Select>
        <Button
          type="button"
          disabled={disabled || isApplying}
          onClick={() => onApply(selectedTemplate)}
        >
          {isApplying ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Apply template
        </Button>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-4">
        <div className="rounded-md bg-white p-3">
          <p className="text-xs text-muted-foreground">Role</p>
          <p className="text-sm font-semibold">{selectedTemplate.role}</p>
        </div>
        <div className="rounded-md bg-white p-3">
          <p className="text-xs text-muted-foreground">Goals</p>
          <p className="text-sm font-semibold">{selectedTemplate.goals.length}</p>
        </div>
        <div className="rounded-md bg-white p-3">
          <p className="text-xs text-muted-foreground">KRAs</p>
          <p className="text-sm font-semibold">{kraCount}</p>
        </div>
        <div className="rounded-md bg-white p-3">
          <p className="text-xs text-muted-foreground">KPIs</p>
          <p className="text-sm font-semibold">{kpiCount}</p>
        </div>
      </div>
      {disabled ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Templates are available after selecting an empty cycle. Existing cycles
          can still be managed manually below.
        </p>
      ) : null}
    </div>
  );
}

function Stepper({
  activeStep,
  setActiveStep,
  cycleId,
  hierarchyReady
}: {
  activeStep: Step;
  setActiveStep: (step: Step) => void;
  cycleId: string;
  hierarchyReady: boolean;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {steps.map((step, index) => {
        const disabled = (index > 0 && !cycleId) || (index === 2 && !hierarchyReady);
        const isActive = activeStep === index;
        return (
          <button
            key={step}
            type="button"
            disabled={disabled}
            onClick={() => setActiveStep(index as Step)}
            className={cn(
              "flex items-center gap-3 rounded-md border p-3 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50",
              isActive ? "border-primary bg-primary/5" : "bg-background hover:bg-accent"
            )}
          >
            <span
              className={cn(
                "grid h-7 w-7 place-items-center rounded-full border text-xs font-semibold",
                isActive && "border-primary bg-primary text-primary-foreground"
              )}
            >
              {index + 1}
            </span>
            <span className="font-medium">{step}</span>
          </button>
        );
      })}
    </div>
  );
}

function CycleDetailsStep({
  tenantId,
  disabled,
  isSaving,
  onSubmit
}: {
  tenantId: string;
  disabled: boolean;
  isSaving: boolean;
  onSubmit: (input: {
    tenantId: string;
    name: string;
    startDate: string;
    endDate: string;
    status: "DRAFT" | "ACTIVE" | "CLOSED" | "ARCHIVED";
  }) => void;
}) {
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [status, setStatus] = useState<"DRAFT" | "ACTIVE" | "CLOSED" | "ARCHIVED">("ACTIVE");
  const isValid = Boolean(tenantId && name.trim().length >= 2 && startDate && endDate && endDate > startDate);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isValid) return;
    onSubmit({ tenantId, name, startDate, endDate, status });
  }

  return (
    <form className="max-w-3xl space-y-4" onSubmit={submit}>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="space-y-1.5 md:col-span-2">
          <span className="text-sm font-medium">Cycle name</span>
          <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="2H2026" required />
        </label>
        <label className="space-y-1.5">
          <span className="text-sm font-medium">Start date</span>
          <Input value={startDate} onChange={(event) => setStartDate(event.target.value)} type="date" required />
        </label>
        <label className="space-y-1.5">
          <span className="text-sm font-medium">End date</span>
          <Input value={endDate} onChange={(event) => setEndDate(event.target.value)} type="date" required />
        </label>
        <label className="space-y-1.5">
          <span className="text-sm font-medium">Status</span>
          <Select value={status} onChange={(event) => setStatus(event.target.value as typeof status)}>
            <option value="DRAFT">Draft</option>
            <option value="ACTIVE">Active</option>
            <option value="CLOSED">Closed</option>
            <option value="ARCHIVED">Archived</option>
          </Select>
        </label>
      </div>
      {startDate && endDate && endDate <= startDate ? (
        <Alert variant="destructive">Start date must be before end date.</Alert>
      ) : null}
      <Button disabled={disabled || !isValid || isSaving}>
        {isSaving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
        Save & Continue
      </Button>
    </form>
  );
}

function GoalHierarchyStep({
  cycleId,
  tenantId,
  goals,
  isLoading,
  canManage,
  hierarchyReady,
  goalTotal,
  onAddGoal,
  onUpdateGoal,
  onDeleteGoal,
  onAddKra,
  onUpdateKra,
  onDeleteKra,
  onAddKpi,
  onUpdateKpi,
  onDeleteKpi,
  onContinue
}: {
  cycleId: string;
  tenantId: string;
  goals: PerformanceGoal[];
  isLoading: boolean;
  canManage: boolean;
  hierarchyReady: boolean;
  goalTotal: number;
  onAddGoal: (input: typeof emptyGoal) => void;
  onUpdateGoal: (id: string, input: typeof emptyGoal) => void;
  onDeleteGoal: (id: string) => void;
  onAddKra: (goalId: string, input: typeof emptyKra) => void;
  onUpdateKra: (id: string, input: typeof emptyKra) => void;
  onDeleteKra: (id: string) => void;
  onAddKpi: (kraId: string, input: typeof emptyKpi) => void;
  onUpdateKpi: (id: string, input: typeof emptyKpi) => void;
  onDeleteKpi: (id: string) => void;
  onContinue: () => void;
}) {
  const [goalDraft, setGoalDraft] = useState(emptyGoal);
  const [expandedGoals, setExpandedGoals] = useState<string[]>([]);
  const [editingGoal, setEditingGoal] = useState<string>();
  const [kraDraftGoal, setKraDraftGoal] = useState<string>();
  const [editingKra, setEditingKra] = useState<string>();
  const [kpiDraftKra, setKpiDraftKra] = useState<string>();
  const [editingKpi, setEditingKpi] = useState<string>();

  useEffect(() => {
    if (!expandedGoals.length && goals[0]) setExpandedGoals([goals[0].id]);
  }, [expandedGoals.length, goals]);

  if (!cycleId) {
    return <Alert>Create or select a cycle before adding goals.</Alert>;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-muted/30 p-3">
        <div>
          <p className="text-sm font-medium">Goal total</p>
          <p className="text-sm text-muted-foreground">The cycle should total 100% before review assignment.</p>
        </div>
        <WeightageIndicator value={goalTotal} />
      </div>

      {canManage ? (
        <InlinePanel title="+ Add Goal">
          <HierarchyForm
            values={goalDraft}
            labels={["Goal name", "Description", "Weightage"]}
            onChange={setGoalDraft}
            onSubmit={() => {
              onAddGoal(goalDraft);
              setGoalDraft(emptyGoal);
            }}
            submitLabel="Add Goal"
            disabled={!tenantId || !isDraftValid(goalDraft)}
          />
        </InlinePanel>
      ) : null}

      {isLoading ? (
        <LoaderCircle className="h-5 w-5 animate-spin" />
      ) : (
        <div className="space-y-3">
          {goals.map((goal) => {
            const isExpanded = expandedGoals.includes(goal.id);
            const kraTotal = totalWeight(goal.kras);
            return (
              <div key={goal.id} className="rounded-md border">
                <div className="flex flex-wrap items-start justify-between gap-3 p-4">
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-start gap-2 text-left"
                    onClick={() =>
                      setExpandedGoals((current) =>
                        current.includes(goal.id)
                          ? current.filter((id) => id !== goal.id)
                          : [...current, goal.id]
                      )
                    }
                  >
                    {isExpanded ? <ChevronDown className="mt-1 h-4 w-4" /> : <ChevronRight className="mt-1 h-4 w-4" />}
                    <span className="min-w-0">
                      <span className="block font-semibold">{goal.name}</span>
                      <span className="block text-sm text-muted-foreground">{goal.description || "No description"}</span>
                    </span>
                  </button>
                  <div className="flex flex-wrap items-center gap-2">
                    <WeightageIndicator value={toNumber(goal.weightage)} compact />
                    <Button size="sm" variant="outline" onClick={() => setEditingGoal(goal.id)}>
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => onDeleteGoal(goal.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </Button>
                  </div>
                </div>
                {editingGoal === goal.id ? (
                  <div className="border-t p-4">
                    <HierarchyForm
                      values={{
                        name: goal.name,
                        description: goal.description ?? "",
                        weightage: String(goal.weightage)
                      }}
                      labels={["Goal name", "Description", "Weightage"]}
                      onSubmit={(input) => {
                        onUpdateGoal(goal.id, input);
                        setEditingGoal(undefined);
                      }}
                      onCancel={() => setEditingGoal(undefined)}
                      submitLabel="Save Goal"
                    />
                  </div>
                ) : null}
                {isExpanded ? (
                  <div className="space-y-3 border-t p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-sm font-medium">KRAs under this goal</div>
                      <div className="flex items-center gap-2">
                        <WeightageIndicator value={kraTotal} compact />
                        <Button size="sm" variant="outline" onClick={() => setKraDraftGoal(goal.id)}>
                          <Plus className="h-3.5 w-3.5" />
                          Add KRA
                        </Button>
                      </div>
                    </div>
                    {kraDraftGoal === goal.id ? (
                      <HierarchyForm
                        values={emptyKra}
                        labels={["KRA name", "Description", "Weightage"]}
                        onSubmit={(input) => {
                          onAddKra(goal.id, input);
                          setKraDraftGoal(undefined);
                        }}
                        onCancel={() => setKraDraftGoal(undefined)}
                        submitLabel="Add KRA"
                      />
                    ) : null}
                    {goal.kras.map((kra) => (
                      <KraBlock
                        key={kra.id}
                        kra={kra}
                        isEditing={editingKra === kra.id}
                        isAddingKpi={kpiDraftKra === kra.id}
                        editingKpi={editingKpi}
                        onEditKra={() => setEditingKra(kra.id)}
                        onCancelEditKra={() => setEditingKra(undefined)}
                        onUpdateKra={(input) => {
                          onUpdateKra(kra.id, input);
                          setEditingKra(undefined);
                        }}
                        onDeleteKra={() => onDeleteKra(kra.id)}
                        onAddKpi={() => setKpiDraftKra(kra.id)}
                        onCancelAddKpi={() => setKpiDraftKra(undefined)}
                        onSubmitKpi={(input) => {
                          onAddKpi(kra.id, input);
                          setKpiDraftKra(undefined);
                        }}
                        onEditKpi={setEditingKpi}
                        onCancelEditKpi={() => setEditingKpi(undefined)}
                        onUpdateKpi={(kpiId, input) => {
                          onUpdateKpi(kpiId, input);
                          setEditingKpi(undefined);
                        }}
                        onDeleteKpi={onDeleteKpi}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
          {!goals.length ? (
            <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              No goals yet. Add the first goal to build the hierarchy.
            </p>
          ) : null}
        </div>
      )}

      {!hierarchyReady ? (
        <Alert>Goal, KRA, and KPI totals should each equal 100% before continuing.</Alert>
      ) : null}
      <div className="flex justify-end">
        <Button disabled={!hierarchyReady} onClick={onContinue}>
          Save Goals & Continue
        </Button>
      </div>
    </div>
  );
}

function KraBlock({
  kra,
  isEditing,
  isAddingKpi,
  editingKpi,
  onEditKra,
  onCancelEditKra,
  onUpdateKra,
  onDeleteKra,
  onAddKpi,
  onCancelAddKpi,
  onSubmitKpi,
  onEditKpi,
  onCancelEditKpi,
  onUpdateKpi,
  onDeleteKpi
}: {
  kra: PerformanceKra;
  isEditing: boolean;
  isAddingKpi: boolean;
  editingKpi?: string;
  onEditKra: () => void;
  onCancelEditKra: () => void;
  onUpdateKra: (input: typeof emptyKra) => void;
  onDeleteKra: () => void;
  onAddKpi: () => void;
  onCancelAddKpi: () => void;
  onSubmitKpi: (input: typeof emptyKpi) => void;
  onEditKpi: (id: string) => void;
  onCancelEditKpi: () => void;
  onUpdateKpi: (id: string, input: typeof emptyKpi) => void;
  onDeleteKpi: (id: string) => void;
}) {
  const kpiTotal = totalWeight(kra.kpis);
  return (
    <div className="rounded-md border bg-muted/20 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium">{kra.title}</p>
          <p className="text-sm text-muted-foreground">{kra.description || "No description"}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <WeightageIndicator value={toNumber(kra.weightage)} compact />
          <Button size="sm" variant="outline" onClick={onAddKpi}>
            <Plus className="h-3.5 w-3.5" />
            Add KPI
          </Button>
          <Button size="sm" variant="outline" onClick={onEditKra}>
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </Button>
          <Button size="sm" variant="ghost" onClick={onDeleteKra}>
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </Button>
        </div>
      </div>
      {isEditing ? (
        <div className="mt-3">
          <HierarchyForm
            values={{
              title: kra.title,
              description: kra.description ?? "",
              weightage: String(kra.weightage)
            }}
            labels={["KRA name", "Description", "Weightage"]}
            onSubmit={onUpdateKra}
            onCancel={onCancelEditKra}
            submitLabel="Save KRA"
          />
        </div>
      ) : null}
      <div className="mt-3 flex justify-end">
        <WeightageIndicator value={kpiTotal} compact label="KPI total" />
      </div>
      {isAddingKpi ? (
        <div className="mt-3">
          <HierarchyForm
            values={emptyKpi}
            labels={["KPI description", "Target", "Weightage"]}
            onSubmit={onSubmitKpi}
            onCancel={onCancelAddKpi}
            submitLabel="Add KPI"
          />
        </div>
      ) : null}
      <div className="mt-3 space-y-2">
        {kra.kpis.map((kpi) => (
          <div key={kpi.id} className="rounded-md bg-background p-3">
            {editingKpi === kpi.id ? (
              <HierarchyForm
                values={{
                  description: kpi.description,
                  targetValue: kpi.targetValue ? String(kpi.targetValue) : "",
                  weightage: String(kpi.weightage)
                }}
                labels={["KPI description", "Target", "Weightage"]}
                onSubmit={(input) => onUpdateKpi(kpi.id, input)}
                onCancel={onCancelEditKpi}
                submitLabel="Save KPI"
              />
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <div>
                  <p className="font-medium">{kpi.description}</p>
                  <p className="text-muted-foreground">Target: {kpi.targetValue ?? "-"}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{formatWeight(kpi.weightage)}%</Badge>
                  <Button size="sm" variant="outline" onClick={() => onEditKpi(kpi.id)}>
                    Edit
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => onDeleteKpi(kpi.id)}>
                    Delete
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}
        {!kra.kpis.length ? (
          <p className="text-sm text-muted-foreground">No KPIs yet.</p>
        ) : null}
      </div>
    </div>
  );
}

function InlinePanel({
  title,
  children
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-md border p-4">
      <p className="mb-3 text-sm font-semibold">{title}</p>
      {children}
    </div>
  );
}

function HierarchyForm<T extends Record<string, string>>({
  values,
  labels,
  onChange,
  onSubmit,
  onCancel,
  submitLabel,
  disabled
}: {
  values: T;
  labels: string[];
  onChange?: (values: T) => void;
  onSubmit: (values: T) => void;
  onCancel?: () => void;
  submitLabel: string;
  disabled?: boolean;
}) {
  const [localValues, setLocalValues] = useState(values);
  const entries = Object.entries(localValues);

  function setField(key: string, value: string) {
    const next = { ...localValues, [key]: value };
    setLocalValues(next);
    onChange?.(next);
  }

  return (
    <form
      className="grid gap-3 md:grid-cols-[1fr_1fr_120px_auto]"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(localValues);
      }}
    >
      {entries.map(([key, value], index) => (
        <Input
          key={key}
          value={value}
          type={key.toLowerCase().includes("weightage") || key.toLowerCase().includes("target") ? "number" : "text"}
          min={key.toLowerCase().includes("weightage") ? 0 : undefined}
          max={key.toLowerCase().includes("weightage") ? 100 : undefined}
          placeholder={labels[index] ?? key}
          onChange={(event) => setField(key, event.target.value)}
          required={!key.toLowerCase().includes("description") && !key.toLowerCase().includes("target")}
        />
      ))}
      <div className="flex gap-2 md:col-span-4">
        <Button size="sm" disabled={disabled}>
          {submitLabel}
        </Button>
        {onCancel ? (
          <Button type="button" size="sm" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  );
}

function ReviewAssignmentStep({
  tenantId,
  cycleId,
  canReview,
  isSaving,
  onSubmit
}: {
  tenantId: string;
  cycleId: string;
  canReview: boolean;
  isSaving: boolean;
  onSubmit: (input: {
    tenantId: string;
    cycleId: string;
    employeeUserIds: string[];
    managerUserId?: string | null;
    organizationId?: string | null;
  }) => void;
}) {
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [selectedEmployeeRecords, setSelectedEmployeeRecords] = useState<AdminUser[]>([]);
  const [employeeToAddId, setEmployeeToAddId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [teamId, setTeamId] = useState("");
  const selectedScopeId = teamId || departmentId;

  const employees = useQuery({
    queryKey: ["admin", "users", "employees", tenantId, selectedScopeId],
    queryFn: () =>
      adminApi.listUsers({
        tenantId,
        ...(selectedScopeId ? { departmentId: selectedScopeId } : {}),
        role: "employee",
        status: "ACTIVE",
        limit: 1000
      }),
    enabled: Boolean(tenantId)
  });
  const departments = useQuery({
    queryKey: ["admin", "organizations", "departments", tenantId],
    queryFn: () =>
      adminApi.listOrganizations({
        tenantId,
        organizationType: "department"
      }),
    enabled: Boolean(tenantId)
  });
  const teams = useQuery({
    queryKey: ["admin", "organizations", "teams", tenantId, departmentId],
    queryFn: () =>
      adminApi.listOrganizations({
        tenantId,
        organizationType: "team",
        departmentId
    }),
    enabled: Boolean(tenantId && departmentId)
  });

  useEffect(() => {
    setEmployeeToAddId("");
    setSelectedEmployeeIds([]);
    setSelectedEmployeeRecords([]);
  }, [selectedScopeId]);

  const selectedEmployees = selectedEmployeeRecords.filter((employee) =>
    selectedEmployeeIds.includes(employee.id)
  );
  const availableEmployees =
    employees.data?.data.filter((employee) => !selectedEmployeeIds.includes(employee.id)) ??
    [];
  const selectedManagers = uniqueManagers(selectedEmployees);
  const employeesWithoutManager = selectedEmployees.filter(
    (employee) => !employee.reportingManagerUserId
  );

  function addEmployee(employeeId: string) {
    const employee = employees.data?.data.find((item) => item.id === employeeId);
    if (!employee) return;
    setSelectedEmployeeIds((current) =>
      current.includes(employee.id) ? current : [...current, employee.id]
    );
    setSelectedEmployeeRecords((records) =>
      records.some((item) => item.id === employee.id) ? records : [...records, employee]
    );
    setEmployeeToAddId("");
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!tenantId || !cycleId || !selectedEmployeeIds.length) return;
    onSubmit({
      tenantId,
      cycleId,
      employeeUserIds: selectedEmployeeIds,
      managerUserId: null,
      organizationId: teamId || departmentId || null
    });
  }

  return (
    <form className="space-y-5" onSubmit={submit}>
      {!cycleId ? <Alert>Select or create a cycle before assigning assessments.</Alert> : null}
      <div className="rounded-md border">
        <div className="grid gap-3 border-b p-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Department
            </span>
            <Select
              value={departmentId}
              onChange={(event) => {
                setDepartmentId(event.target.value);
                setTeamId("");
              }}
            >
              <option value="">No department scope</option>
              {departments.data?.data.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </Select>
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Team
            </span>
            <Select
              value={teamId}
              disabled={!departmentId}
              onChange={(event) => setTeamId(event.target.value)}
            >
              <option value="">
                {departmentId ? "No team scope" : "Select department first"}
              </option>
              {teams.data?.data.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </Select>
          </label>
          <ReportingManagerField
            label="Manager reviewer"
            managers={selectedManagers}
            missingCount={employeesWithoutManager.length}
          />
          <AssignmentUserSelect
            label="Employees to assess"
            placeholder="Add employee"
            users={availableEmployees}
            value={employeeToAddId}
            onChange={addEmployee}
            isLoading={employees.isLoading}
          />
        </div>
        <div className="flex flex-wrap gap-2 p-3 text-xs text-muted-foreground">
          <Badge variant={selectedScopeId ? "success" : "secondary"}>
            {selectedScopeId ? "Scoped" : "Tenant-wide"}
          </Badge>
          <span>
            {selectedManagers.length} reporting manager
            {selectedManagers.length === 1 ? "" : "s"}
          </span>
          <span>
            {employees.isLoading
              ? "Loading employees..."
              : `${employees.data?.data.length ?? 0} assessable employees`}
          </span>
        </div>
      </div>
      {employeesWithoutManager.length ? (
        <Alert>
          Set a reporting manager for {employeesWithoutManager.length} selected employee
          {employeesWithoutManager.length === 1 ? "" : "s"} before creating reviews.
        </Alert>
      ) : null}

      <div className="rounded-md border">
        <div className="border-b p-3 text-sm font-medium">
          Selected employees ({selectedEmployeeIds.length})
        </div>
        {selectedEmployeeIds.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Department</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {selectedEmployees.map((employee) => (
                <TableRow key={employee.id}>
                  <TableCell>{userLabel(employee)}</TableCell>
                  <TableCell>{userDepartment(employee)}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setSelectedEmployeeIds((current) =>
                          current.filter((id) => id !== employee.id)
                        );
                        setSelectedEmployeeRecords((records) =>
                          records.filter((item) => item.id !== employee.id)
                        );
                      }}
                    >
                      Remove
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="p-4 text-sm text-muted-foreground">No employees selected.</p>
        )}
      </div>

      <div className="flex justify-end">
        <Button
          disabled={
            !canReview ||
            !cycleId ||
            !selectedEmployeeIds.length ||
            Boolean(employeesWithoutManager.length) ||
            isSaving
          }
        >
          {isSaving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ClipboardCheck className="h-4 w-4" />}
          Create Reviews
        </Button>
      </div>
    </form>
  );
}

function ManagerPerformanceDashboard({
  tenantName,
  isLoading,
  managerReviews,
  ownReviews,
  pendingReviews,
  completedReviews,
  averageScore,
  managerPending,
  onManager,
  error,
  success
}: {
  tenantName: string;
  isLoading: boolean;
  managerReviews: PerformanceReview[];
  ownReviews: PerformanceReview[];
  pendingReviews: PerformanceReview[];
  completedReviews: PerformanceReview[];
  averageScore: string;
  managerPending: boolean;
  onManager: (
    id: string,
    input: {
      managerScore: number;
      finalScore?: number | null;
      managerComments: string;
      status: "MANAGER_REVIEWED" | "APPROVED" | "REJECTED";
    }
  ) => void;
  error?: string;
  success?: string;
}) {
  const metrics = [
    { label: "Assigned reviews", value: managerReviews.length, icon: FileCheck2 },
    { label: "Needs manager action", value: pendingReviews.length, icon: ClipboardCheck },
    { label: "Completed", value: completedReviews.length, icon: CheckCircle2 },
    { label: "Avg team score", value: averageScore, icon: BarChart3 }
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">Manager performance dashboard</h1>
          <p className="text-muted-foreground">
            Review employees assigned to you and track your own performance cycle.
          </p>
        </div>
        <div className="rounded-md border bg-secondary/40 px-3 py-2 text-sm font-medium">
          {tenantName}
        </div>
      </div>

      {error ? <Alert variant="destructive">{error}</Alert> : null}
      {success ? <Alert>{success}</Alert> : null}

      <div className="grid gap-4 md:grid-cols-4">
        {metrics.map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardContent className="flex items-center gap-4 p-5">
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-accent">
                <Icon className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className="text-lg font-semibold">
                  {isLoading ? <LoaderCircle className="h-5 w-5 animate-spin" /> : value}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <ManagerReviewQueue
          reviews={pendingReviews}
          isLoading={isLoading}
          isSaving={managerPending}
          onManager={onManager}
        />
        <ReviewsTable
          reviews={ownReviews}
          title="My performance"
          description="Your own employee review records."
          emptyMessage="No personal performance reviews assigned yet."
        />
      </div>

      {completedReviews.length ? (
        <ReviewsTable
          reviews={completedReviews}
          title="Completed manager reviews"
          description="Employees you have already scored or approved."
          emptyMessage="No completed manager reviews yet."
        />
      ) : null}
    </div>
  );
}

function ManagerReviewQueue({
  reviews,
  isLoading,
  isSaving,
  onManager
}: {
  reviews: PerformanceReview[];
  isLoading: boolean;
  isSaving: boolean;
  onManager: (
    id: string,
    input: {
      managerScore: number;
      finalScore?: number | null;
      managerComments: string;
      status: "MANAGER_REVIEWED" | "APPROVED" | "REJECTED";
    }
  ) => void;
}) {
  function submitManager(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    onManager(String(form.get("reviewId")), {
      managerScore: Number(form.get("managerScore")),
      finalScore: Number(form.get("finalScore") || form.get("managerScore")),
      managerComments: String(form.get("managerComments")),
      status: String(form.get("status")) as "MANAGER_REVIEWED" | "APPROVED" | "REJECTED"
    });
    event.currentTarget.reset();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Manager review queue</CardTitle>
        <CardDescription>
          Reviews where you are the assigned reporting manager.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <LoaderCircle className="h-5 w-5 animate-spin" />
        ) : reviews.length ? (
          reviews.map((review) => (
            <form
              key={review.id}
              className="space-y-3 rounded-md border p-4"
              onSubmit={submitManager}
            >
              <input type="hidden" name="reviewId" value={review.id} />
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">
                    {review.employee.firstName} {review.employee.lastName}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {review.employee.email}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {review.cycle.name}
                  </p>
                </div>
                <Badge variant="outline">{review.status}</Badge>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <Input
                  name="managerScore"
                  type="number"
                  min="0"
                  max="5"
                  step="0.1"
                  placeholder="Manager score"
                  required
                />
                <Input
                  name="finalScore"
                  type="number"
                  min="0"
                  max="5"
                  step="0.1"
                  placeholder="Final score"
                />
                <Select name="status" defaultValue="MANAGER_REVIEWED">
                  <option value="MANAGER_REVIEWED">Reviewed</option>
                  <option value="APPROVED">Approved</option>
                  <option value="REJECTED">Rejected</option>
                </Select>
              </div>
              <textarea
                name="managerComments"
                className="min-h-20 w-full rounded-md border bg-background px-3 py-2 text-sm"
                placeholder="Manager comments"
                required
              />
              <Button disabled={isSaving}>
                {isSaving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                Submit manager review
              </Button>
            </form>
          ))
        ) : (
          <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            No employee reviews are assigned to you right now.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function ReportingManagerField({
  label,
  managers,
  missingCount
}: {
  label: string;
  managers: Array<NonNullable<AdminUser["reportingManager"]>>;
  missingCount: number;
}) {
  const singleManager = managers[0];
  const value =
    missingCount > 0
      ? `${missingCount} employee${missingCount === 1 ? "" : "s"} missing manager`
      : managers.length === 0
        ? "Select employee first"
        : managers.length === 1 && singleManager
          ? `${singleManager.firstName} ${singleManager.lastName} - ${singleManager.email}`
          : `${managers.length} reporting managers from selected employees`;

  return (
    <label className="space-y-1.5">
      <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      <div
        className={cn(
          "flex h-10 items-center truncate rounded-md border border-primary/10 bg-muted/40 px-3 py-2 text-sm shadow-inner shadow-primary/5",
          missingCount ? "border-destructive/40 text-destructive" : "text-primary"
        )}
        title={value}
      >
        {value}
      </div>
    </label>
  );
}

function AssignmentUserSelect({
  label,
  placeholder,
  users,
  value,
  onChange,
  isLoading
}: {
  label: string;
  placeholder: string;
  users: AdminUser[];
  value: string;
  onChange: (id: string) => void;
  isLoading: boolean;
}) {
  return (
    <label className="space-y-1.5">
      <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
        {isLoading ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : null}
      </span>
      <Select
        value={value}
        disabled={isLoading || !users.length}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">{isLoading ? "Loading..." : placeholder}</option>
        {users.map((item) => (
          <option key={item.id} value={item.id}>
            {userLabel(item)} - {userMeta(item)}
          </option>
        ))}
      </Select>
    </label>
  );
}

function ReviewsTable({
  reviews,
  title = "Reviews",
  description = "Employee and manager assessment status.",
  emptyMessage = "No performance reviews found."
}: {
  reviews: Array<{
    id: string;
    status: string;
    selfScore: string | null;
    managerScore: string | null;
    finalScore: string | null;
    employee: { firstName: string; lastName: string; email: string };
  }>;
  title?: string;
  description?: string;
  emptyMessage?: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {reviews.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Self</TableHead>
                <TableHead>Manager</TableHead>
                <TableHead>Final</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reviews.map((review) => (
                <TableRow key={review.id}>
                  <TableCell>
                    <p className="font-medium">
                      {review.employee.firstName} {review.employee.lastName}
                    </p>
                    <p className="text-xs text-muted-foreground">{review.employee.email}</p>
                  </TableCell>
                  <TableCell>
                    <Badge variant={review.status === "APPROVED" ? "success" : "secondary"}>
                      {review.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{review.selfScore ?? "-"}</TableCell>
                  <TableCell>{review.managerScore ?? "-"}</TableCell>
                  <TableCell>{review.finalScore ?? "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            {emptyMessage}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function AssessmentsCard({
  reviews,
  canReview,
  selfPending,
  managerPending,
  onSelf,
  onManager
}: {
  reviews: Array<{
    id: string;
    employee: { firstName: string; lastName: string };
  }>;
  canReview: boolean;
  selfPending: boolean;
  managerPending: boolean;
  onSelf: (id: string, input: { selfScore: number; employeeComments: string }) => void;
  onManager: (
    id: string,
    input: {
      managerScore: number;
      finalScore?: number | null;
      managerComments: string;
      status: "MANAGER_REVIEWED" | "APPROVED" | "REJECTED";
    }
  ) => void;
}) {
  function submitSelf(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    onSelf(String(form.get("reviewId")), {
      selfScore: Number(form.get("selfScore")),
      employeeComments: String(form.get("employeeComments"))
    });
    event.currentTarget.reset();
  }

  function submitManager(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    onManager(String(form.get("reviewId")), {
      managerScore: Number(form.get("managerScore")),
      finalScore: Number(form.get("finalScore") || form.get("managerScore")),
      managerComments: String(form.get("managerComments")),
      status: String(form.get("status")) as "MANAGER_REVIEWED" | "APPROVED" | "REJECTED"
    });
    event.currentTarget.reset();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Assessments</CardTitle>
        <CardDescription>Submit self and manager review scores.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 lg:grid-cols-2">
        <form className="space-y-3" onSubmit={submitSelf}>
          <Select name="reviewId" required>
            {reviews.map((review) => (
              <option key={review.id} value={review.id}>
                {review.employee.firstName} {review.employee.lastName}
              </option>
            ))}
          </Select>
          <Input name="selfScore" type="number" min="0" max="5" step="0.1" placeholder="Self score" required />
          <textarea
            name="employeeComments"
            className="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm"
            placeholder="Self comments"
            required
          />
          <Button className="w-full" disabled={!reviews.length || selfPending}>
            Submit self
          </Button>
        </form>
        {canReview ? (
          <form className="space-y-3" onSubmit={submitManager}>
            <Select name="reviewId" required>
              {reviews.map((review) => (
                <option key={review.id} value={review.id}>
                  {review.employee.firstName} {review.employee.lastName}
                </option>
              ))}
            </Select>
            <div className="grid grid-cols-2 gap-3">
              <Input name="managerScore" type="number" min="0" max="5" step="0.1" placeholder="Manager" required />
              <Input name="finalScore" type="number" min="0" max="5" step="0.1" placeholder="Final" />
            </div>
            <Select name="status" defaultValue="MANAGER_REVIEWED">
              <option value="MANAGER_REVIEWED">Reviewed</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
            </Select>
            <textarea
              name="managerComments"
              className="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm"
              placeholder="Manager comments"
              required
            />
            <Button className="w-full" disabled={!reviews.length || managerPending}>
              Submit manager
            </Button>
          </form>
        ) : null}
      </CardContent>
    </Card>
  );
}

function WeightageIndicator({
  value,
  compact = false,
  label = "Total"
}: {
  value: number;
  compact?: boolean;
  label?: string;
}) {
  const isComplete = isTotalComplete(value);
  const isOver = value > 100;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm",
        compact && "px-2 py-1 text-xs",
        isComplete && "border-emerald-200 bg-emerald-50 text-emerald-800",
        isOver && "border-destructive/40 bg-destructive/10 text-destructive",
        !isComplete && !isOver && "bg-background"
      )}
    >
      {label}: {formatWeight(value)}%
    </span>
  );
}

function isDraftValid(values: typeof emptyGoal | typeof emptyKra | typeof emptyKpi) {
  const firstValue = Object.values(values)[0];
  return Boolean(firstValue && Number(values.weightage) >= 0 && Number(values.weightage) <= 100);
}

function totalWeight(items: Array<{ weightage: string | number }>) {
  return items.reduce((sum, item) => sum + toNumber(item.weightage), 0);
}

function toNumber(value: string | number | null | undefined) {
  return Number(value ?? 0);
}

function isTotalComplete(value: number) {
  return Math.abs(value - 100) < 0.001;
}

function formatWeight(value: string | number | null | undefined) {
  const number = toNumber(value);
  return Number.isInteger(number) ? String(number) : number.toFixed(2);
}

function userLabel(user: AdminUser) {
  return `${user.firstName} ${user.lastName} - ${user.email}`;
}

function userMeta(user: AdminUser) {
  const role = user.roleAssignments[0]?.role.name ?? "Employee";
  const department = userDepartment(user);
  return `${role} - ${department}`;
}

function uniqueManagers(users: AdminUser[]) {
  const managers = new Map<string, NonNullable<AdminUser["reportingManager"]>>();
  for (const user of users) {
    if (user.reportingManager) {
      managers.set(user.reportingManager.id, user.reportingManager);
    }
  }
  return [...managers.values()];
}

function hasManagerRole(user: CurrentUser) {
  const values = [
    ...user.roles,
    ...user.roleNames,
    ...user.roleAssignments.flatMap((assignment) => [
      assignment.role.code,
      assignment.role.name
    ])
  ];
  return values.some((value) => value.toLowerCase().includes("manager"));
}

function userDepartment(user: AdminUser) {
  return (
    user.roleAssignments[0]?.organization?.name ??
    user.roleAssignments[0]?.role.department?.name ??
    user.tenant.name
  );
}
