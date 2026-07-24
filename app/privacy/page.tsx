import Link from "next/link";
import { assertBuiltinPageEnabled } from "@/lib/modules/site/page-gate";

export const metadata = {
  title: "سياسة الخصوصية — منصة حكيم",
  description: "سياسة الخصوصية ومعالجة البيانات الشخصية في منصة حكيم وفق نظام حماية البيانات الشخصية (PDPL).",
};

export const dynamic = "force-dynamic";

const sections: Array<{ h: string; p: string[] }> = [
  {
    h: "١) مقدمة",
    p: [
      "تلتزم منصة حكيم بحماية خصوصية مستخدميها ومعالجة بياناتهم الشخصية وفق نظام حماية البيانات الشخصية السعودي (PDPL) ولائحته التنفيذية. توضّح هذه السياسة أنواع البيانات التي نعالجها، وأغراض المعالجة، وحقوق صاحب البيانات.",
    ],
  },
  {
    h: "٢) البيانات التي نعالجها",
    p: [
      "بيانات الحساب: الاسم، البريد الإلكتروني، الدور (محامٍ/متدرّب/مدرّب/مدير).",
      "بيانات الاستخدام: عمليات البحث، الاستشارات، جلسات المحاكاة، وسجلات التدقيق — لأغراض تشغيلية وتحسين الخدمة.",
      "لا تُرسَل بياناتك الشخصية إلى مزوّدات الذكاء الاصطناعي؛ تُرسَل وقائع القضية فقط دون معرّفات شخصية.",
    ],
  },
  {
    h: "٣) أغراض المعالجة",
    p: [
      "تقديم خدمات البحث القانوني والاستشارات والمحاكاة والتدريب.",
      "تأمين الحساب وإدارة الصلاحيات والتدقيق.",
      "تحسين جودة الاسترجaع والبحث (عبر سجلات بحث مجهّلة قدر الإمكان).",
    ],
  },
  {
    h: "٤) الأساس النظامي والموافقة",
    p: [
      "تتم المعالجة بناءً على موافقتك عند إنشاء الحساب واستخدام الخدمة، وبما يحقّق المصلحة المشروعة لتقديم الخدمة القانونية، ووفق الأسس المسموح بها في نظام حماية البيانات الشخصية.",
    ],
  },
  {
    h: "٥) حماية البيانات",
    p: [
      "تُشفَّر بيانات الاعتماد الحسّاسة، وتُحفظ المفاتيح بتشفير AES-256، ولا تُعرض للعميل.",
      "يُسجَّل الوصول للعمليات الحسّاسة في سجل تدقيق، وتُطبَّق صلاحيات الأدوار (RBAC).",
    ],
  },
  {
    h: "٦) حقوق صاحب البيانات",
    p: [
      "لك الحق في: العلم بمعالجة بياناتك، والوصول إليها، وتصحيحها، وطلب حذفها أو إتلافها وفق النظام، وسحب الموافقة.",
      "لممارسة حقوقك أو لأي استفسار، تواصل مع مسؤول حماية البيانات عبر قنوات الدعم.",
    ],
  },
  {
    h: "٧) الاحتفاظ بالبيانات",
    p: ["نحتفظ بالبيانات للمدة اللازمة لتحقيق أغراض المعالجة أو بما تتطلّبه الأنظمة، ثم تُتلف أو تُجهَّل بشكل آمن."],
  },
  {
    h: "٨) التحديثات",
    p: ["قد تُحدَّث هذه السياسة لتواكب التغييرات النظامية أو التشغيلية، ويُعلَن عن التحديثات داخل المنصّة."],
  },
];

export default async function PrivacyPage() {
  await assertBuiltinPageEnabled("privacy");

  return (
    <main dir="rtl" className="min-h-screen bg-[var(--hakeem-bg)] px-6 py-12">
      <article className="mx-auto max-w-3xl rounded-[var(--r-2xl)] border border-[var(--ink-08)] bg-[var(--paper)] p-8 shadow-[var(--sh-md)] md:p-12">
        <p className="text-sm font-semibold text-[var(--gold-dark)]">منصة حكيم</p>
        <h1 className="t-head mt-2 text-3xl font-bold text-[var(--navy)] md:text-4xl">سياسة الخصوصية</h1>
        <p className="mt-3 leading-8 text-[var(--ink-60)]">
          معالجة البيانات الشخصية وفق نظام حماية البيانات الشخصية السعودي (PDPL).
        </p>

        <div className="mt-8 space-y-7">
          {sections.map((s) => (
            <section key={s.h}>
              <h2 className="t-display text-lg font-bold text-[var(--navy)]">{s.h}</h2>
              <div className="mt-2 space-y-2">
                {s.p.map((line, i) => (
                  <p key={i} className="leading-8 text-[var(--ink-80)]">
                    {line}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap gap-2 border-t border-[var(--ink-08)] pt-6">
          <Link href="/terms" className="btn btn-outline">شروط الاستخدام</Link>
          <Link href="/dashboard" className="btn btn-gold">العودة إلى المنصّة</Link>
        </div>
      </article>
    </main>
  );
}
