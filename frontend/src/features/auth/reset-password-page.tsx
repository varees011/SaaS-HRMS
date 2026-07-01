import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useSearchParams } from "react-router-dom";
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
import { authApi } from "@/features/auth/auth.api";
import { resetPasswordSchema } from "@/features/auth/auth.schema";
import { ApiError } from "@/shared/api/http";

type FormValues = z.infer<typeof resetPasswordSchema>;

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState<string>();
  const form = useForm<FormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { newPassword: "", confirmPassword: "" }
  });

  async function submit(values: FormValues) {
    if (!token) return;
    setError(undefined);
    try {
      await authApi.resetPassword({ token, ...values });
      setComplete(true);
    } catch (reason) {
      setError(
        reason instanceof ApiError ? reason.message : "Unable to reset password."
      );
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Choose a new password</CardTitle>
        <CardDescription>
          Use at least 12 characters with upper/lowercase, a number, and a symbol.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!token ? (
          <Alert variant="destructive">
            This reset link is incomplete. Request a new password reset.
          </Alert>
        ) : complete ? (
          <div className="space-y-4">
            <Alert variant="success">Your password has been changed.</Alert>
            <Button asChild className="w-full">
              <Link to="/login">Return to sign in</Link>
            </Button>
          </div>
        ) : (
          <form className="space-y-5" onSubmit={form.handleSubmit(submit)}>
            {error ? <Alert variant="destructive">{error}</Alert> : null}
            <FormField
              id="newPassword"
              label="New password"
              error={form.formState.errors.newPassword?.message}
            >
              <PasswordInput
                id="newPassword"
                autoComplete="new-password"
                {...form.register("newPassword")}
              />
            </FormField>
            <FormField
              id="confirmPassword"
              label="Confirm password"
              error={form.formState.errors.confirmPassword?.message}
            >
              <PasswordInput
                id="confirmPassword"
                autoComplete="new-password"
                {...form.register("confirmPassword")}
              />
            </FormField>
            <Button
              className="w-full"
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : null}
              Reset password
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
