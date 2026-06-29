import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { useAuthStore } from "@/features/auth/auth.store";
import { formatDateTime } from "@/lib/utils";

export function ProfilePage() {
  const user = useAuthStore((state) => state.user)!;
  const activeAssignment = user.roleAssignments[0];
  const department =
    activeAssignment?.role.department?.name ??
    activeAssignment?.organization?.name ??
    "No department assigned";
  const rows = [
    ["Name", `${user.firstName} ${user.lastName}`],
    ["Email", user.email],
    ["Username", user.username ?? "Not set"],
    ["Department", department],
    ["Role", user.roleName ?? (user.roleNames.length ? user.roleNames.join(", ") : "No active role")],
    ["Tenant ID", user.tenantId],
    [
      "Last login",
      user.lastLoginAt ? formatDateTime(user.lastLoginAt) : "No recorded login"
    ]
  ];
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Profile</h1>
        <p className="text-muted-foreground">Your authentication identity.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Account details</CardTitle>
          <CardDescription>
            Profile editing belongs to the Employee module.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="divide-y">
            {rows.map(([label, value]) => (
              <div
                key={label}
                className="grid gap-1 py-4 sm:grid-cols-[180px_1fr]"
              >
                <dt className="text-sm font-medium text-muted-foreground">
                  {label}
                </dt>
                <dd className="break-all text-sm">{value}</dd>
              </div>
            ))}
            <div className="grid gap-1 py-4 sm:grid-cols-[180px_1fr]">
              <dt className="text-sm font-medium text-muted-foreground">
                Status
              </dt>
              <dd>
                <Badge variant="success">{user.status}</Badge>
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
