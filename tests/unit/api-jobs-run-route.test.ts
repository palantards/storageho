import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/inventory/ai-jobs", () => ({
  runAiJobBatch: vi.fn(),
}));

import { GET, POST } from "@/app/api/jobs/run/route";
import { runAiJobBatch } from "@/lib/inventory/ai-jobs";

describe("api/jobs/run", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    delete process.env.AI_JOB_RUNNER_TOKEN;
  });

  it("returns 401 when token is set and request is unauthorized", async () => {
    process.env.AI_JOB_RUNNER_TOKEN = "secret";

    const response = await GET(
      new NextRequest("http://localhost/api/jobs/run?limit=4"),
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  });

  it("runs jobs when bearer token is valid", async () => {
    process.env.AI_JOB_RUNNER_TOKEN = "secret";
    vi.mocked(runAiJobBatch).mockResolvedValue({
      claimed: 1,
      results: [{ id: "job1", status: "succeeded" }],
    } as never);

    const response = await GET(
      new NextRequest("http://localhost/api/jobs/run?limit=7", {
        headers: { authorization: "Bearer secret" },
      }),
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.ok).toBe(true);
    expect(payload.claimed).toBe(1);
    expect(runAiJobBatch).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 7 }),
    );
  });

  it("allows POST alias for GET", async () => {
    process.env.AI_JOB_RUNNER_TOKEN = "secret";
    vi.mocked(runAiJobBatch).mockResolvedValue({
      claimed: 0,
      results: [],
    } as never);

    const response = await POST(
      new NextRequest("http://localhost/api/jobs/run", {
        method: "POST",
        headers: { authorization: "Bearer secret" },
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, claimed: 0, results: [] });
  });
});

