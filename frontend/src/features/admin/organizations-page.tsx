import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LoaderCircle, Plus, Trash2 } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Alert } from "@/shared/ui/alert";
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
import { useAuthStore } from "@/features/auth/auth.store";
import { hasAnyPermission } from "@/features/auth/permissions";
import { ApiError } from "@/shared/api/http";

export function OrganizationsPage() {
  const user = useAuthStore((state) => state.user);
  const [tenantId, setTenantId] = useState("");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string>();
  const canCreateOrganization = hasAnyPermission(user, [
    "platform.organizations.create",
    "tenant.organizations.manage"
  ]);
  const canDeleteOrganization = hasAnyPermission(user, [
    "platform.organizations.delete",
    "tenant.organizations.manage"
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
  const organizations = useQuery({
    queryKey: ["admin", "organizations", tenantId],
    queryFn: () => adminApi.listOrganizations({ tenantId }),
    enabled: Boolean(tenantId)
  });
  const create = useMutation({
    mutationFn: adminApi.createOrganization,
    onSuccess: async () => {
      setOpen(false);
      await queryClient.invalidateQueries({
        queryKey: ["admin", "organizations", tenantId]
      });
      await queryClient.invalidateQueries({ queryKey: ["admin", "tenants"] });
    },
    onError: showError
  });
  const remove = useMutation({
    mutationFn: (id: string) => adminApi.deleteOrganization(id, tenantId),
    onMutate: () => setError(undefined),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["admin", "organizations", tenantId]
      }),
    onError: showError
  });

  function showError(reason: unknown) {
    setError(
      reason instanceof ApiError
        ? reason.message
        : "The organization request could not be completed."
    );
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    create.mutate({
      tenantId,
      code: String(form.get("code")),
      name: String(form.get("name")),
      organizationType: String(form.get("organizationType")),
      parentId: String(form.get("parentId") || "") || null,
      timezone: String(form.get("timezone") || "UTC"),
      countryCode: String(form.get("countryCode") || "") || null
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">Organization structure</h1>
          <p className="text-muted-foreground">
            Manage legal entities, divisions, departments, branches, and teams.
          </p>
        </div>
        {canCreateOrganization ? (
          <Button onClick={() => setOpen(true)} disabled={!tenantId}>
            <Plus className="h-4 w-4" />
            Add organization
          </Button>
        ) : null}
      </div>
      {error ? <Alert variant="destructive">{error}</Alert> : null}
      <Card>
        <CardHeader>
          <CardTitle>Organization units</CardTitle>
          <CardDescription>Select a tenant to manage its hierarchy.</CardDescription>
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
          {organizations.isLoading ? (
            <LoaderCircle className="h-5 w-5 animate-spin" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Parent</TableHead>
                  <TableHead>Children</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {organizations.data?.data.map((organization) => (
                  <TableRow key={organization.id}>
                    <TableCell className="font-medium">{organization.name}</TableCell>
                    <TableCell>{organization.code}</TableCell>
                    <TableCell>{organization.organizationType}</TableCell>
                    <TableCell>{organization.parent?.name ?? "Root"}</TableCell>
                    <TableCell>{organization._count.children}</TableCell>
                    <TableCell className="text-right">
                      {canDeleteOrganization ? (
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={`Delete ${organization.name}`}
                          disabled={remove.isPending}
                          onClick={() => {
                            if (window.confirm(`Delete ${organization.name}?`)) {
                              remove.mutate(organization.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      ) : null}
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
            <DialogTitle>Add organization unit</DialogTitle>
            <DialogDescription>
              The unit is created within the selected tenant.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={submit}>
            <Input name="name" placeholder="Organization name" required />
            <Input name="code" placeholder="Code" required />
            <Select name="organizationType" required defaultValue="department">
              <option value="legal_entity">Legal entity</option>
              <option value="company">Company</option>
              <option value="division">Division</option>
              <option value="department">Department</option>
              <option value="branch">Branch</option>
              <option value="team">Team</option>
            </Select>
            <Select name="parentId" defaultValue="">
              <option value="">Root organization</option>
              {organizations.data?.data.map((organization) => (
                <option key={organization.id} value={organization.id}>
                  {organization.name}
                </option>
              ))}
            </Select>
            <div className="grid grid-cols-2 gap-3">
              <Input name="timezone" defaultValue="UTC" required />
              <Input name="countryCode" placeholder="US" maxLength={2} />
            </div>
            <Button className="w-full" disabled={create.isPending}>
              Create organization
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
