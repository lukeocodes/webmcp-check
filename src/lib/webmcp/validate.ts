import type { DiscoveredTool, ValidatedTool, ValidationIssue } from "./types";

/**
 * Validate a discovered tool against the WebMCP `ModelContextTool` contract.
 *
 * Per the spec (https://webmachinelearning.github.io/webmcp/):
 *  - `name`        required, 1–128 chars, matching /^[A-Za-z0-9_.-]+$/
 *  - `description` required, non-empty string
 *  - `title`       optional string
 *  - `inputSchema` optional JSON Schema object (conventionally `type: "object"`)
 *  - `annotations` optional object: { readOnlyHint?: boolean, untrustedContentHint?: boolean }
 *  - `execute`     required callback (imperative API). Declarative tools submit a form instead.
 */

const NAME_RE = /^[A-Za-z0-9_.-]+$/;
const NAME_MAX = 128;

export function validateTool(tool: DiscoveredTool): ValidatedTool {
  const issues: ValidationIssue[] = [];

  // name
  if (typeof tool.name !== "string" || tool.name.length === 0) {
    issues.push({ field: "name", severity: "error", message: "`name` is required and must be a non-empty string." });
  } else {
    if (tool.name.length > NAME_MAX) {
      issues.push({ field: "name", severity: "error", message: `\`name\` must be at most ${NAME_MAX} characters (got ${tool.name.length}).` });
    }
    if (!NAME_RE.test(tool.name)) {
      issues.push({ field: "name", severity: "error", message: "`name` may only contain letters, digits, `_`, `-` and `.`." });
    }
  }

  // description
  if (typeof tool.description !== "string" || tool.description.trim().length === 0) {
    issues.push({ field: "description", severity: "error", message: "`description` is required and must be a non-empty string." });
  } else if (tool.description.trim().length < 8) {
    issues.push({ field: "description", severity: "warning", message: "`description` is very short — agents rely on it to choose tools, so be descriptive." });
  }

  // title (optional)
  if (tool.title !== undefined && typeof tool.title !== "string") {
    issues.push({ field: "title", severity: "warning", message: "`title` should be a string when present." });
  }

  // inputSchema (optional)
  if (tool.inputSchema !== undefined) {
    if (typeof tool.inputSchema !== "object" || tool.inputSchema === null || Array.isArray(tool.inputSchema)) {
      issues.push({ field: "inputSchema", severity: "error", message: "`inputSchema` must be a JSON Schema object when present." });
    } else {
      const schema = tool.inputSchema as Record<string, unknown>;
      if (schema.type !== undefined && schema.type !== "object") {
        issues.push({ field: "inputSchema", severity: "warning", message: 'Top-level `inputSchema.type` is conventionally "object".' });
      }
      if (schema.type === "object" && schema.properties === undefined) {
        issues.push({ field: "inputSchema", severity: "info", message: "`inputSchema` declares an object but has no `properties`." });
      }
    }
  } else {
    issues.push({ field: "inputSchema", severity: "info", message: "No `inputSchema` — the tool takes no structured input." });
  }

  // annotations (optional)
  if (tool.annotations !== undefined) {
    if (typeof tool.annotations !== "object" || tool.annotations === null || Array.isArray(tool.annotations)) {
      issues.push({ field: "annotations", severity: "warning", message: "`annotations` should be an object when present." });
    } else {
      const ann = tool.annotations as Record<string, unknown>;
      for (const key of ["readOnlyHint", "untrustedContentHint"]) {
        if (ann[key] !== undefined && typeof ann[key] !== "boolean") {
          issues.push({ field: `annotations.${key}`, severity: "warning", message: `\`${key}\` should be a boolean.` });
        }
      }
    }
  }

  // execute (imperative only)
  if (tool.source === "imperative" && tool.hasExecute === false) {
    issues.push({ field: "execute", severity: "error", message: "Imperative tools must provide an `execute` callback." });
  }

  const valid = !issues.some((i) => i.severity === "error");
  return { tool, valid, issues };
}

export function validateTools(tools: DiscoveredTool[]): ValidatedTool[] {
  return tools.map(validateTool);
}
