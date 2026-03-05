"use client";

import { useFormStatus } from "react-dom";

import { Button, type ButtonProps } from "@/components/ui/button";
import { useBusyCursor } from "@/hooks/useBusyCursor";

export function FormSubmitButton({
  children,
  loadingText,
  ...props
}: ButtonProps) {
  const { pending } = useFormStatus();
  useBusyCursor(pending);

  return (
    <Button
      type="submit"
      loading={pending}
      loadingText={loadingText}
      {...props}
    >
      {children}
    </Button>
  );
}
