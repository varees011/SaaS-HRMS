import type { CurrentUser } from "./auth.types";
import type { PermissionList } from "./access-policy";

export function hasPermission(
  user: CurrentUser | null | undefined,
  permission: string
): boolean {
  return Boolean(user?.permissions.includes(permission));
}

export function hasAnyPermission(
  user: CurrentUser | null | undefined,
  permissions: PermissionList
): boolean {
  return permissions.some((permission) => hasPermission(user, permission));
}

export function canManageTenantScopedResource(
  user: CurrentUser | null | undefined,
  platformPermission: string,
  tenantPermission: string
): boolean {
  return hasAnyPermission(user, [platformPermission, tenantPermission]);
}
