import Checker from "@/components/Checker";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-5 py-14 sm:py-20">
      <header className="mb-10">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-zinc-400">
          <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
          WebMCP · W3C Web Machine Learning CG
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
          WebMCP Check
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-zinc-400">
          Enter a domain and find out whether an AI agent&apos;s browser would discover{" "}
          <strong className="text-zinc-200">WebMCP tools</strong> on it. We load the page the way a model
          would — running its JavaScript and recording what it registers on{" "}
          <code className="rounded bg-black/40 px-1 py-0.5 text-sm text-indigo-300">navigator.modelContext</code>{" "}
          — then validate each tool against the WebMCP specification.
        </p>
      </header>

      <Checker />

      <section className="mt-16 grid gap-6 sm:grid-cols-3">
        <Card title="Imperative API" badge="runtime">
          Detects tools registered via{" "}
          <code className="text-indigo-300">document.modelContext.registerTool()</code> (and the legacy{" "}
          <code className="text-indigo-300">provideContext()</code>). We supply the WebMCP API in a headless
          browser and capture every registration as it happens.
        </Card>
        <Card title="Declarative API" badge="static + runtime">
          Synthesizes tools from <code className="text-indigo-300">&lt;form toolname&gt;</code> markup with{" "}
          <code className="text-indigo-300">tooldescription</code> and{" "}
          <code className="text-indigo-300">toolparamdescription</code> attributes, exactly as a conforming
          browser would.
        </Card>
        <Card title="Spec validation" badge="ModelContextTool">
          Every tool is checked against the WebMCP contract: <code className="text-indigo-300">name</code>{" "}
          charset/length, required <code className="text-indigo-300">description</code>,{" "}
          <code className="text-indigo-300">inputSchema</code> shape, and{" "}
          <code className="text-indigo-300">annotations</code>.
        </Card>
      </section>

      <section className="mt-12 rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-sm leading-relaxed text-zinc-400">
        <h2 className="mb-2 text-base font-semibold text-zinc-200">How this mirrors the spec</h2>
        <p>
          WebMCP exposes tools through a browser API rather than a wire protocol. There is currently{" "}
          <em>no</em> way for an agent to learn a site&apos;s tools without visiting it — discovery happens by
          loading the page and reading <code className="text-indigo-300">modelContext</code>. This checker does
          the same: it runs the page, provides the API surface a WebMCP-capable browser would, and reports the
          tools the page registers. It also probes the proposed{" "}
          <code className="text-indigo-300">/.well-known/webmcp</code> manifest as a best-effort signal.
        </p>
        <p className="mt-3 text-zinc-500">
          References:{" "}
          <a className="text-indigo-400 hover:underline" href="https://webmachinelearning.github.io/webmcp/" target="_blank" rel="noreferrer">
            W3C WebMCP draft
          </a>
          {" · "}
          <a className="text-indigo-400 hover:underline" href="https://developer.chrome.com/docs/ai/webmcp" target="_blank" rel="noreferrer">
            Chrome WebMCP docs
          </a>
        </p>
      </section>

      <footer className="mt-12 border-t border-white/10 pt-6 text-xs text-zinc-600">
        Built by{" "}
        <a className="text-zinc-400 hover:text-white" href="https://github.com/lukeocodes" target="_blank" rel="noreferrer">
          lukeocodes
        </a>
        . Not affiliated with the W3C. WebMCP is an evolving draft — results are a best-effort reflection of the
        current spec.
      </footer>
    </main>
  );
}

function Card({ title, badge, children }: { title: string; badge: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-semibold text-zinc-100">{title}</h3>
        <span className="rounded border border-white/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-zinc-500">
          {badge}
        </span>
      </div>
      <p className="text-sm leading-relaxed text-zinc-400">{children}</p>
    </div>
  );
}
