import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/stripe/server", () => ({
  getStripe: vi.fn(),
}));

import { getStripe } from "@/lib/stripe/server";
import { createCheckoutSession, ensureStripeCustomer } from "@/lib/stripe";

describe("stripe utilities", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("reuses an existing metadata-mapped Stripe customer", async () => {
    const search = vi.fn().mockResolvedValue({
      data: [
        {
          id: "cus_existing",
          email: "person@example.com",
          name: "Person",
          metadata: {
            supabase_user_id: "user-1",
            company: "StorageHo",
          },
        },
      ],
    });
    const list = vi.fn();
    const update = vi.fn();
    const create = vi.fn();

    vi.mocked(getStripe).mockReturnValue({
      customers: {
        search,
        list,
        update,
        create,
      },
    } as never);

    const customerId = await ensureStripeCustomer({
      supabaseUserId: "user-1",
      email: "person@example.com",
      name: "Person",
      company: "StorageHo",
    });

    expect(customerId).toBe("cus_existing");
    expect(list).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it("backfills a single legacy email-matched customer", async () => {
    const search = vi.fn().mockResolvedValue({ data: [] });
    const list = vi.fn().mockResolvedValue({
      data: [
        {
          id: "cus_legacy",
          name: null,
          metadata: {},
        },
      ],
    });
    const update = vi.fn().mockResolvedValue({});
    const create = vi.fn();

    vi.mocked(getStripe).mockReturnValue({
      customers: {
        search,
        list,
        update,
        create,
      },
    } as never);

    const customerId = await ensureStripeCustomer({
      supabaseUserId: "user-2",
      email: "legacy@example.com",
      name: "Legacy",
      company: "StorageHo",
    });

    expect(customerId).toBe("cus_legacy");
    expect(update).toHaveBeenCalledWith(
      "cus_legacy",
      expect.objectContaining({
        email: "legacy@example.com",
        name: "Legacy",
        metadata: expect.objectContaining({
          supabase_user_id: "user-2",
        }),
      }),
    );
    expect(create).not.toHaveBeenCalled();
  });

  it("creates a new customer when no stable match exists", async () => {
    const search = vi.fn().mockResolvedValue({ data: [] });
    const list = vi.fn().mockResolvedValue({ data: [] });
    const create = vi.fn().mockResolvedValue({ id: "cus_new" });

    vi.mocked(getStripe).mockReturnValue({
      customers: {
        search,
        list,
        create,
      },
    } as never);

    const customerId = await ensureStripeCustomer({
      supabaseUserId: "user-3",
      email: "new@example.com",
      name: "New Person",
    });

    expect(customerId).toBe("cus_new");
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "new@example.com",
        name: "New Person",
        metadata: expect.objectContaining({
          supabase_user_id: "user-3",
        }),
      }),
    );
  });

  it("creates checkout sessions for a resolved Stripe customer", async () => {
    const sessionCreate = vi.fn().mockResolvedValue({
      id: "cs_test",
      url: "https://stripe.test/session",
    });

    vi.mocked(getStripe).mockReturnValue({
      checkout: {
        sessions: {
          create: sessionCreate,
        },
      },
    } as never);

    const session = await createCheckoutSession({
      priceId: "price_123",
      successUrl: "https://app.test/profile/subscription?checkout=success",
      cancelUrl: "https://app.test/profile/subscription?checkout=cancel",
      customerId: "cus_checkout",
    });

    expect(session).toEqual({
      id: "cs_test",
      url: "https://stripe.test/session",
    });
    expect(sessionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: "cus_checkout",
        success_url: expect.stringContaining(
          "session_id={CHECKOUT_SESSION_ID}",
        ),
      }),
    );
  });
});
