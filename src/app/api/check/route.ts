import { NextResponse } from "next/server";
import { checkWebMCP } from "@/lib/webmcp/check";

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

  try {
    const result = await checkWebMCP(input);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
