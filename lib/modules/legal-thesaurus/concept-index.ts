/**
 * concept-index.ts — توسيع البحث القانوني بمفاهيم المكنز (legal_thesaurus_*).
 *
 * يقرأ مفاهيم المكنز ومصطلحاتها البديلة من القاعدة (قراءة فقط)، يبني فهرساً في الذاكرة
 * (يُحمَّل مرّة ويُخزَّن مؤقتاً)، ثم يطابق الاستعلام ليوسّعه بمرادفات مُسنَدة لمعرّفات
 * حقيقية في القاعدة — حتمي، بلا توليد، بلا هلوسة (كل توسيع يتتبّع إلى concept_id فعلي).
 *
 * يكمّل خريطة المفاهيم المنسّقة يدوياً (concept-map.ts) بـ 2,967 مفهوماً مستخرَجاً.
 * لا يحتاج مفتاح API ولا متجهات — توسيع معجمي صرف. سقوط آمن: أي فشل ⇒ لا توسيع،
 * فلا يتعطّل البحث (نفس نمط embeddings).
 */
import { prisma } from "@/lib/prisma";
import { searchableText } from "./normalize";

export interface ThesaurusEntry {
  id: string;
  label: string; // preferred_label_ar (خام)
  status: string; // approved | candidate
  /** صيغ المطابقة (مُطبَّعة searchableText): التسمية + المصطلحات البديلة */
  forms: string[];
  /** مرادفات تُضاف لمصطلحات البحث (خام) */
  synonyms: string[];
}

export interface ThesaurusMatch {
  synonyms: string[];
  conceptIds: string[];
  matched: Array<{ id: string; label: string }>;
}

const EMPTY: ThesaurusMatch = { synonyms: [], conceptIds: [], matched: [] };

/** أدنى طول لصيغة المطابقة (تتجاهل الصيغ القصيرة جداً عديمة التمييز). */
const MIN_FORM_LEN = 4;
/** حدّ المرادفات المُضافة للاستعلام (حماية دقّة البحث وحجم الاستعلام). */
const MAX_SYNONYMS = 24;
/** عمر المخزون المؤقت قبل إعادة التحميل من القاعدة. */
const CACHE_TTL_MS = 10 * 60 * 1000;

let cache: { at: number; entries: ThesaurusEntry[] } | null = null;
let loading: Promise<ThesaurusEntry[]> | null = null;

function expansionEnabled(): boolean {
  const v = (process.env.THESAURUS_EXPANSION ?? "on").toLowerCase();
  return v !== "0" && v !== "false" && v !== "off";
}

/** سياسة الحالة: 'all' (افتراضي) أو 'approved' لقصر التوسيع على المعتمد. */
function approvedOnly(): boolean {
  return (process.env.THESAURUS_EXPANSION_STATUS ?? "all").toLowerCase() === "approved";
}

async function loadEntries(): Promise<ThesaurusEntry[]> {
  const where = approvedOnly() ? `WHERE status = 'approved'` : ``;
  const concepts = await prisma.$queryRawUnsafe<Array<{ id: string; label: string; status: string }>>(
    `SELECT id, preferred_label_ar AS label, status FROM legal_thesaurus_concepts ${where}`
  );
  const terms = await prisma.$queryRawUnsafe<Array<{ concept_id: string | null; term_text: string }>>(
    `SELECT concept_id, term_text FROM legal_thesaurus_terms`
  );
  const termsByConcept = new Map<string, string[]>();
  for (const t of terms) {
    if (!t.concept_id || !t.term_text) continue;
    const arr = termsByConcept.get(t.concept_id) ?? [];
    arr.push(t.term_text);
    termsByConcept.set(t.concept_id, arr);
  }
  const entries: ThesaurusEntry[] = [];
  for (const c of concepts) {
    const alt = termsByConcept.get(c.id) ?? [];
    const surface = [c.label, ...alt];
    const forms = Array.from(new Set(surface.map(searchableText).filter((f) => f.length >= MIN_FORM_LEN)));
    if (!forms.length) continue;
    const synonyms = Array.from(new Set(surface.map((s) => (s || "").trim()).filter(Boolean)));
    entries.push({ id: c.id, label: c.label, status: c.status, forms, synonyms });
  }
  return entries;
}

async function getIndex(): Promise<ThesaurusEntry[]> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.entries;
  if (loading) return loading;
  loading = loadEntries()
    .then((entries) => {
      cache = { at: Date.now(), entries };
      return entries;
    })
    .catch(() => cache?.entries ?? []) // أبقِ القديم إن وُجد، وإلا فارغ
    .finally(() => {
      loading = null;
    });
  return loading;
}

/**
 * مطابقة نقيّة قابلة للاختبار (بلا قاعدة): أيّ مفهوم تظهر إحدى صيغه في الاستعلام المُطبَّع.
 *   - العبارات المركّبة (تحوي مسافة): مطابقة احتواء على نص الاستعلام كاملاً.
 *   - الكلمات المفردة: مطابقة وحدة (token) لا احتواء — حفاظاً على الدقّة ومنعاً
 *     لتوسيع الكلمات العامة على نطاق واسع.
 */
export function matchInIndex(query: string, entries: ThesaurusEntry[]): ThesaurusMatch {
  const nq = searchableText(query || "");
  if (!nq) return { synonyms: [], conceptIds: [], matched: [] };
  const tokens = new Set(nq.split(/\s+/).filter(Boolean));
  const synonyms = new Set<string>();
  const conceptIds: string[] = [];
  const matched: Array<{ id: string; label: string }> = [];
  for (const e of entries) {
    const hit = e.forms.some((f) => (f.includes(" ") ? nq.includes(f) : tokens.has(f)));
    if (!hit) continue;
    conceptIds.push(e.id);
    matched.push({ id: e.id, label: e.label });
    for (const s of e.synonyms) {
      if (synonyms.size >= MAX_SYNONYMS) break;
      synonyms.add(s);
    }
  }
  return { synonyms: [...synonyms].slice(0, MAX_SYNONYMS), conceptIds, matched };
}

/** الواجهة العامة: توسيع الاستعلام بمفاهيم المكنز — سقوط آمن (لا يرمي أبداً). */
export async function matchThesaurusConcepts(query: string): Promise<ThesaurusMatch> {
  if (!expansionEnabled() || !query || !query.trim()) return EMPTY;
  try {
    const entries = await getIndex();
    return matchInIndex(query, entries);
  } catch {
    return EMPTY;
  }
}

/** إفراغ المخزون المؤقت (بعد تحديث المكنز) ليُعاد تحميله. */
export function clearThesaurusCache(): void {
  cache = null;
}
