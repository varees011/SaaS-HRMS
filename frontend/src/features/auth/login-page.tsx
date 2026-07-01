import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle, ShieldCheck } from "lucide-react";
import { useState } from "react";
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
    <Card className="border-primary/10 shadow-[0_28px_70px_rgba(18,32,23,0.12)]">
      <CardHeader>
        <p className="utility-label">Access checkpoint</p>
        <CardTitle className="text-3xl">Sign in to the ledger</CardTitle>
        <CardDescription>
          Choose platform access or enter through your organization workspace.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-5" onSubmit={form.handleSubmit(submit)}>
          {serverError ? <Alert variant="destructive">{serverError}</Alert> : null}
          <input type="hidden" {...form.register("mode")} />
          <div className="grid grid-cols-2 gap-2 rounded-md border border-primary/10 bg-secondary/40 p-1">
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
              <Input
                id="tenant"
                autoComplete="organization"
                placeholder="Organization name or code"
                {...form.register("tenant")}
              />
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
              Reset access
            </Link>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
