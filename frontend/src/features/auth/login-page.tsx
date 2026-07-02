import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { LoaderCircle, ShieldCheck } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
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
import type { AuthTokens, LoginOtpRequired } from "@/features/auth/auth.types";

type FormValues = z.infer<typeof loginSchema>;
type PendingOtp = LoginOtpRequired & { mode: FormValues["mode"]; tenant: string };

export function LoginPage() {
  const [serverError, setServerError] = useState<string>();
  const [showMfa, setShowMfa] = useState(false);
  // Tracks the email OTP challenge returned after password validation succeeds.
  const [otpCode, setOtpCode] = useState("");
  const [resendSeconds, setResendSeconds] = useState(0);
  const [pendingOtp, setPendingOtp] = useState<PendingOtp | null>(null);
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
  const tenantOptions = tenants.data ?? [];

  useEffect(() => {
    if (!pendingOtp) return;
    setResendSeconds(pendingOtp.resendAfterSeconds);
  }, [pendingOtp]);

  useEffect(() => {
    if (!pendingOtp || resendSeconds <= 0) return;
    const timer = window.setInterval(() => {
      setResendSeconds((value) => Math.max(0, value - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [pendingOtp, resendSeconds]);

  useEffect(() => {
    if (mode !== "organization" || !tenantOptions.length) return;
    const currentTenant = form.getValues("tenant");
    const remembered = tenantOptions.find((tenant) => tenant.code === currentTenant);
    if (remembered) return;
    const preferred = preferredTenantCode();
    if (preferred) {
      form.setValue("tenant", preferred, { shouldDirty: false, shouldValidate: false });
      form.clearErrors("tenant");
    }
  }, [form, lastTenant, mode, tenantOptions]);

  async function submit(values: FormValues) {
    setServerError(undefined);
    try {
      const { mode: loginMode, tenant, mfaCode, ...credentials } = values;
      const resolvedTenant =
        loginMode === "organization" ? tenant.trim() || preferredTenantCode() : "";
      if (loginMode === "organization" && !resolvedTenant) {
        form.setError("tenant", {
          type: "manual",
          message: tenantLoadMessage(tenants.isLoading, tenants.isError)
        });
        return;
      }
      if (loginMode === "organization" && tenant.trim() !== resolvedTenant) {
        form.setValue("tenant", resolvedTenant, {
          shouldDirty: false,
          shouldValidate: false
        });
      }
      const tokens = await authApi.login({
        ...credentials,
        ...(loginMode === "organization" ? { tenant: resolvedTenant } : {}),
        ...(mfaCode ? { mfaCode } : {})
      });
      if (tokens.otpRequired) {
        setPendingOtp({ ...tokens, mode: loginMode, tenant: resolvedTenant });
        setOtpCode("");
        return;
      }
      await finishSignIn(tokens, loginMode, resolvedTenant);
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

  async function verifyOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pendingOtp) return;
    setServerError(undefined);
    if (!/^\d{6}$/.test(otpCode)) {
      setServerError("Enter a 6-digit verification code.");
      return;
    }
    try {
      const tokens = await authApi.verifyEmailOtp({
        challengeId: pendingOtp.challengeId,
        code: otpCode
      });
      await finishSignIn(tokens, pendingOtp.mode, pendingOtp.tenant);
    } catch (error) {
      clear();
      setServerError(
        error instanceof ApiError
          ? error.message
          : "Unable to verify the code. Check your connection and try again."
      );
    }
  }

  // Resends only through the server-side challenge so resend limits remain enforced centrally.
  async function resendOtp() {
    if (!pendingOtp || resendSeconds > 0) return;
    setServerError(undefined);
    try {
      const response = await authApi.resendEmailOtp(pendingOtp.challengeId);
      setPendingOtp({
        ...pendingOtp,
        expiresIn: response.expiresIn,
        resendAfterSeconds: response.resendAfterSeconds
      });
      setOtpCode("");
    } catch (error) {
      setServerError(
        error instanceof ApiError
          ? error.message
          : "Unable to resend the code. Check your connection and try again."
      );
    }
  }

  // Completes the existing post-login behavior after email OTP verification returns tokens.
  async function finishSignIn(
    tokens: AuthTokens,
    loginMode: FormValues["mode"],
    tenant: string
  ) {
    setAccessToken(tokens.accessToken);
    const currentUser = await authApi.me();
    if (loginMode === "organization" && tenant) {
      localStorage.setItem("hrms_last_tenant", tenant);
    }
    setSession(tokens.accessToken, currentUser);
    const destination =
      (location.state as { from?: string } | null)?.from ?? "/app";
    navigate(destination, { replace: true });
  }

  // Cancels the OTP challenge locally and restores the original login form.
  function backToLogin() {
    setPendingOtp(null);
    setOtpCode("");
    setServerError(undefined);
  }

  function switchLoginMode(nextMode: FormValues["mode"]) {
    form.setValue("mode", nextMode, { shouldValidate: true });
    if (nextMode === "platform") {
      form.setValue("tenant", "", { shouldValidate: true });
      return;
    }
    form.setValue("tenant", preferredTenantCode() || lastTenant, {
      shouldDirty: false,
      shouldValidate: false
    });
    form.clearErrors("tenant");
  }

  function preferredTenantCode(): string {
    return (
      tenantOptions.find((tenant) => tenant.code === lastTenant)?.code ??
      tenantOptions[0]?.code ??
      ""
    );
  }

  return (
    <Card className="border-primary/10 shadow-[0_28px_70px_rgba(14,22,63,0.14)]">
      <CardHeader>
        <span className="callout-label w-fit">Use case study</span>
        <CardTitle className="pt-3 text-3xl">Sign in to VentureSoft HRMS</CardTitle>
        <CardDescription>
          {mode === "platform"
            ? "Enter your platform account."
            : "Continue inside an organization workspace."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {pendingOtp ? (
          // Shows only the email OTP controls after credentials are accepted.
          <form className="space-y-5" onSubmit={verifyOtp}>
            {serverError ? <Alert variant="destructive">{serverError}</Alert> : null}
            <FormField
              id="emailOtp"
              label="Verification code"
              hint={`Enter the 6-digit code sent to ${pendingOtp.email}.`}
            >
              <Input
                id="emailOtp"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={otpCode}
                onChange={(event) =>
                  setOtpCode(event.target.value.replace(/\D/g, "").slice(0, 6))
                }
              />
            </FormField>
            <Button className="w-full" type="submit">
              Verify
            </Button>
            <Button
              className="w-full"
              type="button"
              variant="outline"
              disabled={resendSeconds > 0}
              onClick={resendOtp}
            >
              {resendSeconds > 0
                ? `Resend OTP in ${resendSeconds}s`
                : "Resend OTP"}
            </Button>
            <Button
              type="button"
              variant="link"
              className="h-auto w-full p-0 text-sm"
              onClick={backToLogin}
            >
              Back to Login
            </Button>
          </form>
        ) : (
        <form className="space-y-5" onSubmit={form.handleSubmit(submit)}>
          {serverError ? <Alert variant="destructive">{serverError}</Alert> : null}
          {mode === "organization" && tenants.isError ? (
            <Alert variant="destructive">
              Unable to load organizations. Check that the API server is running.
            </Alert>
          ) : null}
          <input type="hidden" {...form.register("mode")} />
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
              >
                <option value="">
                  {tenants.isLoading
                    ? "Loading organizations"
                    : tenants.isError
                      ? "Unable to load organizations"
                      : "Select organization"}
                </option>
                {tenantOptions.map((tenant) => (
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
            disabled={form.formState.isSubmitting || (mode === "organization" && tenants.isLoading)}
          >
            {form.formState.isSubmitting ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : null}
            Sign in
          </Button>
          <div className="flex items-center justify-between text-sm">
            <Link className="text-primary hover:underline" to="/forgot-password">
              Forgot password?
            </Link>
            <Button
              type="button"
              variant="link"
              className="h-auto p-0 text-sm"
              onClick={() =>
                switchLoginMode(mode === "platform" ? "organization" : "platform")
              }
            >
              {mode === "platform" ? "Organization login" : "Platform login"}
            </Button>
          </div>
        </form>
        )}
      </CardContent>
    </Card>
  );
}

function tenantLoadMessage(isLoading: boolean, isError: boolean): string {
  if (isLoading) return "Organizations are still loading.";
  if (isError) return "Unable to load organizations. Check that the API server is running.";
  return "No active organization is available.";
}
