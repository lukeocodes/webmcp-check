import { existsSync } from "node:fs";
import type { Browser } from "puppeteer-core";
import type { DiscoveredTool } from "./types";
import { BROWSER_UA } from "./url";

export interface RuntimeResult {
  executed: boolean;
  tools: DiscoveredTool[];
  error?: string;
}

const NAV_TIMEOUT_MS = 25_000;
const SETTLE_MS = 1_800;

/**
 * Instrumentation injected before any page script runs. It supplies the WebMCP
 * imperative API surface (`navigator.modelContext` / `document.modelContext`)
 * that an agent-capable browser would expose, and records every tool the page
 * registers via `registerTool` or the legacy `provideContext({tools})`.
 *
 * This is the core of "seeing the page the way a model would": we don't grep —
 * we run the page and capture what it actually registers.
 */
const INIT_SCRIPT = `
(() => {
  const store = { tools: [] };
  Object.defineProperty(window, "__WEBMCP__", { value: store, configurable: true });

  function clone(v) { try { return JSON.parse(JSON.stringify(v)); } catch { return undefined; } }
  function record(tool, via) {
    try {
      store.tools.push({
        name: tool && tool.name,
        description: tool && tool.description,
        title: tool && tool.title,
        inputSchema: tool ? clone(tool.inputSchema) : undefined,
        annotations: tool ? clone(tool.annotations) : undefined,
        hasExecute: !!(tool && typeof tool.execute === "function"),
        source: "imperative",
        via,
      });
    } catch (e) { /* ignore a single malformed registration */ }
  }

  const ctx = {
    registerTool(tool) { record(tool, "registerTool"); return Promise.resolve({ unregister() {} }); },
    provideContext(obj) {
      if (obj && Array.isArray(obj.tools)) obj.tools.forEach((t) => record(t, "provideContext"));
    },
    unregisterTool() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() { return true; },
  };

  const def = (target, isProto) => {
    try {
      Object.defineProperty(target, "modelContext", isProto
        ? { configurable: true, get() { return ctx; } }
        : { configurable: true, value: ctx });
    } catch (e) { /* property may already be locked */ }
  };
  try { def(Navigator.prototype, true); } catch (e) {}
  try { def(navigator, false); } catch (e) {}
  try { def(Document.prototype, true); } catch (e) {}
  try { def(document, false); } catch (e) {}
})();
`;

/** Collect declarative `<form toolname>` tools from the *live* DOM (catches dynamically added forms). */
const COLLECT_DECLARATIVE = `
(() => {
  const out = [];
  document.querySelectorAll("form[toolname]").forEach((form) => {
    const properties = {};
    const required = [];
    form.querySelectorAll("input[name], select[name], textarea[name]").forEach((c) => {
      const t = (c.getAttribute("type") || "").toLowerCase();
      if (["submit", "button", "hidden", "reset"].includes(t)) return;
      const s = { type: t === "number" || t === "range" ? "number" : t === "checkbox" ? "boolean" : "string" };
      const d = c.getAttribute("toolparamdescription");
      if (d) s.description = d;
      properties[c.getAttribute("name")] = s;
      if (c.hasAttribute("required")) required.push(c.getAttribute("name"));
    });
    const inputSchema = { type: "object", properties };
    if (required.length) inputSchema.required = required;
    out.push({
      name: form.getAttribute("toolname"),
      description: form.getAttribute("tooldescription"),
      inputSchema,
      hasExecute: true,
      source: "declarative",
      via: "form",
    });
  });
  return out;
})();
`;

function findLocalChrome(): string | undefined {
  const candidates = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    process.env.CHROME_PATH,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
  ].filter(Boolean) as string[];
  return candidates.find((p) => existsSync(p));
}

async function launchBrowser(): Promise<Browser> {
  const puppeteer = await import("puppeteer-core");
  const onServerless = !!(process.env.VERCEL_ENV || process.env.AWS_LAMBDA_FUNCTION_NAME);

  if (onServerless) {
    // @sparticuz/chromium only inflates its shared-library pack (libnss3, etc.) and
    // sets LD_LIBRARY_PATH when it detects an AWS Lambda Node 20/22 runtime via
    // AWS_EXECUTION_ENV / AWS_LAMBDA_JS_RUNTIME. Vercel runs on Lambda but doesn't
    // set those, so without this the binary extracts but fails with
    // "libnss3.so: cannot open shared object file". Force the detection *before*
    // importing the package so its module-load env setup runs.
    if (!process.env.AWS_EXECUTION_ENV && !process.env.AWS_LAMBDA_JS_RUNTIME) {
      process.env.AWS_LAMBDA_JS_RUNTIME = "nodejs20.x";
    }
    const chromium = (await import("@sparticuz/chromium")).default;
    return puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });
  }

  const executablePath = findLocalChrome();
  if (!executablePath) {
    throw new Error(
      "No local Chrome/Chromium found. Set PUPPETEER_EXECUTABLE_PATH or install Google Chrome to enable runtime detection."
    );
  }
  return puppeteer.launch({
    executablePath,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });
}

export async function analyzeRuntime(url: string): Promise<RuntimeResult> {
  let browser: Browser | null = null;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    await page.setUserAgent(BROWSER_UA);
    await page.evaluateOnNewDocument(INIT_SCRIPT);

    await page.goto(url, { waitUntil: "networkidle2", timeout: NAV_TIMEOUT_MS });
    // Give late-registering / framework-mounted code a moment to run.
    await new Promise((r) => setTimeout(r, SETTLE_MS));

    const imperative = (await page.evaluate(
      "window.__WEBMCP__ ? window.__WEBMCP__.tools : []"
    )) as DiscoveredTool[];
    const declarative = (await page.evaluate(COLLECT_DECLARATIVE)) as DiscoveredTool[];

    return { executed: true, tools: [...imperative, ...declarative] };
  } catch (err) {
    return {
      executed: false,
      tools: [],
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}
