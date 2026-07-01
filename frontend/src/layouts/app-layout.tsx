import {
  Building,
  Building2,
  Gauge,
  LogOut,
  Menu,
  ClipboardCheck,
  Settings,
  ShieldCheck,
  UserRound,
  Users,
  KeyRound
} from "lucide-react";
import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
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
    permissions: accessPolicy.tenants
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
}>;

export function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const user = useAuthStore((state) => state.user);
  const clear = useAuthStore((state) => state.clear);
  const navigate = useNavigate();

  async function logout() {
    try {
      await authApi.logout();
    } finally {
      clear();
      navigate("/login", { replace: true });
    }
  }

  if (!user) return null;
  const authorizedAdminLinks = adminLinks.filter((link) =>
    hasAnyPermission(user, link.permissions)
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

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 flex h-16 items-center border-b border-primary/10 bg-background/90 px-4 backdrop-blur md:hidden">
        <Button
          size="icon"
          variant="ghost"
          onClick={() => setMobileOpen((value) => !value)}
          aria-label="Toggle navigation"
        >
          <Menu className="h-5 w-5" />
        </Button>
        <span className="ml-3 font-semibold text-primary">VentureSoft HRMS</span>
      </header>
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-72 border-r border-primary/10 bg-primary text-primary-foreground transition-transform md:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-20 items-center gap-3 border-b border-primary-foreground/10 px-5">
          <span className="grid h-11 w-11 place-items-center rounded-md bg-accent text-primary shadow-[inset_0_-6px_0_rgba(20,61,45,0.12)]">
            <ClipboardCheck className="h-5 w-5" />
          </span>
          <div>
            <p className="font-semibold leading-tight">VentureSoft HRMS</p>
            <p className="utility-label text-primary-foreground/60">Performance ledger</p>
          </div>
        </div>
        <nav className="review-rail space-y-1 p-4">
          {links.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                cn(
                  "relative ml-1 flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-primary-foreground/75 hover:bg-primary-foreground/10 hover:text-primary-foreground",
                  isActive &&
                    "bg-accent text-primary shadow-[0_12px_28px_rgba(0,0,0,0.15)]"
                )
              }
            >
              <span className="grid h-8 w-8 place-items-center rounded-full bg-primary-foreground/10">
                <Icon className="h-4 w-4" />
              </span>
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="absolute inset-x-0 bottom-0 border-t border-primary-foreground/10 p-4">
          <div className="mb-4 flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-md bg-accent text-sm font-semibold text-primary">
              {initials(user.firstName, user.lastName)}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {user.firstName} {user.lastName}
              </p>
              <p className="truncate text-xs text-primary-foreground/60">{user.email}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            className="w-full justify-start text-primary-foreground/75 hover:bg-primary-foreground/10 hover:text-primary-foreground"
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
        <div className="border-b border-primary/10 bg-card/55 px-5 py-3 backdrop-blur sm:px-8">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
            <p className="utility-label">Secure workspace</p>
            <div className="flex items-center gap-2 rounded-full border border-primary/10 bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" />
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
