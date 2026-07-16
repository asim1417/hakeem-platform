// ─────────────────────────────────────────────────────────────────────────────
// التكييف الأصولي (المرحلة ٣) — أوّل وكلاء التفكير.
// المنهج: فكّك (decompose_issues) ← نقّح (refine_manat) ← [خرّج عبر أدوات البحث في المنسّق]
//          ← حقّق (match_elements). يُخرج مسائل قانونية بمناطات (أوصاف مؤثّرة) قابلة للبحث.
// يقوده نموذج (callCentralProvider) مع **سقوط حتمي آمن** عند تعذّر النموذج (offline).
// ─────────────────────────────────────────────────────────────────────────────
import { callCentralProvider } from "@/lib/modules/ai/ai-gateway";

export interface LegalIssue {
  /** عنوان المسألة القانونية المفكّكة. */
  issue: string;
  /** المناط: الوصف المؤثّر الذي يُبنى عليه الحكم (جوهر التكييف الأصولي). */
  manat: string;
  /** كلمات مفتاحية للتخريج (تُمرَّر لأدوات البحث). */
  keywords: string[];
}

export interface TakyeefResult {
  issues: LegalIssue[];
  source: "model" | "deterministic";
}

const SYSTEM = [
  "أنت فقيه قانوني سعودي خبير في التكييف الأصولي.",
  "فكّك الوقائع إلى مسائل قانونية مستقلّة، ولكل مسألة استخرج «المناط» (الوصف المؤثّر الذي يُبنى عليه الحكم).",
  "أعِد **JSON فقط** بالشكل: {\"issues\":[{\"issue\":\"...\",\"manat\":\"...\",\"keywords\":[\"...\"]}]}.",
  "لا تُضِف نصًّا خارج JSON. لا تُفتِ ولا تذكر مواد — التكييف فقط.",
].join(" ");

function safeParseIssues(content: string): LegalIssue[] | null {
  try {
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const obj = JSON.parse(match[0]) as { issues?: unknown };
    if (!Array.isArray(obj.issues)) return null;
    const issues = obj.issues
      .map((x) => x as Record<string, unknown>)
      .filter((x) => typeof x.issue === "string" && x.issue.trim())
      .map((x) => ({
        issue: String(x.issue).trim(),
        manat: typeof x.manat === "string" ? x.manat.trim() : "",
        keywords: Array.isArray(x.keywords) ? x.keywords.map(String).filter(Boolean).slice(0, 8) : [],
      }));
    return issues.length ? issues : null;
  } catch {
    return null;
  }
}

/** سقوط حتمي: مسألة واحدة من الوقائع نفسها + كلمات مفتاحية من أبرز الألفاظ. */
function deterministicFallback(facts: string): LegalIssue[] {
  const words = facts.split(/\s+/).filter((w) => w.length >= 4).slice(0, 6);
  return [{ issue: facts.slice(0, 120).trim() || "المسألة محلّ النزاع", manat: "", keywords: words }];
}

/**
 * يفكّك الوقائع إلى مسائل بمناطات. يستدعي المهارة السياقية اختياريًّا (المرحلة ٧ تربطها).
 */
export async function runTakyeef(facts: string, skillContext?: string): Promise<TakyeefResult> {
  const input = (facts || "").trim();
  if (!input) return { issues: [], source: "deterministic" };

  const userPrompt = [skillContext ? `سياق الخبرة:\n${skillContext}\n` : "", `الوقائع:\n${input}`].join("\n");
  const res = await callCentralProvider({ systemPrompt: SYSTEM, userPrompt, maxTokens: 900 }).catch(() => null);

  if (res?.ok && res.mode === "server") {
    const parsed = safeParseIssues(res.content);
    if (parsed) return { issues: parsed, source: "model" };
  }
  return { issues: deterministicFallback(input), source: "deterministic" };
}
