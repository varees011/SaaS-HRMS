import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, LoaderCircle, Plus } from "lucide-react";
import { useState, type FormEvent } from "react";
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
import { hasPermission } from "@/features/auth/permissions";
import { ApiError } from "@/shared/api/http";

export function TenantsPage() {
  const user = useAuthStore((state) => state.user);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string>();
  const canCreateTenant = hasPermission(user, "platform.tenants.create");
  const queryClient = useQueryClient();
  const tenants = useQuery({
    queryKey: ["admin", "tenants"],
    queryFn: () => adminApi.listTenants()
  });
  const create = useMutation({
    mutationFn: adminApi.createTenant,
    onSuccess: async () => {
      setOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["admin", "tenants"] });
    },
    onError: (reason) =>
      setError(reason instanceof ApiError ? reason.message : "Unable to create tenant.")
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    const form = new FormData(event.currentTarget);
    create.mutate({
      code: String(form.get("code")),
      name: String(form.get("name")),
      defaultTimezone: String(form.get("defaultTimezone") || "UTC"),
      defaultLocale: String(form.get("defaultLocale") || "en")
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">Tenant organizations</h1>
          <p className="text-muted-foreground">
            Manage all customer tenants on the platform.
          </p>
        </div>
        {canCreateTenant ? (
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" />
            Add tenant
          </Button>
        ) : null}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Tenants</CardTitle>
          <CardDescription>
            Each tenant is an isolated customer organization.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {tenants.isLoading ? (
            <LoaderCircle className="h-5 w-5 animate-spin" />
          ) : tenants.isError ? (
            <Alert variant="destructive">Unable to load tenants.</Alert>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tenant</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Organizations</TableHead>
                  <TableHead>Users</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tenants.data?.data.map((tenant) => (
                  <TableRow key={tenant.id}>
                    <TableCell>
                      <div className="flex items-center gap-2 font-medium">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        {tenant.name}
                      </div>
                    </TableCell>
                    <TableCell>{tenant.code}</TableCell>
                    <TableCell>
                      <Badge
                        variant={tenant.status === "ACTIVE" ? "success" : "secondary"}
                      >
                        {tenant.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{tenant._count.organizations}</TableCell>
                    <TableCell>{tenant._count.users}</TableCell>
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
            <DialogTitle>Create tenant</DialogTitle>
            <DialogDescription>
              Creates an isolated customer and its standard HR roles.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={submit}>
            {error ? <Alert variant="destructive">{error}</Alert> : null}
            <Input name="name" placeholder="Organization name" required />
            <Input name="code" placeholder="tenant-code" required />
            <div className="grid grid-cols-2 gap-3">
              <Input name="defaultTimezone" defaultValue="UTC" required />
              <Input name="defaultLocale" defaultValue="en" required />
            </div>
            <Button className="w-full" disabled={create.isPending}>
              {create.isPending ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : null}
              Create tenant
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
