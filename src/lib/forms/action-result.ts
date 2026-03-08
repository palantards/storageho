import { z } from "zod"

export type FieldErrors<T extends string> = Partial<Record<T, string>>

export type ActionFail<T extends string = string> = {
  ok: false
  error: string
  fieldErrors?: FieldErrors<T>
}

export type ActionOk<T extends Record<string, unknown> = {}> = {
  ok: true
} & T

export function zodToFieldErrors<T extends string>(
  error: z.ZodError,
  allowedFields: readonly T[]
): FieldErrors<T> {
  const allowed = new Set<string>(allowedFields)
  const flattened = error.flatten().fieldErrors
  const result: FieldErrors<T> = {}

  for (const field of allowedFields) {
    const message = flattened[field]?.[0]
    if (message && allowed.has(field)) {
      result[field] = message
    }
  }

  return result
}
