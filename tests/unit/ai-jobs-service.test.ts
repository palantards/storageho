import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/server/db", () => ({
  dbAdmin: {},
  schema: {},
}));
vi.mock("@/lib/supabaseServer", () => ({
  createSupabaseAdminClient: vi.fn(),
}));
vi.mock("@/lib/inventory/ai", () => ({
  analyzePhotoWithAi: vi.fn(),
  embedTextForSearch: vi.fn(),
}));

import { dispatchAiRunner } from "@/lib/inventory/ai-jobs";

describe("inventory ai-jobs dispatch", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("does not dispatch while NODE_ENV is test", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("AI_JOB_RUNNER_TOKEN", "runner-token");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.example");

    const fetchMock = vi.fn().mockResolvedValue({});
    vi.stubGlobal("fetch", fetchMock);

    dispatchAiRunner({ reason: "enqueue", limit: 10 });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not dispatch when AI_DISPATCH_ON_ENQUEUE is disabled", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AI_DISPATCH_ON_ENQUEUE", "0");
    vi.stubEnv("AI_JOB_RUNNER_TOKEN", "runner-token");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.example");

    const fetchMock = vi.fn().mockResolvedValue({});
    vi.stubGlobal("fetch", fetchMock);

    dispatchAiRunner();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not dispatch when token or app URL is missing", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AI_DISPATCH_ON_ENQUEUE", "1");
    vi.stubEnv("AI_JOB_RUNNER_TOKEN", "");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");

    const fetchMock = vi.fn().mockResolvedValue({});
    vi.stubGlobal("fetch", fetchMock);

    dispatchAiRunner();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("dispatches to /api/jobs/run with clamped limit and auth headers", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AI_DISPATCH_ON_ENQUEUE", "1");
    vi.stubEnv("AI_JOB_RUNNER_TOKEN", "runner-token");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.example/");

    const fetchMock = vi.fn().mockResolvedValue({});
    vi.stubGlobal("fetch", fetchMock);

    dispatchAiRunner({ reason: "manual", limit: 999 });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://app.example/api/jobs/run?limit=30",
      expect.objectContaining({
        method: "POST",
        cache: "no-store",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          Authorization: "Bearer runner-token",
          "x-storageho-dispatch-reason": "manual",
        }),
      }),
    );
  });
});
