/** Normalise arbitrary user input ("example.com", "https://example.com/x") to a URL. */
export function normalizeUrl(input: string): URL {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("Please enter a domain or URL.");
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    throw new Error(`"${input}" is not a valid domain or URL.`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only http(s) URLs are supported.");
  }
  // Block obvious SSRF targets — we fetch these URLs server-side.
  const host = url.hostname.toLowerCase();
  const blocked =
    host === "localhost" ||
    host === "0.0.0.0" ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    host === "[::1]" ||
    host.startsWith("[fd") ||
    host.startsWith("[fe80");
  if (blocked) {
    throw new Error("Refusing to scan private, loopback, or link-local addresses.");
  }
  return url;
}

export const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 webmcp-check/0.1 (+https://github.com/lukeocodes/webmcp-check)";
