// ─────────────────────────────────────────────────────────────────────────────
// تحديد النظام الحاكم **بالنموذج** (لا بالمكنز الجامد) — جوهر الذكاء الذي يفهم الأنظمة.
// النموذج يفهم أي نظام يحكم السؤال (مثلًا «فسخ الزواج» → الأحوال الشخصية) بلا قاموس؛
// ثم **تحقّق إلزامي**: كل نظام يقترحه يُطابَق بسجلّ القاعدة، وغير الموجود يُهمَل (منع الهلوسة).
// النموذج لا يكتب نصّ مادة إطلاقًا — يحدّد النظام فقط؛ النصّ من القاعدة حصريًا.
// سقوط آمن إلى المكنز الجامد عند تعذّر النموذج (offline). قابل للحقن فيُختبَر حتميًّا.
// ─────────────────────────────────────────────────────────────────────────────
import { callCentralProvider } from "@/lib/modules/ai/ai-gateway";
import { loadSystemsRegistry, normalizeSystemName, matchSystemsInText, type SystemRef } from "../substrate/systems-registry";
import { matchConcepts } from "@/lib/modules/legal-core/concept-map";

export interface ScopeResolution {
  systems: SystemRef[]; // الأنظمة المُتحقَّقة من القاعدة (بمعرّفاتها)
  reasoning: string;
  source: "model" | "fallback" | "none";
}

type Provider = (input: { systemPrompt?: string; userPrompt: string; maxTokens?: number }) => Promise<{
  ok: boolean;
  content: string;
  mode: "server" | "offline";
  provider: string;
}>;

const SYSTEM = [
  "أنت خبير في الأنظمة (القوانين) السعودية. مهمّتك: تحديد النظام/الأنظمة الحاكمة لمسألة قانونية.",
  "**لا تكتب أي نصّ مادة نظامية ولا رقم مادة**؛ حدّد اسم النظام فقط ومبرّرًا مختصرًا.",
  'أعِد **JSON فقط** بالشكل: {"systems":["اسم النظام"],"reasoning":"..."}.',
  "أمثلة أنظمة: الأحوال الشخصية، المعاملات المدنية، الإجراءات الجزائية، العمل، الشركات، التجارية، الإفلاس، المرافعات الشرعية، الإثبات، التنفيذ.",
  "مثال: «فسخ الزوجة لعقد الزواج» تحكمه «الأحوال الشخصية» (الخلع/التفريق)، لا «المعاملات المدنية».",
].join(" ");

function parseSystems(content: string): { systems: string[]; reasoning: string } | null {
  try {
    const m = content.match(/\{[\s\S]*\}/);
    if (!m) return null;
    const j = JSON.parse(m[0]) as { systems?: unknown; reasoning?: unknown };
    if (!Array.isArray(j.systems)) return null;
    const systems = j.systems.map(String).map((s) => s.trim()).filter(Boolean).slice(0, 6);
    return { systems, reasoning: typeof j.reasoning === "string" ? j.reasoning.slice(0, 400) : "" };
  } catch {
    return null;
  }
}

/**
 * يطابق اسمًا (من النموذج أو المكنز) بسجلّ القاعدة — تطبيع + احتواء ثنائيّ الاتجاه (≥ ٣ أحرف).
 * فيُقبَل «الأحوال الشخصية» ⇄ «نظام الأحوال الشخصية»، ويُرفَض ما لا وجود له (هلوسة).
 */
export function matchNameToRegistry(name: string, registry: SystemRef[]): SystemRef[] {
  const core = normalizeSystemName(name);
  if (core.length < 3) return [];
  const hits = registry.filter((r) => {
    const rn = normalizeSystemName(r.name);
    return rn.length >= 3 && (rn === core || rn.includes(core) || core.includes(rn));
  });
  return hits;
}

/** يجمع أنظمةً فريدة (بالمعرّف) من قائمة أسماء عبر التحقّق بالسجلّ. */
function validateNames(names: string[], registry: SystemRef[]): SystemRef[] {
  const byId = new Map<string, SystemRef>();
  for (const n of names) for (const ref of matchNameToRegistry(n, registry)) byId.set(ref.id, ref);
  return [...byId.values()];
}

/** المكنز الجامد كطبقة احتياطية: أسماء صريحة في السؤال + preferSystems من concept-map. */
export function fallbackScope(question: string, registry: SystemRef[]): SystemRef[] {
  const explicit = matchSystemsInText(question, registry);
  const concept = matchConcepts(question).preferSystems ?? [];
  const fromConcept = validateNames(concept, registry);
  const byId = new Map<string, SystemRef>();
  for (const r of [...explicit, ...fromConcept]) byId.set(r.id, r);
  return [...byId.values()];
}

/**
 * يحدّد الأنظمة الحاكمة للسؤال: النموذج يفهم → التحقّق بالسجلّ → السقوط للمكنز عند التعذّر.
 * قابل للحقن (provider/registry/fallback) فيُختبَر بلا نموذج ولا قاعدة.
 */
export async function resolveGoverningSystems(
  question: string,
  opts: { provider?: Provider; registry?: SystemRef[]; maxTokens?: number } = {}
): Promise<ScopeResolution> {
  const q = (question || "").trim();
  const registry = opts.registry ?? (await loadSystemsRegistry().catch(() => []));
  if (!q || !registry.length) return { systems: [], reasoning: "", source: "none" };

  const provider = opts.provider ?? callCentralProvider;
  const res = await provider({ systemPrompt: SYSTEM, userPrompt: `السؤال القانوني: «${q}»`, maxTokens: opts.maxTokens ?? 300 }).catch(() => null);

  if (res && res.ok && res.mode === "server" && res.content.trim()) {
    const parsed = parseSystems(res.content);
    if (parsed) {
      const validated = validateNames(parsed.systems, registry); // منع الهلوسة: يُهمَل غير الموجود
      if (validated.length) return { systems: validated, reasoning: parsed.reasoning, source: "model" };
    }
  }

  // سقوط آمن: المكنز الجامد (لا يفهم «فسخ الزواج»، لكنه لا يكسر السائد).
  const fb = fallbackScope(q, registry);
  return { systems: fb, reasoning: "", source: fb.length ? "fallback" : "none" };
}
