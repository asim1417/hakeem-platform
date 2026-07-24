/**
 * عميل مشترك لـ POST /api/ai/agent-search — مصدر التنفيذ الوحيد لـ«اسأل حكيم».
 * لا يكرّر منطق RAG؛ يقرأ بث NDJSON فقط.
 */
import type { AskStreamEvent } from "@/lib/modules/ask/types";

export type RunAgentSearchInput = {
  query: string;
  mode?: string;
  detailed?: boolean;
  skipBreadth?: boolean;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
  signal?: AbortSignal;
  onEvent: (evt: AskStreamEvent) => void;
};

export type RunAgentSearchResult =
  | { ok: true }
  | { ok: false; kind: "auth" | "http" | "network" | "aborted"; message: string };

export async function runAgentSearch(
  input: RunAgentSearchInput
): Promise<RunAgentSearchResult> {
  let res: Response;
  try {
    res = await fetch("/api/ai/agent-search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: input.query,
        detailed: input.detailed ?? false,
        skipBreadth: input.skipBreadth ?? false,
        mode: input.mode ?? "ask",
        history: input.history,
      }),
      signal: input.signal,
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      return { ok: false, kind: "aborted", message: "أُلغي الطلب." };
    }
    return {
      ok: false,
      kind: "network",
      message: "انقطع الاتصال أثناء إعداد الإجابة. تحقق من الشبكة ثم أعد المحاولة.",
    };
  }

  if (res.status === 401) {
    return {
      ok: false,
      kind: "auth",
      message: "انتهت جلستك. سجّل الدخول للمتابعة دون فقد سؤالك.",
    };
  }

  if (!res.ok || !res.body) {
    let msg = "تعذّر إكمال الإجابة الآن. بقي سؤالك محفوظًا ويمكنك إعادة المحاولة.";
    try {
      const j = (await res.json()) as { message?: string };
      if (typeof j?.message === "string" && j.message.trim()) msg = j.message.trim();
    } catch {
      /* تجاهل */
    }
    return { ok: false, kind: "http", message: msg };
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        let evt: AskStreamEvent;
        try {
          evt = JSON.parse(line) as AskStreamEvent;
        } catch {
          continue;
        }
        input.onEvent(evt);
      }
    }
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      return { ok: false, kind: "aborted", message: "أُلغي الطلب." };
    }
    return {
      ok: false,
      kind: "network",
      message: "انقطع الاتصال أثناء إعداد الإجابة. تحقق من الشبكة ثم أعد المحاولة.",
    };
  }

  return { ok: true };
}

/** يطبّق حدث بث على دور — منطق مشترك مع لوحة اسأل حكيم. */
export function applyAskEventToTurn<T extends {
  steps: Array<{ id: string; status: "running" | "done"; label: string; data?: unknown }>;
  answer: string | null;
  mode?: string;
  basis: unknown;
  total: number;
  coverage?: unknown;
  clarify?: unknown;
  groups?: unknown;
  disclosure?: string;
  visibleGroups?: number;
  message?: string;
  error?: string;
  precedents?: unknown;
  streaming: boolean;
  showMethod: boolean;
}>(turn: T, evt: AskStreamEvent): T {
  if (evt.type === "step") {
    const steps = turn.steps.slice();
    const idx = steps.findIndex((s) => s.id === evt.id);
    const step = {
      id: evt.id,
      status: evt.status,
      label: evt.label,
      data: evt.data,
    };
    if (idx >= 0) steps[idx] = step;
    else steps.push(step);
    return { ...turn, steps };
  }
  if (evt.type === "result") {
    return {
      ...turn,
      answer: typeof evt.answer === "string" ? evt.answer : null,
      mode: evt.mode,
      basis: (evt.basis ?? []) as T["basis"],
      total: evt.total ?? 0,
      coverage: evt.coverage as T["coverage"],
      groups: Array.isArray(evt.groups) ? evt.groups : undefined,
      disclosure: typeof evt.disclosure === "string" ? evt.disclosure : undefined,
      visibleGroups: Array.isArray(evt.groups) ? 3 : undefined,
      message: evt.message,
      precedents:
        evt.precedents &&
        (evt.precedents.rulings?.length || evt.precedents.principles?.length)
          ? evt.precedents
          : undefined,
    };
  }
  if (evt.type === "clarify") {
    return {
      ...turn,
      clarify: {
        message: evt.message,
        dimension: evt.dimension,
        options: evt.options ?? [],
      },
    };
  }
  if (evt.type === "error") {
    return { ...turn, error: evt.message ?? "تعذّر إكمال الإجابة الآن." };
  }
  if (evt.type === "done") {
    return { ...turn, streaming: false, showMethod: false };
  }
  return turn;
}
