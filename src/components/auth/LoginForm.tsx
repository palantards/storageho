"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Labels = {
  email: string;
  password: string;
  submit: string;
  forgot: string;
  switch: string;
  title: string;
  subtitle: string;
  errors: Record<string, string>;
  forgotHref: string;
  switchHref: string;
  remember?: string;
};

type State = { errorKey?: string };

export function LoginForm({
  action,
  labels,
}: {
  action: (prev: State, formData: FormData) => Promise<State>;
  labels: Labels;
}) {
  const [state, formAction] = useActionState(action, { errorKey: undefined });
  const { pending } = useFormStatus();

  const errorMessage = state.errorKey
    ? (labels.errors[state.errorKey] ?? labels.errors.generic)
    : null;

  return (
    <form action={formAction} className="grid gap-4">
      {errorMessage && (
        <Alert variant="destructive">
          <AlertTitle>{labels.errors.title}</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-2">
        <Label htmlFor="email">{labels.email}</Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="you@company.com"
          autoComplete="email"
          required
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="password">{labels.password}</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
        <div className="flex items-center justify-between">
          <Link
            className="text-xs text-muted-foreground hover:text-foreground"
            href={labels.forgotHref}
          >
            {labels.forgot}
          </Link>
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <input
          type="checkbox"
          name="rememberMe"
          defaultChecked
          className="h-4 w-4 accent-primary"
        />
        <span>{labels.remember ?? "Remember me"}</span>
      </label>

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? `${labels.submit}…` : labels.submit}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        <Link className="hover:text-foreground" href={labels.switchHref}>
          {labels.switch}
        </Link>
      </p>
    </form>
  );
}

