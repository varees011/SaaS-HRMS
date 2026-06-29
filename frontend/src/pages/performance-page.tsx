import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BarChart3,
  ClipboardCheck,
  FileCheck2,
  LoaderCircle,
  Plus,
  Target
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { adminApi } from "@/features/admin/admin.api";
import { performanceApi } from "@/features/performance/performance.api";
import { useAuthStore } from "@/features/auth/auth.store";
import { hasAnyPermission } from "@/features/auth/permissions";
import { ApiError } from "@/lib/api-client";

export function PerformancePage() {
  const user = useAuthStore((state) => state.user)!;
  const [tenantId, setTenantId] = useState(
    user.tenantId ?? user.memberships?.[0]?.tenantId ?? ""
  );
  const [cycleId, setCycleId] = useState("");
  const [error, setError] = useState<string>();
  const queryClient = useQueryClient();
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

  const tenants = useQuery({
    queryKey: ["admin", "tenants", "performance"],
    queryFn: () => adminApi.listTenants(),
    enabled: canListTenants
  });
  const cycles = useQuery({
    queryKey: ["performance", "cycles", tenantId],
    queryFn: () => performanceApi.listCycles({ tenantId }),
    enabled: Boolean(tenantId)
  });
  const dashboard = useQuery({
    queryKey: ["performance", "dashboard", tenantId, cycleId],
    queryFn: () => performanceApi.dashboard({ tenantId, cycleId }),
    enabled: Boolean(tenantId)
  });
  const goals = useQuery({
    queryKey: ["performance", "goals", tenantId, cycleId],
    queryFn: () => performanceApi.listGoals({ tenantId, cycleId }),
    enabled: Boolean(tenantId)
  });
  const reviews = useQuery({
    queryKey: ["performance", "reviews", tenantId, cycleId],
    queryFn: () => performanceApi.listReviews({ tenantId, cycleId }),
    enabled: Boolean(tenantId)
  });

  useEffect(() => {
    if (!tenantId && tenants.data?.data[0]) {
      const customerTenant =
        tenants.data.data.find((tenant) => tenant.code !== "platform") ??
        tenants.data.data[0];
      setTenantId(customerTenant.id);
    }
  }, [tenantId, tenants.data]);

  useEffect(() => {
    if (!cycleId && cycles.data?.data[0]) {
      setCycleId(cycles.data.data[0].id);
    }
  }, [cycleId, cycles.data]);

  const tenantOptions = useMemo(() => {
    if (tenants.data?.data.length) return tenants.data.data;
    return (
      user.memberships?.map((membership) => ({
        id: membership.tenantId,
        code: membership.tenant.code,
        name: membership.tenant.name
      })) ?? []
    );
  }, [tenants.data, user.memberships]);

  const kraOptions = useMemo(
    () =>
      goals.data?.data.flatMap((goal) =>
        goal.kras.map((kra) => ({
          id: kra.id,
          label: `${goal.name} / ${kra.title}`
        }))
      ) ?? [],
    [goals.data]
  );

  const invalidatePerformance = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["performance"] }),
      queryClient.invalidateQueries({ queryKey: ["admin", "tenants"] })
    ]);
  };

  const createCycle = useMutation({
    mutationFn: performanceApi.createCycle,
    onSuccess: invalidatePerformance,
    onError: showError
  });
  const createGoal = useMutation({
    mutationFn: performanceApi.createGoal,
    onSuccess: invalidatePerformance,
    onError: showError
  });
  const createKra = useMutation({
    mutationFn: ({ goalId, input }: {
      goalId: string;
      input: { title: string; description?: string | null; weightage: number };
    }) => performanceApi.createKra(goalId, input),
    onSuccess: invalidatePerformance,
    onError: showError
  });
  const createKpi = useMutation({
    mutationFn: ({ kraId, input }: {
      kraId: string;
      input: { description: string; targetValue?: number | null; weightage: number };
    }) => performanceApi.createKpi(kraId, input),
    onSuccess: invalidatePerformance,
    onError: showError
  });
  const updateKpi = useMutation({
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
  const createReview = useMutation({
    mutationFn: performanceApi.createReview,
    onSuccess: invalidatePerformance,
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

  function showError(reason: unknown) {
    if (reason instanceof ApiError) {
      const fieldMessages =
        reason.fields
          ?.map((field) => `${field.field.replace(/^body\./, "")}: ${field.message}`)
          .join(" ") ?? "";
      setError(fieldMessages ? `${reason.message} ${fieldMessages}` : reason.message);
      return;
    }
    setError("The performance request failed.");
  }

  function submitCycle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError(undefined);
    createCycle.mutate({
      tenantId,
      name: String(form.get("name")),
      startDate: String(form.get("startDate")),
      endDate: String(form.get("endDate")),
      status: String(form.get("status")) as "DRAFT" | "ACTIVE" | "CLOSED" | "ARCHIVED"
    });
    event.currentTarget.reset();
  }

  function submitGoal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError(undefined);
    createGoal.mutate({
      tenantId,
      cycleId: String(form.get("cycleId") || cycleId),
      name: String(form.get("name")),
      description: String(form.get("description") || "") || null,
      weightage: Number(form.get("weightage"))
    });
    event.currentTarget.reset();
  }

  function submitKra(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError(undefined);
    createKra.mutate({
      goalId: String(form.get("goalId")),
      input: {
        title: String(form.get("title")),
        description: String(form.get("description") || "") || null,
        weightage: Number(form.get("weightage"))
      }
    });
    event.currentTarget.reset();
  }

  function submitKpi(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError(undefined);
    createKpi.mutate({
      kraId: String(form.get("kraId")),
      input: {
        description: String(form.get("description")),
        targetValue: Number(form.get("targetValue") || 0),
        weightage: Number(form.get("weightage"))
      }
    });
    event.currentTarget.reset();
  }

  function submitReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError(undefined);
    createReview.mutate({
      tenantId,
      cycleId: String(form.get("cycleId") || cycleId),
      employeeUserId: String(form.get("employeeUserId")),
      managerUserId: String(form.get("managerUserId") || "") || null
    });
    event.currentTarget.reset();
  }

  function submitSelf(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError(undefined);
    selfAssessment.mutate({
      id: String(form.get("reviewId")),
      input: {
        selfScore: Number(form.get("selfScore")),
        employeeComments: String(form.get("employeeComments"))
      }
    });
    event.currentTarget.reset();
  }

  function submitManager(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError(undefined);
    managerAssessment.mutate({
      id: String(form.get("reviewId")),
      input: {
        managerScore: Number(form.get("managerScore")),
        finalScore: Number(form.get("finalScore") || form.get("managerScore")),
        managerComments: String(form.get("managerComments")),
        status: String(form.get("status")) as "MANAGER_REVIEWED" | "APPROVED" | "REJECTED"
      }
    });
    event.currentTarget.reset();
  }

  const metrics = [
    {
      label: "Cycles",
      value: dashboard.data?.data.cycles ?? 0,
      icon: ClipboardCheck
    },
    {
      label: "Goals",
      value: dashboard.data?.data.goals ?? 0,
      icon: Target
    },
    {
      label: "Approved",
      value: dashboard.data?.data.approvedReviews ?? 0,
      icon: FileCheck2
    },
    {
      label: "Avg score",
      value: dashboard.data?.data.averageFinalScore ?? "0",
      icon: BarChart3
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">Performance management</h1>
          <p className="text-muted-foreground">
            Goals, KRAs, KPIs, review cycles, assessments, and scoring.
          </p>
        </div>
        <div className="flex min-w-72 flex-wrap gap-2">
          <Select value={tenantId} onChange={(event) => setTenantId(event.target.value)}>
            <option value="">Select tenant</option>
            {tenantOptions.map((tenant) => (
              <option key={tenant.id} value={tenant.id}>
                {tenant.name} ({tenant.code})
              </option>
            ))}
          </Select>
          <Select value={cycleId} onChange={(event) => setCycleId(event.target.value)}>
            <option value="">All cycles</option>
            {cycles.data?.data.map((cycle) => (
              <option key={cycle.id} value={cycle.id}>
                {cycle.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {error ? <Alert variant="destructive">{error}</Alert> : null}

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

      <div className="grid gap-4 xl:grid-cols-3">
        {canManagePerformance ? (
          <Card>
            <CardHeader>
              <CardTitle>Create cycle</CardTitle>
              <CardDescription>Open a tenant review window.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-3" onSubmit={submitCycle}>
                <Input name="name" placeholder="Cycle name" required />
                <div className="grid grid-cols-2 gap-3">
                  <Input name="startDate" type="date" required />
                  <Input name="endDate" type="date" required />
                </div>
                <Select name="status" defaultValue="ACTIVE">
                  <option value="DRAFT">Draft</option>
                  <option value="ACTIVE">Active</option>
                  <option value="CLOSED">Closed</option>
                  <option value="ARCHIVED">Archived</option>
                </Select>
                <Button className="w-full" disabled={!tenantId || createCycle.isPending}>
                  <Plus className="h-4 w-4" />
                  Create cycle
                </Button>
              </form>
            </CardContent>
          </Card>
        ) : null}

        {canManageGoals ? (
          <Card>
            <CardHeader>
              <CardTitle>Create goal</CardTitle>
              <CardDescription>Assign weighted goals to a cycle.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-3" onSubmit={submitGoal}>
                <Select name="cycleId" defaultValue={cycleId} required>
                  {cycles.data?.data.map((cycle) => (
                    <option key={cycle.id} value={cycle.id}>
                      {cycle.name}
                    </option>
                  ))}
                </Select>
                <Input name="name" placeholder="Goal name" required />
                <Input name="description" placeholder="Description" />
                <Input name="weightage" type="number" min="0" max="100" placeholder="Weightage" required />
                <Button className="w-full" disabled={!cycleId || createGoal.isPending}>
                  <Target className="h-4 w-4" />
                  Create goal
                </Button>
              </form>
            </CardContent>
          </Card>
        ) : null}

        {canReview ? (
          <Card>
            <CardHeader>
              <CardTitle>Create review</CardTitle>
              <CardDescription>Start an employee assessment.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-3" onSubmit={submitReview}>
                <Select name="cycleId" defaultValue={cycleId} required>
                  {cycles.data?.data.map((cycle) => (
                    <option key={cycle.id} value={cycle.id}>
                      {cycle.name}
                    </option>
                  ))}
                </Select>
                <Input name="employeeUserId" placeholder="Employee user ID" required />
                <Input name="managerUserId" placeholder="Manager user ID" />
                <Button className="w-full" disabled={!cycleId || createReview.isPending}>
                  <ClipboardCheck className="h-4 w-4" />
                  Create review
                </Button>
              </form>
            </CardContent>
          </Card>
        ) : null}
      </div>

      {canManageGoals ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Add KRA</CardTitle>
              <CardDescription>Break goals into measurable result areas.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-3" onSubmit={submitKra}>
                <Select name="goalId" required>
                  {goals.data?.data.map((goal) => (
                    <option key={goal.id} value={goal.id}>
                      {goal.name}
                    </option>
                  ))}
                </Select>
                <Input name="title" placeholder="KRA title" required />
                <Input name="description" placeholder="Description" />
                <Input name="weightage" type="number" min="0" max="100" placeholder="Weightage" required />
                <Button className="w-full" disabled={!goals.data?.data.length || createKra.isPending}>
                  <Plus className="h-4 w-4" />
                  Add KRA
                </Button>
              </form>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Add KPI</CardTitle>
              <CardDescription>Define scoreable targets for a KRA.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-3" onSubmit={submitKpi}>
                <Select name="kraId" required>
                  {kraOptions.map((kra) => (
                    <option key={kra.id} value={kra.id}>
                      {kra.label}
                    </option>
                  ))}
                </Select>
                <Input name="description" placeholder="KPI description" required />
                <div className="grid grid-cols-2 gap-3">
                  <Input name="targetValue" type="number" placeholder="Target" />
                  <Input name="weightage" type="number" min="0" max="100" placeholder="Weightage" required />
                </div>
                <Button className="w-full" disabled={!kraOptions.length || createKpi.isPending}>
                  <Plus className="h-4 w-4" />
                  Add KPI
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      ) : null}

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
              {goals.data?.data.map((goal) => (
                <div key={goal.id} className="rounded-md border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold">{goal.name}</p>
                      <p className="text-sm text-muted-foreground">{goal.description}</p>
                    </div>
                    <Badge variant="secondary">{goal.weightage}%</Badge>
                  </div>
                  <div className="mt-4 space-y-3">
                    {goal.kras.map((kra) => (
                      <div key={kra.id} className="border-l-2 pl-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">{kra.title}</p>
                          <Badge variant="outline">{kra.weightage}%</Badge>
                        </div>
                        <div className="mt-2 space-y-2">
                          {kra.kpis.map((kpi) => (
                            <div
                              key={kpi.id}
                              className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/40 p-3 text-sm"
                            >
                              <span>{kpi.description}</span>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline">{kpi.weightage}%</Badge>
                                {kpi.score ? <Badge variant="success">Score {kpi.score}</Badge> : null}
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={updateKpi.isPending}
                                  onClick={() =>
                                    updateKpi.mutate({
                                      id: kpi.id,
                                      input: { actualValue: Number(kpi.targetValue ?? 0), achievementPercentage: 100, score: 5 }
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
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Reviews</CardTitle>
            <CardDescription>Employee and manager assessment status.</CardDescription>
          </CardHeader>
          <CardContent>
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
                {reviews.data?.data.map((review) => (
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Assessments</CardTitle>
            <CardDescription>Submit self and manager review scores.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-2">
            <form className="space-y-3" onSubmit={submitSelf}>
              <Select name="reviewId" required>
                {reviews.data?.data.map((review) => (
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
              <Button className="w-full" disabled={!reviews.data?.data.length || selfAssessment.isPending}>
                Submit self
              </Button>
            </form>
            {canReview ? (
              <form className="space-y-3" onSubmit={submitManager}>
                <Select name="reviewId" required>
                  {reviews.data?.data.map((review) => (
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
                <Button className="w-full" disabled={!reviews.data?.data.length || managerAssessment.isPending}>
                  Submit manager
                </Button>
              </form>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
