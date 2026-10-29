/**
 * HKM-054 (تشخيص فقط) — سجل طلبات /mcp: البدء والانتهاء والمدة، وطريقة JSON-RPC واسم الأداة ومعرّف الجلسة.
 *
 * السبب: أخطاء مهلة الـ300 ثانية على Vercel كلها POST /mcp، وسقف MCP_TOOL_TIMEOUT_MS (tool-runner.ts) يحيط بدالة
 * الأداة وحدها؛ فالتعليق في موضع آخر (المصادقة، أو فحوص ما قبل الأداة وتسويتها بعدها، أو بثّ الاستجابة).
 * يُسجَّل المرحلة التي تعلّق فيها الطلب: handler (لم تُرجع الاستجابة بعد) أو stream (رجعت ولم يكتمل جسمها).
 * لا يغيّر السلوك: الجسم يمرّ كما هو، ولا تُسجَّل مدخلات الأداة ولا نتيجتها (نص السؤال قد يحوي بيانات شخصية).
 */

/** ما زاد عن هذا متأخر (ms). */
export const MCP_SLOW_MS = 60_000;

export interface McpRequestInfo {
  method: string;
  rpc: string | null;
  tool: string | null;
  session: string | null;
}

export type McpDurationClass = "ok" | "slow";

export function classifyMcpDuration(ms: number, slowMs = MCP_SLOW_MS): McpDurationClass {
  return Number.isFinite(ms) && ms > slowMs ? "slow" : "ok";
}

const clean = (v: unknown, max = 64): string | null => {
  if (typeof v !== "string") return null;
  const s = v.replace(/[^\w.:/-]/g, "").slice(0, max);
  return s || null;
};

/** طريقة JSON-RPC واسم الأداة من الجسم (طلب مفرد أو دفعة)، بلا المعاملات. نقية. */
export function describeMcpRequest(method: string, sessionHeader: string | null, body: unknown): McpRequestInfo {
  const msgs = (Array.isArray(body) ? body : body && typeof body === "object" ? [body] : []) as Array<Record<string, unknown>>;
  const rpcs = msgs.map((m) => clean(m?.method)).filter((x): x is string => x !== null);
  const tools = msgs
    .filter((m) => m?.method === "tools/call")
    .map((m) => clean((m.params as { name?: unknown } | undefined)?.name))
    .filter((x): x is string => x !== null);
  return {
    method,
    rpc: rpcs.length ? rpcs.join(",") : null,
    tool: tools.length ? tools.join(",") : null,
    session: clean(sessionHeader, 16),
  };
}

export function formatMcpLog(phase: "start" | "end" | "slow", id: string, info: McpRequestInfo, extra: Record<string, string | number> = {}): string {
  const fields: Record<string, string | number> = {
    phase,
    id,
    method: info.method,
    rpc: info.rpc ?? "-",
    tool: info.tool ?? "-",
    session: info.session ?? "-",
    ...extra,
  };
  return `[mcp-req] ${Object.entries(fields).map(([k, v]) => `${k}=${v}`).join(" ")}`;
}

export interface RequestLogDeps {
  now(): number;
  log(line: string): void;
  warn(line: string): void;
  setTimer(fn: () => void, ms: number): unknown;
  clearTimer(t: unknown): void;
  newId(): string;
  slowMs: number;
}

const defaultDeps = (): RequestLogDeps => ({
  now: () => Date.now(),
  log: (l) => console.log(l),
  warn: (l) => console.warn(l),
  setTimer: (fn, ms) => {
    const t = setTimeout(fn, ms);
    (t as { unref?: () => void }).unref?.();
    return t;
  },
  clearTimer: (t) => clearTimeout(t as ReturnType<typeof setTimeout>),
  newId: () => Math.random().toString(36).slice(2, 10),
  slowMs: MCP_SLOW_MS,
});

/** HKM-059: سقف قراءة الجسم للسجل. المسار يُلفّ قبل المصادقة، فلا يُقرأ ما فوق هذا (يُتجاهل دون فشل الطلب). */
export const MCP_LOG_BODY_MAX_BYTES = 64 * 1024;

/**
 * يقرأ نسخة من الجسم بسقف حجم: يُهمل فورًا إن أعلن Content-Length أكبر من السقف، ويُقطع القارئ عند تجاوز السقف
 * في الجسم غير المعلن الطول. الطلب الأصلي لا يُمسّ (clone)، ويرجع null عند التجاوز أو الفساد.
 */
export async function readCappedJson(req: Request, maxBytes = MCP_LOG_BODY_MAX_BYTES): Promise<unknown> {
  const declared = Number(req.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) return null;
  const copy = req.clone();
  if (!copy.body) return null;
  const reader = copy.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        // بلا await: إلغاء فرع من tee لا يكتمل حتى يُلغى الفرع الآخر (جسم الطلب الأصلي) فيعلّق الطلب.
        void reader.cancel().catch(() => undefined);
        return null;
      }
      chunks.push(value);
    }
  } catch {
    return null;
  }
  const buf = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    buf.set(c, off);
    off += c.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder().decode(buf));
  } catch {
    return null;
  }
}

async function readInfo(req: Request): Promise<McpRequestInfo> {
  const session = req.headers.get("mcp-session-id");
  const isJson = req.method === "POST" && (req.headers.get("content-type") || "").includes("application/json");
  const body = isJson ? await readCappedJson(req) : null;
  return describeMcpRequest(req.method, session, body);
}

/**
 * يلفّ معالج /mcp: سطر عند البدء، وسطر «slow» إن جاوز الطلب الحد وهو لم ينتهِ (مع مرحلته)، وسطر عند الانتهاء
 * بالحالة والمدة والتصنيف. نهاية الطلب = اكتمال جسم الاستجابة (البثّ SSE) أو إلغاؤه، لا رجوع الدالة.
 */
export function withMcpRequestLog(handler: (req: Request) => Promise<Response>, overrides: Partial<RequestLogDeps> = {}) {
  return async (req: Request): Promise<Response> => {
    const deps = { ...defaultDeps(), ...overrides };
    const started = deps.now();
    const id = deps.newId();
    const info = await readInfo(req).catch((): McpRequestInfo => ({ method: req.method, rpc: null, tool: null, session: null }));
    deps.log(formatMcpLog("start", id, info));
    let stage: "handler" | "stream" = "handler";
    let done = false;
    const watchdog = deps.setTimer(() => {
      if (!done) deps.warn(formatMcpLog("slow", id, info, { ms: deps.now() - started, stage, class: "slow" }));
    }, deps.slowMs);
    const finish = (status: number | string, outcome: string) => {
      if (done) return;
      done = true;
      deps.clearTimer(watchdog);
      const ms = deps.now() - started;
      const cls = classifyMcpDuration(ms, deps.slowMs);
      (cls === "slow" ? deps.warn : deps.log)(formatMcpLog("end", id, info, { status, ms, class: cls, stage, outcome }));
    };

    let res: Response;
    try {
      res = await handler(req);
    } catch (e) {
      finish("throw", "error");
      throw e;
    }
    if (!res.body) {
      finish(res.status, "complete");
      return res;
    }
    stage = "stream";
    const reader = res.body.getReader();
    const body = new ReadableStream<Uint8Array>({
      async pull(controller) {
        try {
          const { done: end, value } = await reader.read();
          if (end) {
            controller.close();
            finish(res.status, "complete");
            return;
          }
          controller.enqueue(value);
        } catch (e) {
          finish(res.status, "error");
          controller.error(e);
        }
      },
      cancel(reason) {
        finish(res.status, "cancel");
        return reader.cancel(reason);
      },
    });
    return new Response(body, { status: res.status, statusText: res.statusText, headers: res.headers });
  };
}
