import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(),
}));

vi.mock("@/lib/support", () => ({
  getPublicTicketsPage: vi.fn(),
}));

vi.mock("@/lib/users", () => ({
  findDbUserBySupabaseId: vi.fn(),
  findDbUserIdBySupabaseId: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  dbAdmin: {
    query: {
      tickets: {
        findFirst: vi.fn(),
      },
      ticketVotes: {
        findFirst: vi.fn(),
      },
    },
    delete: vi.fn(),
    insert: vi.fn(),
  },
  schema: {
    tickets: {
      id: {},
    },
    ticketVotes: {
      userId: {},
      ticketId: {},
    },
  },
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

import { getSession } from "@/lib/auth";
import { getPublicTicketsPage } from "@/lib/support";
import { findDbUserIdBySupabaseId } from "@/lib/users";
import { loadPublicTicketsAction } from "@/app/[locale]/(marketing)/support/action";

describe("support actions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("passes the internal db user id to public ticket queries", async () => {
    vi.mocked(getSession).mockResolvedValue({
      user: { id: "supabase-user", email: "person@example.com" },
    });
    vi.mocked(findDbUserIdBySupabaseId).mockResolvedValue({
      id: "db-user",
    } as never);
    vi.mocked(getPublicTicketsPage).mockResolvedValue({
      items: [],
      hasMore: false,
      nextCursor: null,
    });

    await loadPublicTicketsAction({
      category: "bug",
      limit: 10,
    });

    expect(getPublicTicketsPage).toHaveBeenCalledWith({
      category: "bug",
      limit: 10,
      cursorCreatedAt: undefined,
      cursorId: undefined,
      viewerDbUserId: "db-user",
    });
  });

  it("omits viewer vote state when no session exists", async () => {
    vi.mocked(getSession).mockResolvedValue(null);
    vi.mocked(getPublicTicketsPage).mockResolvedValue({
      items: [],
      hasMore: false,
      nextCursor: null,
    });

    await loadPublicTicketsAction({
      category: "suggestion",
      limit: 5,
    });

    expect(getPublicTicketsPage).toHaveBeenCalledWith({
      category: "suggestion",
      limit: 5,
      cursorCreatedAt: undefined,
      cursorId: undefined,
      viewerDbUserId: undefined,
    });
  });
});
