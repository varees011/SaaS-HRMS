import {
  PrismaClient,
  type AssignmentScope,
  type Prisma,
  type RoleType
} from "@prisma/client";
import argon2 from "argon2";
import "dotenv/config";
import {
  PERMISSIONS,
  PLATFORM_ROLE,
  TENANT_ROLES,
  type RoleTemplate
} from "../src/modules/rbac/rbac.catalog.js";

const prisma = new PrismaClient();

const platformEmail =
  process.env.SUPER_ADMIN_EMAIL ?? "superadmin@venturesoft.ai";
const platformUsername = process.env.SUPER_ADMIN_USERNAME ?? "superadmin";
const platformPassword =
  process.env.SUPER_ADMIN_PASSWORD ?? "Varees@9211@18!Seed";
const platformTenantCode =
  process.env.SUPER_ADMIN_TENANT_CODE ?? "platform";
const tenantCode = process.env.RBAC_SEED_TENANT_CODE ?? "venturesoft";
const tenantName = process.env.RBAC_SEED_TENANT_NAME ?? "VentureSoft.AI";
const tenantPassword =
  process.env.RBAC_SEED_PASSWORD ?? platformPassword;
const resetPasswords =
  process.env.RESET_SUPER_ADMIN_PASSWORD?.toLowerCase() === "true";

const tenantUsers = [
  {
    roleCode: "ORGANIZATION_ADMIN",
    email: "orgadmin@venturesoft.ai",
    username: "orgadmin",
    firstName: "Organization",
    lastName: "Admin"
  },
  {
    roleCode: "HR_MANAGER",
    email: "hrmanager@venturesoft.ai",
    username: "hrmanager",
    firstName: "HR",
    lastName: "Manager"
  },
  {
    roleCode: "RECRUITER",
    email: "recruiter@venturesoft.ai",
    username: "recruiter",
    firstName: "Recruitment",
    lastName: "User"
  },
  {
    roleCode: "MANAGER",
    email: "manager@venturesoft.ai",
    username: "manager",
    firstName: "Team",
    lastName: "Manager"
  },
  {
    roleCode: "EMPLOYEE",
    email: "employee@venturesoft.ai",
    username: "employee",
    firstName: "Sample",
    lastName: "Employee"
  }
] as const;

const departmentRoleCatalog = [
  {
    department: "Engineering / IT",
    roles: [
      "Software Engineer",
      "Full Stack Developer",
      "Frontend Developer",
      "Backend Developer",
      "Mobile App Developer",
      "DevOps Engineer",
      "Site Reliability Engineer",
      "QA Engineer (Manual)",
      "Automation QA Engineer",
      "Technical Lead",
      "Software Architect",
      "Engineering Manager"
    ]
  },
  {
    department: "Cloud & Infrastructure",
    roles: [
      "Cloud Engineer (AWS/Azure/GCP)",
      "System Administrator",
      "Network Engineer",
      "Security Engineer",
      "Infrastructure Engineer",
      "IT Support Engineer"
    ]
  },
  {
    department: "Data & Analytics",
    roles: [
      "Data Analyst",
      "Data Engineer",
      "Data Scientist",
      "Machine Learning Engineer",
      "BI Developer",
      "BI Analyst"
    ]
  },
  {
    department: "Product Management",
    roles: [
      "Product Manager",
      "Senior Product Manager",
      "Product Owner",
      "Program Manager"
    ]
  },
  {
    department: "Quality Assurance (QA)",
    roles: [
      "QA Engineer",
      "Automation QA Engineer",
      "Performance Test Engineer",
      "QA Lead",
      "QA Manager"
    ]
  },
  {
    department: "Human Resources (HR)",
    roles: [
      "HR Executive",
      "HR Generalist",
      "HR Manager",
      "HR Business Partner",
      "Recruiter / Talent Acquisition",
      "Payroll Specialist",
      "L&D Manager"
    ]
  },
  {
    department: "Finance & Accounts",
    roles: [
      "Accountant",
      "Financial Analyst",
      "Accounts Payable Executive",
      "Accounts Receivable Executive",
      "Payroll Manager",
      "Finance Manager"
    ]
  },
  {
    department: "Sales & Business Development",
    roles: [
      "Sales Executive",
      "Business Development Executive",
      "Account Manager",
      "Key Account Manager",
      "Sales Manager",
      "Regional Sales Head"
    ]
  },
  {
    department: "Marketing",
    roles: [
      "Digital Marketing Executive",
      "SEO Specialist",
      "Content Writer",
      "Social Media Manager",
      "Performance Marketing Specialist",
      "Marketing Manager"
    ]
  },
  {
    department: "Operations",
    roles: [
      "Operations Executive",
      "Operations Analyst",
      "Operations Manager",
      "Delivery Manager"
    ]
  },
  {
    department: "Legal & Compliance",
    roles: [
      "Legal Associate",
      "Legal Advisor",
      "Compliance Officer",
      "Risk Analyst"
    ]
  },
  {
    department: "IT Support / Helpdesk",
    roles: [
      "Helpdesk Support (L1)",
      "IT Support Engineer (L2/L3)",
      "Service Desk Analyst"
    ]
  },
  {
    department: "Admin & Facilities",
    roles: [
      "Admin Executive",
      "Office Administrator",
      "Facility Manager",
      "Procurement Officer"
    ]
  }
] as const;

async function main(): Promise<void> {
  if (!platformPassword || platformPassword.length < 16) {
    throw new Error(
      "SUPER_ADMIN_PASSWORD is required and must contain at least 16 characters."
    );
  }
  if (!tenantPassword || tenantPassword.length < 12) {
    throw new Error(
      "RBAC_SEED_PASSWORD or SUPER_ADMIN_PASSWORD must contain at least 12 characters."
    );
  }

  const platformPasswordHash = await hashPassword(platformPassword);
  const tenantPasswordHash = await hashPassword(tenantPassword);

  const result = await prisma.$transaction(async (tx) => {
    const permissionIds = await seedPermissions(tx);

    const platformTenant = await tx.tenant.upsert({
      where: { code: platformTenantCode },
      update: {
        name: "HRMS Platform Administration",
        status: "ACTIVE",
        deletedAt: null,
        settings: { tenantType: "platform" }
      },
      create: {
        code: platformTenantCode,
        name: "HRMS Platform Administration",
        status: "ACTIVE",
        defaultTimezone: "UTC",
        defaultLocale: "en",
        settings: { tenantType: "platform" }
      }
    });

    const platformRole = await upsertRole(
      tx,
      PLATFORM_ROLE,
      null,
      permissionIds
    );
    const platformUser = await upsertUser(tx, {
      email: platformEmail,
      username: platformUsername,
      firstName: "Platform",
      lastName: "Super Admin",
      passwordHash: platformPasswordHash,
      resetPassword: resetPasswords,
      preferences: {
        mustChangePassword: true,
        platformAdministrator: true
      }
    });
    await upsertAssignment(tx, {
      userId: platformUser.id,
      roleId: platformRole.id,
      tenantId: null,
      organizationId: null,
      scopeType: "PLATFORM",
      includeDescendants: true,
      assignedBy: platformUser.id
    });

    const tenant = await tx.tenant.upsert({
      where: { code: tenantCode },
      update: {
        name: tenantName,
        status: "ACTIVE",
        deletedAt: null,
        settings: { tenantType: "customer" }
      },
      create: {
        code: tenantCode,
        name: tenantName,
        status: "ACTIVE",
        defaultTimezone: "Asia/Calcutta",
        defaultLocale: "en-IN",
        settings: { tenantType: "customer" }
      }
    });

    const organization = await tx.organization.upsert({
      where: {
        tenantId_code: {
          tenantId: tenant.id,
          code: "ROOT"
        }
      },
      update: {
        name: tenantName,
        organizationType: "company",
        timezone: tenant.defaultTimezone,
        deletedAt: null
      },
      create: {
        tenantId: tenant.id,
        code: "ROOT",
        name: tenantName,
        organizationType: "company",
        timezone: tenant.defaultTimezone,
        countryCode: "IN"
      }
    });

    const tenantRoleIds = new Map<string, string>();
    for (const template of TENANT_ROLES) {
      const role = await upsertRole(tx, template, tenant.id, permissionIds);
      tenantRoleIds.set(template.code, role.id);
    }
    const departmentSeed = await seedDepartmentRoles(tx, {
      tenantId: tenant.id,
      parentOrganizationId: organization.id,
      actorUserId: platformUser.id,
      permissionIds
    });

    const seededUsers: Array<{ id: string; email: string; role: string }> = [];
    const usersByRole = new Map<string, string>();
    for (const definition of tenantUsers) {
      const user = await upsertUser(tx, {
        email: definition.email,
        username: definition.username,
        firstName: definition.firstName,
        lastName: definition.lastName,
        passwordHash: tenantPasswordHash,
        resetPassword: resetPasswords,
        preferences: { mustChangePassword: true }
      });
      await tx.tenantMembership.upsert({
        where: {
          tenantId_userId: { tenantId: tenant.id, userId: user.id }
        },
        update: {
          status: "ACTIVE",
          joinedAt: new Date(),
          deletedAt: null,
          deletedBy: null,
          updatedBy: platformUser.id,
          rowVersion: { increment: 1 }
        },
        create: {
          tenantId: tenant.id,
          userId: user.id,
          status: "ACTIVE",
          joinedAt: new Date(),
          createdBy: platformUser.id,
          updatedBy: platformUser.id
        }
      });

      const template = TENANT_ROLES.find(
        (item) => item.code === definition.roleCode
      );
      const roleId = tenantRoleIds.get(definition.roleCode);
      if (!template || !roleId) {
        throw new Error(`Missing role template ${definition.roleCode}.`);
      }
      const organizationId =
        template.defaultScope === "ORGANIZATION" ||
        template.defaultScope === "TEAM"
          ? organization.id
          : null;
      await upsertAssignment(tx, {
        userId: user.id,
        roleId,
        tenantId: tenant.id,
        organizationId,
        scopeType: template.defaultScope,
        includeDescendants:
          template.defaultScope === "ORGANIZATION" ||
          template.defaultScope === "TEAM",
        assignedBy: platformUser.id
      });
      seededUsers.push({ id: user.id, email: user.email, role: definition.roleCode });
      usersByRole.set(definition.roleCode, user.id);
    }

    await seedPerformanceTemplate(tx, {
      tenantId: tenant.id,
      organizationId: organization.id,
      actorUserId: platformUser.id,
      managerUserId: usersByRole.get("MANAGER") ?? null,
      employeeUserId: usersByRole.get("EMPLOYEE") ?? null
    });

    await tx.auditEvent.create({
      data: {
        tenantId: null,
        actorUserId: platformUser.id,
        effectiveUserId: platformUser.id,
        action: "identity.rbac_seeded",
        entityType: "rbac",
        result: "SUCCESS",
        metadata: {
          permissionCount: PERMISSIONS.length,
          platformRole: PLATFORM_ROLE.code,
          tenantId: tenant.id,
          tenantRoles: TENANT_ROLES.map((role) => role.code),
          departments: departmentSeed.departments,
          departmentRoles: departmentSeed.roleCount,
          users: seededUsers
        } satisfies Prisma.InputJsonValue
      }
    });

    return {
      platformUser: platformUser.email,
      platformRole: PLATFORM_ROLE.code,
      platformTenant: platformTenant.code,
      tenant: tenant.code,
      tenantUsers: seededUsers,
      departmentCount: departmentSeed.departments.length,
      departmentRoleCount: departmentSeed.roleCount,
      permissionCount: PERMISSIONS.length
    };
  });

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

async function seedPermissions(tx: Prisma.TransactionClient) {
  const ids = new Map<string, string>();
  const catalogCodes = PERMISSIONS.map((definition) => definition.code);
  await tx.permission.updateMany({
    where: {
      code: { notIn: catalogCodes },
      deletedAt: null
    },
    data: { deletedAt: new Date() }
  });
  for (const definition of PERMISSIONS) {
    const item = await tx.permission.upsert({
      where: { code: definition.code },
      update: {
        module: definition.module,
        resource: definition.resource,
        action: definition.action,
        description: definition.description,
        sensitivity: definition.sensitivity ?? "STANDARD",
        requiresMfa: definition.requiresMfa ?? false,
        deletedAt: null,
        deletedBy: null,
        rowVersion: { increment: 1 }
      },
      create: {
        code: definition.code,
        module: definition.module,
        resource: definition.resource,
        action: definition.action,
        description: definition.description,
        sensitivity: definition.sensitivity ?? "STANDARD",
        requiresMfa: definition.requiresMfa ?? false
      }
    });
    ids.set(definition.code, item.id);
  }
  return ids;
}

async function upsertRole(
  tx: Prisma.TransactionClient,
  template: RoleTemplate,
  tenantId: string | null,
  permissionIds: Map<string, string>
) {
  let role = await tx.role.findFirst({
    where: {
      tenantId,
      code: template.code
    }
  });
  if (role) {
    role = await tx.role.update({
      where: { id: role.id },
      data: {
        name: template.name,
        description: template.description,
        departmentId: null,
        roleType: template.roleType,
        isSystemRole: true,
        deletedAt: null,
        deletedBy: null,
        rowVersion: { increment: 1 }
      }
    });
  } else {
    role = await tx.role.create({
      data: {
        tenantId,
        departmentId: null,
        code: template.code,
        name: template.name,
        description: template.description,
        roleType: template.roleType,
        isSystemRole: true
      }
    });
  }

  await tx.rolePermission.updateMany({
    where: { roleId: role.id, deletedAt: null },
    data: { deletedAt: new Date() }
  });
  for (const code of template.permissions) {
    const permissionId = permissionIds.get(code);
    if (!permissionId) throw new Error(`Missing permission ${code}.`);
    const existing = await tx.rolePermission.findUnique({
      where: {
        roleId_permissionId: { roleId: role.id, permissionId }
      }
    });
    if (existing) {
      await tx.rolePermission.update({
        where: { id: existing.id },
        data: { deletedAt: null, deletedBy: null }
      });
    } else {
      await tx.rolePermission.create({
        data: { roleId: role.id, permissionId }
      });
    }
  }
  return role;
}

async function upsertUser(
  tx: Prisma.TransactionClient,
  input: {
    email: string;
    username: string;
    firstName: string;
    lastName: string;
    passwordHash: string;
    resetPassword: boolean;
    preferences: Prisma.InputJsonValue;
  }
) {
  const existing = await tx.user.findUnique({ where: { email: input.email } });
  if (existing) {
    return tx.user.update({
      where: { id: existing.id },
      data: {
        username: input.username,
        firstName: input.firstName,
        lastName: input.lastName,
        ...(input.resetPassword ? { passwordHash: input.passwordHash } : {}),
        status: "ACTIVE",
        emailVerifiedAt: existing.emailVerifiedAt ?? new Date(),
        failedLoginCount: 0,
        lockedUntil: null,
        preferences: input.preferences,
        deletedAt: null,
        deletedBy: null,
        rowVersion: { increment: 1 }
      }
    });
  }
  return tx.user.create({
    data: {
      email: input.email,
      username: input.username,
      passwordHash: input.passwordHash,
      firstName: input.firstName,
      lastName: input.lastName,
      status: "ACTIVE",
      emailVerifiedAt: new Date(),
      preferences: input.preferences
    }
  });
}

async function upsertAssignment(
  tx: Prisma.TransactionClient,
  input: {
    userId: string;
    roleId: string;
    tenantId: string | null;
    organizationId: string | null;
    scopeType: AssignmentScope;
    includeDescendants: boolean;
    assignedBy: string;
  }
) {
  const existing = await tx.roleAssignment.findFirst({
    where: {
      userId: input.userId,
      roleId: input.roleId,
      tenantId: input.tenantId,
      organizationId: input.organizationId,
      scopeType: input.scopeType
    }
  });
  if (existing) {
    return tx.roleAssignment.update({
      where: { id: existing.id },
      data: {
        includeDescendants: input.includeDescendants,
        validFrom: new Date(),
        validUntil: null,
        assignedBy: input.assignedBy,
        deletedAt: null,
        deletedBy: null
      }
    });
  }
  return tx.roleAssignment.create({ data: input });
}

async function seedDepartmentRoles(
  tx: Prisma.TransactionClient,
  input: {
    tenantId: string;
    parentOrganizationId: string;
    actorUserId: string;
    permissionIds: Map<string, string>;
  }
) {
  const selfPermissionIds = [...input.permissionIds.entries()]
    .filter(([code]) => code.startsWith("self."))
    .map(([, id]) => id);
  let roleCount = 0;
  const departments: string[] = [];

  for (const departmentTemplate of departmentRoleCatalog) {
    const department = await tx.organization.upsert({
      where: {
        tenantId_code: {
          tenantId: input.tenantId,
          code: departmentCode(departmentTemplate.department)
        }
      },
      update: {
        parentId: input.parentOrganizationId,
        name: departmentTemplate.department,
        organizationType: "department",
        deletedAt: null,
        deletedBy: null,
        updatedBy: input.actorUserId,
        rowVersion: { increment: 1 }
      },
      create: {
        tenantId: input.tenantId,
        parentId: input.parentOrganizationId,
        code: departmentCode(departmentTemplate.department),
        name: departmentTemplate.department,
        organizationType: "department",
        timezone: "Asia/Calcutta",
        countryCode: "IN",
        createdBy: input.actorUserId,
        updatedBy: input.actorUserId
      }
    });
    departments.push(department.name);

    for (const roleName of departmentTemplate.roles) {
      const code = roleCode(departmentTemplate.department, roleName);
      let role = await tx.role.findFirst({
        where: { tenantId: input.tenantId, code }
      });
      if (role) {
        role = await tx.role.update({
          where: { id: role.id },
          data: {
            departmentId: department.id,
            name: roleName,
            description: `${roleName} in ${department.name}.`,
            roleType: "SELF",
            isSystemRole: true,
            deletedAt: null,
            deletedBy: null,
            updatedBy: input.actorUserId,
            rowVersion: { increment: 1 }
          }
        });
      } else {
        role = await tx.role.create({
          data: {
            tenantId: input.tenantId,
            departmentId: department.id,
            code,
            name: roleName,
            description: `${roleName} in ${department.name}.`,
            roleType: "SELF",
            isSystemRole: true,
            createdBy: input.actorUserId,
            updatedBy: input.actorUserId
          }
        });
      }
      await syncRolePermissionIds(tx, role.id, selfPermissionIds, input.actorUserId);
      roleCount += 1;
    }
  }

  return { departments, roleCount };
}

async function syncRolePermissionIds(
  tx: Prisma.TransactionClient,
  roleId: string,
  permissionIds: string[],
  actorUserId: string
) {
  await tx.rolePermission.updateMany({
    where: { roleId, permissionId: { notIn: permissionIds }, deletedAt: null },
    data: { deletedAt: new Date(), deletedBy: actorUserId }
  });
  for (const permissionId of permissionIds) {
    const existing = await tx.rolePermission.findUnique({
      where: { roleId_permissionId: { roleId, permissionId } }
    });
    if (existing) {
      await tx.rolePermission.update({
        where: { id: existing.id },
        data: { deletedAt: null, deletedBy: null }
      });
    } else {
      await tx.rolePermission.create({
        data: { roleId, permissionId, createdBy: actorUserId }
      });
    }
  }
}

async function seedPerformanceTemplate(
  tx: Prisma.TransactionClient,
  input: {
    tenantId: string;
    organizationId: string;
    actorUserId: string;
    managerUserId: string | null;
    employeeUserId: string | null;
  }
) {
  const cycle = await tx.performanceReviewCycle.upsert({
    where: {
      tenantId_name: {
        tenantId: input.tenantId,
        name: "FY2026 VentureSoft Performance Review"
      }
    },
    update: {
      organizationId: input.organizationId,
      startDate: new Date("2026-04-01"),
      endDate: new Date("2027-03-31"),
      status: "ACTIVE",
      updatedBy: input.actorUserId,
      deletedAt: null,
      deletedBy: null,
      rowVersion: { increment: 1 }
    },
    create: {
      tenantId: input.tenantId,
      organizationId: input.organizationId,
      name: "FY2026 VentureSoft Performance Review",
      startDate: new Date("2026-04-01"),
      endDate: new Date("2027-03-31"),
      status: "ACTIVE",
      createdBy: input.actorUserId,
      updatedBy: input.actorUserId,
      metadata: {
        ratingScale: "1-5",
        scoringFormula: "Final score = weighted goal average"
      }
    }
  });

  const goals = [
    {
      name: "Operational Excellence",
      description: "Service stability, responsiveness, governance, and satisfaction.",
      weightage: 70,
      kras: [
        {
          title: "Ensure Client Cloud Environment is Stable",
          description: "Maintain production stability during the review period.",
          weightage: 25,
          kpis: [
            {
              description: "Less than 5 P1 tickets during review period",
              targetValue: 4,
              weightage: 100
            }
          ]
        },
        {
          title: "Increase Efficiency in Responding and Fixing User Problems",
          description: "Improve responsiveness and reduce SLA misses.",
          weightage: 25,
          kpis: [
            {
              description: "SLA breach percentage below 5%",
              targetValue: 5,
              weightage: 100
            }
          ]
        },
        {
          title: "Governance and Reporting",
          description: "Keep cadence reporting and client governance predictable.",
          weightage: 25,
          kpis: [
            {
              description: "100% cadence reports submitted on time",
              targetValue: 100,
              weightage: 60
            },
            {
              description: "Attendance in all client monthly meetings",
              targetValue: 100,
              weightage: 40
            }
          ]
        },
        {
          title: "Increase Client Satisfaction with Technology Operations",
          description: "Improve client satisfaction and reduce escalations.",
          weightage: 25,
          kpis: [
            {
              description: "Client satisfaction score above 85%",
              targetValue: 85,
              weightage: 60
            },
            {
              description: "Less than 3 operational escalations",
              targetValue: 2,
              weightage: 40
            }
          ]
        }
      ]
    },
    {
      name: "Technical Competencies and Corporate Citizenship",
      description: "Professional development, certifications, and knowledge sharing.",
      weightage: 30,
      kras: [
        {
          title: "Professional Development",
          description: "Complete learning obligations and strengthen credentials.",
          weightage: 60,
          kpis: [
            {
              description: "Complete all mandatory trainings",
              targetValue: 100,
              weightage: 50
            },
            {
              description: "Complete at least one certification",
              targetValue: 1,
              weightage: 50
            }
          ]
        },
        {
          title: "Corporate Citizenship",
          description: "Contribute reusable knowledge to the organization.",
          weightage: 40,
          kpis: [
            {
              description: "Publish minimum one whitepaper or blog",
              targetValue: 1,
              weightage: 100
            }
          ]
        }
      ]
    }
  ];

  for (const goalTemplate of goals) {
    const goal = await tx.performanceGoal.upsert({
      where: {
        tenantId_cycleId_name: {
          tenantId: input.tenantId,
          cycleId: cycle.id,
          name: goalTemplate.name
        }
      },
      update: {
        organizationId: input.organizationId,
        description: goalTemplate.description,
        weightage: goalTemplate.weightage,
        updatedBy: input.actorUserId,
        deletedAt: null,
        deletedBy: null,
        rowVersion: { increment: 1 }
      },
      create: {
        tenantId: input.tenantId,
        cycleId: cycle.id,
        organizationId: input.organizationId,
        name: goalTemplate.name,
        description: goalTemplate.description,
        weightage: goalTemplate.weightage,
        createdBy: input.actorUserId,
        updatedBy: input.actorUserId
      }
    });

    for (const kraTemplate of goalTemplate.kras) {
      const kra = await tx.performanceKra.upsert({
        where: {
          tenantId_goalId_title: {
            tenantId: input.tenantId,
            goalId: goal.id,
            title: kraTemplate.title
          }
        },
        update: {
          description: kraTemplate.description,
          weightage: kraTemplate.weightage,
          deletedAt: null
        },
        create: {
          tenantId: input.tenantId,
          goalId: goal.id,
          title: kraTemplate.title,
          description: kraTemplate.description,
          weightage: kraTemplate.weightage
        }
      });

      await tx.performanceKpi.updateMany({
        where: { tenantId: input.tenantId, kraId: kra.id, deletedAt: null },
        data: { deletedAt: new Date() }
      });
      for (const kpiTemplate of kraTemplate.kpis) {
        await tx.performanceKpi.create({
          data: {
            tenantId: input.tenantId,
            kraId: kra.id,
            description: kpiTemplate.description,
            targetValue: kpiTemplate.targetValue,
            weightage: kpiTemplate.weightage
          }
        });
      }
    }
  }

  if (input.employeeUserId) {
    await tx.performanceReview.upsert({
      where: {
        tenantId_cycleId_employeeUserId: {
          tenantId: input.tenantId,
          cycleId: cycle.id,
          employeeUserId: input.employeeUserId
        }
      },
      update: {
        managerUserId: input.managerUserId,
        organizationId: input.organizationId,
        updatedBy: input.actorUserId,
        deletedAt: null,
        deletedBy: null,
        rowVersion: { increment: 1 }
      },
      create: {
        tenantId: input.tenantId,
        cycleId: cycle.id,
        employeeUserId: input.employeeUserId,
        managerUserId: input.managerUserId,
        organizationId: input.organizationId,
        createdBy: input.actorUserId,
        updatedBy: input.actorUserId
      }
    });
  }
}

function hashPassword(password: string) {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65_536,
    timeCost: 3,
    parallelism: 1
  });
}

function departmentCode(name: string) {
  return `DEPT_${slug(name)}`;
}

function roleCode(department: string, role: string) {
  return `JOB_${slug(department)}_${slug(role)}`.slice(0, 80);
}

function slug(value: string) {
  return value
    .normalize("NFKD")
    .replace(/&/g, " AND ")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_")
    .toUpperCase();
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
