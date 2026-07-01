import { Navigate, Route, Routes } from "react-router-dom";
import {
  AnonymousOnly,
  AuthGuard,
  ForgotPasswordPage,
  LoginPage,
  PermissionGuard,
  ResetPasswordPage,
  accessPolicy
} from "@/features/auth";
import { AppLayout } from "@/layouts/app-layout";
import { AuthLayout } from "@/layouts/auth-layout";
import { DashboardPage } from "@/features/dashboard";
import { NotFoundPage } from "@/features/shell";
import { ProfilePage, SecurityPage, SessionsPage } from "@/features/self-service";
import { OrganizationsPage, RolesPage, TenantsPage, UsersPage } from "@/features/admin";
import { PerformancePage } from "@/features/performance";

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
