/**
 * بذر عيّنة أحكام/مبادئ قضائية تجريبية — موسومة بوضوح («عيّنة تجريبية») —
 * لتفعيل البحث الشامل متعدّد الكيانات (مادة/حكم/مبدأ) قبل توفّر بيانات الأحكام الحقيقية.
 *
 * - كل صف source = "DEMO_SAMPLE" و reviewStatus = "needs_review".
 * - العنوان والنص يبدآن بوسم 【عيّنة تجريبية】 كي يظهر في النتائج والتفاصيل بلا لبس.
 * - idempotent: يحذف عيّنات DEMO_SAMPLE السابقة ثم يعيد البذر.
 * - يربط كل حكم بمواد نظامية حقيقية موجودة (إن وُجدت بالبحث النصّي).
 *
 * التشغيل: npm run seed:demo-judgments     (الحذف فقط: -- --clear)
 * يُستبدل لاحقًا ببيانات أحكام حقيقية عبر: npm run import:judgments
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const TAG = "【عيّنة تجريبية】";
const SOURCE = "DEMO_SAMPLE";

type DemoCase = {
  caseNo: string;
  decisionNo: string;
  court: string;
  cityName: string;
  decisionDateText: string;
  decisionDate: Date;
  title: string;
  text: string;
  // كلمات للبحث عن مواد حقيقية لربطها (lawName جزئي + كلمة في النص)
  links: Array<{ lawNameLike: string; keyword: string; relationType: string }>;
  principle?: { title: string; text: string };
};

const CASES: DemoCase[] = [
  {
    caseNo: "4520/ت/1445", decisionNo: "1730/ق/1445", court: "المحكمة التجارية", cityName: "الرياض",
    decisionDateText: "1445/08/12هـ", decisionDate: new Date("2024-02-22"),
    title: "فسخ عقد بيع بضاعة لتأخّر التسليم والتعويض",
    text: "دعوى يطلب فيها المدّعي فسخ عقد بيع بضاعة لتأخّر المدّعى عليه عن التسليم في الأجل المتفق عليه، واسترداد المبلغ المدفوع مقدّماً مع التعويض عن الضرر التجاري. حكمت الدائرة بفسخ العقد لإخلال البائع بالتزامه الجوهري، وإلزامه بردّ الثمن والتعويض بقدر الضرر الثابت.",
    links: [{ lawNameLike: "المعاملات المدنية", keyword: "فسخ", relationType: "APPLIED" }, { lawNameLike: "المحاكم التجارية", keyword: "اختصاص", relationType: "PROCEDURAL" }],
    principle: { title: "الإخلال الجوهري بالالتزام يبيح طلب الفسخ", text: "إذا أخلّ أحد المتعاقدين بالتزام جوهري في عقد ملزم للجانبين جاز للطرف الآخر طلب فسخ العقد مع التعويض عن الضرر المترتّب على الإخلال." },
  },
  {
    caseNo: "881/ت/1445", decisionNo: "402/ق/1445", court: "المحكمة التجارية", cityName: "جدة",
    decisionDateText: "1445/05/03هـ", decisionDate: new Date("2023-11-16"),
    title: "التعويض عن الضرر الناشئ عن المسؤولية العقدية",
    text: "نزاع حول استحقاق التعويض عن الأضرار المترتّبة على إخلال أحد الطرفين بتنفيذ التزامه التعاقدي. قرّرت الدائرة أن التعويض يُقدّر بقدر ما لحق المضرور من خسارة وما فاته من كسب متى توافرت رابطة السببية بين الإخلال والضرر.",
    links: [{ lawNameLike: "المعاملات المدنية", keyword: "تعويض", relationType: "APPLIED" }],
    principle: { title: "تقدير التعويض بقدر الضرر المباشر", text: "يشمل التعويض ما لحق المضرور من خسارة وما فاته من كسب، بشرط أن يكون الضرر مباشراً ومتوقّعاً ومرتبطاً بالإخلال برابطة سببية." },
  },
  {
    caseNo: "2207/ت/1444", decisionNo: "990/ق/1444", court: "محكمة الاستئناف التجارية", cityName: "الرياض",
    decisionDateText: "1444/11/20هـ", decisionDate: new Date("2023-06-09"),
    title: "الدفع بالتقادم وسقوط الحق في رفع الدعوى",
    text: "تمسّك المدّعى عليه بسقوط دعوى المطالبة لمضيّ المدّة النظامية دون مطالبة. بحثت الدائرة شروط التقادم المسقط وأثر انقطاعه بالمطالبة القضائية أو الإقرار بالحق.",
    links: [{ lawNameLike: "المعاملات المدنية", keyword: "مدة", relationType: "CITED" }],
  },
  {
    caseNo: "1175/ت/1445", decisionNo: "655/ق/1445", court: "المحكمة التجارية", cityName: "الدمام",
    decisionDateText: "1445/06/14هـ", decisionDate: new Date("2023-12-27"),
    title: "حجّية المحرّرات والإثبات في المعاملات التجارية",
    text: "خلاف حول حجّية محرّر في الإثبات ومدى الاعتداد به دليلاً على نشوء الالتزام. قرّرت الدائرة الأخذ بالمحرّر متى استوفى شروطه ولم يقم دليل على الطعن فيه.",
    links: [{ lawNameLike: "المعاملات المدنية", keyword: "إثبات", relationType: "CITED" }],
  },
  {
    caseNo: "640/ت/1445", decisionNo: "318/ق/1445", court: "المحكمة التجارية", cityName: "الرياض",
    decisionDateText: "1445/03/28هـ", decisionDate: new Date("2023-10-13"),
    title: "تجاوز الوكيل لحدود الوكالة وأثره",
    text: "دعوى حول تصرّف وكيل خارج حدود وكالته ومدى نفاذه في حقّ الموكّل. انتهت الدائرة إلى أن تصرّف الوكيل فيما جاوز حدود وكالته موقوف على إجازة الموكّل.",
    links: [{ lawNameLike: "المعاملات المدنية", keyword: "وكالة", relationType: "APPLIED" }],
  },
  {
    caseNo: "1990/ت/1444", decisionNo: "1102/ق/1444", court: "المحكمة التجارية", cityName: "جدة",
    decisionDateText: "1444/12/05هـ", decisionDate: new Date("2023-06-23"),
    title: "الإثراء بلا سبب ودعوى استرداد ما دُفع بغير حق",
    text: "مطالبة باسترداد مبلغ دُفع بغير سبب مشروع. قرّرت الدائرة أن من أثرى على حساب غيره بلا سبب مشروع يلزم بردّ ما أثرى به في حدود ما لحق الغير من افتقار.",
    links: [{ lawNameLike: "المعاملات المدنية", keyword: "سبب", relationType: "APPLIED" }],
  },
];

async function findArticleId(lawNameLike: string, keyword: string): Promise<string | null> {
  const a = await prisma.legalArticle.findFirst({
    where: { lawName: { contains: lawNameLike }, content: { contains: keyword } },
    select: { id: true },
    orderBy: { articleNumber: "asc" },
  });
  return a?.id ?? null;
}

async function clearDemo() {
  const cases = await prisma.judicialCase.findMany({ where: { source: SOURCE }, select: { id: true } });
  const ids = cases.map((c) => c.id);
  if (ids.length) {
    await prisma.legalArticleCaseLink.deleteMany({ where: { caseId: { in: ids } } });
    await prisma.judicialPrinciple.deleteMany({ where: { sourceCaseId: { in: ids } } });
    await prisma.judicialCase.deleteMany({ where: { id: { in: ids } } });
  }
  return ids.length;
}

async function main() {
  const clearOnly = process.argv.includes("--clear");
  const removed = await clearDemo();
  console.log(`🧹 حُذف ${removed} حكمًا تجريبيًا سابقًا.`);
  if (clearOnly) {
    await prisma.$disconnect();
    return;
  }

  let cases = 0, links = 0, principles = 0;
  for (const c of CASES) {
    const created = await prisma.judicialCase.create({
      data: {
        caseNo: c.caseNo, decisionNo: c.decisionNo, court: c.court, cityName: c.cityName,
        decisionDateText: c.decisionDateText, decisionDate: c.decisionDate,
        judgmentTitle: `${TAG} ${c.title}`,
        judgmentText: `${TAG} ${c.text}`,
        source: SOURCE, reviewStatus: "needs_review",
      },
    });
    cases++;

    for (const l of c.links) {
      const articleId = await findArticleId(l.lawNameLike, l.keyword);
      if (!articleId) continue;
      await prisma.legalArticleCaseLink
        .create({
          data: {
            articleId, caseId: created.id, relationType: l.relationType,
            citedText: `${TAG} استشهاد تجريبي`, confidence: 0.6, reviewStatus: "needs_review",
          },
        })
        .then(() => links++)
        .catch(() => undefined);
    }

    if (c.principle) {
      await prisma.judicialPrinciple.create({
        data: {
          title: `${TAG} ${c.principle.title}`,
          principleText: `${TAG} ${c.principle.text}`,
          sourceCaseId: created.id, court: c.court, reviewStatus: "needs_review", confidence: 0.6,
        },
      });
      principles++;
    }
  }

  console.log(`✅ بُذرت عيّنة تجريبية موسومة: ${cases} حكمًا · ${links} رابط مادة · ${principles} مبدأ.`);
  console.log("   كلها source=DEMO_SAMPLE وتبدأ بوسم 【عيّنة تجريبية】. تُحذف بـ: npm run seed:demo-judgments -- --clear");
  await prisma.$disconnect();
}

main().catch((e) => { console.error("❌", e); process.exit(1); });
