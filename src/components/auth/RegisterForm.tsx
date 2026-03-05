"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { FormFieldError, FormSubmitError } from "@/components/ui/form-feedback";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useBusyCursor } from "@/hooks/useBusyCursor";

type Labels = {
  title: string;
  subtitle: string;
  email: string;
  password: string;
  name: string;
  company: string;
  submit: string;
  switch: string;
  switchHref: string;
  optional: string;
  errors: Record<string, string>;
};

type State = { errorKey?: string };

export function RegisterForm({
  action,
  labels,
}: {
  action: (prev: State, formData: FormData) => Promise<State>;
  labels: Labels;
}) {
  const [state, formAction, pending] = useActionState(action, { errorKey: undefined });
  const [fieldErrors, setFieldErrors] = useState<{
    email?: string;
    password?: string;
  }>({});
  const errorMessage = state.errorKey
    ? (labels.errors[state.errorKey] ?? labels.errors.generic)
    : null;
  const formError = errorMessage;

  useBusyCursor(pending);

  useEffect(() => {
    if (!formError) return;
    toast.error(formError);
  }, [formError]);

  return (
    <form
      action={formAction}
      className="grid gap-4"
      noValidate
      onSubmit={(event) => {
        const formData = new FormData(event.currentTarget);
        const nextErrors: { email?: string; password?: string } = {};

        const email = String(formData.get("email") ?? "").trim();
        const password = String(formData.get("password") ?? "").trim();
        if (!email) nextErrors.email = labels.errors.required;
        if (!password) nextErrors.password = labels.errors.required;

        if (Object.keys(nextErrors).length > 0) {
          event.preventDefault();
          setFieldErrors(nextErrors);
          return;
        }

        setFieldErrors({});
      }}
    >
      <div className="grid gap-2">
        <Label htmlFor="name">{labels.name}</Label>
        <Input id="name" name="name" placeholder="Oscar" autoComplete="name" />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="email">{labels.email}</Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="you@company.com"
          autoComplete="email"
          required
          aria-invalid={fieldErrors.email ? true : undefined}
          onChange={() => {
            if (!fieldErrors.email) return;
            setFieldErrors((prev) => ({ ...prev, email: undefined }));
          }}
        />
        <FormFieldError error={fieldErrors.email} />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="password">{labels.password}</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          aria-invalid={fieldErrors.password ? true : undefined}
          onChange={() => {
            if (!fieldErrors.password) return;
            setFieldErrors((prev) => ({ ...prev, password: undefined }));
          }}
        />
        <FormFieldError error={fieldErrors.password} />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="company">{labels.company}</Label>
        <Input id="company" name="company" placeholder="Tesla" />
        <p className="text-xs text-muted-foreground">{labels.optional}</p>
      </div>

      <FormSubmitError error={formError} title={labels.errors.title} />

      <Button
        type="submit"
        className="w-full"
        loading={pending}
        loadingText={`${labels.submit}...`}
      >
        {labels.submit}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        <Link className="hover:text-foreground" href={labels.switchHref}>
          {labels.switch}
        </Link>
      </p>
    </form>
  );
}
