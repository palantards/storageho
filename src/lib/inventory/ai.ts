import "server-only";

import { z } from "zod";

const suggestionSchema = z.object({
  name: z.string().trim().min(1).max(160),
  qty: z.number().int().min(1).max(1000).optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(8).optional(),
  confidence: z.number().min(0).max(1).optional(),
});

const responseSchema = z.object({
  suggestions: z.array(suggestionSchema),
});

const PROHIBITED_TERMS = ["weapon", "bomb", "explosive", "nazi"];

export type AiSuggestion = {
  name: string;
  qty?: number;
  tags?: string[];
  confidence: number;
};

function isAiEnabled() {
  return process.env.STORAGEHO_AI_ENABLED !== "0";
}

function isMockMode() {
  return process.env.AI_MOCK_MODE === "1" || process.env.NODE_ENV === "test";
}

function toDeterministicVector(input: string, dimensions = 1536) {
  const seed = Array.from(input).reduce(
    (acc, char) => acc + char.charCodeAt(0),
    17,
  );
  const vector: number[] = [];
  for (let i = 0; i < dimensions; i += 1) {
    const value =
      Math.sin((seed + i) * 0.017) * 0.4 + Math.cos((seed - i) * 0.011) * 0.2;
    vector.push(Number(value.toFixed(8)));
  }
  return vector;
}

function sanitizeSuggestion(input: AiSuggestion): AiSuggestion | null {
  const name = input.name.trim().replace(/\s+/g, " ");
  if (!name) return null;

  const lower = name.toLowerCase();
  if (PROHIBITED_TERMS.some((term) => lower.includes(term))) {
    return null;
  }

  const tags = (input.tags || [])
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 8);

  const qty =
    input.qty && input.qty > 0
      ? Math.min(1000, Math.floor(input.qty))
      : undefined;
  const confidence = Number.isFinite(input.confidence)
    ? Math.max(0, Math.min(1, Number(input.confidence)))
    : 0.55;

  return {
    name,
    qty,
    tags: tags.length ? tags : undefined,
    confidence,
  };
}

function normalizeSuggestions(
  suggestions: AiSuggestion[],
  maxSuggestions?: number,
) {
  const normalized: AiSuggestion[] = [];
  const seen = new Set<string>();
  const hasLimit =
    typeof maxSuggestions === "number" &&
    Number.isFinite(maxSuggestions) &&
    maxSuggestions > 0;

  for (const suggestion of suggestions) {
    const safe = sanitizeSuggestion(suggestion);
    if (!safe) continue;
    const key = safe.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push(safe);
    if (hasLimit && normalized.length >= maxSuggestions) break;
  }

  return normalized;
}

function extractJsonFromModelOutput(content: string) {
  const trimmed = content.trim();
  if (!trimmed) return "{}";

  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return trimmed;
  }

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return trimmed.slice(start, end + 1);
  }
  return "{}";
}

async function runVisionSuggestionModel(input: {
  messages: Array<Record<string, unknown>>;
  maxSuggestions?: number;
}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is missing while AI is enabled");
  }

  const model = process.env.OPENAI_MODEL_VISION;
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 1,
      response_format: { type: "json_object" },
      messages: input.messages,
    }),
  });

  if (!response.ok) {
    const errorPayload = await response.text();
    throw new Error(`Vision model failed: ${errorPayload}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const rawContent = payload.choices?.[0]?.message?.content || "{}";
  const parsed = responseSchema.safeParse(
    JSON.parse(extractJsonFromModelOutput(rawContent)),
  );

  if (!parsed.success) {
    return { suggestions: [] as AiSuggestion[] };
  }

  return {
    suggestions: normalizeSuggestions(
      parsed.data.suggestions.map((suggestion) => ({
        name: suggestion.name,
        qty: suggestion.qty,
        tags: suggestion.tags,
        confidence: suggestion.confidence ?? 0.55,
      })),
      input.maxSuggestions,
    ),
  };
}

export async function analyzePhotoWithAi(input: {
  signedUrl: string;
  maxSuggestions?: number;
  language?: string;
}) {
  const maxSuggestions =
    typeof input.maxSuggestions === "number" && input.maxSuggestions > 0
      ? Math.floor(input.maxSuggestions)
      : undefined;
  const language = input.language?.trim() || "en";
  if (!isAiEnabled()) {
    return { suggestions: [] as AiSuggestion[] };
  }

  if (isMockMode()) {
    return {
      suggestions: normalizeSuggestions(
        [
          {
            name: "USB Cable",
            qty: 2,
            tags: ["electronics"],
            confidence: 0.84,
          },
          {
            name: "Power Adapter",
            qty: 1,
            tags: ["electronics"],
            confidence: 0.74,
          },
          {
            name: "Small Screws",
            qty: 1,
            tags: ["hardware"],
            confidence: 0.58,
          },
        ],
        maxSuggestions,
      ),
    };
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is missing while AI is enabled");
  }

  return runVisionSuggestionModel({
    maxSuggestions,
    messages: [
      {
        role: "system",
        content: `You extract inventory candidates from a storage photo. Return JSON only with shape { suggestions: [{ name, qty, tags, confidence }] }. Never output prose.
Rules:
- Include only physical objects clearly visible in the image.
- Prefer canonical singular names (e.g. "USB cable", "Power adapter").
- Set qty only when count is visually clear; otherwise omit qty.
- Use short lowercase tags (category/material/use-case), max 8 per item.
- confidence must be between 0 and 1; lower confidence for uncertain guesses.
- Do not include shelves/walls/background unless clearly intentional stored items.
Use language ${language} for item names and tags; if unsure, use English.`,
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "List all distinct visible objects worth tracking in household inventory. Do not omit likely items because of brevity.",
          },
          {
            type: "image_url",
            image_url: {
              url: input.signedUrl,
            },
          },
        ],
      },
    ],
  });
}

export async function analyzeContainerPhotosWithAi(input: {
  signedUrls: string[];
  maxSuggestions?: number;
  language?: string;
}) {
  const urls = input.signedUrls.filter(Boolean).slice(0, 10);
  const maxSuggestions =
    typeof input.maxSuggestions === "number" && input.maxSuggestions > 0
      ? Math.floor(input.maxSuggestions)
      : undefined;
  const language = input.language?.trim() || "en";

  if (!isAiEnabled() || urls.length === 0) {
    return { suggestions: [] as AiSuggestion[] };
  }

  if (isMockMode()) {
    return {
      suggestions: normalizeSuggestions(
        [
          {
            name: "USB Cable",
            qty: 3,
            tags: ["electronics"],
            confidence: 0.86,
          },
          {
            name: "Power Adapter",
            qty: 2,
            tags: ["electronics"],
            confidence: 0.78,
          },
          {
            name: "Batteries",
            qty: 1,
            tags: ["electronics"],
            confidence: 0.67,
          },
          { name: "Small Screws", qty: 1, tags: ["hardware"], confidence: 0.6 },
        ],
        maxSuggestions,
      ),
    };
  }

  return runVisionSuggestionModel({
    maxSuggestions,
    messages: [
      {
        role: "system",
        content: `You extract inventory candidates from multiple photos of the same storage container. Return JSON only with shape { suggestions: [{ name, qty, tags, confidence }] }. Never output prose.
Rules:
- These photos are the same container from different angles.
- Include only physical objects clearly visible in at least one photo.
- Deduplicate entities across photos using canonical singular names.
- Merge quantities conservatively; if unsure about count, omit qty.
- Use short lowercase tags (category/material/use-case), max 8 per item.
- confidence must be between 0 and 1; lower confidence for uncertain guesses.
- Do not include background furniture unless clearly stored as inventory.
Use language ${language} for item names and tags; if unsure, use English.`,
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "These images show the same box from different angles. Return one consolidated deduplicated list of trackable inventory items.",
          },
          ...urls.map((url) => ({
            type: "image_url",
            image_url: { url },
          })),
        ],
      },
    ],
  });
}

export async function embedTextForSearch(text: string) {
  if (!isAiEnabled()) {
    return toDeterministicVector(text);
  }

  if (isMockMode()) {
    return toDeterministicVector(text);
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI cannot create embedding without OPENAI_API_KEY");
  }

  const model = process.env.OPENAI_MODEL_EMBEDDING || "text-embedding-3-small";
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      input: text.slice(0, 8000),
    }),
  });

  if (!response.ok) {
    const errorPayload = await response.text();
    throw new Error(`Embedding model failed: ${errorPayload}`);
  }

  const payload = (await response.json()) as {
    data?: Array<{ embedding?: number[] }>;
  };
  const vector = payload.data?.[0]?.embedding;
  if (!vector?.length) {
    throw new Error("Embedding response missing vector");
  }
  return vector;
}
