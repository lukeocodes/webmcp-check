import { getCache } from "@vercel/functions";
import type { CheckResult } from "./types";

/**
 * Server-side result cache keyed by the cleaned/normalised request URL.
 *
 * On Vercel we use the Runtime Cache (shared per-region, tag-invalidatable).
 * Everywhere else (local dev) we fall back to an in-process TTL map so the
 * behaviour is consistent. We only ever cache *complete* results — a result
 * where the headless browser actually ran — so a transient launch failure is
 * never frozen in for the TTL.
 */

const TTL_SECONDS = 60 * 60; // 1 hour
const KEY_PREFIX = "webmcp-check:v1:";
export const CACHE_TAG = "webmcp-check";

const onVercel = !!process.env.VERCEL;

// In-process fallback store (local dev / when the runtime cache is unavailable).
const memory = new Map<string, { value: CheckResult; expires: number }>();

function memGet(key: string): CheckResult | null {
  const hit = memory.get(key);
  if (!hit) return null;
  if (hit.expires < Date.now()) {
    memory.delete(key);
    return null;
  }
  return hit.value;
}

function memSet(key: string, value: CheckResult): void {
  memory.set(key, { value, expires: Date.now() + TTL_SECONDS * 1000 });
}

export async function getCachedResult(normalizedUrl: string): Promise<CheckResult | null> {
  const key = KEY_PREFIX + normalizedUrl;
  if (!onVercel) return memGet(key);
  try {
    const value = (await getCache().get(key)) as CheckResult | undefined | null;
    return value ?? null;
  } catch {
    return memGet(key);
  }
}

export async function setCachedResult(normalizedUrl: string, result: CheckResult): Promise<void> {
  const key = KEY_PREFIX + normalizedUrl;
  if (!onVercel) {
    memSet(key, result);
    return;
  }
  try {
    await getCache().set(key, result, { ttl: TTL_SECONDS, tags: [CACHE_TAG], name: normalizedUrl });
  } catch {
    memSet(key, result);
  }
}
