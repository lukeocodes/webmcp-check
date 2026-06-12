/**
 * Types modelling the WebMCP specification surface we detect.
 *
 * References:
 *  - W3C WebMCP draft: https://webmachinelearning.github.io/webmcp/
 *  - Chrome WebMCP docs: https://developer.chrome.com/docs/ai/webmcp
 *  - Declarative API explainer:
 *    https://github.com/webmachinelearning/webmcp/blob/main/declarative-api-explainer.md
 *
 * The imperative API exposes `document.modelContext` / `navigator.modelContext`
 * with `registerTool(tool, options)` (and the earlier `provideContext({tools})`).
 * The declarative API annotates `<form>` elements with `toolname`,
 * `tooldescription`, `toolautosubmit`, and `<input toolparamdescription>`.
 */

/** A WebMCP tool as discovered on a page (execute callbacks are not serialisable). */
export interface DiscoveredTool {
  name?: unknown;
  description?: unknown;
  title?: unknown;
  inputSchema?: unknown;
  annotations?: unknown;
  /** Whether an `execute` callback was provided (imperative API only). */
  hasExecute?: boolean;
  /** Which API surface this tool came from. */
  source: "imperative" | "declarative";
  /** Which method registered it, when known. */
  via?: "registerTool" | "provideContext" | "form";
}

export type Severity = "error" | "warning" | "info";

export interface ValidationIssue {
  field: string;
  severity: Severity;
  message: string;
}

export interface ValidatedTool {
  tool: DiscoveredTool;
  /** Spec-compliant when there are no `error`-severity issues. */
  valid: boolean;
  issues: ValidationIssue[];
}

/** A non-tool signal that hints at WebMCP support (script references, manifests). */
export interface Signal {
  kind:
    | "script-reference"
    | "well-known-manifest"
    | "meta-tag"
    | "feature-detection"
    | "note";
  detail: string;
  /** Optional source location (URL or snippet) for context. */
  location?: string;
}

export type Verdict = "supported" | "partial" | "not-detected" | "error";

export interface CheckResult {
  /** The URL that was actually analysed (after normalisation/redirects). */
  url: string;
  requestedInput: string;
  verdict: Verdict;
  /** Did a real headless browser run, or did we fall back to static-only? */
  runtimeExecuted: boolean;
  runtimeError?: string;
  tools: ValidatedTool[];
  signals: Signal[];
  /** Human-readable summary lines explaining the verdict. */
  summary: string[];
  timings: { totalMs: number };
  checkedAt: string;
}
