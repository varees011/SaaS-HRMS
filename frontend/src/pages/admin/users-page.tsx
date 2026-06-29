import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LoaderCircle, Plus, Trash2, UserCog } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { adminApi } from "@/features/admin/admin.api";
import { strongPassword } from "@/features/auth/auth.schemas";
import { useAuthStore } from "@/features/auth/auth.store";
import { hasAnyPermission } from "@/features/auth/permissions";
import { ApiError } from "@/lib/api-client";

export function UsersPage() {
  const currentUser = useAuthStore((state) => state.user)!;
  const [tenantId, setTenantId] = useState("");
  const [createDepartmentId, setCreateDepartmentId] = useState("");
  const [rowDepartmentIds, setRowDepartmentIds] = useState<Record<string, string>>({});
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
    queryFn: () => adminApi.listTenants()
  });
  useEffect(() => {
    if (!tenantId && tenants.data?.data[0]) {
      const customerTenant =
        tenants.data.data.find((tenant) => tenant.code !== "platform") ??
        tenants.data.data[0];
      setTenantId(customerTenant.id);
    }
  }, [tenantId, tenants.data]);
  const users = useQuery({
    queryKey: ["admin", "users", tenantId],
    queryFn: () => adminApi.listUsers({ tenantId }),
    enabled: Boolean(tenantId)
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
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["admin", "users", tenantId] }),
    onError: showError
  });
  const remove = useMutation({
    mutationFn: (id: string) => adminApi.deleteUser(id, tenantId),
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
      organizationId: String(form.get("departmentId"))
    });
  }

  const createRoleOptions =
    roles.data?.data.filter((role) => role.departmentId === createDepartmentId) ?? [];

  function departmentForUser(user: {
    id: string;
    roleAssignments: Array<{
      organizationId: string | null;
      organization: { id: string; name: string } | null;
      role: { departmentId: string | null; department: { id: string; name: string } | null };
    }>;
  }) {
    const assignment = user.roleAssignments[0];
    return (
      rowDepartmentIds[user.id] ??
      assignment?.role.departmentId ??
      ""
    );
  }

  function roleOptionsForDepartment(departmentId: string) {
    return roles.data?.data.filter((role) => role.departmentId === departmentId) ?? [];
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
          <CardDescription>Select a tenant to manage its accounts.</CardDescription>
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
          {users.isLoading ? (
            <LoaderCircle className="h-5 w-5 animate-spin" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Role</TableHead>
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
                        value={departmentForUser(user)}
                        disabled={!canUpdateUser || user.id === currentUser.id}
                        onChange={(event) =>
                          setRowDepartmentIds((value) => ({
                            ...value,
                            [user.id]: event.target.value
                          }))
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
                        value={user.roleAssignments[0]?.role.id ?? ""}
                        disabled={
                          !canUpdateUser ||
                          user.id === currentUser.id ||
                          !departmentForUser(user) ||
                          update.isPending
                        }
                        onChange={(event) =>
                          update.mutate({
                            id: user.id,
                            input: {
                              departmentId: departmentForUser(user),
                              roleId: event.target.value
                            }
                          })
                        }
                      >
                        <option value="" disabled>
                          Select role
                        </option>
                        {roleOptionsForDepartment(departmentForUser(user)).map((role) => (
                          <option key={role.id} value={role.id}>
                            {role.name}
                          </option>
                        ))}
                      </Select>
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
                              if (window.confirm(`Delete ${user.email}?`)) {
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
              onChange={(event) => setCreateDepartmentId(event.target.value)}
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
              defaultValue=""
              disabled={!createDepartmentId}
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
