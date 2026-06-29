import { Navigate, Route, Routes } from "react-router-dom";
import { accessPolicy } from "@/features/auth/access-policy";
import { AnonymousOnly, AuthGuard } from "@/features/auth/auth-guard";
import { PermissionGuard } from "@/features/auth/permission-guard";
import { AppLayout } from "@/layouts/app-layout";
import { AuthLayout } from "@/layouts/auth-layout";
import { DashboardPage } from "@/pages/dashboard-page";
import { NotFoundPage } from "@/pages/not-found-page";
import { ProfilePage } from "@/pages/profile-page";
import { SecurityPage } from "@/pages/security-page";
import { SessionsPage } from "@/pages/sessions-page";
import { ForgotPasswordPage } from "@/pages/auth/forgot-password-page";
import { LoginPage } from "@/pages/auth/login-page";
import { ResetPasswordPage } from "@/pages/auth/reset-password-page";
import { TenantsPage } from "@/pages/admin/tenants-page";
import { OrganizationsPage } from "@/pages/admin/organizations-page";
import { UsersPage } from "@/pages/admin/users-page";
import { RolesPage } from "@/pages/admin/roles-page";
import { PerformancePage } from "@/pages/performance-page";

export function App() {
  return (
    <Routes>
      <Route element={<AnonymousOnly />}>
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
        </Route>
      </Route>

      <Route element={<AuthGuard />}>
          <Route path="/app" element={<AppLayout />}>
            <Route index element={<DashboardPage />} />
          <Route
            element={<PermissionGuard anyOf={accessPolicy.profile} />}
          >
            <Route path="profile" element={<ProfilePage />} />
          </Route>
          <Route
            element={<PermissionGuard anyOf={accessPolicy.security} />}
          >
            <Route path="security" element={<SecurityPage />} />
          </Route>
          <Route
            element={<PermissionGuard anyOf={accessPolicy.sessions} />}
          >
            <Route path="sessions" element={<SessionsPage />} />
          </Route>
          <Route
            element={
              <PermissionGuard anyOf={accessPolicy.tenants} />
            }
          >
            <Route path="admin/tenants" element={<TenantsPage />} />
          </Route>
          <Route
            element={
              <PermissionGuard anyOf={accessPolicy.organizations} />
            }
          >
            <Route path="admin/organizations" element={<OrganizationsPage />} />
          </Route>
          <Route
            element={
              <PermissionGuard anyOf={accessPolicy.users} />
            }
          >
            <Route path="admin/users" element={<UsersPage />} />
          </Route>
          <Route
            element={
              <PermissionGuard anyOf={accessPolicy.roles} />
            }
          >
            <Route path="admin/roles" element={<RolesPage />} />
          </Route>
          <Route
            element={
              <PermissionGuard anyOf={accessPolicy.performance} />
            }
          >
            <Route path="performance" element={<PerformancePage />} />
          </Route>
        </Route>
      </Route>

      <Route path="/" element={<Navigate to="/app" replace />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
