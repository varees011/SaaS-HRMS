import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  CheckCircle2,
  Fingerprint,
  KeyRound,
  LoaderCircle,
  ShieldCheck,
  Target,
  UserRound,
  UsersRound
} from "lucide-react";
import { Badge } from "@/shared/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/shared/ui/card";
import { adminApi } from "@/features/admin/admin.api";
import { useAuthStore } from "@/features/auth/auth.store";
import { hasAnyPermission } from "@/features/auth/permissions";
import { performanceApi } from "@/features/performance/performance.api";

const roleCards = [
  {
    label: "Account",
    valueKey: "status",
    detail: "Identity state",
    icon: UserRound
  },
  {
    label: "MFA",
    valueKey: "mfa",
    detail: "Sign-in protection",
    icon: ShieldCheck
  },
  {
    label: "Roles",
    valueKey: "roles",
    detail: "Active permissions",
    icon: KeyRound
  }
];

export function DashboardPage() {
  const user = useAuthStore((state) => state.user)!;
  const activeAssignment = user.roleAssignments[0];
  const tenantId = user.tenantId ?? user.memberships?.[0]?.tenantId ?? "";
  const department =
    activeAssignment?.organization?.name ??
    activeAssignment?.role.department?.name ??
    "No department assigned";

  const canReadTenants = hasAnyPermission(user, [
    "platform.tenants.read",
    "tenant.settings.read"
  ]);
  const canReadUsers = hasAnyPermission(user, [
    "platform.users.read",
    "tenant.users.read",
    "user.read"
  ]);
  const canReadOrganizations = hasAnyPermission(user, [
    "platform.organizations.read",
    "tenant.organizations.read"
  ]);
  const canReadRoles = hasAnyPermission(user, [
    "platform.roles.read",
    "tenant.roles.read",
    "role.read"
  ]);
  const canReadPerformance = hasAnyPermission(user, [
    "tenant.performance.read",
    "tenant.performance.manage",
    "team.performance.review"
  ]);

  const tenants = useQuery({
    queryKey: ["dashboard", "tenants", tenantId],
    queryFn: () =>
      adminApi.listTenants({
        ...(tenantId ? { tenantId } : {}),
        limit: 1000
      }),
    enabled: canReadTenants
  });
  const users = useQuery({
    queryKey: ["dashboard", "users", tenantId],
    queryFn: () => adminApi.listUsers({ tenantId, limit: 1000 }),
    enabled: Boolean(tenantId) && canReadUsers
  });
  const organizations = useQuery({
    queryKey: ["dashboard", "organizations", tenantId],
    queryFn: () => adminApi.listOrganizations({ tenantId, limit: 1000 }),
    enabled: Boolean(tenantId) && canReadOrganizations
  });
  const roles = useQuery({
    queryKey: ["dashboard", "roles", tenantId],
    queryFn: () => adminApi.listRoles(tenantId),
    enabled: Boolean(tenantId) && canReadRoles
  });
  const performanceDashboard = useQuery({
    queryKey: ["dashboard", "performance", tenantId],
    queryFn: () => performanceApi.dashboard({ tenantId }),
    enabled: Boolean(tenantId) && canReadPerformance
  });
  const reviews = useQuery({
    queryKey: ["dashboard", "performance-reviews", tenantId],
    queryFn: () => performanceApi.listReviews({ tenantId, limit: 3 }),
    enabled: Boolean(tenantId) && canReadPerformance
  });

  const tenantSummary = tenantId
    ? tenants.data?.data.find((tenant) => tenant.id === tenantId)
    : undefined;
  const visibleUsers = users.data?.data ?? [];
  const visibleOrganizations = organizations.data?.data ?? [];
  const visibleRoles = roles.data?.data ?? [];
  const visibleReviews = reviews.data?.data ?? [];

  const metrics = [
    {
      label: "Tenant users",
      value: tenantSummary?._count.users ?? visibleUsers.length,
      detail: "From active tenant memberships",
      available: canReadTenants || canReadUsers,
      loading: tenants.isLoading || users.isLoading,
      icon: UsersRound,
      className: "metric-card-blue"
    },
    {
      label: "Organizations",
      value: tenantSummary?._count.organizations ?? visibleOrganizations.length,
      detail: "From organization records",
      available: canReadOrganizations || canReadTenants,
      loading: organizations.isLoading || tenants.isLoading,
      icon: Building2,
      className: "metric-card-lime"
    },
    {
      label: "Roles",
      value: visibleRoles.length,
      detail: "From RBAC role catalog",
      available: canReadRoles,
      loading: roles.isLoading,
      icon: KeyRound,
      className: "metric-card-rose"
    },
    {
      label: "Reviews",
      value: performanceDashboard.data?.data.reviews ?? 0,
      detail: "From performance reviews",
      available: canReadPerformance,
      loading: performanceDashboard.isLoading,
      icon: Target,
      className: "metric-card-violet"
    }
  ];

  const valueFor = (key: string) => {
    if (key === "status") return user.status;
    if (key === "mfa") return user.mfaEnabled ? "Enabled" : "Not enabled";
    return String(user.roles.length);
  };

  return (
    <div className="space-y-7">
      <section className="ledger-surface overflow-hidden rounded-lg border border-primary/10 bg-white p-6 shadow-[0_24px_70px_rgba(14,22,63,0.08)] sm:p-8">
        <div className="grid gap-7 xl:grid-cols-[1fr_23rem]">
          <div>
            <span className="callout-label">HRMS dashboard</span>
            <h1 className="mt-6 max-w-3xl text-4xl font-extrabold leading-tight text-primary sm:text-5xl">
              Welcome, {user.firstName}. Track your tenant data at a glance.
            </h1>
            <p className="mt-5 max-w-2xl text-muted-foreground">
              This dashboard only shows values returned by the API for your active
              tenant and permissions.
            </p>
          </div>
          <div className="rounded-lg border border-primary/10 bg-primary p-5 text-white shadow-xl">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="utility-label text-white/55">Employee card</p>
                <p className="mt-2 text-xl font-bold">
                  {user.firstName} {user.lastName}
                </p>
              </div>
              <span className="grid h-14 w-14 place-items-center rounded-md bg-accent text-lg font-extrabold text-primary">
                {user.firstName[0]}
                {user.lastName[0]}
              </span>
            </div>
            <div className="mt-5 space-y-3 text-sm text-white/78">
              <p className="flex items-center gap-2">
                <Fingerprint className="h-4 w-4 text-accent" />
                {user.email}
              </p>
              <p className="flex items-center gap-2">
                <UsersRound className="h-4 w-4 text-accent" />
                {department}
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map(({ label, value, detail, available, loading, className, icon: Icon }) => (
          <Card key={label} className={className}>
            <CardContent className="p-5">
              <div className="mb-5 flex items-center justify-between">
                <span className="grid h-10 w-10 place-items-center rounded-md bg-white/85 shadow-sm">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="rounded-full bg-white/70 px-2.5 py-1 text-xs font-bold">
                  {available ? "Live data" : "No access"}
                </span>
              </div>
              <p className="text-sm font-semibold opacity-70">{label}</p>
              <p className="mt-1 text-3xl font-extrabold">
                {loading ? <LoaderCircle className="h-7 w-7 animate-spin" /> : available ? value : "-"}
              </p>
              <p className="mt-2 text-xs font-medium opacity-70">
                {available ? detail : "Permission required"}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader className="flex-row items-start justify-between gap-4">
            <div>
              <span className="callout-label">People</span>
              <CardTitle className="mt-4">Tenant users</CardTitle>
              <CardDescription>
                Real user records returned by the admin API.
              </CardDescription>
            </div>
            <Badge variant="secondary">
              {canReadUsers ? `${visibleUsers.length} visible` : "No access"}
            </Badge>
          </CardHeader>
          <CardContent>
            {!canReadUsers ? (
              <EmptyState message="You do not have permission to read tenant users." />
            ) : users.isLoading ? (
              <LoadingState />
            ) : visibleUsers.length ? (
              <div className="grid gap-3 md:grid-cols-3">
                {visibleUsers.slice(0, 3).map((tenantUser) => (
                  <div
                    key={tenantUser.id}
                    className="rounded-lg border border-primary/10 bg-slate-50 p-4"
                  >
                    <div className="mb-4 grid h-11 w-11 place-items-center rounded-full bg-white text-sm font-extrabold text-destructive shadow-sm">
                      {tenantUser.firstName[0]}
                      {tenantUser.lastName[0]}
                    </div>
                    <p className="font-bold text-primary">
                      {tenantUser.firstName} {tenantUser.lastName}
                    </p>
                    <p className="text-sm text-muted-foreground">{tenantUser.email}</p>
                    <Badge className="mt-4" variant="outline">
                      {tenantUser.status}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState message="No tenant users found." />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <span className="callout-label w-fit">Performance</span>
            <CardTitle className="pt-4">Review focus</CardTitle>
            <CardDescription>
              Real performance review records from the database.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {!canReadPerformance ? (
              <EmptyState message="You do not have permission to read performance reviews." />
            ) : reviews.isLoading ? (
              <LoadingState />
            ) : visibleReviews.length ? (
              visibleReviews.map((review) => (
                <div
                  key={review.id}
                  className="rounded-md border border-primary/10 bg-slate-50 p-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold">
                      {review.employee.firstName} {review.employee.lastName}
                    </p>
                    <Badge variant="outline">{review.status}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {review.cycle.name}
                  </p>
                </div>
              ))
            ) : (
              <EmptyState message="No performance reviews found." />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <span className="callout-label w-fit">Organizations</span>
            <CardTitle className="pt-4">Tenant structure</CardTitle>
            <CardDescription>
              Real organization records returned by the API.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {!canReadOrganizations ? (
              <EmptyState message="You do not have permission to read organizations." />
            ) : organizations.isLoading ? (
              <LoadingState />
            ) : visibleOrganizations.length ? (
              visibleOrganizations.slice(0, 4).map((organization) => (
                <div
                  key={organization.id}
                  className="flex items-center justify-between gap-3 rounded-md border border-primary/10 bg-slate-50 p-3"
                >
                  <div>
                    <p className="text-sm font-semibold">{organization.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {organization.organizationType}
                    </p>
                  </div>
                  <Badge variant="outline">{organization.code}</Badge>
                </div>
              ))
            ) : (
              <EmptyState message="No organizations found." />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Access context</CardTitle>
            <CardDescription>
              Active roles resolved by the API for this tenant.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-3 md:grid-cols-3">
              {roleCards.map(({ label, valueKey, detail, icon: Icon }) => (
                <div
                  key={label}
                  className="rounded-lg border border-primary/10 bg-slate-50 p-4"
                >
                  <Icon className="mb-3 h-5 w-5 text-destructive" />
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
                    {detail}
                  </p>
                  <p className="mt-2 text-sm font-semibold">{label}</p>
                  <p className="text-lg font-extrabold text-primary">
                    {valueFor(valueKey)}
                  </p>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {user.roles.length ? (
                user.roles.map((role) => (
                  <Badge key={role} variant="secondary">
                    <CheckCircle2 className="mr-1 h-3 w-3" />
                    {role}
                  </Badge>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No active roles.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <LoaderCircle className="h-4 w-4 animate-spin" />
      Loading database records...
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-dashed border-primary/20 bg-slate-50 p-4 text-sm text-muted-foreground">
      {message}
    </div>
  );
}
