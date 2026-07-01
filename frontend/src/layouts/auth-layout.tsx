import { ClipboardCheck, Fingerprint, ShieldCheck, UsersRound } from "lucide-react";
import { Outlet } from "react-router-dom";

const trustSignals = [
  { label: "Tenant scope", icon: ShieldCheck },
  { label: "MFA ready", icon: Fingerprint },
  { label: "Role governed", icon: UsersRound }
];

const reviewRail = [
  ["Cycle", "Quarterly scorecards"],
  ["Assign", "Employee and manager queue"],
  ["Approve", "Audit-ready outcomes"]
];

export function AuthLayout() {
  return (
    <main className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_minmax(26rem,31rem)]">
      <section className="ledger-surface hidden min-w-0 overflow-hidden p-10 text-primary lg:flex lg:flex-col">
        <div className="flex items-center justify-between gap-4">
          <img
            src="/venture-soft-logo.png"
            alt="VentureSoft"
            className="h-12 w-64 object-contain object-left"
          />
          <span className="rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-white">
            HRMS
          </span>
        </div>
        <div className="my-auto grid max-w-4xl grid-cols-[minmax(0,1fr)_14rem] gap-8">
          <div>
            <span className="callout-label mb-6">HRMS dashboard</span>
            <h1 className="text-4xl font-extrabold leading-[1.04] text-primary xl:text-5xl">
              A sharper workspace for people, reviews, and approvals.
            </h1>
            <p className="mt-6 max-w-xl text-lg text-muted-foreground">
              Manage goals, candidates, managers, leave, and employee context
              from one branded VentureSoft dashboard.
            </p>
          </div>
          <div className="review-rail space-y-5 pt-2">
            {reviewRail.map(([label, detail]) => (
              <div key={label} className="relative flex gap-4">
                <span className="review-node">
                  <ClipboardCheck className="h-4 w-4" />
                </span>
                <div className="rounded-lg border border-primary/10 bg-card/85 p-3 shadow-sm">
                  <p className="text-sm font-semibold">{label}</p>
                  <p className="text-xs text-muted-foreground">{detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 text-sm">
          {trustSignals.map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="flex items-center gap-2 rounded-md border border-primary/10 bg-white/80 px-3 py-2 text-muted-foreground"
            >
              <Icon className="h-4 w-4 text-destructive" />
              {label}
            </div>
          ))}
        </div>
      </section>
      <section className="flex min-h-screen min-w-0 items-center justify-center p-6 sm:p-8">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <img
              src="/venture-soft-logo.png"
              alt="VentureSoft"
              className="h-10 w-52 object-contain object-left"
            />
          </div>
          <Outlet />
        </div>
      </section>
    </main>
  );
}
