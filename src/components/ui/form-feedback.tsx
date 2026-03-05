"use client"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { cn } from "@/lib/utils"

export function FormFieldError({
  error,
  className,
}: {
  error?: string | null
  className?: string
}) {
  if (!error) return null
  return (
    <p role="alert" className={cn("text-sm text-destructive", className)}>
      {error}
    </p>
  )
}

export function FormSubmitError({
  error,
  title = "Something went wrong",
  className,
}: {
  error?: string | null
  title?: string
  className?: string
}) {
  if (!error) return null
  return (
    <Alert variant="destructive" className={cn("py-2", className)}>
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{error}</AlertDescription>
    </Alert>
  )
}
