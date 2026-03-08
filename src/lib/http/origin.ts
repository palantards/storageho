import { NextRequest, NextResponse } from "next/server";

function toOrigin(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function allowedOriginsFor(request: NextRequest): Set<string> {
  const allowed = [
    request.nextUrl.origin,
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.APP_URL,
  ]
    .map((value) => toOrigin(value))
    .filter((value): value is string => Boolean(value));

  return new Set(allowed);
}

export function assertSameOriginForCookieAuth(
  request: NextRequest,
): NextResponse | null {
  const secFetchSite = request.headers.get("sec-fetch-site");
  if (
    secFetchSite === "same-origin" ||
    secFetchSite === "same-site" ||
    secFetchSite === "none"
  ) {
    return null;
  }

  const origin = toOrigin(request.headers.get("origin"));
  const referer = toOrigin(request.headers.get("referer"));
  const candidateOrigin = origin ?? referer;
  const allowed = allowedOriginsFor(request);

  if (!candidateOrigin || !allowed.has(candidateOrigin)) {
    const response = NextResponse.json({ error: "CSRF check failed" }, { status: 403 });
    response.headers.set("Cache-Control", "no-store");
    return response;
  }

  return null;
}
