import * as cheerio from "cheerio";
import type { DiscoveredTool, Signal } from "./types";
import { BROWSER_UA } from "./url";

export interface StaticResult {
  html: string | null;
  finalUrl: string;
  declarativeTools: DiscoveredTool[];
  signals: Signal[];
}

const FETCH_TIMEOUT_MS = 15_000;

async function fetchText(url: string): Promise<{ body: string; finalUrl: string } | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: ctrl.signal,
      headers: { "User-Agent": BROWSER_UA, Accept: "text/html,application/xhtml+xml" },
    });
    if (!res.ok) return null;
    return { body: await res.text(), finalUrl: res.url || url };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Map an HTML input `type` to a JSON Schema fragment, mirroring browser synthesis. */
function inputToSchema(el: cheerio.Cheerio<never>, $: cheerio.CheerioAPI): Record<string, unknown> {
  const type = ($(el).attr("type") || "text").toLowerCase();
  const schema: Record<string, unknown> = {};
  switch (type) {
    case "number":
    case "range":
      schema.type = "number";
      break;
    case "checkbox":
      schema.type = "boolean";
      break;
    case "email":
      schema.type = "string";
      schema.format = "email";
      break;
    case "url":
      schema.type = "string";
      schema.format = "uri";
      break;
    case "date":
      schema.type = "string";
      schema.format = "date";
      break;
    default:
      schema.type = "string";
  }
  const desc = $(el).attr("toolparamdescription");
  if (desc) schema.description = desc;
  const min = $(el).attr("min");
  const max = $(el).attr("max");
  const pattern = $(el).attr("pattern");
  const maxlength = $(el).attr("maxlength");
  if (min !== undefined) schema.minimum = Number(min);
  if (max !== undefined) schema.maximum = Number(max);
  if (pattern) schema.pattern = pattern;
  if (maxlength) schema.maxLength = Number(maxlength);
  return schema;
}

/**
 * Synthesize declarative WebMCP tools from `<form toolname>` markup exactly as a
 * conforming browser would, so it reflects what an agent would actually see.
 */
function extractDeclarativeTools($: cheerio.CheerioAPI): DiscoveredTool[] {
  const tools: DiscoveredTool[] = [];
  $("form[toolname]").each((_, formEl) => {
    const $form = $(formEl);
    const name = $form.attr("toolname");
    const description = $form.attr("tooldescription");
    const properties: Record<string, unknown> = {};
    const required: string[] = [];

    $form.find("input[name], select[name], textarea[name]").each((__, ctrl) => {
      const fieldName = $(ctrl).attr("name");
      if (!fieldName) return;
      const type = ($(ctrl).attr("type") || "").toLowerCase();
      if (type === "submit" || type === "button" || type === "hidden" || type === "reset") return;
      properties[fieldName] = inputToSchema($(ctrl) as never, $);
      if ($(ctrl).attr("required") !== undefined) required.push(fieldName);
    });

    const inputSchema: Record<string, unknown> = { type: "object", properties };
    if (required.length) inputSchema.required = required;

    tools.push({
      name,
      description,
      inputSchema,
      hasExecute: true, // declarative tools "execute" by submitting the form
      source: "declarative",
      via: "form",
    });
  });
  return tools;
}

/** Look for imperative-API references in inline and linked scripts (best-effort, no execution). */
function scanScriptSignals($: cheerio.CheerioAPI, baseUrl: string): { signals: Signal[]; scriptUrls: string[] } {
  const signals: Signal[] = [];
  const scriptUrls: string[] = [];
  const apiPattern = /(navigator|document)\s*\.\s*modelContext|modelContext\s*\.\s*(registerTool|provideContext)|registerTool\s*\(|provideContext\s*\(/;

  $("script").each((_, el) => {
    const src = $(el).attr("src");
    if (src) {
      try {
        scriptUrls.push(new URL(src, baseUrl).toString());
      } catch {
        /* ignore malformed src */
      }
      return;
    }
    const code = $(el).html() || "";
    if (apiPattern.test(code)) {
      const which = /provideContext/.test(code) ? "provideContext" : "registerTool";
      signals.push({
        kind: "script-reference",
        detail: `Inline script references the imperative WebMCP API (\`${which}\`). Tools are registered at runtime.`,
        location: "inline <script>",
      });
    }
  });
  return { signals, scriptUrls };
}

async function scanExternalScripts(scriptUrls: string[]): Promise<Signal[]> {
  const apiPattern = /(navigator|document)\s*\.\s*modelContext|modelContext\s*\.\s*(registerTool|provideContext)/;
  // Cap how many external scripts we fetch to keep the check fast.
  const candidates = scriptUrls.slice(0, 12);
  const results = await Promise.all(
    candidates.map(async (u): Promise<Signal | null> => {
      const got = await fetchText(u);
      if (!got) return null;
      if (apiPattern.test(got.body)) {
        return {
          kind: "script-reference",
          detail: "External script references the imperative WebMCP API (`navigator/document.modelContext`).",
          location: u,
        };
      }
      return null;
    })
  );
  return results.filter((s): s is Signal => s !== null);
}

async function probeWellKnown(origin: string): Promise<Signal[]> {
  // `.well-known/webmcp` is a proposed (not-yet-standardised) discovery manifest.
  const url = `${origin}/.well-known/webmcp`;
  const got = await fetchText(url);
  if (!got) return [];
  let parsedNote = "";
  try {
    JSON.parse(got.body);
    parsedNote = " It parses as JSON.";
  } catch {
    parsedNote = " (Warning: it does not parse as JSON.)";
  }
  return [
    {
      kind: "well-known-manifest",
      detail: `Found a \`/.well-known/webmcp\` manifest.${parsedNote} Note: this is a proposed, not-yet-standardised discovery mechanism.`,
      location: url,
    },
  ];
}

function scanMetaTags($: cheerio.CheerioAPI): Signal[] {
  const signals: Signal[] = [];
  $('meta[name*="mcp" i], meta[name*="model-context" i]').each((_, el) => {
    const name = $(el).attr("name");
    const content = $(el).attr("content");
    signals.push({
      kind: "meta-tag",
      detail: `Found a WebMCP-related meta tag: <meta name="${name}" content="${content ?? ""}">.`,
      location: "<head>",
    });
  });
  return signals;
}

export async function analyzeStatic(url: string): Promise<StaticResult> {
  const origin = new URL(url).origin;
  const page = await fetchText(url);
  if (!page) {
    return {
      html: null,
      finalUrl: url,
      declarativeTools: [],
      signals: [{ kind: "note", detail: "Could not fetch the page over HTTP for static analysis." }],
    };
  }

  const $ = cheerio.load(page.body);
  const declarativeTools = extractDeclarativeTools($);
  const { signals: inlineSignals, scriptUrls } = scanScriptSignals($, page.finalUrl);
  const [externalSignals, wellKnownSignals] = await Promise.all([
    scanExternalScripts(scriptUrls),
    probeWellKnown(origin),
  ]);

  return {
    html: page.body,
    finalUrl: page.finalUrl,
    declarativeTools,
    signals: [...scanMetaTags($), ...inlineSignals, ...externalSignals, ...wellKnownSignals],
  };
}
