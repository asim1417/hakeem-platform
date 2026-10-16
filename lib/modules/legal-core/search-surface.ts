// ─────────────────────────────────────────────────────────────────────────────
// وجه البحث (الموجة ١): كل صندوق بحث يرى النسخة السارية في تاريخ اليوم لكل عمل،
// والأرشيف كامل يُفتح بالرابط المباشر. القراءة من search_surface + search_surface_member
// (إضافة فقط). لكل work_key آخر صف valid_on <= اليوم هو الوجه.
// غياب الجدولين = لا وجه = السلوك القديم كما هو (لا كسر قبل الحقن).
// ─────────────────────────────────────────────────────────────────────────────

export interface SurfaceRow {
  id: string;
  workKey: string;
  surfaceSystemId: string | null;
  validOn: string; // YYYY-MM-DD
  createdAt: string; // ISO — لكسر التعادل في اليوم نفسه
}

export interface SurfaceMember {
  workKey: string;
  systemId: string;
}

export interface SearchSurface {
  asOf: string;
  /** أنظمة خارج وجه «الساري» اليوم (مخلوط، إصدار غير نافذ، ملغى، مستبدل، كل مواده ملغاة). */
  hidden: Set<string>;
  /** تحويل عضو مخفي إلى وجه عمله الحالي (مثل «نظام التنفيذ» المخلوط → م/53 اليوم). */
  redirect: Map<string, string>;
  /** الوجه الحالي لكل عمل (null = لا نسخة سارية). */
  current: Map<string, string | null>;
}

export const EMPTY_SURFACE: SearchSurface = { asOf: "", hidden: new Set(), redirect: new Map(), current: new Map() };

/** تاريخ اليوم بتوقيت الرياض YYYY-MM-DD (السريان يُحسب باليوم لا بالساعة). */
export function todayRiyadh(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/**
 * يحسب الوجه لتاريخ. نقيّ وحتميّ.
 * لكل عمل: آخر صف valid_on <= asOf (ثم الأحدث إنشاءً). كل عضو غير الوجه مخفي ويُحوَّل إليه.
 * عمل بلا صف قبل asOf (كله مستقبلي) لا يُخفي شيئًا بعد.
 */
export function computeSurface(rows: SurfaceRow[], members: SurfaceMember[], asOf: string): SearchSurface {
  const byWork = new Map<string, SurfaceRow>();
  for (const r of rows) {
    if (r.validOn > asOf) continue;
    const prev = byWork.get(r.workKey);
    if (!prev || r.validOn > prev.validOn || (r.validOn === prev.validOn && (r.createdAt > prev.createdAt || (r.createdAt === prev.createdAt && r.id > prev.id)))) {
      byWork.set(r.workKey, r);
    }
  }
  const current = new Map<string, string | null>();
  for (const [k, r] of byWork) current.set(k, r.surfaceSystemId);

  const hidden = new Set<string>();
  const redirect = new Map<string, string>();
  for (const m of members) {
    if (!current.has(m.workKey)) continue;
    const surfaceId = current.get(m.workKey) ?? null;
    if (m.systemId === surfaceId) continue;
    hidden.add(m.systemId);
    if (surfaceId) redirect.set(m.systemId, surfaceId);
  }
  // الوجه نفسه لا يُخفى أبدًا ولو كان عضوًا مخفيًا في عمل آخر.
  for (const id of current.values()) if (id) hidden.delete(id);
  return { asOf, hidden, redirect, current };
}

/** يحوّل قائمة معرّفات أنظمة إلى معرّفات الوجه: المخفي بخلف يُستبدل، والمخفي بلا خلف يسقط. */
export function mapToSurface(ids: string[], surface: SearchSurface): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    const target = surface.hidden.has(id) ? surface.redirect.get(id) ?? null : id;
    if (target && !seen.has(target)) {
      seen.add(target);
      out.push(target);
    }
  }
  return out;
}

/** هل المادة داخل الوجه؟ (بالمعرّف الثابت أولًا، ثم بالاسم للصفوف القديمة بلا معرّف). */
export function inSurface(row: { legalSystemId?: string | null; lawName?: string | null }, surface: SearchSurface, hiddenNames?: Set<string>): boolean {
  if (row.legalSystemId && surface.hidden.has(row.legalSystemId)) return false;
  if (!row.legalSystemId && hiddenNames && row.lawName && hiddenNames.has(row.lawName)) return false;
  return true;
}

type Loaded = { asOf: string; at: number; surface: SearchSurface; hiddenNames: Set<string>; repealed: string[] };
let _cache: Loaded | null = null;
const TTL_MS = 5 * 60 * 1000;

/**
 * يحمّل الوجه من القاعدة لتاريخ (افتراضيًا اليوم بتوقيت الرياض). مذكَّر ٥ دقائق لكل تاريخ.
 * سقوط آمن إلى وجه فارغ (= السلوك القديم) عند غياب الجداول أو أي خطأ.
 */
/**
 * الأنظمة الملغاة في سجل التحقق (آخر سجل work: «ملغى» أو «مستبدل»). لا يحمل السجل تاريخ الإلغاء،
 * فيُطبَّق على البحث بتاريخ اليوم أو بعده فقط. غياب الجدول = لا شيء.
 */
async function repealedWorkIds(): Promise<{ ids: string[]; ok: boolean }> {
  try {
    const { prisma } = await import("@/lib/prisma");
    const rows = await prisma.$queryRawUnsafe<Array<{ object_id: string; verified_status: string }>>(
      `SELECT DISTINCT ON (object_id) object_id, verified_status
       FROM verification WHERE object_type = 'work'
       ORDER BY object_id, verified_at DESC, id DESC`,
    );
    return { ids: rows.filter((r) => r.verified_status === "ملغى" || r.verified_status === "مستبدل").map((r) => r.object_id), ok: true };
  } catch {
    return { ids: [], ok: false };
  }
}

/** يضيف الملغى بسجل التحقق إلى المخفي (مع إبقاء الإحالة إلى البديل إن عرفها الوجه). نقيّ. */
export function hideRepealed(surface: SearchSurface, repealedIds: string[]): SearchSurface {
  if (!repealedIds.length) return surface;
  const hidden = new Set(surface.hidden);
  for (const id of repealedIds) hidden.add(id);
  return { ...surface, hidden };
}

export async function loadSearchSurface(
  asOf: string = todayRiyadh(),
  opts: { includeRepealed?: boolean } = {},
): Promise<{ surface: SearchSurface; hiddenNames: Set<string> }> {
  const now = Date.now();
  let base: { surface: SearchSurface; hiddenNames: Set<string>; repealed: string[] };
  if (_cache && _cache.asOf === asOf && now - _cache.at < TTL_MS) {
    base = { surface: _cache.surface, hiddenNames: _cache.hiddenNames, repealed: _cache.repealed };
  } else {
    const tables = await loadSurfaceTables(asOf);
    // الإلغاء بلا تاريخ في السجل: يُطبَّق على بحث اليوم أو بعده فقط.
    const repealed = asOf >= todayRiyadh() ? await repealedWorkIds() : { ids: [], ok: true };
    base = { surface: tables.surface, hiddenNames: tables.hiddenNames, repealed: repealed.ids };
    // لا يُذكَّر وجهٌ نتج عن فشل قراءة (يُعاد المحاولة في الطلب التالي).
    if (tables.ok && repealed.ok) _cache = { asOf, at: now, ...base };
  }
  // البحث يستبعد الأنظمة الملغاة افتراضيًا (بالمعرّف فقط: الاسم قد يتكرر مع النظام البديل).
  // الوصول المباشر (برقم المادة أو مطابقة تامة) يمرّر includeRepealed ليُجيب «موجودة وملغاة».
  if (opts.includeRepealed || !base.repealed.length) return { surface: base.surface, hiddenNames: base.hiddenNames };
  return { surface: hideRepealed(base.surface, base.repealed), hiddenNames: base.hiddenNames };
}

async function loadSurfaceTables(asOf: string): Promise<{ surface: SearchSurface; hiddenNames: Set<string>; ok: boolean }> {
  try {
    const { prisma } = await import("@/lib/prisma");
    const rows = await prisma.$queryRawUnsafe<Array<{ id: string; work_key: string; surface_system_id: string | null; valid_on: Date | string; created_at: Date | string }>>(
      `SELECT id, work_key, surface_system_id, valid_on, created_at FROM search_surface WHERE valid_on <= $1::date`,
      asOf,
    );
    const members = await prisma.$queryRawUnsafe<Array<{ work_key: string; system_id: string }>>(
      `SELECT work_key, system_id FROM search_surface_member`,
    );
    const surface = computeSurface(
      rows.map((r) => ({
        id: r.id,
        workKey: r.work_key,
        surfaceSystemId: r.surface_system_id,
        validOn: typeof r.valid_on === "string" ? r.valid_on.slice(0, 10) : r.valid_on.toISOString().slice(0, 10),
        createdAt: new Date(r.created_at).toISOString(),
      })),
      members.map((m) => ({ workKey: m.work_key, systemId: m.system_id })),
      asOf,
    );
    const hiddenIds = [...surface.hidden];
    const names = hiddenIds.length
      ? await prisma.$queryRawUnsafe<Array<{ name: string }>>(`SELECT name FROM legal_systems WHERE id = ANY($1::text[])`, hiddenIds)
      : [];
    const hiddenNames = new Set(names.map((n) => n.name));
    return { surface, hiddenNames, ok: true };
  } catch {
    return { surface: { ...EMPTY_SURFACE, asOf }, hiddenNames: new Set(), ok: false };
  }
}

/** للاختبار: مسح الذاكرة. */
export function __resetSurfaceCache(): void {
  _cache = null;
}
