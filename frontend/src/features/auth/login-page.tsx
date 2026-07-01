import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { LoaderCircle, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { z } from "zod";
import { Alert } from "@/shared/ui/alert";
import { Button } from "@/shared/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Select } from "@/shared/ui/select";
import { FormField } from "@/shared/forms/form-field";
import { PasswordInput } from "@/shared/forms/password-input";
import { ApiError } from "@/shared/api/http";
import { authApi } from "@/features/auth/auth.api";
import { loginSchema } from "@/features/auth/auth.schema";
import { useAuthStore } from "@/features/auth/auth.store";

type FormValues = z.infer<typeof loginSchema>;

export function LoginPage() {
  const [serverError, setServerError] = useState<string>();
  const [showMfa, setShowMfa] = useState(false);
  const setSession = useAuthStore((state) => state.setSession);
  const setAccessToken = useAuthStore((state) => state.setAccessToken);
  const clear = useAuthStore((state) => state.clear);
  const navigate = useNavigate();
  const location = useLocation();
  const lastTenant = localStorage.getItem("hrms_last_tenant") ?? "";
  const tenants = useQuery({
    queryKey: ["auth", "tenants"],
    queryFn: () => authApi.tenants()
  });
  const form = useForm<FormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      mode: "organization",
      tenant: lastTenant,
      login: "",
      password: "",
      mfaCode: ""
    }
  });
  const mode = form.watch("mode");

  useEffect(() => {
    if (mode !== "organization" || !tenants.data?.length) return;
    const currentTenant = form.getValues("tenant");
    const remembered = tenants.data.find((tenant) => tenant.code === currentTenant);
    if (remembered) return;
    const preferred =
      tenants.data.find((tenant) => tenant.code === lastTenant) ?? tenants.data[0];
    if (preferred) form.setValue("tenant", preferred.code, { shouldValidate: true });
  }, [form, lastTenant, mode, tenants.data]);

  async function submit(values: FormValues) {
    setServerError(undefined);
    try {
      const { mode: loginMode, tenant, mfaCode, ...credentials } = values;
      const tokens = await authApi.login({
        ...credentials,
        ...(loginMode === "organization" ? { tenant: tenant.trim() } : {}),
        ...(mfaCode ? { mfaCode } : {})
      });
      setAccessToken(tokens.accessToken);
      const currentUser = await authApi.me();
      if (loginMode === "organization" && tenant.trim()) {
        localStorage.setItem("hrms_last_tenant", tenant.trim());
      }
      setSession(tokens.accessToken, currentUser);
      const destination =
        (location.state as { from?: string } | null)?.from ?? "/app";
      navigate(destination, { replace: true });
    } catch (error) {
      clear();
      if (error instanceof ApiError) {
        if (error.message.toLowerCase().includes("mfa")) setShowMfa(true);
        setServerError(error.message);
      } else {
        setServerError("Unable to sign in. Check your connection and try again.");
      }
    }
  }

  return (
    <Card className="border-primary/10 shadow-[0_28px_70px_rgba(14,22,63,0.14)]">
      <CardHeader>
        <span className="callout-label w-fit">Use case study</span>
        <CardTitle className="pt-3 text-3xl">Sign in to VentureSoft HRMS</CardTitle>
        <CardDescription>
          Enter your platform account or continue inside an organization workspace.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-5" onSubmit={form.handleSubmit(submit)}>
          {serverError ? <Alert variant="destructive">{serverError}</Alert> : null}
          <input type="hidden" {...form.register("mode")} />
          <div className="grid grid-cols-2 gap-2 rounded-md border border-primary/10 bg-slate-100 p-1">
            <Button
              type="button"
              variant={mode === "organization" ? "default" : "ghost"}
              className="h-9"
              aria-pressed={mode === "organization"}
              onClick={() => form.setValue("mode", "organization", { shouldValidate: true })}
            >
              Organization
            </Button>
            <Button
              type="button"
              variant={mode === "platform" ? "default" : "ghost"}
              className="h-9"
              aria-pressed={mode === "platform"}
              onClick={() => {
                form.setValue("mode", "platform", { shouldValidate: true });
                form.setValue("tenant", "", { shouldValidate: true });
              }}
            >
              Platform
            </Button>
          </div>
          {mode === "organization" ? (
            <FormField
              id="tenant"
              label="Organization"
              error={form.formState.errors.tenant?.message}
            >
              <Select
                id="tenant"
                autoComplete="organization"
                {...form.register("tenant")}
                disabled={tenants.isLoading || !tenants.data?.length}
              >
                <option value="">
                  {tenants.isLoading ? "Loading organizations" : "Select organization"}
                </option>
                {tenants.data?.map((tenant) => (
                  <option key={tenant.id} value={tenant.code}>
                    {tenant.name} ({tenant.code})
                  </option>
                ))}
              </Select>
            </FormField>
          ) : null}
          <FormField
            id="login"
            label={mode === "platform" ? "Email" : "Email or user ID"}
            error={form.formState.errors.login?.message}
          >
            <Input
              id="login"
              autoComplete={mode === "platform" ? "email" : "username"}
              placeholder={mode === "platform" ? "admin@platform.com" : "name@company.com or user ID"}
              {...form.register("login")}
            />
          </FormField>
          <FormField
            id="password"
            label="Password"
            error={form.formState.errors.password?.message}
          >
            <PasswordInput
              id="password"
              autoComplete="current-password"
              {...form.register("password")}
            />
          </FormField>
          {showMfa ? (
            <FormField
              id="mfaCode"
              label="Verification code"
              error={form.formState.errors.mfaCode?.message}
              hint="Enter the 6-digit code from your authenticator app."
            >
              <Input
                id="mfaCode"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                {...form.register("mfaCode")}
              />
            </FormField>
          ) : (
            <Button
              type="button"
              variant="link"
              className="h-auto p-0 text-sm"
              onClick={() => setShowMfa(true)}
            >
              <ShieldCheck className="h-4 w-4" />
              Use a verification code
            </Button>
          )}
          <Button
            className="w-full"
            type="submit"
            disabled={form.formState.isSubmitting}
          >
            {form.formState.isSubmitting ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : null}
            Sign in
          </Button>
          <div className="text-center text-sm">
            <Link className="text-primary hover:underline" to="/forgot-password">
              Forgot password?
            </Link>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
