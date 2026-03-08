import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

import { middleware } from "@/../middleware";

describe("middleware security", () => {
  it("blocks cross-site API mutation with session cookie", async () => {
    const request = new NextRequest("http://localhost/api/support", {
      method: "POST",
      headers: {
        cookie: "supabase_access_token=test",
        "sec-fetch-site": "cross-site",
      },
    });

    const response = await middleware(request);
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "CSRF check failed" });
  });

  it("allows csrf-exempt stripe webhook path", async () => {
    const request = new NextRequest("http://localhost/api/stripe/webhook", {
      method: "POST",
      headers: {
        cookie: "supabase_access_token=test",
        "sec-fetch-site": "cross-site",
      },
    });

    const response = await middleware(request);
    expect(response.status).toBe(200);
  });

  it("allows same-origin API mutation with session cookie", async () => {
    const request = new NextRequest("http://localhost/api/support", {
      method: "POST",
      headers: {
        cookie: "supabase_access_token=test",
        "sec-fetch-site": "same-origin",
      },
    });

    const response = await middleware(request);
    expect(response.status).toBe(200);
  });

  it("redirects locale-less app routes", async () => {
    const request = new NextRequest("http://localhost/dashboard", {
      method: "GET",
    });

    const response = await middleware(request);
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/en/dashboard");
  });
});

