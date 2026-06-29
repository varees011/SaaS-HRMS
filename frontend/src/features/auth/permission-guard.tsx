import { Navigate, Outlet } from "react-router-dom";
import type { PermissionList } from "./access-policy";
import { useAuthStore } from "./auth.store";
import { hasAnyPermission } from "./permissions";

interface PermissionGuardProps {
  anyOf: PermissionList;
}

export function PermissionGuard({ anyOf }: PermissionGuardProps) {
  const user = useAuthStore((state) => state.user);
  return hasAnyPermission(user, anyOf) ? (
    <Outlet />
  ) : (
    <Navigate to="/app" replace />
  );
}
