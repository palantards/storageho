"use client";

import { useActionState } from "react";

import { useBusyCursor } from "@/hooks/useBusyCursor";
import { FormFieldError, FormSubmitError } from "@/components/ui/form-feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type State = {
  ok?: boolean;
  error?: string;
  fieldErrors?: {
    name?: string;
  };
};

export function CreateHouseholdForm({
  action,
}: {
  action: (prev: State, formData: FormData) => Promise<State>;
}) {
  const [state, formAction, pending] = useActionState(action, {});

  useBusyCursor(pending);

  return (
    <form action={formAction} className="grid gap-3" noValidate>
      <div className="grid gap-2">
        <Label htmlFor="name">Household name</Label>
        <Input
          id="name"
          name="name"
          placeholder="Home"
          required
          aria-invalid={state.fieldErrors?.name ? true : undefined}
        />
        <FormFieldError error={state.fieldErrors?.name} />
      </div>
      <FormSubmitError error={state.error} />
      <Button
        type="submit"
        className="w-fit"
        loading={pending}
        loadingText="Creating..."
      >
        Create household
      </Button>
    </form>
  );
}
