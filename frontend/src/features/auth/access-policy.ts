export const accessPolicy = {
  profile: ["self.profile.read"],
  security: ["self.security.manage"],
  sessions: ["self.sessions.manage"],
  tenants: ["platform.tenants.read", "tenant.settings.read"],
  organizations: ["platform.organizations.read", "tenant.organizations.read"],
  users: ["platform.users.read", "tenant.users.read", "user.read"],
  roles: ["platform.roles.read", "tenant.roles.read", "role.read"],
  performance: [
    "tenant.performance.read",
    "tenant.performance.manage",
    "team.performance.review",
    "self.performance.read"
  ]
} as const;

export type PermissionList = readonly string[];
