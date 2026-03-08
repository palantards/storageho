import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));
vi.mock("@/server/stripe/webhookHandlers", () => ({
  findUserByStripeCustomerId: vi.fn(),
  getWebhookEventStatus: vi.fn(),
  hashPayload: vi.fn(),
  markEventProcessed: vi.fn(),
  upsertSubscriptionFromStripe: vi.fn(),
}));

import { POST } from "@/app/api/stripe/webhook/route";

describe("api/stripe/webhook POST", () => {
  it("returns 503 when webhook secret is not configured", async () => {
    const previous = process.env.STRIPE_WEBHOOK_SECRET;
    delete process.env.STRIPE_WEBHOOK_SECRET;

    try {
      const response = await POST(
        new NextRequest("http://localhost/api/stripe/webhook", {
          method: "POST",
          body: "{}",
        }),
      );

      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({ error: "Webhook is not configured" });
    } finally {
      if (previous !== undefined) {
        process.env.STRIPE_WEBHOOK_SECRET = previous;
      } else {
        delete process.env.STRIPE_WEBHOOK_SECRET;
      }
    }
  });

  it("returns 400 when stripe-signature header is missing", async () => {
    const previous = process.env.STRIPE_WEBHOOK_SECRET;
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";

    try {
      const response = await POST(
        new NextRequest("http://localhost/api/stripe/webhook", {
          method: "POST",
          body: "{}",
        }),
      );

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: "Missing Stripe signature" });
    } finally {
      if (previous !== undefined) {
        process.env.STRIPE_WEBHOOK_SECRET = previous;
      } else {
        delete process.env.STRIPE_WEBHOOK_SECRET;
      }
    }
  });
});
