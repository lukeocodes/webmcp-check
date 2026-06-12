import type { CheckResult, DiscoveredTool, Signal, ValidatedTool, Verdict } from "./types";
import { normalizeUrl } from "./url";
import { analyzeStatic } from "./static-analyzer";
import { analyzeRuntime } from "./runtime-analyzer";
import { validateTools } from "./validate";

function dedupe(tools: DiscoveredTool[]): DiscoveredTool[] {
  const seen = new Map<string, DiscoveredTool>();
  for (const t of tools) {
    const key = `${t.source}:${typeof t.name === "string" ? t.name : JSON.stringify(t.name)}`;
    // First write wins, but prefer an entry that carries an inputSchema.
    const existing = seen.get(key);
    if (!existing || (existing.inputSchema === undefined && t.inputSchema !== undefined)) {
      seen.set(key, t);
    }
  }
  return [...seen.values()];
}

function computeVerdict(tools: ValidatedTool[], signals: Signal[]): { verdict: Verdict; summary: string[] } {
  const summary: string[] = [];
  const total = tools.length;
  const imperative = tools.filter((t) => t.tool.source === "imperative").length;
  const declarative = tools.filter((t) => t.tool.source === "declarative").length;
  const invalid = tools.filter((t) => !t.valid).length;

  if (total > 0) {
    const parts: string[] = [];
    if (imperative) parts.push(`${imperative} imperative (\`registerTool\`)`);
    if (declarative) parts.push(`${declarative} declarative (\`<form toolname>\`)`);
    summary.push(`Discovered ${total} WebMCP tool${total === 1 ? "" : "s"}: ${parts.join(" and ")}.`);
    if (invalid > 0) {
      summary.push(`${invalid} tool${invalid === 1 ? " has" : "s have"} spec-compliance errors (see details below).`);
    } else {
      summary.push("All discovered tools conform to the WebMCP `ModelContextTool` contract.");
    }
    return { verdict: "supported", summary };
  }

  // No concrete tools — see if anything still hints at WebMCP.
  const hasScriptRef = signals.some((s) => s.kind === "script-reference");
  const hasManifest = signals.some((s) => s.kind === "well-known-manifest");
  if (hasScriptRef || hasManifest) {
    if (hasScriptRef) {
      summary.push(
        "The page references the imperative WebMCP API in its scripts but registered no tools when loaded. " +
          "Tools may register only after user interaction, behind auth, or on another route."
      );
    }
    if (hasManifest) summary.push("A `/.well-known/webmcp` manifest was found (proposed discovery mechanism).");
    return { verdict: "partial", summary };
  }

  summary.push("No WebMCP tools or signals were found. An AI agent visiting this page would not discover any tools.");
  return { verdict: "not-detected", summary };
}

export async function checkWebMCP(input: string): Promise<CheckResult> {
  const start = Date.now();
  const url = normalizeUrl(input).toString();

  // Run static fetch/parse and the headless browser concurrently.
  const [staticRes, runtimeRes] = await Promise.all([analyzeStatic(url), analyzeRuntime(url)]);

  // Prefer the runtime view of declarative tools (live DOM) when the browser ran;
  // otherwise fall back to the statically-parsed declarative tools.
  const runtimeDeclarative = runtimeRes.tools.filter((t) => t.source === "declarative");
  const declarative = runtimeRes.executed && runtimeDeclarative.length > 0 ? runtimeDeclarative : staticRes.declarativeTools;
  const imperative = runtimeRes.tools.filter((t) => t.source === "imperative");

  const tools = validateTools(dedupe([...imperative, ...declarative]));

  const signals: Signal[] = [...staticRes.signals];
  if (!runtimeRes.executed) {
    signals.push({
      kind: "note",
      detail:
        "Runtime detection (headless browser) was unavailable, so imperative tools registered via JavaScript could not be enumerated. Results reflect static analysis only.",
    });
  }

  const { verdict, summary } = computeVerdict(tools, signals);

  return {
    url: staticRes.finalUrl || url,
    requestedInput: input,
    verdict,
    runtimeExecuted: runtimeRes.executed,
    runtimeError: runtimeRes.error,
    tools,
    signals,
    summary,
    timings: { totalMs: Date.now() - start },
    checkedAt: new Date().toISOString(),
  };
}
