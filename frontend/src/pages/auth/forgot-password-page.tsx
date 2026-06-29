import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, LoaderCircle } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import { z } from "zod";
import { FormField } from "@/components/forms/form-field";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { authApi } from "@/features/auth/auth.api";
import { forgotPasswordSchema } from "@/features/auth/auth.schemas";
import { ApiError } from "@/lib/api-client";

type FormValues = z.infer<typeof forgotPasswordSchema>;

export function ForgotPasswordPage() {
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const form = useForm<FormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      tenant: localStorage.getItem("hrms_last_tenant") ?? "",
      email: ""
    }
  });

  async function submit(values: FormValues) {
    setError(undefined);
    try {
      const response = await authApi.forgotPassword(values);
      setMessage(response.data.message);
    } catch (reason) {
      setError(
        reason instanceof ApiError
          ? reason.message
          : "Unable to submit the request."
      );
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reset password</CardTitle>
        <CardDescription>
          We will send reset instructions if the account exists.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-5" onSubmit={form.handleSubmit(submit)}>
          {message ? <Alert variant="success">{message}</Alert> : null}
          {error ? <Alert variant="destructive">{error}</Alert> : null}
          <FormField
            id="tenant"
            label="Organization"
            error={form.formState.errors.tenant?.message}
          >
            <Input id="tenant" {...form.register("tenant")} />
          </FormField>
          <FormField
            id="email"
            label="Work email"
            error={form.formState.errors.email?.message}
          >
            <Input id="email" type="email" {...form.register("email")} />
          </FormField>
          <Button
            className="w-full"
            disabled={form.formState.isSubmitting || Boolean(message)}
          >
            {form.formState.isSubmitting ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : null}
            Send reset instructions
          </Button>
          <Button asChild variant="link" className="w-full">
            <Link to="/login">
              <ArrowLeft className="h-4 w-4" />
              Back to sign in
            </Link>
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
