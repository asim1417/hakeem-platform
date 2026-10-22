/**
 * HKM-012 — مزوّد البحث النصّي (postgres-provider) لا يُخرج اسم فرد ولا رقمًا شخصيًا في مقتطفات الأحكام والمبادئ،
 * والحجب قبل القص (كان المقتطف يُقص من النص الخام). قاعدة وهمية في الذاكرة مكان prisma؛ بيانات مصطنعة بالكامل.
 *   npm run test:postgres-provider-privacy
 */
import { createRequire } from "node:module";

// «server-only» يرمي خارج بيئة الخادم: نحلّه وحدةً فارغة قبل الاستيراد (كاختبار المستهلكين).
const req = createRequire(__filename);
const serverOnly = req.resolve("server-only");
req.cache[serverOnly] = { id: serverOnly, filename: serverOnly, loaded: true, exports: {} } as unknown as NodeJS.Module;

let failed = 0;
const ok = (c: boolean, m: string) => {
  console.log(`${c ? "✓" : "✗"} ${m}`);
  if (!c) failed++;
};

const NAME_WORDS = ["غانم", "الموسوي", "زيدان", "الفلاني", "قيصر", "الطاهري", "رجاء", "السندي"];
const leaks = (s: string) => NAME_WORDS.filter((w) => s.includes(w));
const ID = "1987654320";

// حكم ديباجته أسماء أطراف (مصطنعة) ورقم هوية: القص الخام عند 200 حرف كان يُخرجها.
const ruling = {
  id: "r5",
  judgmentTitle: "حكم توريد",
  judgmentText: `الوقائع: أقام المدعي/ غانم الموسوي (هوية ${ID}) دعواه ضد المدعى عليه/ زيدان الفلاني بطلب ثمن توريد بضاعة. وحضر وكيل المدعي المحامي قيصر الطاهري وقرر ما جاء في الصحيفة.\nالأسباب: وحيث شهدت الشاهدة/ رجاء السندي بالتسليم.\nمنطوق الحكم: حكمت الدائرة بإلزام المدعى عليه بالثمن.`,
  caseNo: "٤٤٧٠٠٠٠٠٠٥",
  decisionNo: null,
  court: "المحكمة التجارية",
  decisionDate: null,
  decisionDateText: null,
  reviewStatus: "approved",
};
const principle = { id: "p1", title: "مبدأ فسخ عقد التوريد في دعوى المدعي/ زيدان الفلاني", principleText: "إذا أخل المورد بالتسليم جاز الفسخ. وقرر المدعي/ غانم الموسوي ذلك أمام الدائرة.", reviewStatus: "approved" };

const noWrite = async () => { throw new Error("لا كتابة مسموحة في الاختبار"); };
const fakePrisma = {
  judicialCase: { findMany: async () => [ruling], update: noWrite, create: noWrite, delete: noWrite },
  judicialPrinciple: { findMany: async () => [principle], update: noWrite, create: noWrite, delete: noWrite },
  legalArticle: { findMany: async () => { throw new Error("لا مواد في هذا الاختبار"); } },
  async $queryRawUnsafe() { throw new Error("لا استعلام خام في هذا الاختبار"); },
  async $executeRawUnsafe() { throw new Error("لا كتابة مسموحة في الاختبار"); },
};
(globalThis as unknown as { prisma: unknown }).prisma = fakePrisma;

async function main() {
  const { postgresProvider, maskedSnippet } = await import("../lib/modules/legal-search/providers/postgres-provider");
  const frozen = JSON.stringify([ruling, principle]);

  const results = await postgresProvider.search({ q: "ثمن توريد بضاعة", limit: 10 });
  const hit = results.find((r) => r.type === "ruling" && r.id === "r5");
  ok(Boolean(hit), "المزوّد يعيد الحكم");
  ok(leaks(`${hit?.title} ${hit?.snippet}`).length === 0, `مقتطف الحكم بلا اسم فرد (${leaks(hit?.snippet ?? "").join("،") || "لا تسرّب"})`);
  ok(!(hit?.snippet ?? "").includes(ID) && (hit?.snippet ?? "").includes("[هوية محجوبة]"), "رقم الهوية محجوب في المقتطف");
  ok((hit?.snippet ?? "").includes("[اسم]") && (hit?.snippet ?? "").includes("ثمن توريد"), "مكان الاسم معلَّم وبقية النص باقية");
  ok((hit?.snippet ?? "").length <= 200, "المقتطف مقصوص إلى 200 حرف بعد الحجب");

  const p = results.find((r) => r.type === "principle" && r.id === "p1");
  ok(Boolean(p) && leaks(`${p?.title} ${p?.snippet}`).length === 0 && (p?.title ?? "").startsWith("مبدأ: "), "عنوان المبدأ ومقتطفه بلا اسم فرد");

  // الحجب قبل القص: اسم يقع على حد القص لا يُخرج نصفه.
  const edge = `${"ـ".repeat(190)} المدعي/ غانم الموسوي يطلب`;
  ok(leaks(maskedSnippet(edge)).length === 0 && !maskedSnippet(edge).includes("غان"), "اسم على حد الـ200 حرف محجوب كاملًا (الحجب قبل القص)");
  ok(maskedSnippet(null) === "" && maskedSnippet("نص قصير") === "نص قصير", "نص فارغ وقصير");

  ok(JSON.stringify([ruling, principle]) === frozen, "النص الأصلي في الذاكرة كما هو");
  console.log(failed === 0 ? "✓ خصوصية مزوّد البحث النصّي" : `✗ فشل ${failed}`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
