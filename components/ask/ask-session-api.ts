/** عميل HTTP لجلسات «اسأل حكيم» — service=ask فقط. بلا منطق ذكاء. */

export type AskSessionListItem = {
  id: string;
  title: string;
  preview: string | null;
  updatedAt: string;
  mode: string;
  messageCount: number;
};

export type AskSessionMessage = {
  id: string;
  role: string;
  content: string;
  sequence: number;
  status: string;
  mode: string | null;
  attachments: unknown;
  retrievedSources: unknown;
  outputSnapshot: unknown;
  inputSnapshot: unknown;
  warnings: unknown;
  createdAt: string;
};

export type AskSessionContext = {
  conversationId: string;
  serviceKey: string;
  mode: string;
  title: string;
  status: string;
  state: unknown;
  messages: AskSessionMessage[];
};

async function parseJson(res: Response): Promise<Record<string, unknown>> {
  try {
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export async function listAskSessions(opts?: {
  take?: number;
}): Promise<{ ok: boolean; items: AskSessionListItem[]; message?: string }> {
  const take = opts?.take ?? 40;
  const res = await fetch(`/api/conversations?service=ask&take=${take}`, {
    method: "GET",
    credentials: "same-origin",
  });
  const data = await parseJson(res);
  if (!res.ok || data.ok === false) {
    return { ok: false, items: [], message: String(data.message ?? "تعذّر جلب الجلسات.") };
  }
  return { ok: true, items: (data.items as AskSessionListItem[]) ?? [] };
}

export async function getAskSession(
  conversationId: string
): Promise<{ ok: boolean; context?: AskSessionContext; message?: string; code?: string }> {
  const res = await fetch(`/api/conversations/${encodeURIComponent(conversationId)}?service=ask`, {
    method: "GET",
    credentials: "same-origin",
  });
  const data = await parseJson(res);
  if (!res.ok || data.ok === false) {
    return {
      ok: false,
      message: String(data.message ?? "تعذّر استعادة الجلسة."),
      code: typeof data.code === "string" ? data.code : undefined,
    };
  }
  return { ok: true, context: data.context as AskSessionContext };
}

export async function createAskSessionWithFirstMessage(input: {
  content: string;
  mode: string;
  clientRequestId: string;
  detailed?: boolean;
  sources?: string[];
  sourcePolicy?: Record<string, unknown>;
  attachments?: Array<{
    id: string;
    fileName: string;
    mimeType?: string;
    extractedText?: string;
    processingStatus?: "inline" | "pending" | "ready" | "failed";
  }>;
}): Promise<{ ok: boolean; conversationId?: string; messageId?: string; message?: string }> {
  const res = await fetch("/api/conversations", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      service: "ask",
      content: input.content,
      role: "user",
      mode: input.mode,
      clientRequestId: input.clientRequestId,
      status: "completed",
      attachments: input.attachments,
      inputSnapshot: {
        detailed: Boolean(input.detailed),
        mode: input.mode,
        sources: input.sources,
        sourcePolicy: input.sourcePolicy,
      },
      statePatch: {
        detailed: Boolean(input.detailed),
        contextVersion: 1,
        sources: input.sources,
        sourcePolicy: input.sourcePolicy,
      },
    }),
  });
  const data = await parseJson(res);
  if (!res.ok || data.ok === false) {
    return { ok: false, message: String(data.message ?? "تعذّر حفظ الجلسة.") };
  }
  return {
    ok: true,
    conversationId: String(data.conversationId ?? ""),
    messageId: typeof data.messageId === "string" ? data.messageId : undefined,
  };
}

export async function appendAskMessage(input: {
  conversationId: string;
  content: string;
  role: "user" | "assistant";
  mode: string;
  clientRequestId: string;
  retrievedSources?: unknown[];
  outputSnapshot?: unknown;
  inputSnapshot?: unknown;
  attachments?: unknown[];
  status?: "pending" | "streaming" | "completed" | "failed" | "cancelled";
}): Promise<{ ok: boolean; messageId?: string; deduped?: boolean; message?: string }> {
  const res = await fetch(
    `/api/conversations/${encodeURIComponent(input.conversationId)}/messages`,
    {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        service: "ask",
        content: input.content,
        role: input.role,
        mode: input.mode,
        clientRequestId: input.clientRequestId,
        status: input.status ?? "completed",
        retrievedSources: input.retrievedSources,
        outputSnapshot: input.outputSnapshot,
        inputSnapshot: input.inputSnapshot,
        attachments: input.attachments,
      }),
    }
  );
  const data = await parseJson(res);
  if (!res.ok || data.ok === false) {
    return { ok: false, message: String(data.message ?? "تعذّر حفظ الرسالة.") };
  }
  return {
    ok: true,
    messageId: typeof data.messageId === "string" ? data.messageId : undefined,
    deduped: Boolean(data.deduped),
  };
}

/** يحفظ زوج سؤال/جواب بعد اكتمال agent-search دون تغيير منطق الذكاء. */
export async function persistAskTurn(input: {
  conversationId: string | null;
  question: string;
  answer: string | null;
  mode: string;
  detailed: boolean;
  sources?: string[];
  sourcePolicy?: Record<string, unknown>;
  basis?: unknown[];
  outputSnapshot?: Record<string, unknown>;
  attachments?: Array<{
    id: string;
    fileName: string;
    mimeType?: string;
    size?: number;
    extractedText?: string;
    storageKey?: string;
    processingStatus?: "inline" | "pending" | "ready" | "failed";
  }>;
  turnKey: string;
}): Promise<{ conversationId: string | null; error?: string }> {
  let conversationId = input.conversationId;
  const inputSnapshot = {
    detailed: input.detailed,
    mode: input.mode,
    sources: input.sources,
    sourcePolicy: input.sourcePolicy,
  };

  if (!conversationId) {
    const created = await createAskSessionWithFirstMessage({
      content: input.question,
      mode: input.mode,
      clientRequestId: `${input.turnKey}-user`,
      detailed: input.detailed,
      attachments: input.attachments,
      sourcePolicy: input.sourcePolicy,
      sources: input.sources,
    });
    if (!created.ok || !created.conversationId) {
      return { conversationId: null, error: created.message ?? "فشل إنشاء الجلسة" };
    }
    conversationId = created.conversationId;
  } else {
    const userMsg = await appendAskMessage({
      conversationId,
      content: input.question,
      role: "user",
      mode: input.mode,
      clientRequestId: `${input.turnKey}-user`,
      attachments: input.attachments,
      inputSnapshot,
    });
    if (!userMsg.ok) {
      return { conversationId, error: userMsg.message };
    }
  }

  if (input.answer && input.answer.trim()) {
    const sources = Array.isArray(input.basis)
      ? input.basis.map((b) => {
          const item = b as {
            systemName?: string;
            articleNumber?: string | number;
            quote?: string;
            internalUrl?: string;
            articleTitle?: string;
            state?: string;
          };
          return {
            kind: "article" as const,
            systemName: item.systemName,
            articleNumber: item.articleNumber,
            title: item.articleTitle,
            quote: item.quote,
            url: item.internalUrl,
            id: item.internalUrl,
          };
        })
      : undefined;

    const assistantMsg = await appendAskMessage({
      conversationId,
      content: input.answer,
      role: "assistant",
      mode: input.mode,
      clientRequestId: `${input.turnKey}-assistant`,
      retrievedSources: sources,
      outputSnapshot: {
        ...(input.outputSnapshot ?? {}),
        detailed: input.detailed,
        mode: input.mode,
      },
    });
    if (!assistantMsg.ok) {
      return { conversationId, error: assistantMsg.message };
    }
  }

  return { conversationId };
}
