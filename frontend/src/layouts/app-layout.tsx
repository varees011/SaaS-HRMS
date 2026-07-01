import {
  BarChart3,
  Building,
  Building2,
  Gauge,
  LogOut,
  Menu,
  ClipboardCheck,
  FileCheck2,
  Settings,
  ShieldCheck,
  Target,
  UserRound,
  Users,
  KeyRound
} from "lucide-react";
import { useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/shared/ui/button";
import { accessPolicy, type PermissionList } from "@/features/auth/access-policy";
import { authApi } from "@/features/auth/auth.api";
import { useAuthStore } from "@/features/auth/auth.store";
import { hasAnyPermission } from "@/features/auth/permissions";
import { cn } from "@/shared/lib/cn";
import { initials } from "@/shared/lib/initials";

const baseLinks = [
  { to: "/app", label: "Overview", icon: Gauge, end: true },
  {
    to: "/app/profile",
    label: "Profile",
    icon: UserRound,
    permissions: accessPolicy.profile
  },
  {
    to: "/app/security",
    label: "Security",
    icon: ShieldCheck,
    permissions: accessPolicy.security
  },
  {
    to: "/app/sessions",
    label: "Sessions",
    icon: Settings,
    permissions: accessPolicy.sessions
  }
] satisfies Array<{
  to: string;
  label: string;
  icon: typeof Gauge;
  end?: boolean;
  permissions?: PermissionList;
}>;

const adminLinks = [
  {
    to: "/app/admin/tenants",
    label: "Tenants",
    icon: Building2,
    end: false,
    permissions: accessPolicy.tenants,
    platformOnly: true
  },
  {
    to: "/app/admin/organizations",
    label: "Organizations",
    icon: Building,
    end: false,
    permissions: accessPolicy.organizations
  },
  {
    to: "/app/admin/users",
    label: "Users",
    icon: Users,
    end: false,
    permissions: accessPolicy.users
  },
  {
    to: "/app/admin/roles",
    label: "Roles",
    icon: KeyRound,
    end: false,
    permissions: accessPolicy.roles
  }
] satisfies Array<{
  to: string;
  label: string;
  icon: typeof Gauge;
  end?: boolean;
  permissions: PermissionList;
  platformOnly?: boolean;
}>;

const performanceSubLinks = [
  {
    to: "/app/performance?section=setup",
    section: "setup",
    label: "Cycle setup",
    icon: ClipboardCheck
  },
  {
    to: "/app/performance?section=hierarchy",
    section: "hierarchy",
    label: "Goal hierarchy",
    icon: Target
  },
  {
    to: "/app/performance?section=assignments",
    section: "assignments",
    label: "Assignments",
    icon: Users
  },
  {
    to: "/app/performance?section=reviews",
    section: "reviews",
    label: "Reviews",
    icon: FileCheck2
  },
  {
    to: "/app/performance?section=assessments",
    section: "assessments",
    label: "Assessments",
    icon: BarChart3
  }
];

export function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const user = useAuthStore((state) => state.user);
  const clear = useAuthStore((state) => state.clear);
  const navigate = useNavigate();
  const location = useLocation();

  async function logout() {
    try {
      await authApi.logout();
    } finally {
      clear();
      navigate("/login", { replace: true });
    }
  }

  if (!user) return null;
  const authorizedAdminLinks = adminLinks.filter(
    (link) =>
      hasAnyPermission(user, link.permissions) &&
      (!link.platformOnly || user.isSuperAdmin)
  );
  const authorizedBaseLinks = baseLinks.filter(
    (link) => !link.permissions || hasAnyPermission(user, link.permissions)
  );
  const links = [
    ...authorizedBaseLinks.slice(0, 1),
    {
      to: "/app/performance",
      label: "Performance",
      icon: ClipboardCheck,
      end: false,
      permissions: accessPolicy.performance
    },
    ...authorizedAdminLinks,
    ...authorizedBaseLinks.slice(1)
  ].filter((link) => !link.permissions || hasAnyPermission(user, link.permissions));
  const performanceSection =
    new URLSearchParams(location.search).get("section") ?? "setup";

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 flex h-16 items-center border-b border-primary/10 bg-white/92 px-4 backdrop-blur md:hidden">
        <Button
          size="icon"
          variant="ghost"
          onClick={() => setMobileOpen((value) => !value)}
          aria-label="Toggle navigation"
        >
          <Menu className="h-5 w-5" />
        </Button>
        <img
          src="/venture-soft-logo.png"
          alt="VentureSoft"
          className="ml-3 h-8 w-36 object-contain object-left"
        />
      </header>
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-72 border-r border-primary/10 bg-white text-primary transition-transform md:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-20 items-center border-b border-primary/10 px-5">
          <img
            src="/venture-soft-logo.png"
            alt="VentureSoft"
            className="h-11 w-56 object-contain object-left"
          />
        </div>
        <div className="px-5 pt-5">
          <span className="callout-label">HRMS dashboard</span>
        </div>
        <nav className="space-y-1 p-4">
          {links.map(({ to, label, icon: Icon, end }) => {
            const isPerformance = to === "/app/performance";
            const isPerformanceActive = location.pathname.startsWith("/app/performance");

            return (
              <div key={to}>
                <NavLink
                  to={to}
                  end={end}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      "relative flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-semibold text-muted-foreground hover:bg-secondary/80 hover:text-primary",
                      (isActive || (isPerformance && isPerformanceActive)) &&
                        "bg-primary text-white shadow-[0_12px_28px_rgba(14,22,63,0.16)]"
                    )
                  }
                >
                  <span className="grid h-8 w-8 place-items-center rounded-md bg-current/10">
                    <Icon className="h-4 w-4" />
                  </span>
                  {label}
                </NavLink>
                {isPerformance ? (
                  <div className="ml-6 mt-2 space-y-1 border-l border-primary/10 pl-3">
                    {performanceSubLinks.map(
                      ({ to: subTo, section, label: subLabel, icon: SubIcon }) => {
                        const active =
                          isPerformanceActive && performanceSection === section;
                        return (
                          <NavLink
                            key={section}
                            to={subTo}
                            onClick={() => setMobileOpen(false)}
                            className={cn(
                              "flex items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-secondary/80 hover:text-primary",
                              active && "bg-accent text-primary"
                            )}
                          >
                            <SubIcon className="h-3.5 w-3.5" />
                            {subLabel}
                          </NavLink>
                        );
                      }
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}
        </nav>
        <div className="absolute inset-x-0 bottom-0 border-t border-primary/10 bg-slate-50/80 p-4">
          <div className="mb-4 flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-md bg-accent text-sm font-bold text-primary">
              {initials(user.firstName, user.lastName)}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {user.firstName} {user.lastName}
              </p>
              <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            className="w-full justify-start text-muted-foreground hover:bg-white hover:text-primary"
            onClick={logout}
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </div>
      </aside>
      {mobileOpen ? (
        <button
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}
      <main className="md:pl-72">
        <div className="border-b border-primary/10 bg-white/82 px-5 py-3 backdrop-blur sm:px-8">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
            <p className="utility-label">VentureSoft workspace</p>
            <div className="flex items-center gap-2 rounded-full border border-lime-200 bg-lime-50 px-3 py-1.5 text-xs font-bold text-primary">
              <ShieldCheck className="h-3.5 w-3.5 text-lime-600" />
              Tenant-aware access active
            </div>
          </div>
        </div>
        <div className="mx-auto max-w-7xl p-5 sm:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
