/**
 * HKM-054: سجل طلبات /mcp — البدء والانتهاء والمدة والأداة والجلسة، وتصنيف ما جاوز 60 ثانية ومرحلته،
 * وأن الاستجابة تمرّ كما هي (الحالة والرؤوس والجسم). ساعة ومؤقتات وهمية؛ لا شبكة ولا قاعدة.
 * التشغيل: npx tsx scripts/test-mcp-request-log.ts
 */
import { classifyMcpDuration, describeMcpRequest, MCP_SLOW_MS, withMcpRequestLog, type RequestLogDeps } from "../lib/mcp/request-log";

let failed = 0;
const ok = (c: boolean, m: string) => {
  if (!c) {
    failed += 1;
    console.error("✗ " + m);
  } else console.log("✓ " + m);
};

function harness() {
  let clock = 1_000;
  const lines: string[] = [];
  const timers: Array<{ fn: () => void; at: number; cleared: boolean }> = [];
  const deps: Partial<RequestLogDeps> = {
    now: () => clock,
    log: (l) => lines.push(l),
    warn: (l) => lines.push("WARN " + l),
    setTimer: (fn, ms) => {
      const t = { fn, at: clock + ms, cleared: false };
      timers.push(t);
      return t;
    },
    clearTimer: (t) => {
      (t as { cleared: boolean }).cleared = true;
    },
    newId: () => "r1",
  };
  const advance = (ms: number) => {
    clock += ms;
    for (const t of timers) if (!t.cleared && t.at <= clock) {
      t.cleared = true;
      t.fn();
    }
  };
  return { deps, lines, advance };
}

const call = (body: unknown, session = "sess-abc") =>
  new Request("https://hakeemai.net/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", "mcp-session-id": session },
    body: JSON.stringify(body),
  });

async function main() {
  // ① الوصف: الطريقة والأداة والجلسة، بلا المعاملات.
  const d1 = describeMcpRequest("POST", "sess-abc", { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "hakeem_search", arguments: { query: "محمد بن علي" } } });
  ok(d1.rpc === "tools/call" && d1.tool === "hakeem_search" && d1.session === "sess-abc", "الطريقة والأداة والجلسة من الطلب");
  ok(!JSON.stringify(d1).includes("محمد"), "مدخلات الأداة لا تُسجَّل");
  const batch = describeMcpRequest("POST", null, [{ method: "tools/call", params: { name: "hakeem_get_article" } }, { method: "ping" }]);
  ok(batch.rpc === "tools/call,ping" && batch.tool === "hakeem_get_article" && batch.session === null, "الدفعة: كل الطرق وأسماء الأدوات");
  ok(describeMcpRequest("GET", null, null).rpc === null, "GET بلا جسم");
  ok(describeMcpRequest("POST", "x y\n<z>", { method: "tools/call", params: { name: "a b;c" } }).tool === "abc", "القيم تُنظَّف قبل السجل (لا حقن أسطر)");

  // ② التصنيف.
  ok(classifyMcpDuration(MCP_SLOW_MS) === "ok" && classifyMcpDuration(MCP_SLOW_MS + 1) === "slow", "ما جاوز 60 ثانية متأخر");

  // ③ طلب سريع: سطر بدء وسطر انتهاء، والاستجابة كما هي.
  {
    const h = harness();
    const handler = withMcpRequestLog(async () => new Response("event: message\ndata: {}\n\n", { status: 200, headers: { "Content-Type": "text/event-stream", "x-k": "v" } }), h.deps);
    const res = await handler(call({ method: "tools/call", params: { name: "hakeem_search" } }));
    h.advance(1200);
    const text = await res.text();
    ok(res.status === 200 && res.headers.get("x-k") === "v" && res.headers.get("content-type") === "text/event-stream" && text === "event: message\ndata: {}\n\n", "الاستجابة تمرّ كما هي (الحالة والرؤوس والجسم)");
    ok(h.lines[0].includes("phase=start") && h.lines[0].includes("tool=hakeem_search") && h.lines[0].includes("session=sess-abc"), "سطر البدء بالأداة والجلسة");
    const end = h.lines.find((l) => l.includes("phase=end")) ?? "";
    ok(end.includes("status=200") && end.includes("ms=1200") && end.includes("class=ok") && end.includes("outcome=complete") && !end.startsWith("WARN"), "سطر الانتهاء بالحالة والمدة والتصنيف");
  }

  // ④ معالج معلّق: سطر slow عند 60 ثانية بمرحلة handler.
  {
    const h = harness();
    let release: (r: Response) => void = () => undefined;
    const handler = withMcpRequestLog(() => new Promise<Response>((r) => (release = r)), h.deps);
    const pending = handler(call({ method: "tools/call", params: { name: "hakeem_research" } }));
    await new Promise((r) => setTimeout(r, 0));
    h.advance(MCP_SLOW_MS + 5);
    const slow = h.lines.find((l) => l.includes("phase=slow")) ?? "";
    ok(slow.startsWith("WARN") && slow.includes("stage=handler") && slow.includes("tool=hakeem_research"), "المعلّق قبل الاستجابة يُصنَّف متأخرًا بمرحلة handler");
    release(new Response(null, { status: 204 }));
    await pending;
    const end = h.lines.find((l) => l.includes("phase=end")) ?? "";
    ok(end.startsWith("WARN") && end.includes("class=slow") && end.includes("status=204"), "انتهاؤه متأخرًا يُسجَّل تحذيرًا");
  }

  // ⑤ بثّ لا يكتمل: المرحلة stream، والإلغاء يُسجَّل.
  {
    const h = harness();
    const stream = new ReadableStream<Uint8Array>({ start(c) { c.enqueue(new TextEncoder().encode("event: message\n")); } });
    const handler = withMcpRequestLog(async () => new Response(stream, { status: 200 }), h.deps);
    const res = await handler(call({ method: "tools/call", params: { name: "hakeem_search" } }));
    const reader = res.body!.getReader();
    await reader.read();
    h.advance(MCP_SLOW_MS + 1);
    ok((h.lines.find((l) => l.includes("phase=slow")) ?? "").includes("stage=stream"), "رجعت الاستجابة ولم يكتمل جسمها: مرحلة stream");
    await reader.cancel();
    ok((h.lines.find((l) => l.includes("phase=end")) ?? "").includes("outcome=cancel"), "إلغاء العميل للبثّ يُسجَّل");
  }

  // ⑥ استثناء المعالج يُسجَّل ويُعاد رميه كما هو.
  {
    const h = harness();
    const handler = withMcpRequestLog(async () => {
      throw new Error("boom");
    }, h.deps);
    const err = await handler(call({ method: "initialize" })).catch((e: Error) => e);
    ok(err instanceof Error && err.message === "boom" && (h.lines.find((l) => l.includes("phase=end")) ?? "").includes("outcome=error"), "الاستثناء يُسجَّل ويُعاد رميه");
  }

  if (failed) {
    console.error(`\n${failed} فشل`);
    process.exit(1);
  }
  console.log("\nكل اختبارات HKM-054 نجحت");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
