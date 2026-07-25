/**
 * فحص سطحي لمسارات API الجلسات — بلا خادم.
 * يتحقق من وجود العزل بـ service وrequireApiPermission وعدم ربط agent-search.
 */
import fs from "node:fs";
import path from "node:path";

let passed = 0;
let failed = 0;
const check = (cond: boolean, label: string) => {
  console.log(`  ${cond ? "✅" : "❌"} ${label}`);
  cond ? passed++ : failed++;
};

const root = process.cwd();
const files = [
  "app/api/conversations/route.ts",
  "app/api/conversations/[id]/route.ts",
  "app/api/conversations/[id]/messages/route.ts",
  "lib/modules/conversations/engine.ts",
  "lib/modules/conversations/api-auth.ts",
  "app/api/ai/agent-search/route.ts",
];

console.log("🧪 فحص سطح API محرك الجلسات");
for (const rel of files) {
  check(fs.existsSync(path.join(root, rel)), `وجود ${rel}`);
}

const listSrc = fs.readFileSync(path.join(root, "app/api/conversations/route.ts"), "utf8");
const getSrc = fs.readFileSync(path.join(root, "app/api/conversations/[id]/route.ts"), "utf8");
const msgSrc = fs.readFileSync(
  path.join(root, "app/api/conversations/[id]/messages/route.ts"),
  "utf8"
);
const engineSrc = fs.readFileSync(path.join(root, "lib/modules/conversations/engine.ts"), "utf8");
const authSrc = fs.readFileSync(path.join(root, "lib/modules/conversations/api-auth.ts"), "utf8");
const agentSrc = fs.readFileSync(path.join(root, "app/api/ai/agent-search/route.ts"), "utf8");

check(listSrc.includes("requireConversationService"), "GET/POST list يستخدم requireConversationService");
check(getSrc.includes("requireConversationService"), "GET/PATCH id يستخدم العزل");
check(msgSrc.includes("requireConversationService"), "messages يستخدم العزل");
check(authSrc.includes("JUDICIAL_ASSISTANT_USE") && authSrc.includes("LEGAL_CORE_VIEW"), "صلاحيات مفصولة حسب الخدمة");
check(engineSrc.includes("serviceKey: input.serviceKey"), "المحرك يقيّد الاستعلامات بـ serviceKey");
check(engineSrc.includes("userId: input.userId"), "المحرك يقيّد الاستعلامات بـ userId");
check(engineSrc.includes("clientRequestId"), "دعم idempotency في المحرك");
check(engineSrc.includes("linkGenerationJob"), "ربط generation_jobs موجود");
check(!agentSrc.includes("appendMessage") && !agentSrc.includes("conversations/engine"), "agent-search غير مربوط بمحرك الجلسات بعد");
check(!listSrc.includes("prisma.") || listSrc.includes("appendMessage"), "المسار يعتمد المحرك لا Prisma المباشر للقائمة/الإنشاء");

// لا تعديل موجهات الأوضاع
const modes = fs.readFileSync(path.join(root, "lib/modules/agents/modes.ts"), "utf8");
check(modes.includes('id: "ask"') && modes.includes('id: "consultation"'), "أوضاع اسأل لم تُمس");

console.log("-".repeat(50));
console.log(`النتيجة: ${passed} ناجح / ${failed} فاشل`);
if (failed > 0) process.exit(1);
