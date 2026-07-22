import { Briefcase, Gavel, Paperclip, ShieldCheck, Sparkles, Wallet } from "lucide-react";
import Link from "next/link";
import { ModuleCard } from "@/components/ModuleCard";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/modules/auth/session";
import { getStatus } from "@/lib/modules/billing/quota";
import { getCreditsStatus } from "@/lib/modules/credits/ledger";

export const dynamic = "force-dynamic";

/**
 * مساحة المستخدم الخاصّة — نقطة تجميع لكل عمل ملكه فقط.
 * النموذج المعتمد: عزل على مستوى الصفوف (userId/ownerId) في قاعدة مشتركة،
 * مع مكتبة قانونية عامة مشتركة، وحصّة/نقاط لكل مستخدم على حدة.
 */
export default async function FilesPage() {
  const user = await requireUser();

  const [cases, consultations, attachments, simulations, quota, credits] = await Promise.all([
    prisma.caseFile.count({ where: { ownerId: user.id } }).catch(() => 0),
    prisma.consultation.count({ where: { userId: user.id, status: "GENERATED" } }).catch(() => 0),
    prisma.attachment.count({ where: { caseFile: { ownerId: user.id } } }).catch(() => 0),
    prisma.simulation.count({ where: { userId: user.id } }).catch(() => 0),
    getStatus(user.id).catch(() => null),
    getCreditsStatus(user.id).catch(() => null)
  ]);

  const ar = (n: number) => n.toLocaleString("ar-SA");
  const usageLabel =
    quota && !quota.unknown
      ? quota.isSubscribed
        ? "اشتراك نشط"
        : `${ar(quota.remaining)} متبقية من ${ar(quota.total)}`
      : "—";
  const creditsLabel =
    credits && !credits.unknown ? `${ar(credits.balance)} نقطة` : "—";

  return (
    <div dir="rtl">
      <header className="hero">
        <p className="text-sm text-[var(--gold-pale)]">مساحتك الخاصّة · معزولة عن باقي المستخدمين</p>
        <h1 className="t-display mt-2 text-3xl font-bold md:text-4xl">مساحتي</h1>
        <p className="mt-3 max-w-3xl leading-8 text-white/85">
          هنا فقط ما يخصّك: قضاياك، استشاراتك، جلساتك، ومرفقاتك. لا يظهر عمل مستخدم آخر في هذه الصفحة.
        </p>
        <p className="mt-2 text-sm text-white/70">
          مرحبًا، {user.name}
        </p>
      </header>

      <section className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-md border border-line bg-ivory p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <Wallet className="text-olive" size={22} />
            <span className="rounded-full bg-sand px-3 py-1 text-xs text-olive">{usageLabel}</span>
          </div>
          <h3 className="mt-4 text-lg font-bold text-olive">استخدامك</h3>
          <p className="mt-2 text-sm leading-7 text-muted">
            الحصّة المجانية والنقاط مرتبطة بحسابك فقط — لا تُشارك مع مستخدمين آخرين.
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-sm">
            <Link href="/dashboard/billing" className="font-semibold text-olive underline">
              الفوترة والحصّة ←
            </Link>
            <span className="text-muted">·</span>
            <span className="tabular-nums text-olive">{creditsLabel}</span>
          </div>
        </div>
        <div className="rounded-md border border-line bg-ivory p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <Sparkles className="text-olive" size={22} />
            <span className="rounded-full bg-sand px-3 py-1 text-xs text-olive">مكتبة عامة</span>
          </div>
          <h3 className="mt-4 text-lg font-bold text-olive">ما يُشارك؟</h3>
          <p className="mt-2 text-sm leading-7 text-muted">
            الأنظمة والمواد والأحكام مرجعٌ عام للمنصة. عملك الخاص (قضايا · محاكاة · مرفقات) يبقى لك وحدك.
          </p>
          <Link href="/dashboard/legal-core" className="mt-4 inline-block text-sm font-semibold text-olive underline">
            فتح النواة القانونية ←
          </Link>
        </div>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <ModuleCard
          href="/dashboard/cases"
          title="قضاياي"
          metric={`${ar(cases)} قضية`}
          icon={Briefcase}
          description="ملفات قضاياك مع سجلّ العمليات والربط بالبيّنات."
        />
        <ModuleCard
          href="/dashboard/consultations"
          title="استشاراتي"
          metric={`${ar(consultations)} استشارة`}
          icon={ShieldCheck}
          description="سجلّ استشاراتك المؤصّلة المحفوظة للرجوع إليها."
        />
        <ModuleCard
          href="/dashboard/simulations"
          title="جلساتي"
          metric={`${ar(simulations)} جلسة`}
          icon={Gavel}
          description="جلسات القاضي التفاعلي الخاصة بحسابك."
        />
        <ModuleCard
          href="/dashboard/attachments"
          title="مرفقاتي"
          metric={`${ar(attachments)} مرفق`}
          icon={Paperclip}
          description="مستنداتك وبيّناتك المرفوعة مع بياناتها الوصفية."
        />
      </section>
    </div>
  );
}
