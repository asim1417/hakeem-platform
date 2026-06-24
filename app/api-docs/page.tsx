import Link from "next/link";
import { openApiSpec } from "@/lib/openapi/spec";

export const metadata = {
  title: "توثيق الواجهات البرمجية — منصة حكيم",
  description: "توثيق OpenAPI لواجهات حكيم البرمجية: البحث، المبادئ، تراث، والمعرّف التشريعي.",
};

const METHOD_TONE: Record<string, string> = {
  get: "var(--emerald)",
  post: "var(--navy)",
  patch: "var(--amber)",
  put: "var(--amber)",
  delete: "var(--ruby)",
};

type Operation = {
  tags?: string[];
  summary?: string;
  description?: string;
  parameters?: Array<{ name: string; in: string; required?: boolean; description?: string; schema?: Record<string, unknown> }>;
  responses?: Record<string, { description?: string }>;
};

// صفحة توثيق ذاتية (بلا اعتماد خارجي) مبنية من مواصفة OpenAPI.
export default function ApiDocsPage() {
  const spec = openApiSpec;
  const paths = spec.paths as unknown as Record<string, Record<string, Operation>>;

  // تجميع العمليات حسب الوسم.
  const byTag = new Map<string, Array<{ path: string; method: string; op: Operation }>>();
  for (const [path, methods] of Object.entries(paths)) {
    for (const [method, op] of Object.entries(methods)) {
      const tag = op.tags?.[0] ?? "أخرى";
      if (!byTag.has(tag)) byTag.set(tag, []);
      byTag.get(tag)!.push({ path, method, op });
    }
  }

  return (
    <main dir="rtl" className="min-h-screen bg-[var(--hakeem-bg)] px-6 py-12">
      <div className="mx-auto max-w-4xl">
        <header className="rounded-[var(--r-2xl)] border border-[var(--ink-08)] bg-[var(--paper)] p-8 shadow-[var(--sh-md)]">
          <p className="text-sm font-semibold text-[var(--gold-dark)]">منصة حكيم</p>
          <h1 className="t-head mt-2 text-3xl font-bold text-[var(--navy)]">{spec.info.title}</h1>
          <p className="mt-3 leading-8 text-[var(--ink-60)]">{spec.info.description}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-full bg-[var(--gold-ghost)] px-3 py-1 text-xs font-semibold text-[var(--gold-dark)]">OpenAPI {spec.openapi}</span>
            <span className="rounded-full bg-[var(--gold-ghost)] px-3 py-1 text-xs font-semibold text-[var(--gold-dark)]">الإصدار {spec.info.version}</span>
            <a href="/api/openapi" className="btn btn-outline" target="_blank" rel="noreferrer">المواصفة الخام (JSON)</a>
            <Link href="/dashboard" className="btn btn-gold">العودة إلى المنصّة</Link>
          </div>
          <p className="mt-4 rounded-[var(--r-md)] border border-[var(--gold-border)] bg-[var(--gold-ghost)] p-3 text-xs leading-6 text-[var(--navy)]">
            {spec.info["x-notice"]}
          </p>
        </header>

        <div className="mt-8 space-y-8">
          {[...byTag.entries()].map(([tag, ops]) => (
            <section key={tag}>
              <h2 className="t-display mb-3 text-xl font-bold text-[var(--navy)]">{tag}</h2>
              <div className="space-y-3">
                {ops.map(({ path, method, op }) => (
                  <article key={`${method}:${path}`} className="rounded-[var(--r-xl)] border border-[var(--ink-08)] bg-[var(--paper)] p-5 shadow-[var(--sh-xs)]">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded px-2 py-0.5 text-xs font-bold uppercase text-white" style={{ background: METHOD_TONE[method] ?? "var(--ink-60)" }}>
                        {method}
                      </span>
                      <code className="font-mono-legal text-sm text-[var(--navy)]" dir="ltr">{path}</code>
                    </div>
                    {op.summary ? <p className="mt-2 font-display-ar text-sm font-bold text-[var(--navy)]">{op.summary}</p> : null}
                    {op.description ? <p className="mt-1 text-sm leading-7 text-[var(--ink-60)]">{op.description}</p> : null}

                    {op.parameters && op.parameters.length > 0 ? (
                      <div className="mt-3">
                        <p className="text-xs font-semibold text-[var(--ink-60)]">المعاملات</p>
                        <ul className="mt-1 space-y-1">
                          {op.parameters.map((p) => (
                            <li key={p.name} className="text-xs leading-6 text-[var(--ink-80)]">
                              <code className="font-mono-legal text-[var(--gold-dark)]" dir="ltr">{p.name}</code>
                              <span className="text-[var(--ink-40)]"> ({p.in}{p.required ? "، إلزامي" : ""})</span>
                              {p.description ? ` — ${p.description}` : ""}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}

                    {op.responses ? (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {Object.entries(op.responses).map(([code, r]) => (
                          <span key={code} className="rounded bg-[var(--ink-04)] px-2 py-0.5 text-[11px] text-[var(--ink-60)]">
                            <span className="font-mono-legal font-bold" dir="ltr">{code}</span> {r.description ?? ""}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
