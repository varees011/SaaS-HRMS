import type {
  AssignmentScope,
  PermissionSensitivity,
  RoleType
} from "@prisma/client";

export interface PermissionDefinition {
  code: string;
  module: string;
  resource: string;
  action: string;
  description: string;
  sensitivity?: PermissionSensitivity;
  requiresMfa?: boolean;
}

export interface RoleTemplate {
  code: string;
  name: string;
  description: string;
  roleType: RoleType;
  defaultScope: AssignmentScope;
  permissions: string[];
}

function permission(
  code: string,
  module: string,
  resource: string,
  action: string,
  options: Partial<
    Pick<PermissionDefinition, "sensitivity" | "requiresMfa">
  > = {}
): PermissionDefinition {
  return {
    code,
    module,
    resource,
    action,
    description: `Allows ${action} access to ${resource}.`,
    ...options
  };
}

export const PERMISSIONS: PermissionDefinition[] = [
  permission("platform.tenants.read", "platform", "tenants", "read"),
  permission("platform.tenants.create", "platform", "tenants", "create", {
    sensitivity: "SENSITIVE"
  }),
  permission("platform.tenants.update", "platform", "tenants", "update", {
    sensitivity: "SENSITIVE"
  }),
  permission("platform.tenants.suspend", "platform", "tenants", "suspend", {
    sensitivity: "RESTRICTED",
    requiresMfa: true
  }),
  permission("platform.organizations.read", "platform", "organizations", "read"),
  permission(
    "platform.organizations.create",
    "platform",
    "organizations",
    "create",
    { sensitivity: "SENSITIVE" }
  ),
  permission(
    "platform.organizations.update",
    "platform",
    "organizations",
    "update",
    { sensitivity: "SENSITIVE" }
  ),
  permission(
    "platform.organizations.delete",
    "platform",
    "organizations",
    "delete",
    { sensitivity: "RESTRICTED", requiresMfa: true }
  ),
  permission("platform.users.read", "platform", "users", "read"),
  permission("platform.users.create", "platform", "users", "create", {
    sensitivity: "SENSITIVE"
  }),
  permission("platform.users.update", "platform", "users", "update", {
    sensitivity: "SENSITIVE"
  }),
  permission("platform.users.delete", "platform", "users", "delete", {
    sensitivity: "RESTRICTED",
    requiresMfa: true
  }),
  permission("platform.roles.read", "platform", "roles", "read"),
  permission("platform.roles.manage", "platform", "roles", "manage", {
    sensitivity: "RESTRICTED",
    requiresMfa: true
  }),
  permission(
    "platform.admins.impersonate",
    "platform",
    "organization_admins",
    "impersonate",
    { sensitivity: "RESTRICTED", requiresMfa: true }
  ),
  permission("platform.audit.read", "platform", "audit", "read", {
    sensitivity: "SENSITIVE"
  }),

  permission("tenant.settings.read", "tenant", "settings", "read"),
  permission("tenant.settings.manage", "tenant", "settings", "manage", {
    sensitivity: "SENSITIVE",
    requiresMfa: true
  }),
  permission("tenant.organizations.read", "tenant", "organizations", "read"),
  permission("tenant.organizations.manage", "tenant", "organizations", "manage"),
  permission("tenant.users.read", "tenant", "users", "read"),
  permission("tenant.users.manage", "tenant", "users", "manage", {
    sensitivity: "SENSITIVE"
  }),
  permission("tenant.roles.read", "tenant", "roles", "read"),
  permission("tenant.roles.manage", "tenant", "roles", "manage", {
    sensitivity: "SENSITIVE"
  }),
  permission("tenant.roles.assign", "tenant", "roles", "assign", {
    sensitivity: "RESTRICTED",
    requiresMfa: true
  }),
  permission("tenant.audit.read", "tenant", "audit", "read", {
    sensitivity: "SENSITIVE"
  }),
  permission("tenant.reports.read", "tenant", "reports", "read"),
  permission("tenant.reports.export", "tenant", "reports", "export", {
    sensitivity: "SENSITIVE",
    requiresMfa: true
  }),
  permission("tenant.performance.read", "tenant", "performance", "read"),
  permission("tenant.performance.manage", "tenant", "performance", "manage", {
    sensitivity: "SENSITIVE"
  }),

  permission("employees.directory.read", "employees", "directory", "read"),
  permission("employees.profile.read", "employees", "profile", "read"),
  permission("employees.profile.create", "employees", "profile", "create"),
  permission("employees.profile.update", "employees", "profile", "update"),
  permission("employees.profile.delete", "employees", "profile", "delete", {
    sensitivity: "SENSITIVE"
  }),
  permission("employees.sensitive.read", "employees", "sensitive", "read", {
    sensitivity: "RESTRICTED",
    requiresMfa: true
  }),
  permission("employees.documents.read", "employees", "documents", "read", {
    sensitivity: "SENSITIVE"
  }),
  permission("employees.documents.manage", "employees", "documents", "manage", {
    sensitivity: "SENSITIVE"
  }),
  permission(
    "employees.reporting_lines.manage",
    "employees",
    "reporting_lines",
    "manage"
  ),
  permission("employees.employment.manage", "employees", "employment", "manage", {
    sensitivity: "SENSITIVE"
  }),

  permission("attendance.own.read", "attendance", "own", "read"),
  permission("attendance.own.correct", "attendance", "own", "correct"),
  permission("attendance.team.read", "attendance", "team", "read"),
  permission("attendance.records.read", "attendance", "records", "read"),
  permission("attendance.records.manage", "attendance", "records", "manage"),
  permission(
    "attendance.corrections.approve",
    "attendance",
    "corrections",
    "approve"
  ),
  permission("attendance.policies.manage", "attendance", "policies", "manage"),
  permission("attendance.reports.read", "attendance", "reports", "read"),

  permission("leave.own.read", "leave", "own", "read"),
  permission("leave.own.request", "leave", "own", "request"),
  permission("leave.own.cancel", "leave", "own", "cancel"),
  permission("leave.team.read", "leave", "team", "read"),
  permission("leave.requests.read", "leave", "requests", "read"),
  permission("leave.requests.approve", "leave", "requests", "approve"),
  permission("leave.requests.manage", "leave", "requests", "manage"),
  permission("leave.policies.manage", "leave", "policies", "manage"),
  permission("leave.balances.manage", "leave", "balances", "manage"),
  permission("leave.reports.read", "leave", "reports", "read"),

  permission("payroll.own.read", "payroll", "own", "read", {
    sensitivity: "SENSITIVE"
  }),
  permission("payroll.records.read", "payroll", "records", "read", {
    sensitivity: "RESTRICTED",
    requiresMfa: true
  }),
  permission("payroll.records.manage", "payroll", "records", "manage", {
    sensitivity: "RESTRICTED",
    requiresMfa: true
  }),
  permission("payroll.runs.process", "payroll", "runs", "process", {
    sensitivity: "RESTRICTED",
    requiresMfa: true
  }),
  permission("payroll.runs.approve", "payroll", "runs", "approve", {
    sensitivity: "RESTRICTED",
    requiresMfa: true
  }),
  permission("payroll.compensation.read", "payroll", "compensation", "read", {
    sensitivity: "RESTRICTED",
    requiresMfa: true
  }),
  permission("payroll.compensation.manage", "payroll", "compensation", "manage", {
    sensitivity: "RESTRICTED",
    requiresMfa: true
  }),
  permission("payroll.reports.read", "payroll", "reports", "read", {
    sensitivity: "RESTRICTED",
    requiresMfa: true
  }),
  permission("payroll.reports.export", "payroll", "reports", "export", {
    sensitivity: "RESTRICTED",
    requiresMfa: true
  }),

  permission("recruitment.jobs.read", "recruitment", "jobs", "read"),
  permission("recruitment.jobs.manage", "recruitment", "jobs", "manage"),
  permission("recruitment.candidates.read", "recruitment", "candidates", "read", {
    sensitivity: "SENSITIVE"
  }),
  permission(
    "recruitment.candidates.manage",
    "recruitment",
    "candidates",
    "manage",
    { sensitivity: "SENSITIVE" }
  ),
  permission(
    "recruitment.interviews.manage",
    "recruitment",
    "interviews",
    "manage"
  ),
  permission("recruitment.offers.manage", "recruitment", "offers", "manage", {
    sensitivity: "RESTRICTED",
    requiresMfa: true
  }),
  permission("recruitment.reports.read", "recruitment", "reports", "read"),

  permission("team.members.read", "team", "members", "read"),
  permission("team.goals.manage", "team", "goals", "manage"),
  permission("team.performance.review", "team", "performance", "review"),
  permission("workflow.tasks.read", "workflow", "tasks", "read"),
  permission("workflow.tasks.approve", "workflow", "tasks", "approve"),
  permission("workflow.tasks.reject", "workflow", "tasks", "reject"),
  permission("workflow.tasks.delegate", "workflow", "tasks", "delegate"),

  permission("self.profile.read", "self", "profile", "read"),
  permission("self.profile.update", "self", "profile", "update"),
  permission("self.documents.read", "self", "documents", "read"),
  permission("self.attendance.read", "self", "attendance", "read"),
  permission("self.attendance.correct", "self", "attendance", "correct"),
  permission("self.leave.read", "self", "leave", "read"),
  permission("self.leave.request", "self", "leave", "request"),
  permission("self.leave.cancel", "self", "leave", "cancel"),
  permission("self.payroll.read", "self", "payroll", "read", {
    sensitivity: "SENSITIVE"
  }),
  permission("self.performance.read", "self", "performance", "read"),
  permission("self.performance.submit", "self", "performance", "submit"),
  permission("self.training.read", "self", "training", "read"),
  permission("self.security.manage", "self", "security", "manage", {
    sensitivity: "SENSITIVE"
  }),
  permission("self.sessions.manage", "self", "sessions", "manage", {
    sensitivity: "SENSITIVE"
  }),

  permission("user.create", "users", "user", "create", {
    sensitivity: "SENSITIVE"
  }),
  permission("user.read", "users", "user", "read"),
  permission("user.update", "users", "user", "update", {
    sensitivity: "SENSITIVE"
  }),
  permission("user.delete", "users", "user", "delete", {
    sensitivity: "RESTRICTED",
    requiresMfa: true
  }),
  permission("role.create", "roles", "role", "create", {
    sensitivity: "SENSITIVE"
  }),
  permission("role.read", "roles", "role", "read"),
  permission("role.update", "roles", "role", "update", {
    sensitivity: "SENSITIVE"
  }),
  permission("role.delete", "roles", "role", "delete", {
    sensitivity: "RESTRICTED",
    requiresMfa: true
  }),
  permission("leave.approve", "leave", "requests", "approve"),
  permission("payroll.manage", "payroll", "records", "manage", {
    sensitivity: "RESTRICTED",
    requiresMfa: true
  }),
  permission("recruitment.manage", "recruitment", "jobs", "manage"),
  permission("finance.reports.read", "finance", "reports", "read", {
    sensitivity: "SENSITIVE"
  }),
  permission("compliance.read", "compliance", "records", "read", {
    sensitivity: "SENSITIVE"
  }),
  permission("compliance.manage", "compliance", "records", "manage", {
    sensitivity: "SENSITIVE"
  }),
  permission("helpdesk.tickets.manage", "helpdesk", "tickets", "manage"),
  permission("analytics.hr.read", "analytics", "hr", "read")
];

// Platform administrators can enter any tenant context, so their role must
// include tenant/module permissions as well as platform control-plane access.
const platformPermissions = PERMISSIONS.map((item) => item.code);

const tenantAdministration = PERMISSIONS.filter(
  (item) => !item.code.startsWith("platform.")
).map((item) => item.code);

const selfServicePermissions = PERMISSIONS.filter((item) =>
  item.code.startsWith("self.")
).map((item) => item.code);

function withSelfService(codes: string[]) {
  return [...new Set([...codes, ...selfServicePermissions])];
}

function matchingPermissions(predicate: (code: string) => boolean) {
  return PERMISSIONS.filter((item) => predicate(item.code)).map((item) => item.code);
}

export const PLATFORM_ROLE: RoleTemplate = {
  code: "PLATFORM_SUPER_ADMIN",
  name: "Platform Super Admin",
  description: "Administers the SaaS platform across all tenants.",
  roleType: "PLATFORM",
  defaultScope: "PLATFORM",
  permissions: platformPermissions
};

export const TENANT_ROLES: RoleTemplate[] = [
  {
    code: "ORGANIZATION_ADMIN",
    name: "Organization Admin",
    description: "Full administration within an assigned tenant.",
    roleType: "TENANT",
    defaultScope: "TENANT",
    permissions: tenantAdministration
  },
  {
    code: "HR_ADMIN",
    name: "HR Admin",
    description: "Owns HR administration, employee records, recruitment, reports, and role assignment.",
    roleType: "TENANT",
    defaultScope: "TENANT",
    permissions: withSelfService(
      matchingPermissions(
        (code) =>
          code.startsWith("tenant.") ||
          code.startsWith("employees.") ||
          code.startsWith("attendance.") ||
          code.startsWith("leave.") ||
          code.startsWith("recruitment.") ||
          code.startsWith("analytics.") ||
          code.startsWith("user.") ||
          code.startsWith("role.") ||
          code === "recruitment.manage"
      )
    )
  },
  {
    code: "HR_MANAGER",
    name: "HR Manager",
    description: "Employee, attendance, leave, and payroll administration.",
    roleType: "ORGANIZATION",
    defaultScope: "ORGANIZATION",
    permissions: withSelfService(
      PERMISSIONS.filter(
        (item) =>
          item.code.startsWith("employees.") ||
          item.code.startsWith("attendance.") ||
          item.code.startsWith("leave.") ||
          item.code.startsWith("payroll.") ||
          item.code.startsWith("tenant.performance.")
      ).map((item) => item.code)
    )
  },
  {
    code: "HR_EXECUTIVE",
    name: "HR Executive",
    description: "Runs limited HR operations for employee records, attendance, leave, and onboarding.",
    roleType: "ORGANIZATION",
    defaultScope: "ORGANIZATION",
    permissions: withSelfService(
      matchingPermissions(
        (code) =>
          code === "employees.directory.read" ||
          code === "employees.profile.read" ||
          code === "employees.profile.create" ||
          code === "employees.profile.update" ||
          code === "attendance.records.read" ||
          code === "leave.requests.read" ||
          code === "user.read"
      )
    )
  },
  {
    code: "RECRUITER",
    name: "Recruiter / Talent Acquisition",
    description: "Recruitment, candidate, interview, and offer coordination.",
    roleType: "ORGANIZATION",
    defaultScope: "ORGANIZATION",
    permissions: withSelfService(
      matchingPermissions(
        (code) => code.startsWith("recruitment.") || code === "recruitment.manage"
      )
    )
  },
  {
    code: "INTERVIEWER",
    name: "Interviewer / Hiring Manager",
    description: "Participates in interviews and hiring feedback workflows.",
    roleType: "ORGANIZATION",
    defaultScope: "ORGANIZATION",
    permissions: withSelfService(
      matchingPermissions(
        (code) =>
          code === "recruitment.jobs.read" ||
          code === "recruitment.candidates.read" ||
          code === "recruitment.interviews.manage"
      )
    )
  },
  {
    code: "MANAGER",
    name: "Reporting Manager",
    description: "Team management, team approvals, and performance reviews.",
    roleType: "MANAGER",
    defaultScope: "TEAM",
    permissions: withSelfService(
      PERMISSIONS.filter(
        (item) =>
          item.code.startsWith("team.") ||
          item.code.startsWith("workflow.") ||
          item.code === "attendance.team.read" ||
          item.code === "attendance.corrections.approve" ||
          item.code === "leave.team.read" ||
          item.code === "leave.requests.approve" ||
          item.code === "leave.approve"
      ).map((item) => item.code)
    )
  },
  {
    code: "PROJECT_MANAGER",
    name: "Project Manager",
    description: "Manages project teams, project goals, workflow approvals, and team performance.",
    roleType: "MANAGER",
    defaultScope: "TEAM",
    permissions: withSelfService(
      matchingPermissions(
        (code) =>
          code.startsWith("team.") ||
          code.startsWith("workflow.") ||
          code === "attendance.team.read" ||
          code === "leave.team.read" ||
          code === "leave.approve"
      )
    )
  },
  {
    code: "PAYROLL_ADMIN",
    name: "Payroll Admin",
    description: "Administers payroll records, payroll runs, compensation, and payroll exports.",
    roleType: "ORGANIZATION",
    defaultScope: "ORGANIZATION",
    permissions: withSelfService(
      matchingPermissions(
        (code) => code.startsWith("payroll.") || code === "payroll.manage"
      )
    )
  },
  {
    code: "FINANCE_MANAGER",
    name: "Finance Manager",
    description: "Reviews payroll outputs and finance reports.",
    roleType: "ORGANIZATION",
    defaultScope: "ORGANIZATION",
    permissions: withSelfService(
      matchingPermissions(
        (code) =>
          code === "payroll.records.read" ||
          code === "payroll.runs.approve" ||
          code === "payroll.reports.read" ||
          code === "payroll.reports.export" ||
          code === "finance.reports.read"
      )
    )
  },
  {
    code: "DEPARTMENT_HEAD",
    name: "Department Head / BU Head",
    description: "Views department-wide employees, reports, approvals, and performance.",
    roleType: "ORGANIZATION",
    defaultScope: "ORGANIZATION",
    permissions: withSelfService(
      matchingPermissions(
        (code) =>
          code === "employees.directory.read" ||
          code === "employees.profile.read" ||
          code === "attendance.reports.read" ||
          code === "leave.reports.read" ||
          code === "tenant.reports.read" ||
          code === "tenant.performance.read" ||
          code === "analytics.hr.read" ||
          code.startsWith("team.")
      )
    )
  },
  {
    code: "COMPLIANCE_OFFICER",
    name: "Compliance Officer",
    description: "Reviews sensitive HR, payroll, audit, and compliance records.",
    roleType: "ORGANIZATION",
    defaultScope: "ORGANIZATION",
    permissions: withSelfService(
      matchingPermissions(
        (code) =>
          code === "tenant.audit.read" ||
          code === "employees.sensitive.read" ||
          code === "payroll.records.read" ||
          code.startsWith("compliance.")
      )
    )
  },
  {
    code: "HR_ANALYST",
    name: "HR Analyst",
    description: "Reads HR analytics, reports, employee directories, and performance summaries.",
    roleType: "ORGANIZATION",
    defaultScope: "ORGANIZATION",
    permissions: withSelfService(
      matchingPermissions(
        (code) =>
          code === "employees.directory.read" ||
          code === "tenant.reports.read" ||
          code === "tenant.performance.read" ||
          code === "analytics.hr.read"
      )
    )
  },
  {
    code: "HELPDESK_SUPPORT",
    name: "Helpdesk / Support",
    description: "Handles employee support, profile lookup, and helpdesk tickets.",
    roleType: "ORGANIZATION",
    defaultScope: "ORGANIZATION",
    permissions: withSelfService(
      matchingPermissions(
        (code) =>
          code === "employees.directory.read" ||
          code === "employees.profile.read" ||
          code === "helpdesk.tickets.manage"
      )
    )
  },
  {
    code: "EMPLOYEE",
    name: "Employee",
    description: "Employee self-service access.",
    roleType: "SELF",
    defaultScope: "SELF",
    permissions: PERMISSIONS.filter((item) =>
      item.code.startsWith("self.")
    ).map((item) => item.code)
  }
];
