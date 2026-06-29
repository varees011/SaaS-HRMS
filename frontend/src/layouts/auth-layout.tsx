import { Building2, ShieldCheck } from "lucide-react";
import { Outlet } from "react-router-dom";

export function AuthLayout() {
  return (
    <main className="grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
      <section className="hidden bg-slate-950 p-12 text-white lg:flex lg:flex-col">
        <div className="flex items-center gap-3 text-lg font-semibold">
          <span className="grid h-10 w-10 place-items-center rounded-lg bg-primary">
            <Building2 className="h-5 w-5" />
          </span>
          VentureSoft HRMS
        </div>
        <div className="my-auto max-w-xl">
          <p className="mb-4 text-sm font-medium uppercase tracking-[0.2em] text-sky-300">
            Performance Management
          </p>
          <h1 className="text-5xl font-semibold leading-tight">
            Goals, accountability, and growth in one secure workspace.
          </h1>
          <p className="mt-6 max-w-lg text-lg text-slate-300">
            Manage KRA/KPI scorecards, review cycles, evidence, and assessments
            with tenant-aware access controls.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <ShieldCheck className="h-4 w-4" />
          JWT sessions, MFA, and audit logging
        </div>
      </section>
      <section className="flex min-h-screen items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-primary text-primary-foreground">
              <Building2 className="h-5 w-5" />
            </span>
            <span className="font-semibold">VentureSoft HRMS</span>
          </div>
          <Outlet />
        </div>
      </section>
    </main>
  );
}
