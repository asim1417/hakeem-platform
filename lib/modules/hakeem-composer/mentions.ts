import type { ComposerAttachment, ComposerContextItem, ComposerMention } from "./types";

export type MentionMenuState = {
  open: boolean;
  query: string;
  startIndex: number;
  activeIndex: number;
};

export function detectMentionTrigger(text: string, caret: number): MentionMenuState | null {
  const before = text.slice(0, caret);
  const match = before.match(/(?:^|\s)(@[^\s@]*)$/);
  if (!match) return null;
  const token = match[1] ?? "";
  const startIndex = before.length - token.length;
  return {
    open: true,
    query: token.slice(1),
    startIndex,
    activeIndex: 0,
  };
}

export function buildMentionCatalog(input: {
  attachments?: ComposerAttachment[];
  contextItems?: ComposerContextItem[];
  includeDefaults?: boolean;
}): ComposerMention[] {
  const items: ComposerMention[] = [];
  if (input.includeDefaults !== false) {
    items.push(
      {
        id: "sys-civil",
        label: "نظام المعاملات المدنية",
        insertText: "@نظام_المعاملات_المدنية",
        group: "systems",
        description: "تضييق البحث على نظام المعاملات المدنية",
      },
      {
        id: "sys-evidence",
        label: "نظام الإثبات",
        insertText: "@نظام_الإثبات",
        group: "systems",
        description: "تضييق البحث على نظام الإثبات",
      },
      {
        id: "src-core",
        label: "مكتبة حكيم",
        insertText: "@مكتبة_حكيم",
        group: "sources",
        description: "البحث في النواة القانونية",
      },
      {
        id: "src-attached",
        label: "المستندات المرفقة",
        insertText: "@المستندات_المرفقة",
        group: "sources",
        description: "الاعتماد على المرفقات",
      }
    );
  }
  for (const att of input.attachments ?? []) {
    if (att.status !== "ready") continue;
    items.push({
      id: `att-${att.id}`,
      label: att.name,
      insertText: `@${att.name.replace(/\s+/g, "_")}`,
      group: "attachments",
      description: "المستند المرفق في الصندوق",
    });
  }
  for (const ctx of input.contextItems ?? []) {
    items.push({
      id: `ctx-${ctx.id}`,
      label: ctx.label,
      insertText: `@${ctx.label.replace(/\s+/g, "_")}`,
      group: ctx.type === "system" ? "systems" : ctx.type === "session" ? "sessions" : "tools",
      description: "سياق نشط",
    });
  }
  return items;
}

export function filterMentions(items: ComposerMention[], query: string): ComposerMention[] {
  const q = (query || "").trim().toLowerCase();
  if (!q) return items;
  return items.filter((m) => {
    const hay = `${m.label} ${m.insertText} ${m.description ?? ""}`.toLowerCase();
    return hay.includes(q);
  });
}

export function applyMention(
  text: string,
  caret: number,
  mention: ComposerMention
): { text: string; caret: number } {
  const state = detectMentionTrigger(text, caret);
  if (!state) {
    const insert = `${mention.insertText} `;
    return { text: `${text}${insert}`, caret: text.length + insert.length };
  }
  const before = text.slice(0, state.startIndex);
  const after = text.slice(caret);
  const insert = `${mention.insertText} `;
  const next = `${before}${insert}${after}`;
  return { text: next, caret: before.length + insert.length };
}
