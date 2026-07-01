import { Router, type Router as ExpressRouter } from "express";
import {
  authenticate,
  establishTenantAccess,
  requireAnyPermission,
  requirePermissions
} from "../../core/auth.js";
import { validate } from "../../core/validate.middleware.js";
import { adminController } from "./admin.controller.js";
import {
  adminListQuerySchema,
  createOrganizationSchema,
  createRoleSchema,
  createTenantSchema,
  createUserSchema,
  idParamsSchema,
  updateOrganizationSchema,
  updateRoleSchema,
  updateTenantSchema,
  updateUserSchema
} from "./admin.schema.js";

export const adminRouter: ExpressRouter = Router();
adminRouter.use(authenticate);
adminRouter.use(establishTenantAccess);

adminRouter.get(
  "/tenants",
  requireAnyPermission("platform.tenants.read", "tenant.settings.read"),
  validate({ query: adminListQuerySchema }),
  adminController.listTenants.bind(adminController)
);
adminRouter.post(
  "/tenants",
  requirePermissions("platform.tenants.create"),
  validate({ body: createTenantSchema }),
  adminController.createTenant.bind(adminController)
);
adminRouter.patch(
  "/tenants/:id",
  requireAnyPermission("platform.tenants.update", "tenant.settings.manage"),
  validate({ params: idParamsSchema, body: updateTenantSchema }),
  adminController.updateTenant.bind(adminController)
);

adminRouter.get(
  "/organizations",
  requireAnyPermission(
    "platform.organizations.read",
    "tenant.organizations.read"
  ),
  validate({ query: adminListQuerySchema }),
  adminController.listOrganizations.bind(adminController)
);
adminRouter.post(
  "/organizations",
  requireAnyPermission(
    "platform.organizations.create",
    "tenant.organizations.manage"
  ),
  validate({ body: createOrganizationSchema }),
  adminController.createOrganization.bind(adminController)
);
adminRouter.patch(
  "/organizations/:id",
  requireAnyPermission(
    "platform.organizations.update",
    "tenant.organizations.manage"
  ),
  validate({ params: idParamsSchema, body: updateOrganizationSchema }),
  adminController.updateOrganization.bind(adminController)
);
adminRouter.delete(
  "/organizations/:id",
  requireAnyPermission(
    "platform.organizations.delete",
    "tenant.organizations.manage"
  ),
  validate({ params: idParamsSchema }),
  adminController.deleteOrganization.bind(adminController)
);

adminRouter.get(
  "/users",
  requireAnyPermission("platform.users.read", "tenant.users.read", "user.read"),
  validate({ query: adminListQuerySchema }),
  adminController.listUsers.bind(adminController)
);
adminRouter.post(
  "/users",
  requireAnyPermission("platform.users.create", "tenant.users.manage", "user.create"),
  validate({ body: createUserSchema }),
  adminController.createUser.bind(adminController)
);
adminRouter.patch(
  "/users/:id",
  requireAnyPermission("platform.users.update", "tenant.users.manage", "user.update"),
  validate({ params: idParamsSchema, body: updateUserSchema }),
  adminController.updateUser.bind(adminController)
);
adminRouter.delete(
  "/users/:id",
  requireAnyPermission("platform.users.delete", "tenant.users.manage", "user.delete"),
  validate({ params: idParamsSchema }),
  adminController.deleteUser.bind(adminController)
);
adminRouter.get(
  "/roles",
  requireAnyPermission("platform.roles.read", "tenant.roles.read", "role.read"),
  validate({ query: adminListQuerySchema.pick({ tenantId: true, departmentId: true }) }),
  adminController.listRoles.bind(adminController)
);
adminRouter.post(
  "/roles",
  requireAnyPermission(
    "tenant.roles.manage",
    "platform.roles.manage",
    "role.create"
  ),
  validate({ body: createRoleSchema }),
  adminController.createRole.bind(adminController)
);
adminRouter.patch(
  "/roles/:id",
  requireAnyPermission(
    "tenant.roles.manage",
    "platform.roles.manage",
    "role.update"
  ),
  validate({ params: idParamsSchema, body: updateRoleSchema }),
  adminController.updateRole.bind(adminController)
);
adminRouter.delete(
  "/roles/:id",
  requireAnyPermission(
    "tenant.roles.manage",
    "platform.roles.manage",
    "role.delete"
  ),
  validate({ params: idParamsSchema }),
  adminController.deleteRole.bind(adminController)
);
adminRouter.get(
  "/permissions",
  requireAnyPermission("platform.roles.read", "tenant.roles.read", "role.read"),
  adminController.listPermissions.bind(adminController)
);
