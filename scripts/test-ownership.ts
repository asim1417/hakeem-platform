/**
 * اختبار عزل بيانات المستخدمين (ملكيّة المحاكاة/القضايا/المرفقات).
 * يعمل بلا قاعدة: يتحقق من دوال where ومسحًا ثابتًا لمسارات API الحسّاسة.
 *
 * التشغيل: npx tsx scripts/test-ownership.ts
 */
import fs from "node:fs";
import path from "node:path";
import {
  attachmentListWhere,
  caseListWhere,
  consultationListWhere,
  isSystemAdmin,
  simulationListWhere,
  simulationOwnedWhere
} from "@/lib/modules/auth/ownership";

let passed = 0;
let failed = 0;
const check = (cond: boolean, label: string) => {
  console.log(`  ${cond ? "✅" : "❌"} ${label}`);
  cond ? passed++ : failed++;
};

const trainee = { id: "user-a", role: "TRAINEE" as const };
const admin = { id: "admin-1", role: "SYSTEM_ADMIN" as const };
const lawyer = { id: "user-b", role: "LAWYER" as const };

console.log("🧪 اختبار عزل بيانات المستخدمين");
console.log("=".repeat(50));

check(isSystemAdmin(admin) && !isSystemAdmin(trainee) && !isSystemAdmin(lawyer), "isSystemAdmin يميّز المدير فقط");

check(simulationListWhere(admin) === undefined, "قائمة المحاكاة للمدير بلا قيد");
check(JSON.stringify(simulationListWhere(trainee)) === JSON.stringify({ userId: "user-a" }), "قائمة المحاكاة للمتدرّب مقيّدة بـ userId");

check(JSON.stringify(simulationOwnedWhere(trainee, "sim-1")) === JSON.stringify({ id: "sim-1", userId: "user-a" }), "ملكيّة جلسة: متدرّب + id + userId");
check(JSON.stringify(simulationOwnedWhere(admin, "sim-1")) === JSON.stringify({ id: "sim-1" }), "ملكيّة جلسة: المدير بالمعرّف فقط");

check(caseListWhere(admin) === undefined, "قائمة القضايا للمدير بلا قيد");
check(JSON.stringify(caseListWhere(lawyer)) === JSON.stringify({ ownerId: "user-b" }), "قائمة القضايا للمحامي مقيّدة بـ ownerId");

check(consultationListWhere(admin) === undefined, "قائمة الاستشارات للمدير بلا قيد");
check(JSON.stringify(consultationListWhere(trainee)) === JSON.stringify({ userId: "user-a" }), "قائمة الاستشارات للمتدرّب مقيّدة");

const attWhere = attachmentListWhere(trainee);
check(attWhere !== undefined && Array.isArray((attWhere as { OR?: unknown }).OR), "قائمة المرفقات للمتدرّب عبر OR (قضية/uploadedBy)");
check(attachmentListWhere(admin) === undefined, "قائمة المرفقات للمدير بلا قيد");

// مسح ثابت: مسارات المحاكاة الفرعية يجب ألا تستخدم findUnique بلا ملكيّة
const simRoot = path.join(process.cwd(), "app", "api", "simulations");
const leakPattern = /prisma\.simulation\.findUnique\s*\(/;
const ownershipImport = /from\s+["']@\/lib\/modules\/auth\/ownership["']/;
const ownershipUse = /findOwnedSimulation|simulationListWhere|simulationOwnedWhere/;

function walkTs(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkTs(full));
    else if (entry.name.endsWith(".ts")) out.push(full);
  }
  return out;
}

const simFiles = walkTs(simRoot);
for (const file of simFiles) {
  const rel = path.relative(process.cwd(), file);
  const src = fs.readFileSync(file, "utf8");
  const hasLeak = leakPattern.test(src);
  check(!hasLeak, `${rel}: لا findUnique بلا ملكيّة`);
  if (rel.includes("[id]") || rel.endsWith(path.join("simulations", "route.ts"))) {
    check(ownershipImport.test(src) && ownershipUse.test(src), `${rel}: يستورد ويستخدم ownership`);
  }
}

// صفحات SSR الحسّاسة
const ssrChecks: Array<[string, RegExp]> = [
  ["app/dashboard/cases/page.tsx", /caseListWhere/],
  ["app/dashboard/attachments/page.tsx", /attachmentListWhere/],
  ["app/dashboard/page.tsx", /simulationListWhere|caseListWhere|consultationListWhere/],
  ["components/AppShell.tsx", /SYSTEM_ADMIN/]
];
for (const [rel, re] of ssrChecks) {
  const src = fs.readFileSync(path.join(process.cwd(), rel), "utf8");
  check(re.test(src), `${rel}: عزل مطبّق`);
}

console.log("=".repeat(50));
console.log(`النتيجة: ${passed} نجح · ${failed} فشل`);
if (failed > 0) process.exit(1);
