// عرضٌ حيّ لطبقة الوكلاء — «افتح» (كتالوج صفحة /dashboard/agents) + «استدعِ» (أدوات مدخل MCP).
// يستدعي نفس دوال المدخل. المحرّك هنا مُحقَنٌ صوريًّا (لا قاعدة في هذه البيئة) لإثبات المسار والحرّاس.
import { listManifests, getManifest, validateManifest, stanceFromArabic } from "@/lib/agent-runtime/live/manifests";
import { composeGrounded } from "@/lib/agent-runtime/live/compose";
import { handleSearch, isForbiddenCell } from "@/lib/agent-runtime/pipeline/searchRoute";
import { computeDeadline } from "@/lib/agent-runtime/tools/hijriDateCalc";
import type { EngineResult } from "@/lib/agent-runtime/types";

const line = "─".repeat(72);

// ── «افتح»: ما تعرضه صفحة /dashboard/agents ──
console.log("\n█ افتح — كتالوج /dashboard/agents\n" + line);
for (const a of listManifests()) {
  const engineTools = Array.from(new Set(a.skills.flatMap((s) => s.engineTools)));
  console.log(`\n▸ ${a.displayName}  [${a.approval.status === "approved" ? "معتمَد ✓" : "قيد الاعتماد"}]`);
  console.log(`  المعرّف: ${a.agentId}   ·   الدور: ${a.practiceProfile.role}`);
  console.log(`  النطاق: ${a.scope.defaultSystems.map((s) => s.replace(/-/g, " ")).join(" · ")}`);
  if (a.subRoles?.length) console.log(`  الأدوار: ${a.subRoles.map((s) => `${s.displayName ?? s.subRoleId}(${s.stance})`).join(" · ")}`);
  console.log(`  الأدوات: ${engineTools.join(" · ")}`);
  console.log(`  مدخل: /api/mcp/${a.agentId}   ·   المطابقة: HLS ${a.approval.conformanceTestsPassed.length}/6 + مواقف ${a.approval.agentConformanceTestsPassed?.length ?? 0}   ·   صالح: ${validateManifest(a).length === 0}`);
}

// ── «استدعِ»: أدوات المدخل ──
(async () => {
  console.log("\n\n█ استدعِ — أدوات مدخل MCP\n" + line);

  // (١) أداة المهلة — حتميّة، بلا قاعدة، حيّة فعلًا.
  const d = computeDeadline({ year: 1447, month: 3, day: 15 }, 30);
  console.log("\n① احسب_المهلة (aman-commercial-litigator) — تبليغ 1447/3/15 + 30 يومًا");
  console.log(`   ⟶ تنتهي: ${d.due.year}/${d.due.month}/${d.due.day}هـ  الموافق ${d.dueGregorian.year}-${String(d.dueGregorian.month).padStart(2,"0")}-${String(d.dueGregorian.day).padStart(2,"0")}م   (فرق JDN = ${d.jdnDue - (d.jdnDue - d.periodDays)} يومًا)`);

  // محرّك صوريّ (بديل القاعدة في هذه البيئة) — مادّتان ضمن نطاق المحاكم التجارية.
  const mockEngine = (scope: string[]): Promise<EngineResult> => {
    const sys = scope.map((s) => s.replace(/-/g, " ")).find((s) => s.includes("المحاكم التجارية")) ?? scope[0].replace(/-/g, " ");
    return Promise.resolve({
      scopeSystems: scope.map((s) => s.replace(/-/g, " ")),
      articles: [
        { system: sys, article: "20", text: "نصّ المادة العشرين…", enforcement: "ساري" },
        { system: sys, article: "21", text: "نصّ المادة الحادية والعشرين…", enforcement: "ساري" },
        { system: sys, article: "99", text: "مادة منسوخة…", enforcement: "لاغٍ" },
      ],
    });
  };

  // (٢) بحث مقيّد بالنطاق — يمرّ بالحرّاس (تأريض/نطاق/نفاذ). المادة اللاغية تُستبعَد من السند.
  const m = getManifest("aman-commercial-litigator")!;
  const res = await handleSearch(
    { query: "اختصاص المحكمة التجارية", scope: m.scope.defaultSystems, stance: "neutral", taskMode: "ask" },
    { runEngine: (q, s) => mockEngine(s), compose: composeGrounded }
  );
  console.log("\n② بحث_في_نطاقي (aman-commercial-litigator) — «اختصاص المحكمة التجارية»");
  if (res.status === "ok") {
    console.log(`   ⟶ الحالة: ok   ·   العنوان: «${res.answer.title}»`);
    console.log(`   ⟶ السند (مؤرَّض، داخل النطاق، بلا لاغٍ): ${res.answer.sources.map((s) => `${s.system} م/${s.article}`).join("، ")}`);
    console.log(`   ⟶ لاحظ: المادة (99) اللاغية استُبعِدت تلقائيًّا من السند (حارس النفاذ).`);
  } else console.log(`   ⟶ الحالة: ${res.status}`);

  // (٣) بوّابة الخلية المحرّمة — معاون قاضٍ (مشرف) × تقدير حكم = محجوب قبل أي استرجاع.
  const blocked = isForbiddenCell(stanceFromArabic("مشرف"), "verdict-estimate");
  console.log("\n③ بوّابة الموقف — معاون قاضٍ (مشرف) × «تقدير حكم»");
  console.log(`   ⟶ ${blocked ? "محجوب ✓ (لا يقترح منطوقًا — يُقترَح: analyze-case)" : "مسموح"}`);

  // (٤) حارس التأريض — محاولة حقن مصدرٍ غير مسترجَع تُرفَض.
  const leak = await handleSearch(
    { query: "x", scope: m.scope.defaultSystems, stance: "neutral", taskMode: "ask" },
    { runEngine: (q, s) => mockEngine(s), compose: (er, ctx) => ({
      title: "مخرَجٌ محقون", stance: ctx.stance, scope: ctx.scope,
      sections: [{ heading: "أ", body: "نصّ." }],
      sources: [{ ref: "z", system: "نظام غير مطلوب", article: "500", enforcement: "ساري" }], // مختلَق + خارج النطاق
    }) }
  );
  console.log("\n④ حارس التأريض/النطاق — حقن مصدرٍ مختلَقٍ خارج النطاق");
  console.log(`   ⟶ الحالة: ${leak.status}${leak.status === "rejected" ? "  ·  مخالفات: " + leak.verdict.rejects.join("؛ ") : ""}`);

  console.log("\n" + line + "\nانتهى العرض. المدخل والحرّاس والأدوات تعمل كما في الإنتاج.\n");
})();
