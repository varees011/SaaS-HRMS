import {
  CheckCircle2,
  ClipboardCheck,
  Fingerprint,
  KeyRound,
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
import { useAuthStore } from "@/features/auth/auth.store";

const reviewSteps = [
  {
    label: "Plan",
    title: "Set cycle weights",
    text: "Define the KRA/KPI hierarchy before reviews open."
  },
  {
    label: "Review",
    title: "Collect assessments",
    text: "Keep employee and manager scores moving together."
  },
  {
    label: "Close",
    title: "Approve outcomes",
    text: "Finalize scores with role and tenant context intact."
  }
];

export function DashboardPage() {
  const user = useAuthStore((state) => state.user)!;
  const activeAssignment = user.roleAssignments[0];
  const department =
    activeAssignment?.organization?.name ??
    activeAssignment?.role.department?.name ??
    "No department assigned";
  const cards = [
    {
      label: "Account",
      value: user.status,
      detail: "Identity state",
      icon: UserRound
    },
    {
      label: "MFA",
      value: user.mfaEnabled ? "Enabled" : "Not enabled",
      detail: "Sign-in protection",
      icon: ShieldCheck
    },
    {
      label: "Roles",
      value: String(user.roles.length),
      detail: "Active permissions",
      icon: KeyRound
    }
  ];

  return (
    <div className="space-y-8">
      <section className="ledger-surface overflow-hidden rounded-lg border border-primary/10 p-6 shadow-[0_24px_70px_rgba(18,32,23,0.08)] sm:p-8">
        <div className="grid gap-8 xl:grid-cols-[1fr_22rem]">
          <div>
            <p className="utility-label mb-4">Signed-in command center</p>
            <h1 className="max-w-3xl text-4xl font-semibold leading-tight text-primary sm:text-5xl">
              Welcome, {user.firstName}. Your performance workspace is ready.
            </h1>
            <p className="mt-5 max-w-2xl text-muted-foreground">
              Start from the current tenant context, confirm your role coverage,
              then move into goals, scorecards, reviews, and approvals.
            </p>
          </div>
          <div className="rounded-lg border border-primary/10 bg-primary p-5 text-primary-foreground shadow-xl">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="utility-label text-primary-foreground/60">Roster card</p>
                <p className="mt-2 text-xl font-semibold">
                  {user.firstName} {user.lastName}
                </p>
              </div>
              <span className="grid h-14 w-14 place-items-center rounded-md bg-accent text-lg font-bold text-primary">
                {user.firstName[0]}
                {user.lastName[0]}
              </span>
            </div>
            <div className="mt-5 space-y-3 text-sm text-primary-foreground/78">
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

      <div className="grid gap-4 md:grid-cols-3">
        {cards.map(({ label, value, detail, icon: Icon }) => (
          <Card key={label} className="overflow-hidden">
            <CardContent className="p-5">
              <div className="mb-5 flex items-center justify-between">
                <span className="review-node">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="utility-label">{detail}</span>
              </div>
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className="mt-1 text-2xl font-semibold text-primary">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader>
            <CardTitle>Review rail</CardTitle>
            <CardDescription>
              The core performance workflow stays visible from setup through
              approval.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="review-rail space-y-5">
              {reviewSteps.map((step) => (
                <div key={step.label} className="relative flex gap-4">
                  <span className="review-node">
                    <Target className="h-4 w-4" />
                  </span>
                  <div className="flex-1 rounded-lg border border-primary/10 bg-secondary/35 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold text-primary">{step.title}</p>
                      <Badge variant="outline">{step.label}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{step.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Access context</CardTitle>
            <CardDescription>
              Active roles resolved by the API for this tenant.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
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
            <div className="mt-5 w-full rounded-md border border-primary/10 bg-card/70 p-4">
              <p className="utility-label">Current tenant</p>
              <p className="mt-2 break-all text-sm text-muted-foreground">
                {user.tenantId || "Platform scope"}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
