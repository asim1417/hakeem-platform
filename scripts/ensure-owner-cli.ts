/**
 * ensure-owner-cli — تزويد حساب المالك يدويًّا (بدل تنفيذه عند كل إقلاع — AUTH-001/RUN-001).
 *
 *   npm run owner:ensure            # معاينة (لا كتابة)
 *   npm run owner:ensure -- --apply # يضمن الوجود/التفعيل (لا يمسّ كلمة مرور قائمة)
 *   npm run owner:ensure -- --apply --allow-role-write  # يضبط الدور SUPER_ADMIN أيضًا
 *
 * لا يطبع أي سرّ. لا يعيد كتابة passwordHash لحساب قائم. الدخول الرسمي عبر Clerk.
 */
import { ensurePlatformOwner, OWNER_DEFAULT_EMAIL } from "../lib/modules/auth/ensure-owner";

async function main() {
  const apply = process.argv.includes("--apply");
  const allowRoleWrite = process.argv.includes("--allow-role-write");
  if (!apply) {
    console.log(`🔎 DRY-RUN: سيضمن وجود المالك (${OWNER_DEFAULT_EMAIL}) بلا مسّ كلمة مرور قائمة.`);
    console.log("   أضف --apply للتنفيذ، و--allow-role-write لضبط الدور SUPER_ADMIN (بعد ترحيل enum المعتمد).");
    return;
  }
  const r = await ensurePlatformOwner({ allowRoleWrite });
  console.log(`✓ المالك: ${r.email} | created=${r.created} updated=${r.updated}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
