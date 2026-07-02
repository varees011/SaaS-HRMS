import type { Request, Response } from "express";
import { AuthenticationError } from "../../core/errors.js";
import { adminService } from "./admin.service.js";

export class AdminController {
  async listTenants(req: Request, res: Response) {
    res.json(await adminService.listTenants(listInput(req), actor(req)));
  }

  async createTenant(req: Request, res: Response) {
    const auth = requireAuth(req);
    res.status(201).json({
      data: await adminService.createTenant(
        req.body,
        actor(req),
        req.context
      )
    });
  }

  async updateTenant(req: Request, res: Response) {
    const auth = requireAuth(req);
    res.json({
      data: await adminService.updateTenant(
        String(req.params.id),
        req.body,
        actor(req),
        req.context
      )
    });
  }

  async listOrganizations(req: Request, res: Response) {
    res.json(
      await adminService.listOrganizations(listInput(req), actor(req))
    );
  }

  async createOrganization(req: Request, res: Response) {
    const auth = requireAuth(req);
    res.status(201).json({
      data: await adminService.createOrganization(
        req.body,
        actor(req),
        req.context
      )
    });
  }

  async updateOrganization(req: Request, res: Response) {
    const auth = requireAuth(req);
    res.json({
      data: await adminService.updateOrganization(
        String(req.params.id),
        req.body,
        actor(req),
        req.context
      )
    });
  }

  async deleteOrganization(req: Request, res: Response) {
    const auth = requireAuth(req);
    await adminService.deleteOrganization(
      String(req.params.id),
      actor(req),
      req.context
    );
    res.status(204).send();
  }

  async listUsers(req: Request, res: Response) {
    res.json(await adminService.listUsers(listInput(req), actor(req)));
  }

  async listRoles(req: Request, res: Response) {
    const filters = {
      ...(req.query.tenantId ? { tenantId: String(req.query.tenantId) } : {}),
      ...(req.query.departmentId
        ? { departmentId: String(req.query.departmentId) }
        : {})
    };
    res.json({
      data: await adminService.listRoles(filters, actor(req))
    });
  }

  async listPermissions(req: Request, res: Response) {
    const auth = requireAuth(req);
    res.json({ data: await adminService.listPermissions() });
  }

  async createRole(req: Request, res: Response) {
    const auth = requireAuth(req);
    res.status(201).json({
      data: await adminService.createRole(req.body, actor(req), req.context)
    });
  }

  async updateRole(req: Request, res: Response) {
    const auth = requireAuth(req);
    res.json({
      data: await adminService.updateRole(
        String(req.params.id),
        req.body,
        actor(req),
        req.context
      )
    });
  }

  async deleteRole(req: Request, res: Response) {
    const auth = requireAuth(req);
    await adminService.deleteRole(String(req.params.id), actor(req), req.context);
    res.status(204).send();
  }

  async createUser(req: Request, res: Response) {
    const auth = requireAuth(req);
    res.status(201).json({
      data: await adminService.createUser(
        req.body,
        actor(req),
        req.context
      )
    });
  }

  async updateUser(req: Request, res: Response) {
    const auth = requireAuth(req);
    res.json({
      data: await adminService.updateUser(
        String(req.params.id),
        req.body,
        actor(req),
        req.context
      )
    });
  }

  async deleteUser(req: Request, res: Response) {
    const auth = requireAuth(req);
    await adminService.deleteUser(
      String(req.params.id),
      actor(req),
      req.context
    );
    res.status(204).send();
  }
}

function requireAuth(req: Request) {
  if (!req.auth) throw new AuthenticationError();
  return req.auth;
}

function actor(req: Request) {
  const auth = requireAuth(req);
  return {
    tenantId: req.tenantAccess?.tenantId ?? null,
    userId: auth.userId,
    isPlatformAdmin: req.tenantAccess?.isPlatformAdmin ?? false,
    permissions: auth.permissions,
    assignments: auth.assignments
  };
}

function listInput(req: Request) {
  return {
    limit: Number(req.query.limit) || 25,
    sort: (req.query.sort ?? "-createdAt") as
      | "name"
      | "-name"
      | "createdAt"
      | "-createdAt",
    ...(req.query.cursor ? { cursor: String(req.query.cursor) } : {}),
    ...(req.query.tenantId ? { tenantId: String(req.query.tenantId) } : {}),
    ...(req.query.departmentId ? { departmentId: String(req.query.departmentId) } : {}),
    ...(req.query.search ? { search: String(req.query.search) } : {}),
    ...(req.query.role ? { role: String(req.query.role) as "employee" | "manager" } : {}),
    ...(req.query.organizationType
      ? { organizationType: String(req.query.organizationType) }
      : {}),
    ...(req.query.status ? { status: String(req.query.status) } : {})
  };
}

export const adminController = new AdminController();
