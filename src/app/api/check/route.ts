import { NextResponse } from "next/server";
import { checkWebMCP } from "@/lib/webmcp/check";
import { normalizeUrl } from "@/lib/webmcp/url";
import { getCachedResult, setCachedResult } from "@/lib/webmcp/cache";

// Headless Chromium needs the Node.js runtime and plenty of headroom.
export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let input: unknown;
  try {
    const body = await request.json();
    input = body?.url;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (typeof input !== "string" || !input.trim()) {
    return NextResponse.json({ error: "Provide a `url` string." }, { status: 400 });
  }

  // Cache key: the cleaned/trimmed normalised URL. normalizeUrl also validates
  // input and rejects private/loopback hosts, so do it up front.
  let cacheKey: string;
  try {
    cacheKey = normalizeUrl(input).toString();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid URL.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    const hit = await getCachedResult(cacheKey);
    if (hit) {
      return NextResponse.json({ ...hit, cached: true });
    }

    const result = await checkWebMCP(input);
    // Only cache complete results — never freeze in a transient browser failure.
    if (result.runtimeExecuted) {
      await setCachedResult(cacheKey, result);
    }
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
