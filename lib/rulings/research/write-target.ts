/**
 * write-target — أقفال الكتابة لسكربتات طبقة الأحكام البحثية (مشتركة).
 *   • فرع بحثي: NEON_RESEARCH_DATABASE_URL + CONFIRM_RESEARCH_WRITE=YES، ويُرفض إن طابق مضيفُه الإنتاج.
 *   • الإنتاج: CONFIRM_RUNTIME_DB_ALIGNMENT=NEON_RUNTIME_CONFIRMED + OWNER_APPROVAL_REF (مرجع موافقة المالك) + DATABASE_URL.
 * لا يُطبع رابط ولا كلمة مرور.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import type { PrismaClient } from "@prisma/client";

export const META_SEGMENTS_MIGRATION = path.join(process.cwd(), "prisma/migrations/20261016180000_ruling_meta_segments/migration.sql");

export const hostOf = (u?: string) => {
  try {
    return u ? new URL(u).hostname.replace("-pooler", "") : "";
  } catch {
    return "";
  }
};

/** هدف الكتابة بأقفاله: فرع بحثي مستقل، أو الإنتاج بموافقة المالك المسجّلة. */
export function resolveWriteTarget(): { url: string; kind: "research" | "production"; approval: string | null } {
  const research = process.env.NEON_RESEARCH_DATABASE_URL;
  if (research && process.env.CONFIRM_RESEARCH_WRITE === "YES") {
    // يفشل مغلقًا: لا بد من معرفة مضيف الإنتاج، ويُقارن بكل روابطه المعروفة.
    const prodHosts = [process.env.NEON_DATABASE_URL, process.env.DATABASE_URL, process.env.DIRECT_DB_URL]
      .map(hostOf).filter(Boolean);
    if (!prodHosts.length) {
      console.error("🛑 مضيف الإنتاج غير معروف (NEON_DATABASE_URL/DATABASE_URL) — لا يُتحقق من استقلال الفرع البحثي.");
      process.exit(2);
    }
    if (!/neon\.tech$/.test(hostOf(research)) || prodHosts.includes(hostOf(research))) {
      console.error("🛑 هدف الكتابة ليس فرع Neon بحثيًّا مستقلًّا عن الإنتاج.");
      process.exit(2);
    }
    return { url: research, kind: "research", approval: null };
  }
  const approval = (process.env.OWNER_APPROVAL_REF ?? "").trim();
  if (process.env.CONFIRM_RUNTIME_DB_ALIGNMENT === "NEON_RUNTIME_CONFIRMED" && approval && process.env.DATABASE_URL) {
    return { url: process.env.DATABASE_URL, kind: "production", approval };
  }
  console.error("🛑 الكتابة مقفولة: فرع بحثي (NEON_RESEARCH_DATABASE_URL + CONFIRM_RESEARCH_WRITE=YES) " +
    "أو الإنتاج (CONFIRM_RUNTIME_DB_ALIGNMENT=NEON_RUNTIME_CONFIRMED + OWNER_APPROVAL_REF).");
  process.exit(2);
}

/** يطبّق ملف هجرة متساوي القوة جملةً جملة (التعليقات تُحذف). */
export async function applyMigration(prisma: PrismaClient, file: string) {
  for (const stmt of readFileSync(file, "utf8").split(/;\s*\n/).map((x) => x.replace(/^\s*--.*$/gm, "").trim()).filter(Boolean)) {
    await prisma.$executeRawUnsafe(stmt);
  }
}

