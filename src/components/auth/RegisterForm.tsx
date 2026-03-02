"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="password">{labels.password}</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="company">{labels.company}</Label>
        <Input id="company" name="company" placeholder="Tesla" />
        <p className="text-xs text-muted-foreground">{labels.optional}</p>
      </div>

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

