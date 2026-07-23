/**
 * اختبار بوابة السوبر أدمن + حماية التعيين + رايات الخدمات.
 * npx tsx scripts/test-super-admin.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  isPlatformOwnerEmail,
  isOAuthAdminEmail,
  PLATFORM_OWNER_EMAILS,
} from "../lib/modules/auth/oauth-shared";
import { ROLE_PERMISSIONS } from "../lib/modules/auth/role-permissions";
import { isSystemAdmin } from "../lib/modules/auth/ownership";
import { setRolePermission, ROLE_ORDER, isRole } from "../lib/modules/auth/role-admin";

async function main() {
  const root = process.cwd();

  assert.equal(isPlatformOwnerEmail(PLATFORM_OWNER_EMAILS[0]), true);
  assert.equal(isPlatformOwnerEmail("lawyer@example.com"), false);
  assert.equal(isOAuthAdminEmail(PLATFORM_OWNER_EMAILS[0]), true);

  assert.ok(ROLE_PERMISSIONS.SUPER_ADMIN.includes("SUPER_ADMIN_ACCESS"));
  assert.equal(ROLE_PERMISSIONS.SYSTEM_ADMIN.includes("SUPER_ADMIN_ACCESS"), false);
  assert.ok(ROLE_PERMISSIONS.SUPER_ADMIN.includes("USERS_MANAGE"));

  assert.equal(isSystemAdmin({ id: "1", role: "SUPER_ADMIN" }), true);
  assert.equal(isSystemAdmin({ id: "1", role: "SYSTEM_ADMIN" }), true);
  assert.equal(isSystemAdmin({ id: "1", role: "LAWYER" }), false);

  assert.equal(ROLE_ORDER[0], "SUPER_ADMIN");
  assert.equal(isRole("SUPER_ADMIN"), true);

  const blocked = await setRolePermission("LAWYER", "SUPER_ADMIN_ACCESS", true);
  assert.equal(blocked.ok, false);

  const files = [
    "app/admin/page.tsx",
    "app/admin/services/page.tsx",
    "app/admin/jobs/page.tsx",
    "app/admin/audit/page.tsx",
    "app/api/admin/feature-toggles/route.ts",
    "app/api/admin/jobs/route.ts",
    "lib/modules/auth/super-admin.ts",
    "prisma/migrations/20260723160000_add_super_admin_role/migration.sql",
  ];
  for (const f of files) {
    assert.ok(fs.existsSync(path.join(root, f)), `missing ${f}`);
  }

  const usersApi = fs.readFileSync(path.join(root, "app/api/admin/users/[id]/route.ts"), "utf8");
  assert.ok(usersApi.includes("canAssignSuperAdmin"));
  assert.ok(usersApi.includes("لا يمكنك تغيير دورك بنفسك"));

  const schema = fs.readFileSync(path.join(root, "prisma/schema.prisma"), "utf8");
  assert.ok(schema.includes("SUPER_ADMIN"));
  assert.ok(!schema.includes("DROP TABLE"));

  console.log("test-super-admin: OK");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
