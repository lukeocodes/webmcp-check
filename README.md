# WebMCP Check

Enter a domain and find out whether an AI agent's browser would discover
[**WebMCP**](https://webmachinelearning.github.io/webmcp/) tools on it.

WebMCP exposes tools to AI agents through a **browser API**, not a wire protocol.
An agent discovers a site's tools by loading the page and reading
`document.modelContext` / `navigator.modelContext`. This tool does exactly that, so
the result reflects what a model would actually see.

## What it checks

| Mechanism | How it's detected |
| --- | --- |
| **Imperative API** — `modelContext.registerTool()` / legacy `provideContext()` | A headless browser loads the page with the WebMCP API surface injected, and records every tool the page registers at runtime. |
| **Declarative API** — `<form toolname tooldescription toolautosubmit>` + `<input toolparamdescription>` | Parsed from the HTML (and re-collected from the live DOM) and synthesized into tool definitions exactly as a conforming browser would. |
| **`/.well-known/webmcp`** | Probed as a best-effort signal (this is a *proposed*, not-yet-standardised discovery manifest). |
| **Script / meta signals** | Inline and external scripts are scanned for `modelContext` references in case tools only register after interaction. |

Every discovered tool is validated against the WebMCP `ModelContextTool` contract:
`name` (1–128 chars, `[A-Za-z0-9_.-]`), required non-empty `description`, optional
`title`, `inputSchema` (JSON Schema object), and `annotations`
(`readOnlyHint` / `untrustedContentHint`).

## Running locally

```bash
pnpm install
pnpm dev
```

Runtime detection needs a Chromium binary:

- **Locally** it auto-detects Google Chrome / Chromium / Edge, or set
  `PUPPETEER_EXECUTABLE_PATH`.
- **On Vercel** it uses [`@sparticuz/chromium`](https://github.com/Sparticuz/chromium)
  automatically.

If no browser is available the app degrades to static-only analysis and says so.

## Stack

Next.js (App Router) · TypeScript · Tailwind CSS · `puppeteer-core` +
`@sparticuz/chromium` · `cheerio`.

## References

- [W3C WebMCP draft](https://webmachinelearning.github.io/webmcp/)
- [Chrome WebMCP docs](https://developer.chrome.com/docs/ai/webmcp)
- [Declarative API explainer](https://github.com/webmachinelearning/webmcp/blob/main/declarative-api-explainer.md)

---

Built by [lukeocodes](https://github.com/lukeocodes). Not affiliated with the W3C.
WebMCP is an evolving draft; results are a best-effort reflection of the current spec.
