// ─────────────────────────────────────────────────────────────────────────────
// JS-005 استخلاص خريطة القضية من المرفقات (Document Intelligence خفيف، §16، §18.10).
// يقترح أطرافًا/طلبات/وقائع/مسائل من **نصّ مرفقات المستخدم فقط** — لا اختلاق، ولا مصدرٍ خارجيّ.
// المخرَج **اقتراحٌ** يثبّته القاضي (human-in-the-loop) قبل الحفظ. سقوطٌ آمن دون مزوّد نموذج.
// ─────────────────────────────────────────────────────────────────────────────
import { callCentralProvider } from "@/lib/modules/ai/ai-gateway";
import type { CaseFact, CaseIssue, CaseRequest, FactStatus, JudicialCase, Party } from "./types";

export interface MapProposal {
  parties: Party[];
  requests: CaseRequest[];
  facts: CaseFact[];
  issues: CaseIssue[];
  blocked: boolean;
  note: string;
}

const FACT_STATES: FactStatus[] = ["alleged", "admitted", "denied", "established", "unresolved"];

const SYSTEM = [
  "أنت محلّل قضايا يستخرج بنية القضية من نصّ المستندات المرفقة فقط.",
  "لا تخترع أطرافًا أو وقائع أو طلبات غير واردة في النصّ. إن لم يتّضح عنصرٌ فاحذفه.",
  "لا تقرّر ثبوت واقعة؛ الحالة الافتراضيّة «alleged» ما لم يظهر إقرارٌ/إنكارٌ صريح في النصّ.",
  "أعِد **JSON فقط** بالشكل:",
  '{"parties":[{"name":"","role":"","representative":""}],"requests":[{"text":""}],"facts":[{"text":"","status":"alleged"}],"issues":[{"statement":""}]}',
  "status ∈ alleged|admitted|denied|established|unresolved. لا نصّ خارج JSON.",
].join("\n");

function tryParse(t: string): unknown | null {
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
}

/**
 * يُصلح JSON مبتورًا (تجاوز سقف الرموز): يوازن الأقواس/الأقواس المربّعة ويُغلق السلسلة المفتوحة،
 * فتُستخرَج العناصر المكتملة على الأقلّ بدل الفشل الكليّ. يمرّ على النصّ حرفًا حرفًا مع تتبّع السلاسل.
 */
function repairTruncatedJson(s: string): string {
  let inStr = false;
  let esc = false;
  const stack: string[] = [];
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
    } else if (c === '"') inStr = true;
    else if (c === "{") stack.push("}");
    else if (c === "[") stack.push("]");
    else if (c === "}" || c === "]") stack.pop();
  }
  let out = s;
  if (inStr) out += '"';
  out = out.replace(/,\s*$/, ""); // فاصلةٌ متدلّية في الذيل
  while (stack.length) out += stack.pop();
  return out;
}

/** يستخرج كائن JSON من مخرَج النموذج بمرونة: أسوار ماركداون، فواصل زائدة، وبترٌ عند سقف الرموز. */
function extractJson(raw: string): unknown | null {
  if (!raw) return null;
  // إزالة أسوار ماركداون ```json … ``` إن وُجدت.
  const s = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  // محاولةٌ مباشرة (المخرَج JSON نقيّ).
  const direct = tryParse(s);
  if (direct) return direct;
  // اقتطاع أوّل كائنٍ متوازن (موازنة الأقواس مع تجاهل ما داخل السلاسل).
  const start = s.indexOf("{");
  if (start < 0) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  let end = -1;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
    } else if (c === '"') inStr = true;
    else if (c === "{") depth++;
    else if (c === "}") { depth--; if (depth === 0) { end = i; break; } }
  }
  const slice = end > start ? s.slice(start, end + 1) : s.slice(start);
  // إصلاحات شائعة: فواصل زائدة قبل } أو ].
  const cleaned = slice.replace(/,\s*([}\]])/g, "$1");
  return tryParse(cleaned) ?? tryParse(repairTruncatedJson(cleaned));
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/** يستخلص اقتراح خريطةٍ من مرفقات القضية. اقتراحٌ يثبّته القاضي؛ لا يُحفظ هنا. */
export async function extractCaseMap(kase: JudicialCase): Promise<MapProposal> {
  if (kase.attachments.length === 0) {
    return { parties: [], requests: [], facts: [], issues: [], blocked: true, note: "لا مرفقات — أضِف وثائق القضية أولًا." };
  }

  let budget = 14_000;
  const material = kase.attachments
    .map((a) => {
      const slice = a.text.slice(0, Math.max(0, budget));
      budget -= slice.length;
      return slice ? `— «${a.name}»:\n${slice}` : "";
    })
    .filter(Boolean)
    .join("\n\n");

  const res = await callCentralProvider({
    systemPrompt: SYSTEM,
    userPrompt: `موضوع القضية: ${kase.subject}\nنوع القضاء: ${kase.jurisdiction}\n\nنصّ المرفقات:\n${material}`,
    // سقفٌ أوسع كي لا يُبتَر JSON للقضايا كثيرة الأطراف/الوقائع (المرفقات الكبيرة).
    maxTokens: 4000,
  }).catch(() => null);

  if (!res || !res.ok || !res.content) {
    const why = res?.error || (!res || res.provider === "offline" ? "مزوّد النموذج غير مضبوط" : "تعذّر نداء النموذج، أعِد المحاولة");
    return { parties: [], requests: [], facts: [], issues: [], blocked: true, note: `تعذّر الاستخلاص (${why}). يمكنك إضافة عناصر الخريطة يدويًّا لاحقًا.` };
  }

  const parsed = extractJson(res.content) as Record<string, unknown> | null;
  if (!parsed) {
    return { parties: [], requests: [], facts: [], issues: [], blocked: true, note: "تعذّر تحليل مخرَج النموذج." };
  }

  const parties: Party[] = (Array.isArray(parsed.parties) ? parsed.parties : [])
    .flatMap((p, i): Party[] => {
      const o = p as Record<string, unknown>;
      const name = str(o.name);
      if (!name) return [];
      const rep = str(o.representative);
      return [{ id: `p-${i + 1}`, name, role: str(o.role) || "طرف", ...(rep ? { representative: rep } : {}) }];
    })
    .slice(0, 12);

  const requests: CaseRequest[] = (Array.isArray(parsed.requests) ? parsed.requests : [])
    .flatMap((r, i): CaseRequest[] => {
      const text = str((r as Record<string, unknown>).text);
      return text ? [{ id: `r-${i + 1}`, text, byPartyId: parties[0]?.id ?? "p-1", status: "contested" }] : [];
    })
    .slice(0, 15);

  const facts: CaseFact[] = (Array.isArray(parsed.facts) ? parsed.facts : [])
    .flatMap((f, i): CaseFact[] => {
      const o = f as Record<string, unknown>;
      const text = str(o.text);
      if (!text) return [];
      const status = FACT_STATES.includes(str(o.status) as FactStatus) ? (str(o.status) as FactStatus) : "alleged";
      return [{ id: `f-${i + 1}`, text, status, verification: "machine", sourceLabel: "مرفقات القضية", hasEvidence: false }];
    })
    .slice(0, 30);

  const issues: CaseIssue[] = (Array.isArray(parsed.issues) ? parsed.issues : [])
    .flatMap((s, i): CaseIssue[] => {
      const statement = str((s as Record<string, unknown>).statement);
      return statement ? [{ id: `i-${i + 1}`, statement, resolved: false }] : [];
    })
    .slice(0, 15);

  const total = parties.length + requests.length + facts.length + issues.length;
  return {
    parties, requests, facts, issues,
    blocked: total === 0,
    note: total === 0
      ? "لم يُستخلَص عنصرٌ واضح من المرفقات."
      : "اقتراحٌ مستخلَصٌ من مرفقاتك — راجِعه واحذف ما لا يلزم قبل التثبيت. الوقائع «مُدّعاة» حتى تحسمها.",
  };
}
