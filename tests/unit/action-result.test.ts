import { describe, expect, it } from "vitest";
import { z } from "zod";

import { zodToFieldErrors } from "@/lib/forms/action-result";

describe("zodToFieldErrors", () => {
  it("maps only allowed fields with first message", () => {
    const schema = z.object({
      email: z.string().email("Invalid email"),
      password: z.string().min(8, "Password too short"),
      hidden: z.string().min(1, "Hidden field required"),
    });

    const parsed = schema.safeParse({
      email: "nope",
      password: "123",
      hidden: "",
    });

    expect(parsed.success).toBe(false);
    if (parsed.success) return;

    const errors = zodToFieldErrors(parsed.error, ["email", "password"] as const);
    expect(errors).toEqual({
      email: "Invalid email",
      password: "Password too short",
    });
  });
});
