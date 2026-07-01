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
      <header className="sticky top-0 z-30 flex h-16 items-center border-b bg-background/95 px-4 backdrop-blur md:hidden">
        <Button
          size="icon"
          variant="ghost"
          onClick={() => setMobileOpen((value) => !value)}
          aria-label="Toggle navigation"
        >
          <Menu className="h-5 w-5" />
        </Button>
        <span className="ml-3 font-semibold">VentureSoft HRMS</span>
      </header>
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 border-r bg-slate-950 text-white transition-transform md:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-16 items-center border-b border-white/10 px-5 font-semibold">
          VentureSoft HRMS
        </div>
        <nav className="space-y-1 p-3">
          {links.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-slate-300 hover:bg-white/10 hover:text-white",
                  isActive && "bg-primary text-white"
                )
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="absolute inset-x-0 bottom-0 border-t border-white/10 p-4">
          <div className="mb-4 flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-sky-200 text-sm font-semibold text-slate-900">
              {initials(user.firstName, user.lastName)}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {user.firstName} {user.lastName}
              </p>
              <p className="truncate text-xs text-slate-400">{user.email}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            className="w-full justify-start text-slate-300 hover:bg-white/10 hover:text-white"
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
      <main className="md:pl-64">
        <div className="mx-auto max-w-7xl p-5 sm:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
