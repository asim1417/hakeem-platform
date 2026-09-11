/**
 * تعبئة المعرّفات بأثر رجعي: لكل نظام قائم يُنشأ LegalWork وتعبيرٌ أول،
 * ويُعطى كل مادة eId ومعرّفًا دائمًا وبصمة.
 *
 * يعمل على دفعات، وقابل لإعادة التشغيل بلا ازدواج (idempotent).
 * يُشغَّل جافًّا أولًا:  npx tsx scripts/backfill-identifiers.ts --dry-run --limit=20
 * ثم فعليًّا:            npx tsx scripts/backfill-identifiers.ts --batch=20
 *
 * لا يحذف شيئًا ولا يكتب فوق نص. يكتب في الجداول الجديدة فقط، ويملأ
 * الحقول الاختيارية في DocumentUnit.
 *
 * ⛔ محجوبٌ حاليًّا — لا يُشغَّل بعدُ (@ts-nocheck مقصود):
 *   ١) يعتمد على نموذج `DocumentUnit`/`LegalWork` من المرحلة الأولى (PR #631) وهي
 *      **غير مدموجة بعد** — فالنماذج غير موجودة في عميل Prisma الحاليّ.
 *   ٢) أسماء الجداول/الحقول هنا (`prisma.law`, `law.units`, `law.instrumentRef`) لا تزال
 *      افتراضيّة وتحتاج مواءمةً مع المخطّط الفعليّ **بعد** توفّر نماذج المرحلتين ١ و٢.
 *   ٣) الدفعة الجافّة تحتاج `DATABASE_URL` حيًّا (غير متوفّر في بيئة الإعداد).
 *   أُنجز في هذه الجلسة: تصحيح خطأ استيراد `parseArticleOrdinal` (كان من hkn-uri)،
 *   ومواءمة مسارات استيراد المكتبات إلى `@/lib/legal-work/*`.
 *   يبقى: مواءمة أسماء Prisma + الدفعة الجافّة على ٢٠ نظامًا + تقرير التعذّر (الخطوة ٤/٥).
 */
// @ts-nocheck — يُرفَع الوسم بعد دمج #631 ومواءمة أسماء Prisma الفعليّة (انظر الرأس أعلاه).

import { PrismaClient } from '@prisma/client';
import { parseArticleOrdinal } from '@/lib/legal-work/arabic-ordinals';
import { buildWorkUri, buildExpressionUri, buildUnitUri, EID, normalizeInstrumentNumber } from '@/lib/legal-work/hkn-uri';
import { contentHash } from '@/lib/legal-work/content-hash';

const prisma = new PrismaClient();

const args = new Map(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? 'true'];
  }),
);
const DRY = args.has('dry-run');
const BATCH = Number(args.get('batch') ?? args.get('limit') ?? 20);

interface Report {
  worksCreated: number;
  expressionsCreated: number;
  unitsStamped: number;
  unparsedArticles: { lawId: string; heading: string }[];
  missingInstrument: string[];
}

const report: Report = {
  worksCreated: 0, expressionsCreated: 0, unitsStamped: 0,
  unparsedArticles: [], missingInstrument: [],
};

/**
 * استنتاج نوع الأداة من نصّ مرجع الإصدار المخزَّن.
 * لا يُخمَّن: ما لم يُطابق نمطًا صريحًا يُترك ويُرفع للمراجعة.
 */
function detectInstrument(raw: string | null): { instrument: string; number: string } | null {
  if (!raw) return null;
  const s = raw.replace(/\s+/g, ' ');
  const decree = s.match(/مرسوم\s*ملكي\s*(?:رقم)?\s*\(?\s*(م\s*[\/\-]\s*[\d٠-٩]+)/);
  if (decree) return { instrument: 'marsoum', number: normalizeInstrumentNumber(decree[1]) };
  const order = s.match(/أمر\s*ملكي\s*(?:رقم)?\s*\(?\s*(أ\s*[\/\-]\s*[\d٠-٩]+)/);
  if (order) return { instrument: 'amr-malaki', number: normalizeInstrumentNumber(order[1]) };
  const cabinet = s.match(/قرار\s*مجلس\s*الوزراء\s*(?:رقم)?\s*\(?\s*([\d٠-٩]+)/);
  if (cabinet) return { instrument: 'qarar-wuzara', number: normalizeInstrumentNumber(cabinet[1]) };
  const minister = s.match(/قرار\s*(?:وزاري|وزير[^\d٠-٩]{0,40})\s*(?:رقم)?\s*\(?\s*([\d٠-٩]+)/);
  if (minister) return { instrument: 'qarar-wazari', number: normalizeInstrumentNumber(minister[1]) };
  return null;
}

/** 1428/10/26هـ أو ٢٦/١٠/١٤٢٨هـ → 1428-10-26 */
export function toHijriIso(raw: string | null): string | null {
  if (!raw) return null;
  const latin = raw.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
  const m = latin.match(/(\d{1,4})\s*[\/\-]\s*(\d{1,2})\s*[\/\-]\s*(\d{1,4})/);
  if (!m) return null;
  let [, a, b, c] = m;
  // الصيغتان شائعتان: YYYY/MM/DD و DD/MM/YYYY
  const [y, mo, d] = a.length === 4 ? [a, b, c] : [c, b, a];
  const yy = Number(y);
  if (yy < 1300 || yy > 1500) return null; // ميلادي أو خطأ — لا يُخمَّن
  return `${yy}-${String(Number(mo)).padStart(2, '0')}-${String(Number(d)).padStart(2, '0')}`;
}

async function processLaw(law: any): Promise<void> {
  const inst = detectInstrument(law.instrumentRef ?? law.issuedBy ?? null);
  const hijri = toHijriIso(law.issueDate ?? law.hijriDate ?? null);

  if (!inst || !hijri) {
    report.missingInstrument.push(law.id);
    return; // لا يُخمَّن معرّف — يُترك للمراجعة
  }

  const workUri = buildWorkUri({
    country: 'sa',
    docType: law.isBylaw ? 'reg' : 'act',
    instrument: inst.instrument as any,
    hijriDate: hijri,
    number: inst.number,
  });
  const exprUri = buildExpressionUri(workUri, 'ar', hijri);

  if (DRY) {
    console.log(`[جاف] ${law.titleAr ?? law.id}\n       ${workUri}\n       ${exprUri}`);
  }

  if (!DRY) {
    const work = await prisma.legalWork.upsert({
      where: { uri: workUri },
      create: {
        uri: workUri,
        titleAr: law.titleAr ?? law.name,
        workType: law.isBylaw ? 'BYLAW' : 'ACT',
        instrument: inst.instrument === 'marsoum' ? 'ROYAL_DECREE'
          : inst.instrument === 'amr-malaki' ? 'ROYAL_ORDER'
          : inst.instrument === 'qarar-wuzara' ? 'CABINET_DECISION' : 'MINISTERIAL',
        instrumentNo: inst.number,
        hijriDate: hijri,
        domainCode: law.domainCode ?? null,
        legacyLawId: law.id,
        completeness: 'missing_instrument', // النص يبدأ من المادة الأولى حتى تُنفَّذ المرحلة الثالثة
      },
      update: {},
    });
    report.worksCreated++;

    const expr = await prisma.legalExpression.upsert({
      where: { workId_lang_effectiveFrom: { workId: work.id, lang: 'ar', effectiveFrom: hijri } },
      create: { uri: exprUri, workId: work.id, lang: 'ar', effectiveFrom: hijri, isOriginal: true },
      update: {},
    });
    report.expressionsCreated++;

    for (const unit of law.units ?? law.articles ?? []) {
      const parsed = parseArticleOrdinal(unit.heading ?? unit.title ?? '');
      if (!parsed) {
        report.unparsedArticles.push({ lawId: law.id, heading: unit.heading ?? unit.title ?? '' });
        continue;
      }
      const eId = EID.article(parsed.number, parsed.bis);
      await prisma.documentUnit.update({
        where: { id: unit.id },
        data: {
          eId,
          uri: buildUnitUri(exprUri, eId),
          contentHash: contentHash(unit.text ?? ''),
          expressionId: expr.id,
        },
      });
      report.unitsStamped++;
    }
  }
}

async function main() {
  const laws = await prisma.law.findMany({
    where: { /* legacyLawId غير مُنشأ بعد */ },
    take: BATCH,
    include: { units: true },
  });

  for (const law of laws) {
    try {
      await processLaw(law);
    } catch (e) {
      console.error(`تعذّر: ${law.id}`, (e as Error).message);
    }
  }

  console.log('\n——— تقرير الدفعة ———');
  console.log(`أعمال: ${report.worksCreated} | تعبيرات: ${report.expressionsCreated} | وحدات موسومة: ${report.unitsStamped}`);
  console.log(`بلا أداة إصدار مقروءة: ${report.missingInstrument.length}`);
  console.log(`عناوين مواد لم تُقرأ: ${report.unparsedArticles.length}`);
  if (report.unparsedArticles.length) {
    console.log(report.unparsedArticles.slice(0, 15));
  }
  await prisma.$disconnect();
}

main();
