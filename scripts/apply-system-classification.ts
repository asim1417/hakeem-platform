/**
 * apply-system-classification.ts — المرحلة ٣: حقن التصنيف والترميز (idempotent).
 *
 * يقرأ data/legal_systems_classified.json ويطابق كل نظام بالاسم مع legal_systems،
 * ثم يحدّث code/domain/domainTitle/sortOrder فقط. **تحديث فقط** — لا إنشاء ولا حذف.
 *
 * معاينة افتراضيًا. للكتابة: --apply
 * لا يطبع أسرارًا (بصمة المضيف فقط).
 */
import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";

const APPLY = process.argv.includes("--apply");
const prisma = new PrismaClient();

function safeHost(raw?: string): string {
  if (!raw) return "غير مضبوط";
  try {
    return new URL(raw).hostname;
  } catch {
    return "unparseable";
  }
}

interface ClsSystem {
  code: string;
  name: string;
  domain: string;
  domainTitle: string;
  order: number;
}

async function main() {
  console.log(`بصمة المضيف: ${safeHost(process.env.DATABASE_URL)}`);
  console.log(APPLY ? "الوضع: تطبيق فعلي (--apply)" : "الوضع: معاينة فقط (dry-run)");

  const file = path.join(process.cwd(), "data", "legal_systems_classified.json");
  const cls = (JSON.parse(fs.readFileSync(file, "utf-8")).systems ?? []) as ClsSystem[];
  console.log(`أنظمة الملف: ${cls.length}`);

  let updated = 0;
  let unchanged = 0;
  const unmatched: string[] = [];

  for (const s of cls) {
    const existing = await prisma.legalSystem.findUnique({ where: { name: s.name }, select: { id: true, code: true, domain: true, domainTitle: true, sortOrder: true } }).catch(() => null);
    if (!existing) {
      unmatched.push(s.name);
      continue;
    }
    const needs =
      existing.code !== s.code || existing.domain !== s.domain || existing.domainTitle !== s.domainTitle || existing.sortOrder !== s.order;
    if (!needs) {
      unchanged++;
      continue;
    }
    if (APPLY) {
      await prisma.legalSystem.update({
        where: { id: existing.id },
        data: { code: s.code, domain: s.domain, domainTitle: s.domainTitle, sortOrder: s.order }
      });
    }
    updated++;
  }

  console.log(`\nالنتيجة: ${APPLY ? "حُدِّث" : "سيُحدَّث"} ${updated}، دون تغيير ${unchanged}، غير مطابق ${unmatched.length}`);
  if (unmatched.length) {
    console.log("أنظمة في الملف بلا مطابق في القاعدة (لن تُنشأ — تحديث فقط):");
    unmatched.slice(0, 30).forEach((n) => console.log(`   • ${n}`));
  }
}

main()
  .catch((e) => {
    console.error("فشل:", e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
