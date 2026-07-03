/**
 * lexicon-expansion.ts — توسيع استعلام البحث بالمرادفات الصرفية من المعجم الرسميّ
 * (data/hoqoqi-lexicon.json المستخرَج من hoqoqi.sql). حتميّ، شفّاف، بلا اختلاق:
 * كل توسيع صيغةٌ حقيقية لنفس الجذر (مفرد↔جمع، مذكّر↔مؤنّث، ماضٍ↔مضارع…).
 *
 * التحميل كسول من القرص (خادميّ فقط). إن غاب الملف → لا توسيع (سلوك آمن).
 */
import fs from "node:fs";
import path from "node:path";

type LexiconFile = { roots: Record<string, string[]> };

let INDEX: { formToRoots: Map<string, Set<string>>; rootToForms: Map<string, string[]> } | null = null;

/** تطبيع خفيف للمطابقة: إزالة التشكيل/التطويل وتوحيد الهمزات والألف واللام والتاء المربوطة. */
export function normLex(s: string): string {
  return s
    .replace(/[ً-ْٰـ]/g, "")
    .replace(/[إأآا]/g, "ا").replace(/[ؤ]/g, "و").replace(/[ئى]/g, "ي").replace(/ء/g, "")
    .replace(/ة/g, "ه")
    .replace(/^ال/, "")
    .trim();
}

function load(): NonNullable<typeof INDEX> {
  if (INDEX) return INDEX;
  const formToRoots = new Map<string, Set<string>>();
  const rootToForms = new Map<string, string[]>();
  try {
    const p = process.env.LEXICON_PATH || path.resolve(process.cwd(), "data/hoqoqi-lexicon.json");
    const data = JSON.parse(fs.readFileSync(p, "utf8")) as LexiconFile;
    for (const [root, forms] of Object.entries(data.roots ?? {})) {
      rootToForms.set(root, forms);
      for (const f of forms) {
        const key = normLex(f);
        if (!key) continue;
        (formToRoots.get(key) ?? formToRoots.set(key, new Set()).get(key)!).add(root);
      }
    }
  } catch {
    /* لا ملف ⇒ فهرس فارغ (لا توسيع) */
  }
  INDEX = { formToRoots, rootToForms };
  return INDEX;
}

/**
 * يُعيد الصيغ الصرفية الشقيقة لكلمة (بنفس الجذر)، عدا الكلمة نفسها، بحدٍّ أقصى `cap`.
 * فارغ إن لم تُعرَف الكلمة أو غاب المعجم.
 */
export function expandToken(token: string, cap = 8): string[] {
  const { formToRoots, rootToForms } = load();
  const key = normLex(token);
  const roots = formToRoots.get(key);
  if (!roots) return [];
  const out = new Set<string>();
  for (const root of roots) for (const f of rootToForms.get(root) ?? []) { if (normLex(f) !== key) out.add(f); }
  return [...out].slice(0, cap);
}

export function lexiconStats(): { roots: number; forms: number } {
  const { formToRoots, rootToForms } = load();
  return { roots: rootToForms.size, forms: formToRoots.size };
}

/** لأغراض الاختبار: يُعيد تهيئة الفهرس ليُعاد تحميله. */
export function _resetLexicon(): void { INDEX = null; }
