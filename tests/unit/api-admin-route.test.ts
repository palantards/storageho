import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/admin/requireAdmin", () => ({
  requireAdmin: vi.fn(),
}));

vi.mock("@/lib/admin/users", () => ({
  getUsers: vi.fn(),
}));

import { GET } from "@/app/api/admin/route";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import { getUsers } from "@/lib/admin/users";

describe("api/admin GET", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns paginated users for admin", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({
      ok: true,
      status: 200,
      session: { user: { id: "u1", email: "a@example.com" } },
      me: { isAdmin: true },
    });
    vi.mocked(getUsers).mockResolvedValue([{ id: "row-1" }] as never);

    const response = await GET(
      new Request("http://localhost/api/admin?offset=5&limit=10"),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual([{ id: "row-1" }]);
    expect(getUsers).toHaveBeenCalledWith({ offset: 5, limit: 10 });
  });

  it("returns a forbidden payload when user is not admin", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({
      ok: false,
      status: 403,
      session: null,
      me: null,
    });

    const response = await GET(new Request("http://localhost/api/admin"));

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Forbidden" });
  });
});
