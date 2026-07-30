import Link from "next/link";
import {
  ArrowLeft,
  BookOpenCheck,
  CheckCircle2,
  FileSearch,
  Files,
  Gavel,
  MessageSquareText,
  Scale,
  SearchCheck,
  ShieldCheck,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import { HomeAuthActions } from "@/components/home/HomeAuthActions";
import { GuestAskComposer } from "@/components/home/GuestAskComposer";
import { hasAnySignInProvider } from "@/lib/modules/auth/auth-providers";
import { isAskFirstHomeEnabled } from "@/lib/modules/config/ask-first-home";
import {
  DEFAULT_HOME,
  type SiteHomeContent,
} from "@/lib/modules/site/defaults";
import type { PublicPlatformStats } from "@/lib/modules/site/public-platform-stats";

type ServiceCard = {
  title: string;
  description: string;
  evidence: string;
  href: string;
  action: string;
  icon: LucideIcon;
};

const SERVICES: ServiceCard[] = [
  {
    title: "اسأل حكيم",
    description:
      "اكتب المسألة بطريقتك. يستوضح حكيم ما ينقص، ثم يبحث على قدر المسألة ويضع السند بجوار النتيجة.",
    evidence: "بحث متعدد الجولات · حواشٍ مرتبطة · جلسات محفوظة",
    href: "/dashboard/ask",
    action: "ابدأ سؤالًا",
    icon: MessageSquareText,
  },
  {
    title: "النواة القانونية",
    description:
      "بحث معجمي ودلالي في الأنظمة والمواد والأحكام والمبادئ، مع قراءة النص الكامل قبل الاستناد إليه.",
    evidence: "PostgreSQL + pgvector · مسح شامل حتى ٦٠ مادة",
    href: "/dashboard/legal-core",
    action: "افتح المكتبة",
    icon: BookOpenCheck,
  },
  {
    title: "منصة الوثائق",
    description:
      "تفحص المستند أولًا: تستخدم النص السليم مباشرة، وتحوّل الصفحات المعطوبة إلى OCR بدل اعتماد نص مشوّه.",
    evidence: "نص مباشر · مراجعة · OCR عند الحاجة",
    href: "/documents",
    action: "حلّل مستندًا",
    icon: FileSearch,
  },
  {
    title: "المعاون القضائي",
    description:
      "ملف عمل يجمع وقائع القضية وأطرافها ومستنداتها وتحليلها ومخرجاتها، بدل توزيعها بين صفحات متفرقة.",
    evidence: "قضية واحدة · مستندات · تحليل · مخرجات",
    href: "/dashboard/judicial-assistant",
    action: "افتح ملف قضية",
    icon: Scale,
  },
  {
    title: "القاضي التفاعلي",
    description:
      "محاكاة لمسار الجلسة والدفوع والحكم، مع أدوات للاعتراض وتقدير المدد وصياغة المخرجات القضائية.",
    evidence: "٢٨ دفعًا · استئناف ونقض والتماس · حكم معلّل",
    href: "/dashboard/simulations",
    action: "ابدأ المحاكاة",
    icon: Gavel,
  },
];

const OPERATING_CAPABILITIES = [
  { value: "٢٠٠٬٠٠٠", label: "حرف للمرفق داخل اسأل حكيم" },
  { value: "٦٠", label: "مادة في جولة المسح الشامل" },
  { value: "٢٨", label: "دفعًا في كتالوج القاضي التفاعلي" },
  { value: "٣", label: "مسارات للاعتراض على الأحكام" },
];

function BrandMark({ inverse = false }: { inverse?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span
        className={`grid h-10 w-10 place-items-center rounded-[var(--r-md)] font-judicial text-lg font-bold shadow-[var(--sh-xs)] ${
          inverse
            ? "border border-white/15 bg-white/10 text-[var(--gold-bright)]"
            : "bg-[var(--navy)] text-[var(--gold-bright)]"
        }`}
        aria-hidden
      >
        ح
      </span>
      <div className="leading-tight">
        <p className={`text-lg font-bold ${inverse ? "text-white" : "text-[var(--navy)]"}`}>حكيم</p>
        <p className={`text-[11px] ${inverse ? "text-white/55" : "text-[var(--ink-60)]"}`}>
          منصة المعرفة القضائية السعودية
        </p>
      </div>
    </div>
  );
}

function formatCount(value: number) {
  return value.toLocaleString("ar-SA");
}

export function HomeHero({
  content = DEFAULT_HOME,
  stats,
}: {
  content?: SiteHomeContent;
  stats: PublicPlatformStats;
}) {
  const authReady = hasAnySignInProvider();
  const askFirst = isAskFirstHomeEnabled();

  const databaseStats = [
    { value: stats.legalSystems, label: "نظامًا ولائحة" },
    { value: stats.legalArticles, label: "مادة نظامية" },
    { value: stats.judgments, label: "حكمًا قضائيًا" },
    { value: stats.principles, label: "مبدأ قضائيًا" },
  ].filter((item) => item.value > 0);

  return (
    <main className="min-h-[100dvh] overflow-hidden bg-[var(--hakeem-bg)] text-[var(--ink)]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[640px] opacity-[0.09]"
        style={{
          background:
            "radial-gradient(55% 78% at 50% 0%, var(--navy) 0%, transparent 72%), radial-gradient(38% 55% at 88% 4%, var(--gold) 0%, transparent 68%)",
        }}
      />

      <header className="sticky top-0 z-40 border-b border-[var(--ink-08)] bg-[rgba(239,243,242,0.9)] backdrop-blur-xl">
        <div className="mx-auto flex min-h-[72px] max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/" aria-label="حكيم — الصفحة الرئيسية">
            <BrandMark />
          </Link>

          <nav className="hidden items-center gap-6 text-sm font-semibold text-[var(--navy)] lg:flex" aria-label="التنقل العام">
            <a href="#database" className="transition hover:text-[var(--gold-dark)]">قاعدة حكيم</a>
            <a href="#services" className="transition hover:text-[var(--gold-dark)]">الخدمات</a>
            <a href="#method" className="transition hover:text-[var(--gold-dark)]">طريقة العمل</a>
            <Link href="/pricing" className="transition hover:text-[var(--gold-dark)]">الأسعار</Link>
          </nav>

          <HomeAuthActions
            guest={
              <div className="flex items-center gap-2">
                <Link
                  href="/sign-in"
                  className="focus-ring hidden min-h-[44px] items-center justify-center rounded-[var(--r-md)] border border-[var(--gold-border)] bg-[var(--paper)] px-4 text-sm font-semibold text-[var(--navy)] sm:inline-flex"
                >
                  تسجيل الدخول
                </Link>
                <Link
                  href="/sign-up"
                  className="focus-ring inline-flex min-h-[44px] items-center justify-center rounded-[var(--r-md)] bg-[var(--navy)] px-4 text-sm font-semibold text-white shadow-[var(--sh-xs)]"
                >
                  ابدأ مجانًا
                </Link>
              </div>
            }
            user={
              <Link
                href="/dashboard"
                className="focus-ring inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[var(--r-md)] bg-[var(--navy)] px-5 text-sm font-semibold text-white"
              >
                افتح المنصة
                <ArrowLeft className="h-4 w-4" aria-hidden />
              </Link>
            }
          />
        </div>
      </header>

      <section className="relative mx-auto max-w-7xl px-4 pb-14 pt-12 sm:px-6 sm:pt-16 lg:pb-20 lg:pt-20">
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-sm font-semibold text-[var(--gold-dark)]">بُني للممارسة القانونية السعودية</p>
          <h1 className="mt-4 font-display text-4xl font-bold leading-[1.25] text-[var(--navy)] sm:text-5xl lg:text-6xl">
            ابحث في الأنظمة، حلّل مستنداتك،
            <span className="block text-[var(--gold-dark)]">وابنِ ملف قضيتك في مكان واحد</span>
          </h1>
          <p className="mx-auto mt-5 max-w-3xl text-base leading-8 text-[var(--ink-70)] sm:text-lg sm:leading-9">
            حكيم منصة قانونية تجمع قاعدة المعرفة السعودية مع أدوات البحث والتحليل والوثائق والعمل القضائي.
            تبدأ من سؤالك، وتبقي السند والمستندات والمخرجات في سياق واحد.
          </p>
        </div>

        <div className="mx-auto mt-9 max-w-4xl">
          {askFirst ? (
            <HomeAuthActions
              guest={
                <div className="rounded-[var(--r-2xl)] border border-[var(--gold-border)] bg-[var(--paper)] p-3 shadow-[var(--sh-md)] sm:p-5">
                  <div className="mb-3 flex items-center justify-between gap-3 px-1 text-start">
                    <div>
                      <p className="text-sm font-bold text-[var(--navy)]">اكتب السؤال أو الواقعة</p>
                      <p className="mt-1 text-xs leading-6 text-[var(--ink-60)]">
                        يُحفظ النص ويكتمل التحليل بعد تسجيل الدخول.
                      </p>
                    </div>
                    <MessageSquareText className="hidden h-6 w-6 text-[var(--gold-dark)] sm:block" aria-hidden />
                  </div>
                  <GuestAskComposer />
                </div>
              }
              user={
                <div className="rounded-[var(--r-2xl)] border border-[var(--gold-border)] bg-[var(--paper)] p-6 text-center shadow-[var(--sh-md)]">
                  <p className="font-bold text-[var(--navy)]">جلساتك وأعمالك محفوظة داخل المنصة</p>
                  <Link
                    href="/dashboard"
                    className="focus-ring mt-5 inline-flex min-h-[48px] items-center justify-center gap-2 rounded-[var(--r-md)] bg-[var(--navy)] px-6 text-sm font-semibold text-white"
                  >
                    المتابعة إلى حكيم
                    <ArrowLeft className="h-4 w-4" aria-hidden />
                  </Link>
                </div>
              }
            />
          ) : (
            <HomeAuthActions
              guest={
                <div className="flex flex-col justify-center gap-3 sm:flex-row">
                  <Link
                    href={authReady ? "/sign-up" : "/sign-in"}
                    className="focus-ring inline-flex min-h-[52px] items-center justify-center gap-2 rounded-[var(--r-md)] bg-[var(--navy)] px-7 text-base font-semibold text-white"
                  >
                    ابدأ مجانًا
                    <ArrowLeft className="h-4 w-4" aria-hidden />
                  </Link>
                  <a
                    href="#services"
                    className="focus-ring inline-flex min-h-[52px] items-center justify-center rounded-[var(--r-md)] border border-[var(--gold-border)] bg-[var(--paper)] px-7 text-base font-semibold text-[var(--navy)]"
                  >
                    استعرض الخدمات
                  </a>
                </div>
              }
              user={
                <Link
                  href="/dashboard"
                  className="focus-ring mx-auto inline-flex min-h-[52px] items-center justify-center gap-2 rounded-[var(--r-md)] bg-[var(--navy)] px-8 text-base font-semibold text-white"
                >
                  افتح المنصة
                  <ArrowLeft className="h-4 w-4" aria-hidden />
                </Link>
              }
            />
          )}
        </div>
      </section>

      <section id="database" className="border-y border-[var(--ink-08)] bg-[var(--navy)] px-4 py-10 text-white sm:px-6">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col justify-between gap-3 text-start md:flex-row md:items-end">
            <div>
              <p className="text-sm font-semibold text-[var(--gold-pale)]">قاعدة حكيم الحية</p>
              <h2 className="mt-1 font-display text-2xl font-bold">أرقام تُقرأ مباشرة من قاعدة المنصة</h2>
            </div>
            <p className="text-xs leading-6 text-white/55">تتغير المؤشرات تلقائيًا مع تحديث المحتوى القانوني.</p>
          </div>

          {databaseStats.length > 0 ? (
            <dl className="mt-7 grid grid-cols-2 gap-px overflow-hidden rounded-[var(--r-xl)] border border-white/10 bg-white/10 lg:grid-cols-4">
              {databaseStats.map((item) => (
                <div key={item.label} className="bg-[var(--navy)] px-5 py-6 text-start">
                  <dd className="font-mono text-3xl font-bold text-[var(--gold-bright)] sm:text-4xl">
                    {formatCount(item.value)}
                  </dd>
                  <dt className="mt-2 text-sm text-white/70">{item.label}</dt>
                </div>
              ))}
            </dl>
          ) : (
            <p className="mt-7 rounded-[var(--r-lg)] border border-white/10 bg-white/5 p-5 text-sm text-white/65">
              مؤشرات القاعدة غير متاحة في هذه اللحظة؛ تبقى خدمات البحث والتصفح متاحة من داخل المنصة.
            </p>
          )}
        </div>
      </section>

      <section id="services" className="px-4 py-16 sm:px-6 lg:py-24">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl text-start">
            <p className="text-sm font-semibold text-[var(--gold-dark)]">الخدمات الموجودة الآن</p>
            <h2 className="mt-2 font-display text-3xl font-bold text-[var(--navy)] sm:text-4xl">
              أدوات مترابطة حول القضية، لا خدمات منفصلة بالاسم فقط
            </h2>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {SERVICES.map(({ title, description, evidence, href, action, icon: Icon }) => (
              <Link
                key={title}
                href={href}
                className="group flex min-h-full flex-col rounded-[var(--r-xl)] border border-[var(--ink-08)] bg-[var(--paper)] p-5 text-start shadow-[var(--sh-xs)] transition hover:-translate-y-0.5 hover:border-[var(--gold-border)] hover:shadow-[var(--sh-sm)]"
              >
                <span className="grid h-11 w-11 place-items-center rounded-[var(--r-md)] bg-[var(--navy)] text-[var(--gold-pale)]">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <h3 className="mt-5 font-display text-xl font-bold text-[var(--navy)]">{title}</h3>
                <p className="mt-3 flex-1 text-sm leading-7 text-[var(--ink-60)]">{description}</p>
                <p className="mt-5 border-t border-[var(--ink-08)] pt-4 text-xs font-semibold leading-6 text-[var(--gold-dark)]">
                  {evidence}
                </p>
                <span className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-[var(--navy)]">
                  {action}
                  <ArrowLeft className="h-4 w-4 transition group-hover:-translate-x-1" aria-hidden />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-[var(--ink-08)] bg-[var(--paper)] px-4 py-14 sm:px-6 lg:py-18">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {OPERATING_CAPABILITIES.map((item) => (
              <div key={item.label} className="rounded-[var(--r-lg)] border border-[var(--ink-08)] bg-[var(--hakeem-bg)] p-5 text-start">
                <p className="font-mono text-3xl font-bold text-[var(--gold-dark)]">{item.value}</p>
                <p className="mt-2 text-sm leading-6 text-[var(--ink-60)]">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="method" className="px-4 py-16 sm:px-6 lg:py-24">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.75fr_1.25fr] lg:items-center">
          <div className="text-start">
            <p className="text-sm font-semibold text-[var(--gold-dark)]">طريقة العمل</p>
            <h2 className="mt-2 font-display text-3xl font-bold leading-tight text-[var(--navy)]">
              السؤال لا يذهب مباشرة إلى قالب جاهز
            </h2>
            <p className="mt-4 text-sm leading-8 text-[var(--ink-60)] sm:text-base">
              يفهم حكيم المطلوب أولًا، ويحدد ما إذا كان يحتاج استيضاحًا أو بحثًا أو دراسة موسعة، ثم يستدعي الأدوات المناسبة ويحفظ النتيجة في الجلسة.
            </p>
          </div>

          <ol className="grid gap-4 sm:grid-cols-3">
            {[
              {
                number: "١",
                title: "فهم المسألة",
                description: "تحرير المطلوب وكشف الوقائع الناقصة قبل البحث.",
                icon: SearchCheck,
              },
              {
                number: "٢",
                title: "البحث والقراءة",
                description: "مسح المصادر، فتح النصوص، ثم إعادة البحث عند وجود فجوة.",
                icon: Files,
              },
              {
                number: "٣",
                title: "نتيجة قابلة للمراجعة",
                description: "تحليل بسنده وحواشيه، محفوظ داخل جلسة يمكن استكمالها.",
                icon: Workflow,
              },
            ].map(({ number, title, description, icon: Icon }) => (
              <li key={number} className="rounded-[var(--r-xl)] border border-[var(--ink-08)] bg-[var(--paper)] p-5 text-start shadow-[var(--sh-xs)]">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-judicial text-3xl font-bold text-[var(--gold)]">{number}</span>
                  <Icon className="h-5 w-5 text-[var(--navy)]" aria-hidden />
                </div>
                <h3 className="mt-4 font-display text-lg font-bold text-[var(--navy)]">{title}</h3>
                <p className="mt-2 text-sm leading-7 text-[var(--ink-60)]">{description}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="px-4 pb-16 sm:px-6 lg:pb-24">
        <div className="mx-auto grid max-w-7xl overflow-hidden rounded-[var(--r-2xl)] bg-[var(--navy)] shadow-[var(--sh-lg)] lg:grid-cols-[1.1fr_0.9fr]">
          <div className="p-7 text-start sm:p-10 lg:p-12">
            <p className="text-sm font-semibold text-[var(--gold-pale)]">ضوابط داخل المنتج</p>
            <h2 className="mt-3 font-display text-3xl font-bold text-white">السند جزء من النتيجة، لا هامش تجميلي</h2>
            <ul className="mt-7 space-y-4">
              {[
                "حارس الإسناد يمنع نسبة أرقام مواد لم تُسترجع من القاعدة.",
                "الحواشي في المتن مرتبطة ببطاقات المصادر وتبقى عند التصدير.",
                "الدراسة الطويلة تستمر في الخلفية وتُحفظ حتى عند إغلاق التبويب.",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm leading-7 text-white/80">
                  <ShieldCheck className="mt-1 h-5 w-5 shrink-0 text-[var(--gold-bright)]" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="border-t border-white/10 bg-white/[0.05] p-7 sm:p-10 lg:border-r lg:border-t-0 lg:p-12">
            <div className="flex h-full flex-col justify-center text-start">
              <p className="text-sm leading-8 text-white/70">
                ابدأ بالسؤال. وعندما تتسع المسألة، انتقل إلى المستندات أو ملف القضية أو المحاكاة دون فقد ما سبق.
              </p>
              <HomeAuthActions
                guest={
                  <div className="mt-6 flex flex-col gap-3 sm:flex-row lg:flex-col xl:flex-row">
                    <Link
                      href="/sign-up"
                      className="focus-ring inline-flex min-h-[50px] flex-1 items-center justify-center gap-2 rounded-[var(--r-md)] bg-[var(--gold)] px-6 text-sm font-bold text-[var(--navy)]"
                    >
                      ابدأ مجانًا
                      <ArrowLeft className="h-4 w-4" aria-hidden />
                    </Link>
                    <Link
                      href="/pricing"
                      className="focus-ring inline-flex min-h-[50px] flex-1 items-center justify-center rounded-[var(--r-md)] border border-white/15 px-6 text-sm font-semibold text-white"
                    >
                      عرض الخطط
                    </Link>
                  </div>
                }
                user={
                  <Link
                    href="/dashboard"
                    className="focus-ring mt-6 inline-flex min-h-[50px] items-center justify-center gap-2 rounded-[var(--r-md)] bg-[var(--gold)] px-6 text-sm font-bold text-[var(--navy)]"
                  >
                    افتح مساحة العمل
                    <ArrowLeft className="h-4 w-4" aria-hidden />
                  </Link>
                }
              />
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-[var(--ink-08)] bg-[var(--navy)] px-4 py-9 text-white sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-col gap-7 md:flex-row md:items-end md:justify-between">
          <div>
            <BrandMark inverse />
            <p className="mt-4 max-w-xl text-xs leading-7 text-white/50">{content.disclaimer}</p>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-3 text-xs font-semibold text-white/65">
            <Link href="/pricing" className="hover:text-[var(--gold-pale)]">الأسعار</Link>
            <Link href="/privacy" className="hover:text-[var(--gold-pale)]">الخصوصية</Link>
            <Link href="/terms" className="hover:text-[var(--gold-pale)]">الشروط</Link>
            <Link href="/sign-in" className="hover:text-[var(--gold-pale)]">تسجيل الدخول</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
