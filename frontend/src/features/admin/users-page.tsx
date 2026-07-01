import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LoaderCircle, Plus, Save, Trash2, UserCog } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
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
import type { AdminUser } from "@/features/admin/admin.types";
import { strongPassword } from "@/features/auth/auth.schema";
import { useAuthStore } from "@/features/auth/auth.store";
import { hasAnyPermission } from "@/features/auth/permissions";
import { ApiError } from "@/shared/api/http";

export function UsersPage() {
  const currentUser = useAuthStore((state) => state.user)!;
  const isPlatformAdmin = currentUser.isSuperAdmin;
  const fixedTenantId =
    currentUser.tenantId ?? currentUser.memberships?.[0]?.tenantId ?? "";
  const [tenantId, setTenantId] = useState(isPlatformAdmin ? "" : fixedTenantId);
  const [createDepartmentId, setCreateDepartmentId] = useState("");
  const [createRoleId, setCreateRoleId] = useState("");
  const [createManagerUserId, setCreateManagerUserId] = useState("");
  const [rowDrafts, setRowDrafts] = useState<
    Record<string, { departmentId: string; roleId: string; managerUserId: string }>
  >({});
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string>();
  const canCreateUser = hasAnyPermission(currentUser, [
    "platform.users.create",
    "tenant.users.manage",
    "user.create"
  ]);
  const canUpdateUser = hasAnyPermission(currentUser, [
    "platform.users.update",
    "tenant.users.manage",
    "user.update"
  ]);
  const canDeleteUser = hasAnyPermission(currentUser, [
    "platform.users.delete",
    "tenant.users.manage",
    "user.delete"
  ]);
  const canReadRoles = hasAnyPermission(currentUser, [
    "platform.roles.read",
    "tenant.roles.read",
    "role.read"
  ]);
  const canReadOrganizations = hasAnyPermission(currentUser, [
    "platform.organizations.read",
    "tenant.organizations.read"
  ]);
  const queryClient = useQueryClient();
  const tenants = useQuery({
    queryKey: ["admin", "tenants"],
    queryFn: () => adminApi.listTenants(),
    enabled: isPlatformAdmin
  });
  useEffect(() => {
    if (!isPlatformAdmin) {
      if (fixedTenantId && tenantId !== fixedTenantId) setTenantId(fixedTenantId);
      return;
    }
    if (!tenantId && tenants.data?.data[0]) {
      const customerTenant =
        tenants.data.data.find((tenant) => tenant.code !== "platform") ??
        tenants.data.data[0];
      setTenantId(customerTenant.id);
    }
  }, [fixedTenantId, isPlatformAdmin, tenantId, tenants.data]);
  const users = useQuery({
    queryKey: ["admin", "users", tenantId],
    queryFn: () => adminApi.listUsers({ tenantId }),
    enabled: Boolean(tenantId)
  });
  const managers = useQuery({
    queryKey: ["admin", "users", "managers", tenantId],
    queryFn: () =>
      adminApi.listUsers({
        tenantId,
        role: "manager",
        status: "ACTIVE",
        limit: 1000
      }),
    enabled: Boolean(tenantId) && canUpdateUser
  });
  const roles = useQuery({
    queryKey: ["admin", "roles", tenantId],
    queryFn: () => adminApi.listRoles(tenantId),
    enabled: Boolean(tenantId) && canReadRoles
  });
  const departments = useQuery({
    queryKey: ["admin", "departments", tenantId],
    queryFn: () =>
      adminApi.listOrganizations({ tenantId, organizationType: "department" }),
    enabled: Boolean(tenantId) && canReadOrganizations
  });
  const create = useMutation({
    mutationFn: adminApi.createUser,
    onSuccess: async () => {
      setOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["admin", "users", tenantId] });
      await queryClient.invalidateQueries({ queryKey: ["admin", "tenants"] });
    },
    onError: showError
  });
  const update = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Record<string, unknown> }) =>
      adminApi.updateUser(id, input, tenantId),
    onSuccess: async (_data, variables) => {
      setRowDrafts((current) => {
        const next = { ...current };
        delete next[variables.id];
        return next;
      });
      await queryClient.invalidateQueries({ queryKey: ["admin", "users", tenantId] });
      await queryClient.invalidateQueries({
        queryKey: ["admin", "users", "managers", tenantId]
      });
    },
    onError: showError
  });
  const remove = useMutation({
    mutationFn: (id: string) => adminApi.deleteUser(id, tenantId),
    onMutate: () => setError(undefined),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["admin", "users", tenantId] }),
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
    setError("The user request failed.");
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password"));
    const passwordResult = strongPassword.safeParse(password);
    if (!passwordResult.success) {
      setError(
        `Temporary password: ${passwordResult.error.issues
          .map((issue) => issue.message)
          .join(" ")}`
      );
      return;
    }
    setError(undefined);
    create.mutate({
      tenantId,
      firstName: String(form.get("firstName")),
      lastName: String(form.get("lastName")),
      email: String(form.get("email")),
      username: String(form.get("username") || "") || null,
      password,
      status: "ACTIVE",
      roleId: String(form.get("roleId")),
      departmentId: String(form.get("departmentId")),
      organizationId: String(form.get("departmentId")),
      ...(createManagerUserId ? { managerUserId: createManagerUserId } : {})
    });
  }

  const createRoleOptions =
    roles.data?.data.filter((role) => role.departmentId === createDepartmentId) ?? [];
  const createRole = createRoleOptions.find((role) => role.id === createRoleId);
  const canAssignCreateManager = Boolean(
    createRole && !isManagerialRole(createRole)
  );
  const activeTenantLabel =
    currentUser.memberships?.find((membership) => membership.tenantId === tenantId)
      ?.tenant.name ??
    tenants.data?.data.find((tenant) => tenant.id === tenantId)?.name ??
    "Current organization";

  function baseDraftForUser(user: AdminUser) {
    const assignment = user.roleAssignments[0];
    return {
      departmentId: assignment?.role.departmentId ?? "",
      roleId: assignment?.role.id ?? "",
      managerUserId: user.reportingManagerUserId ?? ""
    };
  }

  function draftForUser(user: AdminUser) {
    return rowDrafts[user.id] ?? baseDraftForUser(user);
  }

  function setUserDraft(user: AdminUser, input: Partial<ReturnType<typeof baseDraftForUser>>) {
    setRowDrafts((current) => ({
      ...current,
      [user.id]: {
        ...draftForUser(user),
        ...input
      }
    }));
  }

  function hasDraftChanges(user: AdminUser) {
    const draft = draftForUser(user);
    const base = baseDraftForUser(user);
    return (
      draft.departmentId !== base.departmentId ||
      draft.roleId !== base.roleId ||
      draft.managerUserId !== base.managerUserId
    );
  }

  function roleOptionsForDepartment(departmentId: string) {
    return roles.data?.data.filter((role) => role.departmentId === departmentId) ?? [];
  }

  function roleById(roleId: string) {
    return roles.data?.data.find((role) => role.id === roleId);
  }

  function hasManagerialDraftRole(user: AdminUser) {
    const role = roleById(draftForUser(user).roleId);
    return role ? isManagerialRole(role) : false;
  }

  function saveUserChanges(user: AdminUser) {
    const draft = draftForUser(user);
    update.mutate({
      id: user.id,
      input: {
        departmentId: draft.departmentId,
        roleId: draft.roleId,
        managerUserId: draft.managerUserId || null
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">User administration</h1>
          <p className="text-muted-foreground">
            Create, assign, disable, and remove users across every tenant.
          </p>
        </div>
        {canCreateUser ? (
          <Button
            onClick={() => {
              setError(undefined);
              setCreateDepartmentId("");
              setCreateRoleId("");
              setCreateManagerUserId("");
              setOpen(true);
            }}
            disabled={!tenantId}
          >
            <Plus className="h-4 w-4" />
            Add user
          </Button>
        ) : null}
      </div>
      {error ? <Alert variant="destructive">{error}</Alert> : null}
      <Card>
        <CardHeader>
          <CardTitle>Users</CardTitle>
          <CardDescription>
            {isPlatformAdmin
              ? "Select a tenant to manage its accounts."
              : `Managing accounts for ${activeTenantLabel}.`}
          </CardDescription>
          {isPlatformAdmin ? (
            <Select value={tenantId} onChange={(event) => setTenantId(event.target.value)}>
              <option value="">Select tenant</option>
              {tenants.data?.data.map((tenant) => (
                <option key={tenant.id} value={tenant.id}>
                  {tenant.name} ({tenant.code})
                </option>
              ))}
            </Select>
          ) : (
            <div className="rounded-md border bg-secondary/40 px-3 py-2 text-sm font-medium">
              {activeTenantLabel}
            </div>
          )}
        </CardHeader>
        <CardContent>
          {users.isLoading ? (
            <LoaderCircle className="h-5 w-5 animate-spin" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Reporting manager</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>MFA</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.data?.data.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <UserCog className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium">
                            {user.firstName} {user.lastName}
                          </p>
                          <p className="text-xs text-muted-foreground">{user.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={draftForUser(user).departmentId}
                        disabled={!canUpdateUser || user.id === currentUser.id}
                        onChange={(event) =>
                          setUserDraft(user, {
                            departmentId: event.target.value,
                            roleId: ""
                          })
                        }
                      >
                        <option value="" disabled>
                          Select department
                        </option>
                        {departments.data?.data.map((department) => (
                          <option key={department.id} value={department.id}>
                            {department.name}
                          </option>
                        ))}
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={draftForUser(user).roleId}
                        disabled={
                          !canUpdateUser ||
                          user.id === currentUser.id ||
                          !draftForUser(user).departmentId ||
                          update.isPending
                        }
                        onChange={(event) => {
                          const role = roleById(event.target.value);
                          setUserDraft(user, {
                            roleId: event.target.value,
                            ...(role && isManagerialRole(role)
                              ? { managerUserId: "" }
                              : {})
                          });
                        }}
                      >
                        <option value="" disabled>
                          Select role
                        </option>
                        {roleOptionsForDepartment(draftForUser(user).departmentId).map((role) => (
                          <option key={role.id} value={role.id}>
                            {role.name}
                          </option>
                        ))}
                      </Select>
                    </TableCell>
                    <TableCell>
                      {hasManagerialDraftRole(user) ? (
                        <span className="text-sm text-muted-foreground">
                          Managerial role
                        </span>
                      ) : (
                        <Select
                          value={draftForUser(user).managerUserId}
                          disabled={!canUpdateUser || user.id === currentUser.id}
                          onChange={(event) =>
                            setUserDraft(user, { managerUserId: event.target.value })
                          }
                        >
                          <option value="">No reporting manager</option>
                          {managers.data?.data
                            .filter((manager) => manager.id !== user.id)
                            .map((manager) => (
                              <option key={manager.id} value={manager.id}>
                                {manager.firstName} {manager.lastName}
                              </option>
                            ))}
                        </Select>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.status === "ACTIVE" ? "success" : "secondary"}>
                        {user.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{user.mfaEnabled ? "Enabled" : "Not enabled"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {canUpdateUser ? (
                          <Button
                            size="sm"
                            disabled={
                              user.id === currentUser.id ||
                              !hasDraftChanges(user) ||
                              !draftForUser(user).roleId ||
                              update.isPending
                            }
                            onClick={() => saveUserChanges(user)}
                          >
                            {update.isPending ? (
                              <LoaderCircle className="h-4 w-4 animate-spin" />
                            ) : (
                              <Save className="h-4 w-4" />
                            )}
                            Save
                          </Button>
                        ) : null}
                        {canUpdateUser ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={user.id === currentUser.id}
                            onClick={() =>
                              update.mutate({
                                id: user.id,
                                input: {
                                  status: user.status === "ACTIVE" ? "DISABLED" : "ACTIVE"
                                }
                              })
                            }
                          >
                            {user.status === "ACTIVE" ? "Disable" : "Enable"}
                          </Button>
                        ) : null}
                        {canDeleteUser ? (
                          <Button
                            size="icon"
                            variant="ghost"
                            disabled={user.id === currentUser.id || remove.isPending}
                            onClick={() => {
                              if (
                                window.confirm(
                                  `Permanently delete ${user.email}? An archive snapshot will be retained separately.`
                                )
                              ) {
                                remove.mutate(user.id);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        ) : null}
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create user</DialogTitle>
            <DialogDescription>
              The temporary password must be changed by the user.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={submit}>
            <div className="grid grid-cols-2 gap-3">
              <Input name="firstName" placeholder="First name" required />
              <Input name="lastName" placeholder="Last name" required />
            </div>
            <Input name="email" type="email" placeholder="Email" required />
            <Input name="username" placeholder="Username (optional)" />
            <Input
              name="password"
              type="password"
              placeholder="Temporary password"
              minLength={12}
              maxLength={128}
              pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).{12,128}"
              title="Use 12-128 characters with lowercase, uppercase, number, and special character."
              required
            />
            <Select
              name="departmentId"
              value={createDepartmentId}
              onChange={(event) => {
                setCreateDepartmentId(event.target.value);
                setCreateRoleId("");
                setCreateManagerUserId("");
              }}
              required
            >
              <option value="" disabled>
                Select department
              </option>
              {departments.data?.data.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </Select>
            <Select
              key={createDepartmentId}
              name="roleId"
              value={createRoleId}
              disabled={!createDepartmentId}
              onChange={(event) => {
                setCreateRoleId(event.target.value);
                setCreateManagerUserId("");
              }}
              required
            >
              <option value="" disabled>
                Select role
              </option>
              {createRoleOptions.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </Select>
            {canAssignCreateManager ? (
              <Select
                value={createManagerUserId}
                onChange={(event) => setCreateManagerUserId(event.target.value)}
              >
                <option value="">Select active reporting manager</option>
                {managers.data?.data.map((manager) => (
                  <option key={manager.id} value={manager.id}>
                    {manager.firstName} {manager.lastName} ({manager.email})
                  </option>
                ))}
              </Select>
            ) : null}
            <Button className="w-full" disabled={create.isPending}>
              {create.isPending ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : null}
              Create user
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function isManagerialRole(role: { roleType: string; code: string; name: string }) {
  return (
    role.roleType === "MANAGER" ||
    role.code.toLowerCase().includes("manager") ||
    role.name.toLowerCase().includes("manager")
  );
}
