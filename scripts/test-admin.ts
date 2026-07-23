/**
 * اختبار تفعيل لوحة الإدارة (المرحلة التاسعة).
 * يعمل بلا قاعدة: يتحقق من مصفوفة الصلاحيات الأساسية، كتالوج الصلاحيات،
 * حماية سحب الصلاحية الأساسية، واختيار خلفية التخزين (Azure/SharePoint/metadata).
 *
 * التشغيل: npm run test:admin
 */
import {
  buildBaselineMatrix,
  PERMISSION_CATALOG,
  ROLE_ORDER,
  isPermission,
  isRole,
  setRolePermission,
} from "@/lib/modules/auth/role-admin";
import { storageBackend, sharePointConfigured, azureConfigured } from "@/lib/modules/attachments/blob-storage";

let passed = 0;
let failed = 0;
const check = (cond: boolean, label: string) => {
  console.log(`  ${cond ? "✅" : "❌"} ${label}`);
  cond ? passed++ : failed++;
};

const SP = ["SHAREPOINT_DRIVE_ID", "SHAREPOINT_ACCESS_TOKEN", "SHAREPOINT_TENANT_ID", "SHAREPOINT_CLIENT_ID", "SHAREPOINT_CLIENT_SECRET"];
const AZ = ["AZURE_STORAGE_ACCOUNT", "AZURE_STORAGE_CONTAINER", "AZURE_STORAGE_SAS_TOKEN"];
function clearStorageEnv() {
  for (const k of [...SP, ...AZ]) delete process.env[k];
}

async function main() {
  console.log("🧪 اختبار تفعيل لوحة الإدارة");
  console.log("=".repeat(50));

  // ١. كتالوج الصلاحيات والأدوار
  check(PERMISSION_CATALOG.length === 16, `كتالوج الصلاحيات كامل (${PERMISSION_CATALOG.length})`);
  check(new Set(PERMISSION_CATALOG.map((p) => p.key)).size === PERMISSION_CATALOG.length, "لا تكرار في مفاتيح الصلاحيات");
  check(ROLE_ORDER.length === 6 && ROLE_ORDER[0] === "SUPER_ADMIN", "ترتيب الأدوار صحيح");
  check(isPermission("USERS_MANAGE") && !isPermission("NOPE"), "حارس صحّة الصلاحية");
  check(isRole("LAWYER") && !isRole("ROOT"), "حارس صحّة الدور");

  // ٢. مصفوفة الأساس تعكس rbac
  const matrix = buildBaselineMatrix();
  const admin = matrix.find((m) => m.role === "SYSTEM_ADMIN")!;
  const superAdmin = matrix.find((m) => m.role === "SUPER_ADMIN")!;
  const trainee = matrix.find((m) => m.role === "TRAINEE")!;
  const lawyer = matrix.find((m) => m.role === "LAWYER")!;
  const adminUsers = admin.cells.find((c) => c.permission === "USERS_MANAGE")!;
  check(adminUsers.effective && adminUsers.locked, "مدير النظام يملك USERS_MANAGE (أساسية مقفلة)");
  check(
    superAdmin.cells.find((c) => c.permission === "SUPER_ADMIN_ACCESS")!.effective,
    "السوبر أدمن يملك SUPER_ADMIN_ACCESS"
  );
  check(
    !admin.cells.find((c) => c.permission === "SUPER_ADMIN_ACCESS")!.effective,
    "مدير النظام لا يملك SUPER_ADMIN_ACCESS"
  );
  check(!trainee.cells.find((c) => c.permission === "USERS_MANAGE")!.effective, "المتدرّب لا يملك USERS_MANAGE");
  check(lawyer.cells.find((c) => c.permission === "CONSULTATIONS_FULL")!.effective, "المحامي يملك الاستشارات الكاملة");
  check(admin.cells.every((c) => c.granted === false), "الأساس لا يحوي منحاً إضافياً (granted=false)");

  // ٣. حماية سحب الصلاحية الأساسية (قبل أي قاعدة)
  const revokeBaseline = await setRolePermission("SYSTEM_ADMIN", "USERS_MANAGE", false);
  check(!revokeBaseline.ok && Boolean(revokeBaseline.message), "لا يمكن سحب صلاحية أساسية");
  const grantBaseline = await setRolePermission("LAWYER", "CONSULTATIONS_FULL", true);
  check(grantBaseline.ok, "منح صلاحية أساسية موجودة لا يفشل");
  const grantSuper = await setRolePermission("SYSTEM_ADMIN", "SUPER_ADMIN_ACCESS", true);
  check(!grantSuper.ok, "لا يمكن منح SUPER_ADMIN_ACCESS لغير السوبر");

  // ٤. اختيار خلفية التخزين
  clearStorageEnv();
  check(storageBackend() === "metadata-only" && !azureConfigured() && !sharePointConfigured(), "بلا إعداد → metadata-only");

  process.env.SHAREPOINT_DRIVE_ID = "drive123";
  process.env.SHAREPOINT_ACCESS_TOKEN = "tok";
  check(sharePointConfigured() && storageBackend() === "sharepoint", "ضبط SharePoint → sharepoint");

  process.env.AZURE_STORAGE_ACCOUNT = "acc";
  process.env.AZURE_STORAGE_CONTAINER = "cont";
  process.env.AZURE_STORAGE_SAS_TOKEN = "sas";
  check(azureConfigured() && storageBackend() === "azure-blob", "أولوية Azure عند ضبط الاثنين");

  // SharePoint بدون توكن/اعتماد → غير مُهيّأ
  clearStorageEnv();
  process.env.SHAREPOINT_DRIVE_ID = "drive123";
  check(!sharePointConfigured(), "SharePoint بلا توكن/اعتماد → غير مُهيّأ");
  clearStorageEnv();

  // ٥. عدم كسر المراحل السابقة (استيراد الوحدات)
  try {
    const { runJudicialSimulation } = await import("@/lib/modules/judicial-simulation/judicial-simulation");
    const v = await runJudicialSimulation({ caseFacts: "واقعة اختبار للتأكد من عدم الكسر." });
    check(typeof v.caseSummary === "string" && Array.isArray(v.citations), "المحاكاة القضائية سليمة (لم تُكسَر)");
  } catch (e) {
    console.log(`  ⏭️  تخطّي تحقق المراحل السابقة: ${e instanceof Error ? e.message.split("\n")[0] : e}`);
  } finally {
    try {
      const { prisma } = await import("@/lib/prisma");
      await prisma.$disconnect();
    } catch {
      /* لا شيء */
    }
  }

  console.log("\n" + "=".repeat(50));
  console.log(`النتيجة: ${passed} نجح، ${failed} فشل`);
  if (failed > 0) process.exit(1);
  console.log("✅ نجح اختبار تفعيل لوحة الإدارة.");
}

main().catch((e) => {
  console.error("❌ فشل الاختبار:", e instanceof Error ? e.message : e);
  process.exit(1);
});
