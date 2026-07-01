import {
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  Coffee,
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

const metricCards = [
  {
    label: "Employees",
    value: "248",
    delta: "+12 this month",
    className: "metric-card-blue",
    icon: UsersRound
  },
  {
    label: "New hires",
    value: "16",
    delta: "8 onboarding",
    className: "metric-card-lime",
    icon: BriefcaseBusiness
  },
  {
    label: "On leave",
    value: "12",
    delta: "3 pending approval",
    className: "metric-card-rose",
    icon: CalendarDays
  },
  {
    label: "Reviews",
    value: "08",
    delta: "Cycle active",
    className: "metric-card-violet",
    icon: Target
  }
];

const candidates = [
  ["Aarav Mehta", "Frontend Engineer", "Interview"],
  ["Neha Rao", "HR Generalist", "Offer"],
  ["Kabir Khan", "QA Engineer", "Screening"]
] satisfies Array<[string, string, string]>;

const meetings = [
  ["10:00", "Performance calibration"],
  ["12:30", "Recruiter sync"],
  ["16:00", "Leave policy review"]
] satisfies Array<[string, string]>;

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
  const department =
    activeAssignment?.organization?.name ??
    activeAssignment?.role.department?.name ??
    "No department assigned";
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
              Welcome, {user.firstName}. Track your people operations at a glance.
            </h1>
            <p className="mt-5 max-w-2xl text-muted-foreground">
              Candidate movement, manager actions, leave status, and review
              progress share one workspace with tenant-aware access.
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
        {metricCards.map(({ label, value, delta, className, icon: Icon }) => (
          <Card key={label} className={className}>
            <CardContent className="p-5">
              <div className="mb-5 flex items-center justify-between">
                <span className="grid h-10 w-10 place-items-center rounded-md bg-white/85 shadow-sm">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="rounded-full bg-white/70 px-2.5 py-1 text-xs font-bold">
                  {delta}
                </span>
              </div>
              <p className="text-sm font-semibold opacity-70">{label}</p>
              <p className="mt-1 text-3xl font-extrabold">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader className="flex-row items-start justify-between gap-4">
            <div>
              <span className="callout-label">Candidates</span>
              <CardTitle className="mt-4">Shortlisted candidates</CardTitle>
              <CardDescription>
                Track active hiring movement and next actions.
              </CardDescription>
            </div>
            <Badge variant="secondary">3 active</Badge>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-3">
              {candidates.map(([name, role, status]) => (
                <div
                  key={name}
                  className="rounded-lg border border-primary/10 bg-slate-50 p-4"
                >
                  <div className="mb-4 grid h-11 w-11 place-items-center rounded-full bg-white text-sm font-extrabold text-destructive shadow-sm">
                    {name
                      .split(" ")
                      .map((part) => part[0])
                      .join("")}
                  </div>
                  <p className="font-bold text-primary">{name}</p>
                  <p className="text-sm text-muted-foreground">{role}</p>
                  <Badge className="mt-4" variant="outline">
                    {status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <span className="callout-label w-fit">Managers</span>
            <CardTitle className="pt-4">Today's focus</CardTitle>
            <CardDescription>
              Meetings and manager actions that need attention.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {meetings.map(([time, title]) => (
              <div
                key={title}
                className="flex items-center gap-3 rounded-md border border-primary/10 bg-slate-50 p-3"
              >
                <span className="rounded-md bg-accent px-2.5 py-1 text-xs font-extrabold text-primary">
                  {time}
                </span>
                <p className="text-sm font-semibold">{title}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <span className="callout-label w-fit">Water cooler</span>
            <CardTitle className="pt-4">Team pulse</CardTitle>
            <CardDescription>
              Lightweight people signals for HR and managers.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {["4 birthdays this week", "2 policy acknowledgements due", "6 kudos shared"].map(
              (item) => (
                <div key={item} className="flex items-center gap-3 text-sm">
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-lime-100 text-primary">
                    <Coffee className="h-4 w-4" />
                  </span>
                  {item}
                </div>
              )
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
