// ─────────────────────────────────────────────────────────────────────────────
// اختبار دخانٍ حيّ للخدمات النموذجيّة على الموقع المنشور — يُشغَّل من بيئةٍ تصل الموقع
// وتملك مفاتيحه (جهازك أو Vercel)، لا من صندوق CI المعزول.
//
// الاستعمال:
//   BASE=https://hakeem-platform.vercel.app CASE_ID=<uuid> npx tsx scripts/smoke-judicial.ts
//   (CASE_ID اختياريّ — بدونه يُختبَر الموجّه العامّ فقط. مع قضيّةٍ لها مرفقات تُختبَر البقيّة.)
//
// «نجاح» = المسار ردّ باستجابةٍ صحيحة (لا خطأ شبكة/500)، سواءٌ أجاب أو امتنع بصدق.
// ─────────────────────────────────────────────────────────────────────────────

const BASE = process.env.BASE || process.argv[2] || "";
const CASE_ID = process.env.CASE_ID || process.argv[3] || "";
if (!BASE) { console.error("مطلوب BASE=https://…"); process.exit(1); }

let pass = 0, fail = 0;
async function hit(name: string, path: string, body: unknown): Promise<void> {
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    const txt = await res.text();
    let shape = "";
    try { const j = JSON.parse(txt); shape = j.blocked ? "امتناع صادق" : (j.answer || j.summary || j.body || j.output || j.rows || j.computations || j.items || j.sections) ? "مخرَج" : "استجابة"; }
    catch { shape = "نصّ"; }
    if (res.ok) { pass++; console.log(`  ✓ ${name} — ${res.status} (${shape})`); }
    else { fail++; console.log(`  ✗ ${name} — ${res.status} ${txt.slice(0, 120)}`); }
  } catch (e) { fail++; console.log(`  ✗ ${name} — خطأ شبكة: ${e instanceof Error ? e.message : e}`); }
}

(async () => {
  console.log(`\n── اختبار دخانٍ حيّ: ${BASE} ──\n`);
  console.log("الموجّه (بلا قضية):");
  await hit("موجّه المعاون /ask", "/api/judicial-assistant/ask", { question: "ما مدّة الاعتراض على حكمٍ تجاريّ؟" });

  if (CASE_ID) {
    console.log(`\nخدمات القضية (CASE_ID=${CASE_ID}):`);
    await hit("JS-001 الملخّص", "/api/judicial-assistant/summary", { caseId: CASE_ID });
    await hit("JS-013 الدراسة", "/api/judicial-assistant/study", { caseId: CASE_ID, depth: "short" });
    await hit("JS-018 مشروع الحكم", "/api/judicial-assistant/draft", { caseId: CASE_ID });
    await hit("JS-002 مذكّرة إحاطة (نموذج)", "/api/judicial-assistant/work", { caseId: CASE_ID, serviceId: "JS-002" });
    await hit("JS-009 حساب المدد (حتميّ)", "/api/judicial-assistant/action", { caseId: CASE_ID, serviceId: "JS-009" });
    await hit("موجّه القضية /ask", "/api/judicial-assistant/ask", { question: "ما أبرز نقاط القوّة؟", caseId: CASE_ID });
  } else {
    console.log("\n(مرّر CASE_ID لقضيّةٍ لها مرفقات لاختبار بقيّة الخدمات.)");
  }

  console.log(`\n── ${pass} ناجح، ${fail} فاشل ──`);
  process.exit(fail ? 1 : 0);
})();
