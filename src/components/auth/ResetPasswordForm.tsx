"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormFieldError, FormSubmitError } from "@/components/ui/form-feedback";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useBusyCursor } from "@/hooks/useBusyCursor";
import { resetPasswordAction } from "@/lib/actions/auth";

type ResetPasswordLabels = {
  title: string;
  subtitle: string;
  passwordLabel: string;
  confirmLabel: string;
  submit: string;
  successTitle: string;
  successDescription: string;
  errorTitle: string;
  errorDescription: string;
  tokenErrorTitle: string;
  tokenErrorDescription: string;
};

export function ResetPasswordForm({ labels }: { labels: ResetPasswordLabels }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<"idle" | "success" | "token-missing">(
    "idle",
  );
  const [fieldErrors, setFieldErrors] = useState<{
    password?: string;
    confirm?: string;
  }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const tokens = useMemo(() => {
    if (typeof window === "undefined") return null;
    const hash = window.location.hash.startsWith("#")
      ? window.location.hash.slice(1)
      : window.location.hash;
    const params = new URLSearchParams(hash);
    const accessToken = params.get("access_token");
    const type = params.get("type");
    return { accessToken, type };
  }, []);

  useBusyCursor(loading);

  useEffect(() => {
    if (!tokens?.accessToken || tokens.type !== "recovery") {
      setStatus("token-missing");
    } else {
      setStatus("idle");
    }
  }, [tokens]);

  useEffect(() => {
    if (!formError) return;
    toast.error(formError);
  }, [formError]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!tokens?.accessToken || tokens.type !== "recovery") {
      setStatus("token-missing");
      return;
    }

    const nextErrors: { password?: string; confirm?: string } = {};
    if (!password.trim()) nextErrors.password = labels.errorDescription;
    if (!confirm.trim()) nextErrors.confirm = labels.errorDescription;
    if (password.trim() && confirm.trim() && password !== confirm) {
      nextErrors.confirm = labels.errorDescription;
    }

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      setFormError(null);
      return;
    }

    setFieldErrors({});
    setFormError(null);
    setLoading(true);
    try {
      const result = await resetPasswordAction({
        accessToken: tokens.accessToken,
        password,
      });
      if (!result.ok) {
        setFormError(labels.errorDescription);
        setStatus("idle");
        return;
      }
      setStatus("success");
    } catch {
      setFormError(labels.errorDescription);
      setStatus("idle");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-lg font-semibold leading-tight">{labels.title}</h1>
        <p className="text-sm text-muted-foreground">{labels.subtitle}</p>
      </div>

      {status === "success" && (
        <Alert>
          <AlertTitle>{labels.successTitle}</AlertTitle>
          <AlertDescription>{labels.successDescription}</AlertDescription>
        </Alert>
      )}

      {status === "token-missing" && (
        <Alert variant="destructive">
          <AlertTitle>{labels.tokenErrorTitle}</AlertTitle>
          <AlertDescription>{labels.tokenErrorDescription}</AlertDescription>
        </Alert>
      )}

      <form className="grid gap-3" onSubmit={onSubmit} noValidate>
        <div className="grid gap-2">
          <Label htmlFor="password">{labels.passwordLabel}</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (!fieldErrors.password) return;
              setFieldErrors((prev) => ({ ...prev, password: undefined }));
            }}
            aria-invalid={fieldErrors.password ? true : undefined}
          />
          <FormFieldError error={fieldErrors.password} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="confirm">{labels.confirmLabel}</Label>
          <Input
            id="confirm"
            type="password"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(e) => {
              setConfirm(e.target.value);
              if (!fieldErrors.confirm) return;
              setFieldErrors((prev) => ({ ...prev, confirm: undefined }));
            }}
            aria-invalid={fieldErrors.confirm ? true : undefined}
          />
          <FormFieldError error={fieldErrors.confirm} />
        </div>
        <FormSubmitError error={formError} title={labels.errorTitle} />
        <Button
          type="submit"
          className="w-full"
          loading={loading}
          loadingText={`${labels.submit}...`}
        >
          {labels.submit}
        </Button>
      </form>
    </div>
  );
}
