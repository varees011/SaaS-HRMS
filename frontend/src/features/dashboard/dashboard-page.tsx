import { CheckCircle2, KeyRound, ShieldCheck, UserRound } from "lucide-react";
import { Badge } from "@/shared/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/shared/ui/card";
import { useAuthStore } from "@/features/auth/auth.store";

export function DashboardPage() {
  const user = useAuthStore((state) => state.user)!;
  const cards = [
    {
      label: "Account",
      value: user.status,
      icon: UserRound
    },
    {
      label: "MFA",
      value: user.mfaEnabled ? "Enabled" : "Not enabled",
      icon: ShieldCheck
    },
    {
      label: "Roles",
      value: String(user.roles.length),
      icon: KeyRound
    }
  ];
  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm text-muted-foreground">Authentication module</p>
        <h1 className="text-3xl font-semibold">
          Welcome, {user.firstName}
        </h1>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {cards.map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardContent className="flex items-center gap-4 p-5">
              <span className="grid h-11 w-11 place-items-center rounded-lg bg-accent text-accent-foreground">
                <Icon className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className="font-semibold">{value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Access context</CardTitle>
          <CardDescription>
            Active roles resolved by the API for this tenant.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {user.roles.length ? (
            user.roles.map((role) => (
              <Badge key={role} variant="secondary">
                <CheckCircle2 className="mr-1 h-3 w-3" />
                {role}
              </Badge>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No active roles.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
