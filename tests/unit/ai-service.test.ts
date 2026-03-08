import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  analyzeContainerPhotosWithAi,
  analyzePhotoWithAi,
  embedTextForSearch,
} from "@/lib/inventory/ai";

describe("inventory ai service", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("returns empty suggestions when AI is disabled", async () => {
    vi.stubEnv("STORAGEHO_AI_ENABLED", "0");

    const result = await analyzePhotoWithAi({
      signedUrl: "https://example.com/photo.png",
    });

    expect(result.suggestions).toEqual([]);
  });

  it("uses deterministic mock suggestions with maxSuggestions cap", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("STORAGEHO_AI_ENABLED", "1");
    vi.stubEnv("AI_MOCK_MODE", "1");

    const result = await analyzeContainerPhotosWithAi({
      signedUrls: ["https://example.com/a.png", "https://example.com/b.png"],
      maxSuggestions: 2,
    });

    expect(result.suggestions.length).toBe(2);
    expect(result.suggestions[0]?.name).toBeTypeOf("string");
  });

  it("throws when AI is enabled without key and not in mock mode", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("STORAGEHO_AI_ENABLED", "1");
    vi.stubEnv("AI_MOCK_MODE", "0");
    vi.stubEnv("OPENAI_API_KEY", "");

    await expect(
      analyzePhotoWithAi({ signedUrl: "https://example.com/photo.png" }),
    ).rejects.toThrow("OPENAI_API_KEY is missing while AI is enabled");
  });

  it("returns deterministic embedding vector in disabled mode", async () => {
    vi.stubEnv("STORAGEHO_AI_ENABLED", "0");

    const v1 = await embedTextForSearch("HDMI cable");
    const v2 = await embedTextForSearch("HDMI cable");

    expect(v1).toHaveLength(1536);
    expect(v1).toEqual(v2);
  });
});
