import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Copy, LoaderCircle, ShieldCheck, ShieldOff } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { FormField } from "@/shared/forms/form-field";
import { PasswordInput } from "@/shared/forms/password-input";
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
import { authApi } from "@/features/auth/auth.api";
import {
  changePasswordSchema,
  disableMfaSchema,
  otpSchema
} from "@/features/auth/auth.schema";
import { useAuthStore } from "@/features/auth/auth.store";
import type { MfaSetup } from "@/features/auth/auth.types";
import { ApiError } from "@/shared/api/http";

type PasswordValues = z.infer<typeof changePasswordSchema>;
type OtpValues = z.infer<typeof otpSchema>;
type DisableMfaValues = z.infer<typeof disableMfaSchema>;

export function SecurityPage() {
  const user = useAuthStore((state) => state.user)!;
  const setUser = useAuthStore((state) => state.setUser);
  const [mfaSetup, setMfaSetup] = useState<MfaSetup>();
  const [notice, setNotice] = useState<string>();
  const [error, setError] = useState<string>();

  const passwordForm = useForm<PasswordValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: ""
    }
  });
  const otpForm = useForm<OtpValues>({
    resolver: zodResolver(otpSchema),
    defaultValues: { code: "" }
  });
  const disableForm = useForm<DisableMfaValues>({
    resolver: zodResolver(disableMfaSchema),
    defaultValues: { password: "", code: "" }
  });

  const setupMutation = useMutation({
    mutationFn: authApi.setupMfa,
    onSuccess: (setup) => {
      setMfaSetup(setup);
      setError(undefined);
    },
    onError: handleError
  });

  async function updateCurrentUser() {
    setUser(await authApi.me());
  }

  async function changePassword(values: PasswordValues) {
    setError(undefined);
    setNotice(undefined);
    try {
      await authApi.changePassword(values);
      passwordForm.reset();
      setNotice("Password changed. Other active sessions were revoked.");
    } catch (reason) {
      handleError(reason);
    }
  }

  async function confirmMfa(values: OtpValues) {
    setError(undefined);
    try {
      await authApi.confirmMfa(values.code);
      await updateCurrentUser();
      otpForm.reset();
      setMfaSetup(undefined);
      setNotice("Multi-factor authentication is enabled.");
    } catch (reason) {
      handleError(reason);
    }
  }

  async function disableMfa(values: DisableMfaValues) {
    setError(undefined);
    try {
      await authApi.disableMfa(values);
      await updateCurrentUser();
      disableForm.reset();
      setNotice("Multi-factor authentication is disabled.");
    } catch (reason) {
      handleError(reason);
    }
  }

  function handleError(reason: unknown) {
    setError(
      reason instanceof ApiError ? reason.message : "The request could not be completed."
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Security</h1>
        <p className="text-muted-foreground">
          Manage your password and multi-factor authentication.
        </p>
      </div>
      {notice ? <Alert variant="success">{notice}</Alert> : null}
      {error ? <Alert variant="destructive">{error}</Alert> : null}

      <Card>
        <CardHeader>
          <CardTitle>Change password</CardTitle>
          <CardDescription>
            Changing your password revokes every other active session.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="max-w-lg space-y-5"
            onSubmit={passwordForm.handleSubmit(changePassword)}
          >
            <FormField
              id="currentPassword"
              label="Current password"
              error={passwordForm.formState.errors.currentPassword?.message}
            >
              <PasswordInput
                id="currentPassword"
                autoComplete="current-password"
                {...passwordForm.register("currentPassword")}
              />
            </FormField>
            <FormField
              id="newPassword"
              label="New password"
              error={passwordForm.formState.errors.newPassword?.message}
            >
              <PasswordInput
                id="newPassword"
                autoComplete="new-password"
                {...passwordForm.register("newPassword")}
              />
            </FormField>
            <FormField
              id="confirmPassword"
              label="Confirm new password"
              error={passwordForm.formState.errors.confirmPassword?.message}
            >
              <PasswordInput
                id="confirmPassword"
                autoComplete="new-password"
                {...passwordForm.register("confirmPassword")}
              />
            </FormField>
            <Button disabled={passwordForm.formState.isSubmitting}>
              {passwordForm.formState.isSubmitting ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : null}
              Change password
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {user.mfaEnabled ? (
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
            ) : (
              <ShieldOff className="h-5 w-5 text-amber-600" />
            )}
            Multi-factor authentication
          </CardTitle>
          <CardDescription>
            {user.mfaEnabled
              ? "Your account requires an authenticator code at sign-in."
              : "Protect your account with a time-based authenticator code."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!user.mfaEnabled && !mfaSetup ? (
            <Button
              onClick={() => setupMutation.mutate()}
              disabled={setupMutation.isPending}
            >
              {setupMutation.isPending ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : null}
              Set up authenticator
            </Button>
          ) : null}

          {!user.mfaEnabled && mfaSetup ? (
            <div className="max-w-xl space-y-5">
              <Alert>
                Add this account to your authenticator app, then enter the
                generated code to confirm setup.
              </Alert>
              <div className="rounded-md border bg-muted/40 p-4">
                <p className="mb-1 text-xs font-medium uppercase text-muted-foreground">
                  Manual setup key
                </p>
                <div className="flex items-center gap-2">
                  <code className="min-w-0 flex-1 break-all text-sm">
                    {mfaSetup.secret}
                  </code>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => void navigator.clipboard.writeText(mfaSetup.secret)}
                    aria-label="Copy setup key"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <form
                className="space-y-4"
                onSubmit={otpForm.handleSubmit(confirmMfa)}
              >
                <FormField
                  id="code"
                  label="Verification code"
                  error={otpForm.formState.errors.code?.message}
                >
                  <Input
                    id="code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    {...otpForm.register("code")}
                  />
                </FormField>
                <div className="flex gap-2">
                  <Button disabled={otpForm.formState.isSubmitting}>
                    Confirm and enable
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setMfaSetup(undefined)}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </div>
          ) : null}

          {user.mfaEnabled ? (
            <form
              className="max-w-lg space-y-5"
              onSubmit={disableForm.handleSubmit(disableMfa)}
            >
              <Alert>
                Disabling MFA requires your password and a current authenticator
                code.
              </Alert>
              <FormField
                id="disablePassword"
                label="Password"
                error={disableForm.formState.errors.password?.message}
              >
                <PasswordInput
                  id="disablePassword"
                  autoComplete="current-password"
                  {...disableForm.register("password")}
                />
              </FormField>
              <FormField
                id="disableCode"
                label="Verification code"
                error={disableForm.formState.errors.code?.message}
              >
                <Input
                  id="disableCode"
                  inputMode="numeric"
                  maxLength={6}
                  {...disableForm.register("code")}
                />
              </FormField>
              <Button
                variant="destructive"
                disabled={disableForm.formState.isSubmitting}
              >
                Disable MFA
              </Button>
            </form>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
