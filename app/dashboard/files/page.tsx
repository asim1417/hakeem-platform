import { Briefcase, Paperclip, ShieldCheck } from "lucide-react";
import { ModuleCard } from "@/components/ModuleCard";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/modules/auth/session";

export const dynamic = "force-dynamic";

// ملفّاتي — صفحة تجميع لعمل المستخدم: الدعاوى · الاستشارات · المرفقات.
export default async function FilesPage() {
  const user = await requireUser();

  // أعداد المستخدم نفسه (عمله هو) — لا أعداد عالمية.
  // القضايا بالمالك؛ الاستشارات المحفوظة بالمستخدم؛ المرفقات ضمن قضاياه (الملكية غير مباشرة عبر القضية).
  const [cases, consultations, attachments] = await Promise.all([
    prisma.caseFile.count({ where: { ownerId: user.id } }).catch(() => 0),
    prisma.consultation.count({ where: { userId: user.id, status: "GENERATED" } }).catch(() => 0),
    prisma.attachment.count({ where: { caseFile: { ownerId: user.id } } }).catch(() => 0),
  ]);

  return (
    <div dir="rtl">
      <header className="hero">
        <p className="text-sm text-[var(--gold-pale)]">مساحتك الخاصّة</p>
        <h1 className="t-display mt-2 text-3xl font-bold md:text-4xl">ملفّاتي</h1>
        <p className="mt-3 max-w-3xl leading-8 text-white/85">
          كل ما يخصّك في مكان واحد — دعاواك، استشاراتك المحفوظة، ومرفقاتك.
        </p>
      </header>

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <ModuleCard
          href="/dashboard/cases"
          title="الدعاوى"
          metric={`${cases.toLocaleString("ar-SA")} قضية`}
          icon={Briefcase}
          description="ملفات قضاياك مع سجلّ العمليات والربط بالبيّنات."
        />
        <ModuleCard
          href="/dashboard/consultations"
          title="الاستشارات"
          metric={`${consultations.toLocaleString("ar-SA")} استشارة`}
          icon={ShieldCheck}
          description="سجلّ استشاراتك المؤصّلة المحفوظة للرجوع إليها."
        />
        <ModuleCard
          href="/dashboard/attachments"
          title="المرفقات"
          metric={`${attachments.toLocaleString("ar-SA")} مرفق`}
          icon={Paperclip}
          description="مستنداتك وبيّناتك المرفوعة مع بياناتها الوصفية."
        />
      </section>
    </div>
  );
}
