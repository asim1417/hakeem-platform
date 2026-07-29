import type { UserRole } from "@prisma/client";
import { hasPermission, type Permission } from "@/lib/modules/auth/rbac";

const roles: UserRole[] = ["TRAINEE", "LAWYER", "TRAINER", "SYSTEM_ADMIN"];
const rasdPermissions: Permission[] = ["RASD_VIEW", "RASD_REVIEW", "RASD_APPLY", "RASD_ADMIN"];

const expected: Record<UserRole, Partial<Record<Permission, boolean>>> = {
  TRAINEE: {
    RASD_VIEW: false,
    RASD_REVIEW: false,
    RASD_APPLY: false,
    RASD_ADMIN: false
  },
  LAWYER: {
    RASD_VIEW: true,
    RASD_REVIEW: false,
    RASD_APPLY: false,
    RASD_ADMIN: false
  },
  TRAINER: {
    RASD_VIEW: true,
    RASD_REVIEW: true,
    RASD_APPLY: false,
    RASD_ADMIN: false
  },
  SYSTEM_ADMIN: {
    RASD_VIEW: true,
    RASD_REVIEW: true,
    RASD_APPLY: true,
    RASD_ADMIN: true
  },
  SUPER_ADMIN: {},
  JUDGE: {}
};

let failures = 0;

for (const role of roles) {
  for (const permission of rasdPermissions) {
    const actual = hasPermission(role, permission);
    const wanted = expected[role][permission];
    if (actual !== wanted) {
      failures += 1;
      console.error(`FAIL ${role} ${permission}: expected ${String(wanted)}, got ${String(actual)}`);
    } else {
      console.log(`PASS ${role} ${permission}`);
    }
  }
}

if (failures > 0) {
  process.exit(1);
}
