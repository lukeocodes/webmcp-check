"use client";

import { useState } from "react";
import type { CheckResult, ValidatedTool, Signal, Verdict } from "@/lib/webmcp/types";

const VERDICT_META: Record<Verdict, { label: string; cls: string; dot: string }> = {
  supported: { label: "WebMCP detected", cls: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300", dot: "bg-emerald-400" },
  partial: { label: "Partial / inconclusive", cls: "border-amber-500/40 bg-amber-500/10 text-amber-300", dot: "bg-amber-400" },
  "not-detected": { label: "No WebMCP detected", cls: "border-zinc-600/50 bg-zinc-500/10 text-zinc-300", dot: "bg-zinc-400" },
  error: { label: "Error", cls: "border-red-500/40 bg-red-500/10 text-red-300", dot: "bg-red-400" },
};

const EXAMPLES = ["github.com", "vercel.com", "example.com"];

export default function Checker() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CheckResult | null>(null);

  async function run(target?: string) {
    const value = (target ?? url).trim();
    if (!value) return;
    setUrl(value);
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: value }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Request failed.");
      setResult(data as CheckResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          run();
        }}
        className="flex flex-col gap-3 sm:flex-row"
      >
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="example.com"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          className="flex-1 rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-base text-white placeholder:text-zinc-500 outline-none transition focus:border-indigo-400/60 focus:ring-2 focus:ring-indigo-500/30"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-indigo-500 px-6 py-3 font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Checking…" : "Check site"}
        </button>
      </form>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-zinc-500">
        <span>Try:</span>
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            onClick={() => run(ex)}
            className="rounded-md border border-white/10 px-2 py-0.5 text-zinc-400 transition hover:border-white/20 hover:text-white"
          >
            {ex}
          </button>
        ))}
      </div>

      {loading && (
        <p className="mt-6 animate-pulse text-sm text-zinc-400">
          Loading the page in a headless browser and recording what it registers on{" "}
          <code className="text-indigo-300">navigator.modelContext</code>…
        </p>
      )}

      {error && (
        <div className="mt-6 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-red-300">
          {error}
        </div>
      )}

      {result && <ResultView result={result} />}
    </div>
  );
}

function ResultView({ result }: { result: CheckResult }) {
  const [showJson, setShowJson] = useState(false);
  const meta = VERDICT_META[result.verdict];

  return (
    <div className="mt-8 space-y-6">
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-medium ${meta.cls}`}>
            <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
            {meta.label}
          </div>
          <div className="text-xs text-zinc-500">
            {result.runtimeExecuted ? "Ran in a headless browser" : "Static analysis only"} · {result.timings.totalMs} ms
          </div>
        </div>

        <p className="mt-3 break-all text-sm text-zinc-400">
          Analysed: <span className="text-zinc-200">{result.url}</span>
        </p>

        <ul className="mt-4 space-y-1.5">
          {result.summary.map((line, i) => (
            <li key={i} className="text-sm text-zinc-200">
              • {renderInline(line)}
            </li>
          ))}
        </ul>

        {!result.runtimeExecuted && result.runtimeError && (
          <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-300/90">
            Runtime detection skipped: {result.runtimeError}
          </p>
        )}
      </div>

      {result.tools.length > 0 && (
        <section>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-400">
            Discovered tools ({result.tools.length})
          </h3>
          <div className="space-y-3">
            {result.tools.map((t, i) => (
              <ToolCard key={i} item={t} />
            ))}
          </div>
        </section>
      )}

      {result.signals.length > 0 && (
        <section>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-400">Signals</h3>
          <div className="space-y-2">
            {result.signals.map((s, i) => (
              <SignalRow key={i} signal={s} />
            ))}
          </div>
        </section>
      )}

      <div>
        <button
          onClick={() => setShowJson((v) => !v)}
          className="text-xs text-zinc-500 underline-offset-2 hover:text-zinc-300 hover:underline"
        >
          {showJson ? "Hide" : "Show"} raw JSON
        </button>
        {showJson && (
          <pre className="mt-2 max-h-96 overflow-auto rounded-xl border border-white/10 bg-black/50 p-4 text-xs text-zinc-300">
            {JSON.stringify(result, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}

function ToolCard({ item }: { item: ValidatedTool }) {
  const { tool, valid, issues } = item;
  const name = typeof tool.name === "string" ? tool.name : "(invalid name)";
  const description = typeof tool.description === "string" ? tool.description : "";
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <code className="rounded bg-black/40 px-1.5 py-0.5 text-sm text-indigo-300">{name}</code>
        <span className="rounded border border-white/10 px-1.5 py-0.5 text-[11px] uppercase tracking-wide text-zinc-400">
          {tool.source}
          {tool.via ? ` · ${tool.via}` : ""}
        </span>
        <span
          className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${
            valid ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/15 text-red-300"
          }`}
        >
          {valid ? "spec-valid" : "spec errors"}
        </span>
      </div>
      {description && <p className="mt-2 text-sm text-zinc-300">{description}</p>}

      {tool.inputSchema != null && (
        <details className="mt-2">
          <summary className="cursor-pointer text-xs text-zinc-500 hover:text-zinc-300">inputSchema</summary>
          <pre className="mt-1 overflow-auto rounded-lg bg-black/50 p-3 text-xs text-zinc-300">
            {JSON.stringify(tool.inputSchema, null, 2)}
          </pre>
        </details>
      )}

      {issues.length > 0 && (
        <ul className="mt-3 space-y-1">
          {issues.map((iss, i) => (
            <li key={i} className="flex items-start gap-2 text-xs">
              <span
                className={`mt-0.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full ${
                  iss.severity === "error" ? "bg-red-400" : iss.severity === "warning" ? "bg-amber-400" : "bg-zinc-500"
                }`}
              />
              <span className="text-zinc-400">
                <span className="text-zinc-300">{iss.field}</span> — {iss.message}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SignalRow({ signal }: { signal: Signal }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-sm text-zinc-300">
      <span className="mr-2 rounded bg-black/40 px-1.5 py-0.5 text-[11px] uppercase tracking-wide text-zinc-500">
        {signal.kind}
      </span>
      {signal.detail}
      {signal.location && <span className="ml-1 break-all text-xs text-zinc-500">({signal.location})</span>}
    </div>
  );
}

// Render `inline code` spans inside summary/markdown-ish strings.
function renderInline(text: string) {
  const parts = text.split(/(`[^`]+`)/g);
  return parts.map((p, i) =>
    p.startsWith("`") && p.endsWith("`") ? (
      <code key={i} className="rounded bg-black/40 px-1 py-0.5 text-[0.85em] text-indigo-300">
        {p.slice(1, -1)}
      </code>
    ) : (
      <span key={i}>{p}</span>
    )
  );
}
