import type { LegislativeEffect, RasdLegislativeEffectType } from "../types";

const EFFECT_PATTERNS: Array<{ type: RasdLegislativeEffectType; pattern: RegExp }> = [
  { type: "AMENDS", pattern: /(?:تعدل|يعدل|تُعدل|عدلت|تعديل)\s+([^.\n،]{0,120})/gu },
  { type: "REPLACES", pattern: /(?:يستبدل|تستبدل|يحل\s+محل|حل\s+محل)\s+([^.\n،]{0,120})/gu },
  { type: "ADDS", pattern: /(?:تضاف|يضاف|إضافة|اضافة)\s+([^.\n،]{0,120})/gu },
  { type: "REPEALS", pattern: /(?:تلغى|يلغى|إلغاء|الغاء|ملغى|يلغي)\s+([^.\n،]{0,120})/gu },
  { type: "SUPERSEDES", pattern: /(?:يحل\s+هذا\s+النظام\s+محل|يحل\s+محل)\s+([^.\n،]{0,120})/gu },
  { type: "COMMENCES", pattern: /(?:يعمل\s+به|العمل\s+به|يسري|سريان)\s+([^.\n،]{0,120})/gu },
  { type: "PUBLISHES", pattern: /(?:ينشر|ينشر\s+في\s+الجريدة\s+الرسمية|نشره)\s+([^.\n،]{0,120})/gu },
  { type: "POSTPONES", pattern: /(?:يؤجل|تؤجل|تأجيل|ارجاء|إرجاء)\s+([^.\n،]{0,120})/gu },
  { type: "EXTENDS", pattern: /(?:تمدد|يمدد|تمديد)\s+([^.\n،]{0,120})/gu }
];

function extractArticleRef(snippet: string): string | undefined {
  return snippet.match(/المادة\s*(?:رقم)?\s*(?:\(?\s*)?([0-9٠-٩۰-۹]+|[اأإآء-ي]+)(?:\s*\)?)/u)?.[0]?.trim();
}

function extractTargetRef(snippet: string): string | undefined {
  return snippet.match(/(?:من|في)\s+(نظام|لائحة|تنظيم|قواعد)\s+([^.\n،]{3,90})/u)?.[0]?.trim();
}

export function detectLegislativeEffects(text: string): LegislativeEffect[] {
  const effects: LegislativeEffect[] = [];

  for (const { type, pattern } of EFFECT_PATTERNS) {
    for (const match of text.matchAll(pattern)) {
      const rawSnippet = match[0].replace(/\s+/g, " ").trim();
      if (!rawSnippet) continue;

      effects.push({
        effectType: type,
        targetRef: extractTargetRef(rawSnippet),
        articleRef: extractArticleRef(rawSnippet),
        rawSnippet
      });
    }
  }

  return effects;
}
