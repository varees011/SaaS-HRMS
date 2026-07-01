import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LoaderCircle, Pencil, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Alert } from "@/shared/ui/alert";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/shared/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Select } from "@/shared/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/shared/ui/table";
import { adminApi } from "@/features/admin/admin.api";
import type { AdminPermission, AdminRole } from "@/features/admin/admin.types";
import { ApiError } from "@/shared/api/http";

const roleTypes = ["TENANT", "ORGANIZATION", "MANAGER", "SELF"] as const;

export function RolesPage() {
  const [tenantId, setTenantId] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AdminRole | null>(null);
  const [error, setError] = useState<string>();
  const queryClient = useQueryClient();
  const tenants = useQuery({
    queryKey: ["admin", "tenants"],
    queryFn: () => adminApi.listTenants()
  });
  const roles = useQuery({
    queryKey: ["admin", "roles", tenantId],
    queryFn: () => adminApi.listRoles(tenantId),
    enabled: Boolean(tenantId)
  });
  const permissions = useQuery({
    queryKey: ["admin", "permissions"],
    queryFn: () => adminApi.listPermissions()
  });

  useEffect(() => {
    if (!tenantId && tenants.data?.data[0]) {
      const customerTenant =
        tenants.data.data.find((tenant) => tenant.code !== "platform") ??
        tenants.data.data[0];
      setTenantId(customerTenant.id);
    }
  }, [tenantId, tenants.data]);

  const groupedPermissions = useMemo(() => {
    const groups = new Map<string, AdminPermission[]>();
    for (const permission of permissions.data?.data ?? []) {
      const existing = groups.get(permission.module) ?? [];
      existing.push(permission);
      groups.set(permission.module, existing);
    }
    return [...groups.entries()];
  }, [permissions.data]);

  const createRole = useMutation({
    mutationFn: adminApi.createRole,
    onSuccess: async () => {
      setOpen(false);
      setEditing(null);
      await queryClient.invalidateQueries({ queryKey: ["admin", "roles"] });
    },
    onError: showError
  });
  const updateRole = useMutation({
    mutationFn: ({ id, input }: {
      id: string;
      input: {
        name: string;
        description?: string | null;
        roleType: string;
        permissionIds: string[];
      };
    }) => adminApi.updateRole(id, input),
    onSuccess: async () => {
      setOpen(false);
      setEditing(null);
      await queryClient.invalidateQueries({ queryKey: ["admin", "roles"] });
    },
    onError: showError
  });
  const deleteRole = useMutation({
    mutationFn: (id: string) => adminApi.deleteRole(id, tenantId),
    onMutate: () => setError(undefined),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["admin", "roles", tenantId] }),
    onError: showError
  });

  function showError(reason: unknown) {
    if (reason instanceof ApiError) {
      const fieldMessages =
        reason.fields
          ?.map((field) => `${field.field.replace(/^body\./, "")}: ${field.message}`)
          .join(" ") ?? "";
      setError(fieldMessages ? `${reason.message} ${fieldMessages}` : reason.message);
      return;
    }
    setError("The role request failed.");
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const permissionIds = form.getAll("permissionIds").map(String);
    if (!permissionIds.length) {
      setError("Select at least one permission.");
      return;
    }
    setError(undefined);
    const input = {
      name: String(form.get("name")),
      description: String(form.get("description") || "") || null,
      roleType: String(form.get("roleType")),
      permissionIds
    };
    if (editing) {
      updateRole.mutate({ id: editing.id, input });
      return;
    }
    createRole.mutate({
      tenantId,
      code: String(form.get("code")).trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_"),
      ...input
    });
  }

  function openCreate() {
    setError(undefined);
    setEditing(null);
    setOpen(true);
  }

  function openEdit(role: AdminRole) {
    setError(undefined);
    setEditing(role);
    setOpen(true);
  }

  const selectedPermissionIds = new Set(
    editing?.permissions.map((item) => item.permission.id) ?? []
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">Role management</h1>
          <p className="text-muted-foreground">
            Define tenant roles and the permissions enforced by backend guards.
          </p>
        </div>
        <Button onClick={openCreate} disabled={!tenantId}>
          <Plus className="h-4 w-4" />
          Add role
        </Button>
      </div>
      {error ? <Alert variant="destructive">{error}</Alert> : null}
      <Card>
        <CardHeader>
          <CardTitle>Roles</CardTitle>
          <CardDescription>Select a tenant to manage its role catalog.</CardDescription>
          <Select value={tenantId} onChange={(event) => setTenantId(event.target.value)}>
            <option value="">Select tenant</option>
            {tenants.data?.data.map((tenant) => (
              <option key={tenant.id} value={tenant.id}>
                {tenant.name} ({tenant.code})
              </option>
            ))}
          </Select>
        </CardHeader>
        <CardContent>
          {roles.isLoading ? (
            <LoaderCircle className="h-5 w-5 animate-spin" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Role</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Permissions</TableHead>
                  <TableHead>System</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roles.data?.data.map((role) => (
                  <TableRow key={role.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{role.name}</p>
                          <p className="text-xs text-muted-foreground">{role.code}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{role.roleType}</TableCell>
                    <TableCell>{role.permissions.length}</TableCell>
                    <TableCell>
                      <Badge variant={role.isSystemRole ? "secondary" : "outline"}>
                        {role.isSystemRole ? "Default" : "Custom"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(role)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          disabled={role.isSystemRole || deleteRole.isPending}
                          onClick={() => {
                            if (window.confirm(`Delete ${role.name}?`)) {
                              deleteRole.mutate(role.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit role" : "Create role"}</DialogTitle>
            <DialogDescription>
              Permission changes are enforced by the API on subsequent requests.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={submit}>
            <div className="grid gap-3 md:grid-cols-2">
              <Input
                name="code"
                placeholder="ROLE_CODE"
                defaultValue={editing?.code ?? ""}
                disabled={Boolean(editing)}
                required
              />
              <Input name="name" placeholder="Role name" defaultValue={editing?.name ?? ""} required />
            </div>
            <Input
              name="description"
              placeholder="Description"
              defaultValue={editing?.description ?? ""}
            />
            <Select name="roleType" defaultValue={editing?.roleType ?? "ORGANIZATION"}>
              {roleTypes.map((roleType) => (
                <option key={roleType} value={roleType}>
                  {roleType}
                </option>
              ))}
            </Select>
            <div className="max-h-80 space-y-4 overflow-auto rounded-md border p-3">
              {groupedPermissions.map(([module, items]) => (
                <div key={module}>
                  <p className="mb-2 text-sm font-semibold capitalize">{module}</p>
                  <div className="grid gap-2 md:grid-cols-2">
                    {items.map((permission) => (
                      <label
                        key={permission.id}
                        className="flex items-start gap-2 rounded-md border p-2 text-sm"
                      >
                        <input
                          type="checkbox"
                          name="permissionIds"
                          value={permission.id}
                          defaultChecked={selectedPermissionIds.has(permission.id)}
                          className="mt-1"
                        />
                        <span>
                          <span className="block font-medium">{permission.code}</span>
                          <span className="text-xs text-muted-foreground">
                            {permission.description}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <Button className="w-full" disabled={createRole.isPending || updateRole.isPending}>
              {(createRole.isPending || updateRole.isPending) ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : null}
              {editing ? "Save role" : "Create role"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
