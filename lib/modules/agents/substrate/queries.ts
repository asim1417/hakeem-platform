// ─────────────────────────────────────────────────────────────────────────────
// المرحلة ١ — استعلامات القبول على الركيزة (HLS‑4.2/4.4). مدعومة بالقاعدة، لكن **سقوط آمن**:
//   • استعلام المعيار يقرأ الأعمدة الجديدة عبر SQL خام داخل try/catch → [] إن غابت الأعمدة
//     (قبل تطبيق الهجرة) أو كانت فارغة (قبل الوسم). فلا يكسر شيئًا قبل تعبئة البيانات.
//   • استعلام النفاذ يعتمد `status` القائم (عمود موجود دومًا) عبر prisma — آمن الآن.
// استيراد prisma كسولٌ. لا أمن، لا نواة ترتيب.
// ─────────────────────────────────────────────────────────────────────────────
import type { NormativeModality } from "./normative";
import { isRepealed } from "./enforcement";

export interface NormativeHit {
  id: string;
  lawName: string;
  articleNumber: number;
  title: string;
  content: string;
  addressee: string | null;
  modality: string | null;
}

/**
 * يُرجع كل المواد المطابقة لـ (modality [+ addressee]) ضمن نطاقٍ اختياريّ (systemName).
 * أساس قبول «رخصة_تقديرية/المحكمة» ووضع المسح المفهوميّ (المرحلة ٣). **لا top‑k**.
 * systemName غائب ⇒ عبر كل الأنظمة (مع صرامة الـmodality فلا مواد عرضية).
 * SQL خام (الأعمدة اختيارية) داخل try/catch → [] عند غياب الأعمدة/البيانات.
 */
export async function queryNormative(opts: {
  systemName?: string;
  modality?: NormativeModality;
  addressee?: string;
  limit?: number;
}): Promise<NormativeHit[]> {
  const { systemName, modality, addressee } = opts;
  const limit = Math.min(Math.max(opts.limit ?? 2000, 1), 5000);
  // لا مرشِّح إطلاقًا → لا نمسح الكوربوس كاملًا بلا معنى.
  if (!systemName && !modality && !addressee) return [];
  try {
    const { prisma } = await import("@/lib/prisma");
    const conds: string[] = [];
    const params: unknown[] = [];
    if (systemName) {
      params.push(`%${systemName.trim()}%`);
      conds.push(`"lawName" ILIKE $${params.length}`);
    }
    if (modality) {
      params.push(modality);
      conds.push(`"norm_modality" = $${params.length}`);
    }
    if (addressee) {
      params.push(addressee);
      conds.push(`"norm_addressee" = $${params.length}`);
    }
    const rows = await prisma.$queryRawUnsafe<NormativeHit[]>(
      `SELECT id, "lawName", "articleNumber", title, content,
              "norm_addressee" AS addressee, "norm_modality" AS modality
       FROM legal_articles
       WHERE ${conds.join(" AND ")}
       ORDER BY "lawName" ASC, "articleNumber" ASC
       LIMIT ${limit}`,
      ...params
    );
    return rows;
  } catch {
    return []; // الأعمدة غير مطبَّقة بعد (قبل الهجرة) → سقوط آمن
  }
}

export interface EnforcementHit {
  id: string;
  articleNumber: number;
  title: string;
  status: string | null;
}

/**
 * يُرجع كل المواد اللاغية (منسوخة) في نظام — أساس قبول «كل مادّة لاغٍ مُميَّزة».
 * يعتمد `status` القائم (عمود موجود دومًا) → آمن قبل أي هجرة. لا top‑k.
 */
export async function queryRepealedInSystem(systemName: string, limit = 5000): Promise<EnforcementHit[]> {
  try {
    const { prisma } = await import("@/lib/prisma");
    const rows = await prisma.legalArticle.findMany({
      where: { lawName: { contains: systemName.trim(), mode: "insensitive" } },
      select: { id: true, articleNumber: true, title: true, status: true },
      orderBy: { articleNumber: "asc" },
      take: Math.min(Math.max(limit, 1), 5000),
    });
    return rows.filter((r) => isRepealed(r.status));
  } catch {
    return [];
  }
}
