// اختبارات ثابتة للوكيل الأصيل — الأجزاء غير المعتمدة على قاعدةٍ حيّة أو Anthropic:
// مخطّطات الأدوات، سجلّ المهارات، تنفيذ load_skill/read_attachment، وقراءة العلم.
// (البحث/قراءة المصادر و حلقة Claude تُختبر حيًّا على النشر — تحتاج DB + مفتاح Anthropic.)
import { HAKEEM_TOOL_DEFS, executeTool, createAgentContext } from "../lib/modules/hakeem-agent/tools";
import { skillsIndex, loadSkillGuide } from "../lib/modules/hakeem-agent/skills";
import { nativeAgentEnabled, hakeemAgentMaxToolTurns } from "../lib/modules/hakeem-agent/flag";
import { HAKEEM_SYSTEM_PROMPT } from "../lib/modules/hakeem-agent/system";

let pass = 0;
const fails: string[] = [];
function check(name: string, fn: () => void | Promise<void>): Promise<void> {
  return Promise.resolve()
    .then(fn)
    .then(() => { pass += 1; console.log(`✓ ${name}`); })
    .catch((e) => { fails.push(`✗ ${name}: ${e instanceof Error ? e.message : e}`); console.log(`✗ ${name}`); });
}
function assert(cond: unknown, msg: string) { if (!cond) throw new Error(msg); }

async function main() {
  await check("مخطّطات الأدوات: كلٌّ باسمٍ ووصفٍ ومخطّط مدخلات", () => {
    assert(HAKEEM_TOOL_DEFS.length >= 5, "أدوات كافية");
    for (const t of HAKEEM_TOOL_DEFS) {
      assert(typeof t.name === "string" && t.name, `اسم أداة: ${JSON.stringify(t)}`);
      assert(typeof t.description === "string" && t.description.length > 10, `وصف أداة: ${t.name}`);
      assert(t.input_schema && (t.input_schema as { type?: string }).type === "object", `مخطّط أداة: ${t.name}`);
    }
    const names = HAKEEM_TOOL_DEFS.map((t) => t.name);
    for (const need of ["resolve_scope", "legal_search", "comprehensive_legal_scan", "deep_legal_study", "fetch_legal_source", "read_attachment", "load_skill"]) {
      assert(names.includes(need as (typeof names)[number]), `أداة مفقودة: ${need}`);
    }
  });

  await check("المهارات: الفهرس غير فارغ وكلٌّ باسمٍ ووصف", () => {
    const idx = skillsIndex();
    assert(idx.length >= 5, "عدد المهارات");
    for (const s of idx) assert(s.name && s.description, `مهارة: ${JSON.stringify(s)}`);
  });

  await check("load_skill: يعيد المنهج لاسمٍ صحيح", () => {
    const g = loadSkillGuide("case-analysis");
    assert(g && g.includes("تحرير المسألة") && g.includes("الدفوع المتقابلة"), "منهج case-analysis (الدراسة الموسّعة)");
    assert(loadSkillGuide("لا-توجد") === null, "مهارة غير موجودة → null");
  });

  await check("executeTool load_skill: ok لصحيحٍ، خطأٌ لغير موجود", async () => {
    const ctx = createAgentContext("");
    const ok = await executeTool("load_skill", { name: "legal-research" }, ctx);
    assert(ok.ok && (ok.data as { guide?: string }).guide, "تحميل مهارة صحيحة");
    const bad = await executeTool("load_skill", { name: "xyz" }, ctx);
    assert(!bad.ok, "مهارة غير موجودة → فشل");
  });

  await check("executeTool read_attachment: يعكس وجود المستند", async () => {
    const withDoc = await executeTool("read_attachment", {}, createAgentContext("نصّ الحكم المرفق"));
    assert(withDoc.ok && (withDoc.data as { hasAttachment: boolean }).hasAttachment === true, "مع مستند");
    const noDoc = await executeTool("read_attachment", {}, createAgentContext(""));
    assert(noDoc.ok && (noDoc.data as { hasAttachment: boolean }).hasAttachment === false, "بلا مستند");
  });

  await check("executeTool: أداةٌ غير معروفة → فشلٌ محكوم (لا رمي)", async () => {
    const r = await executeTool("ghost_tool", {}, createAgentContext(""));
    assert(!r.ok, "أداة مجهولة → ok=false");
  });

  await check("العلم: مفعّلٌ افتراضًا، ومفتاح إطفاءٍ طارئ من البيئة", () => {
    delete process.env.CLAUDE_NATIVE_AGENT_ENABLED;
    assert(nativeAgentEnabled() === true, "مفعّل افتراضًا");
    process.env.CLAUDE_NATIVE_AGENT_ENABLED = "0";
    assert(nativeAgentEnabled() === false, "0 = إطفاء طارئ");
    process.env.CLAUDE_NATIVE_AGENT_ENABLED = "off";
    assert(nativeAgentEnabled() === false, "off = إطفاء");
    process.env.CLAUDE_NATIVE_AGENT_ENABLED = "1";
    assert(nativeAgentEnabled() === true, "1 = مفعّل");
    delete process.env.CLAUDE_NATIVE_AGENT_ENABLED;
    assert(hakeemAgentMaxToolTurns() >= 1, "حدّ الدورات موجب");
  });

  await check("توجيه النظام: يحمل قاعدة «لا نتيجة نهائية بلا استيضاح» ومنع الاختراع", () => {
    assert(HAKEEM_SYSTEM_PROMPT.includes("لا تُقدّم نتيجةً نهائية"), "قاعدة الاستيضاح");
    assert(HAKEEM_SYSTEM_PROMPT.includes("غير حرٍّ في اختراع"), "منع اختراع المصادر");
    assert(HAKEEM_SYSTEM_PROMPT.includes("resolve_scope") && HAKEEM_SYSTEM_PROMPT.includes("legal_search"), "ذكر الأدوات");
  });

  console.log(`\nنتيجة: ${pass} نجح، ${fails.length} فشل`);
  if (fails.length) { console.log(fails.join("\n")); process.exit(1); }
}

void main();
