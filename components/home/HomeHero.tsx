import Link from "next/link";
import {
  ArrowLeft,
  BookOpenCheck,
  CheckCircle2,
  FileSearch,
  FileText,
  Gavel,
  LockKeyhole,
  MessageSquareText,
  Scale,
  SearchCheck,
  ShieldCheck,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import { DirectGoogleEntry } from "@/components/auth/DirectGoogleEntry";
import { GuestAskComposer } from "@/components/home/GuestAskComposer";
import { HomeAuthActions } from "@/components/home/HomeAuthActions";
import { HomeVideoShowcase } from "@/components/home/HomeVideoShowcase";
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
    description: "حرّر المسألة، استكمل الوقائع المؤثرة، واحصل على تحليل مرتبط بمصادره.",
    evidence: "تحرير · استيضاح · بحث متعدد الجولات",
    href: "/dashboard/ask",
    action: "ابدأ مسألتك",
    icon: MessageSquareText,
  },
  {
    title: "النواة القانونية",
    description: "ابحث في الأنظمة واللوائح والأحكام والمبادئ، ثم افتح النص الكامل.",
    evidence: "بحث معجمي ودلالي · نصوص مترابطة",
    href: "/dashboard/legal-core",
    action: "ابحث في النواة",
    icon: BookOpenCheck,
  },
  {
    title: "منصة الوثائق",
    description: "استخرج النص، افحص جودة القراءة، واستخدم OCR عند الحاجة.",
    evidence: "استخراج · فحص جودة · OCR",
    href: "/documents",
    action: "حلّل مستندًا",
    icon: FileSearch,
  },
  {
    title: "المعاون القضائي",
    description: "اجمع الوقائع والطلبات والمستندات والدفوع في ملف قضية واحد.",
    evidence: "ملف موحّد · مستندات · دفوع · مخرجات",
    href: "/dashboard/judicial-assistant",
    action: "افتح ملف قضية",
    icon: Scale,
  },
  {
    title: "القاضي التفاعلي",
    description: "راجع بناء الدعوى والدفوع وطرق الاعتراض ضمن محاكاة إجرائية.",
    evidence: "٢٨ دفعًا · استئناف · نقض · التماس",
    href: "/dashboard/simulations",
    action: "ابدأ المحاكاة",
    icon: Gavel,
  },
  {
    title: "الاستشارات القانونية",
    description: "رتّب الوقائع والتكييف والسند والمخاطر والخطوات العملية.",
    evidence: "تكييف · سند · مخاطر · توصيات",
    href: "/dashboard/consultations",
    action: "أنشئ استشارة",
    icon: FileText,
  },
];

const OPERATING_CAPABILITIES = [
  { value: "٢٠٠٬٠٠٠", label: "حرف للمرفق" },
  { value: "٦٠", label: "مادة في المسح الموسع" },
  { value: "٢٨", label: "دفعًا في المحاكاة" },
  { value: "٣", label: "مسارات للاعتراض" },
];

const ENTRY_ASSURANCES = [
  "تُحفظ المسألة قبل الانتقال",
  "تعود إلى العمل بعد التحقق",
  "لا نطلب كلمة مرور Google",
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
        <p className={`text-[11px] ${inverse ? "text-white/[0.58]" : "text-[var(--ink-60)]"}`}>
          منصة تقنية قانونية للممارسة السعودية
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
  loginError,
}: {
  content?: SiteHomeContent;
  stats: PublicPlatformStats;
  loginError?: string;
}) {
  const askFirst = isAskFirstHomeEnabled();
  const databaseStats = [
    { value: stats.legalSystems, label: "نظام ولائحة" },
    { value: stats.legalArticles, label: "مادة نظامية" },
    { value: stats.judgments, label: "حكم قضائي" },
    { value: stats.principles, label: "مبدأ قضائي" },
  ].filter((item) => item.value > 0);

  return (
    <main className="min-h-[100dvh] overflow-hidden bg-[var(--hakeem-bg)] text-[var(--ink)]">
      <a
        href="#main-content"
        className="focus-ring sr-only fixed start-4 top-4 z-[60] rounded-[var(--r-md)] bg-[var(--navy)] px-4 py-3 font-semibold text-white focus:not-sr-only"
      >
        تجاوز إلى المحتوى
      </a>

      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[620px] opacity-[0.09]"
        style={{
          background:
            "radial-gradient(55% 78% at 50% 0%, var(--navy) 0%, transparent 72%), radial-gradient(38% 55% at 88% 4%, var(--gold) 0%, transparent 68%)",
        }}
      />

      <header className="sticky top-0 z-40 border-b border-[var(--ink-08)] bg-[rgba(239,243,242,0.92)] backdrop-blur-xl">
        <div className="mx-auto flex min-h-[72px] max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/" aria-label="حكيم — الصفحة الرئيسية" className="focus-ring rounded-[var(--r-md)]">
            <BrandMark />
          </Link>

          <nav className="hidden items-center gap-6 text-sm font-semibold text-[var(--navy)] lg:flex" aria-label="التنقل العام">
            <a href="#tour" className="focus-ring rounded px-1 py-2 transition hover:text-[var(--gold-dark)]">جولة مرئية</a>
            <a href="#services" className="focus-ring rounded px-1 py-2 transition hover:text-[var(--gold-dark)]">الخدمات</a>
            <a href="#database" className="focus-ring rounded px-1 py-2 transition hover:text-[var(--gold-dark)]">المحتوى القانوني</a>
            <Link href="/pricing" className="focus-ring rounded px-1 py-2 transition hover:text-[var(--gold-dark)]">الأسعار</Link>
          </nav>

          <HomeAuthActions
            guest={
              <DirectGoogleEntry
                label="الدخول عبر Google"
                className="focus-ring inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[var(--r-md)] bg-[var(--navy)] px-4 text-sm font-semibold text-white shadow-[var(--sh-xs)]"
              />
            }
            user={
              <Link
                href="/dashboard"
                className="focus-ring inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[var(--r-md)] bg-[var(--navy)] px-5 text-sm font-semibold text-white"
              >
                مساحة العمل
                <ArrowLeft className="h-4 w-4" aria-hidden />
              </Link>
            }
          />
        </div>
      </header>

      <section id="main-content" className="relative scroll-mt-24 px-4 pb-14 pt-12 sm:px-6 sm:pt-16 lg:pb-20 lg:pt-20">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-4xl text-center">
            <p className="text-sm font-semibold text-[var(--gold-dark)]">منصة تقنية قانونية للممارسة السعودية</p>
            <h1 className="mt-4 font-display text-4xl font-bold leading-[1.22] text-[var(--navy)] sm:text-5xl lg:text-6xl">
              حرّر المسألة. راجع السند.
              <span className="block text-[var(--gold-dark)]">وأكمل العمل في ملف واحد.</span>
            </h1>
            <p className="mx-auto mt-5 max-w-3xl text-base leading-8 text-[var(--ink-70)] sm:text-lg">
              بحث نظامي، تحليل مستندات، وإدارة ملف القضية في مساحة عمل مترابطة.
            </p>
          </div>

          <div className="mx-auto mt-9 max-w-4xl">
            {loginError ? (
              <div className="mb-4 rounded-[var(--r-lg)] border border-[rgba(140,34,51,0.2)] bg-[var(--ruby-soft)] px-4 py-3 text-start text-sm leading-7 text-[var(--ruby)]" role="alert">
                لم يكتمل الدخول عبر Google. بقيت المسألة محفوظة على جهازك. {loginError}
              </div>
            ) : null}

            {askFirst ? (
              <HomeAuthActions
                guest={
                  <div className="rounded-[var(--r-2xl)] border border-[var(--gold-border)] bg-[var(--paper)] p-3 shadow-[var(--sh-md)] sm:p-5">
                    <div className="mb-3 flex items-center justify-between gap-3 px-1 text-start">
                      <div>
                        <p className="text-sm font-bold text-[var(--navy)]">ابدأ بالوقائع والطلب</p>
                        <p className="mt-1 text-xs leading-6 text-[var(--ink-60)]">يحدد حكيم عناصر المسألة قبل البحث.</p>
                      </div>
                      <MessageSquareText className="hidden h-6 w-6 text-[var(--gold-dark)] sm:block" aria-hidden />
                    </div>
                    <GuestAskComposer />
                  </div>
                }
                user={
                  <div className="rounded-[var(--r-2xl)] border border-[var(--gold-border)] bg-[var(--paper)] p-6 text-center shadow-[var(--sh-md)]">
                    <p className="font-bold text-[var(--navy)]">تابع من حيث توقفت</p>
                    <p className="mt-2 text-sm leading-7 text-[var(--ink-60)]">جلساتك وملفاتك محفوظة في مساحة العمل.</p>
                    <Link
                      href="/dashboard"
                      className="focus-ring mt-5 inline-flex min-h-[48px] items-center justify-center gap-2 rounded-[var(--r-md)] bg-[var(--navy)] px-6 text-sm font-semibold text-white"
                    >
                      افتح مساحة العمل
                      <ArrowLeft className="h-4 w-4" aria-hidden />
                    </Link>
                  </div>
                }
              />
            ) : (
              <HomeAuthActions
                guest={
                  <div className="flex flex-col justify-center gap-3 sm:flex-row">
                    <DirectGoogleEntry
                      label="ابدأ عبر Google"
                      className="focus-ring inline-flex min-h-[52px] items-center justify-center gap-2 rounded-[var(--r-md)] bg-[var(--navy)] px-7 text-base font-semibold text-white"
                    />
                    <a
                      href="#tour"
                      className="focus-ring inline-flex min-h-[52px] items-center justify-center rounded-[var(--r-md)] border border-[var(--gold-border)] bg-[var(--paper)] px-7 text-base font-semibold text-[var(--navy)]"
                    >
                      شاهد الجولة
                    </a>
                  </div>
                }
                user={
                  <Link
                    href="/dashboard"
                    className="focus-ring mx-auto inline-flex min-h-[52px] items-center justify-center gap-2 rounded-[var(--r-md)] bg-[var(--navy)] px-8 text-base font-semibold text-white"
                  >
                    افتح مساحة العمل
                    <ArrowLeft className="h-4 w-4" aria-hidden />
                  </Link>
                }
              />
            )}
          </div>

          <ul className="mx-auto mt-5 flex max-w-4xl flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-[var(--ink-60)]" aria-label="ضمانات رحلة الدخول">
            {ENTRY_ASSURANCES.map((item, index) => (
              <li key={item} className="flex min-h-[32px] items-center gap-2">
                {index === 2 ? (
                  <LockKeyhole className="h-4 w-4 text-[var(--emerald)]" aria-hidden />
                ) : (
                  <CheckCircle2 className="h-4 w-4 text-[var(--emerald)]" aria-hidden />
                )}
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <HomeVideoShowcase />

      <section id="services" className="scroll-mt-24 px-4 py-16 sm:px-6 lg:py-20">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl text-start">
            <p className="text-sm font-semibold text-[var(--gold-dark)]">الخدمات</p>
            <h2 className="mt-2 font-display text-3xl font-bold text-[var(--navy)] sm:text-4xl">مسار قانوني مترابط</h2>
            <p className="mt-3 text-sm leading-7 text-[var(--ink-60)] sm:text-base">
              سؤال، مستند، قضية، استشارة، ومحاكاة داخل سياق واحد.
            </p>
          </div>

          <div className="mt-9 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {SERVICES.map(({ title, description, evidence, href, action, icon: Icon }) => (
              <Link
                key={title}
                href={href}
                className="focus-ring group flex min-h-full flex-col rounded-[var(--r-xl)] border border-[var(--ink-08)] bg-[var(--paper)] p-5 text-start shadow-[var(--sh-xs)] transition hover:-translate-y-0.5 hover:border-[var(--gold-border)] hover:shadow-[var(--sh-sm)]"
              >
                <span className="grid h-11 w-11 place-items-center rounded-[var(--r-md)] bg-[var(--navy)] text-[var(--gold-pale)]">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <h3 className="mt-5 font-display text-xl font-bold text-[var(--navy)]">{title}</h3>
                <p className="mt-3 flex-1 text-sm leading-7 text-[var(--ink-60)]">{description}</p>
                <p className="mt-5 border-t border-[var(--ink-08)] pt-4 text-xs font-semibold leading-6 text-[var(--gold-dark)]">{evidence}</p>
                <span className="mt-4 inline-flex min-h-[32px] items-center gap-2 text-sm font-bold text-[var(--navy)]">
                  {action}
                  <ArrowLeft className="h-4 w-4 transition group-hover:-translate-x-1" aria-hidden />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section id="database" className="scroll-mt-24 border-y border-[var(--ink-08)] bg-[var(--navy)] px-4 py-12 text-white sm:px-6">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
            <div className="text-start">
              <p className="text-sm font-semibold text-[var(--gold-pale)]">المحتوى القانوني</p>
              <h2 className="mt-2 font-display text-2xl font-bold sm:text-3xl">مصادر يمكن فتحها ومراجعتها</h2>
              <p className="mt-2 text-sm leading-7 text-white/65">المؤشرات تُقرأ مباشرة من قاعدة حكيم.</p>
            </div>

            {databaseStats.length > 0 ? (
              <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-[var(--r-xl)] border border-white/10 bg-white/10 lg:grid-cols-4">
                {databaseStats.map((item) => (
                  <div key={item.label} className="bg-[var(--navy)] px-5 py-5 text-start">
                    <dd className="font-mono text-3xl font-bold text-[var(--gold-bright)]">{formatCount(item.value)}</dd>
                    <dt className="mt-2 text-xs text-white/70">{item.label}</dt>
                  </div>
                ))}
              </dl>
            ) : null}
          </div>
        </div>
      </section>

      <section id="difference" className="scroll-mt-24 bg-[var(--paper)] px-4 py-16 sm:px-6 lg:py-20">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl text-start">
            <p className="text-sm font-semibold text-[var(--gold-dark)]">منهج العمل</p>
            <h2 className="mt-2 font-display text-3xl font-bold text-[var(--navy)] sm:text-4xl">مخرج قابل للمراجعة</h2>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              {
                title: "تحرير المسألة",
                description: "فصل الوقائع والطلبات والمسائل النظامية.",
                icon: SearchCheck,
              },
              {
                title: "إظهار السند",
                description: "فتح النصوص والأحكام المرتبطة بالتحليل.",
                icon: ShieldCheck,
              },
              {
                title: "استمرار السياق",
                description: "حفظ الجلسات والملفات والمخرجات معًا.",
                icon: Workflow,
              },
            ].map(({ title, description, icon: Icon }) => (
              <article key={title} className="rounded-[var(--r-xl)] border border-[var(--ink-08)] bg-[var(--hakeem-bg)] p-6 text-start shadow-[var(--sh-xs)]">
                <Icon className="h-6 w-6 text-[var(--gold-dark)]" aria-hidden />
                <h3 className="mt-5 font-display text-xl font-bold text-[var(--navy)]">{title}</h3>
                <p className="mt-3 text-sm leading-7 text-[var(--ink-60)]">{description}</p>
              </article>
            ))}
          </div>

          <div className="mt-8">
            <p className="mb-3 text-sm font-bold text-[var(--navy)]">قدرات تشغيلية معلنة</p>
            <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {OPERATING_CAPABILITIES.map((item) => (
                <div key={item.label} className="rounded-[var(--r-lg)] border border-[var(--ink-08)] bg-[var(--paper)] px-5 py-4 text-start">
                  <dd className="font-mono text-2xl font-bold text-[var(--gold-dark)]">{item.value}</dd>
                  <dt className="mt-1 text-xs leading-6 text-[var(--ink-60)]">{item.label}</dt>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6 lg:py-20">
        <div className="mx-auto grid max-w-7xl overflow-hidden rounded-[var(--r-2xl)] bg-[var(--navy)] shadow-[var(--sh-lg)] lg:grid-cols-[1.15fr_0.85fr]">
          <div className="p-7 text-start sm:p-10 lg:p-12">
            <p className="text-sm font-semibold text-[var(--gold-pale)]">ابدأ بمسألتك الحالية</p>
            <h2 className="mt-3 font-display text-3xl font-bold text-white sm:text-4xl">اكتب الوقائع وانتقل إلى مساحة العمل</h2>
            <p className="mt-4 text-sm leading-7 text-white/70">يُحفظ النص قبل الدخول ويعود معك بعد التحقق.</p>
          </div>

          <div className="border-t border-white/10 bg-white/[0.05] p-7 sm:p-10 lg:border-r lg:border-t-0 lg:p-12">
            <HomeAuthActions
              guest={
                <div className="flex h-full flex-col justify-center gap-3">
                  <DirectGoogleEntry
                    label="ابدأ عبر Google"
                    className="focus-ring inline-flex min-h-[52px] items-center justify-center gap-2 rounded-[var(--r-md)] bg-[var(--gold)] px-6 text-sm font-bold text-[var(--navy)]"
                  />
                  <Link
                    href="/pricing"
                    className="focus-ring inline-flex min-h-[50px] items-center justify-center rounded-[var(--r-md)] border border-white/15 px-6 text-sm font-semibold text-white"
                  >
                    استعرض الأسعار
                  </Link>
                </div>
              }
              user={
                <Link
                  href="/dashboard"
                  className="focus-ring inline-flex min-h-[52px] items-center justify-center gap-2 rounded-[var(--r-md)] bg-[var(--gold)] px-6 text-sm font-bold text-[var(--navy)]"
                >
                  افتح مساحة العمل
                  <ArrowLeft className="h-4 w-4" aria-hidden />
                </Link>
              }
            />
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
            <Link href="/pricing" className="focus-ring rounded hover:text-[var(--gold-pale)]">الأسعار</Link>
            <Link href="/privacy" className="focus-ring rounded hover:text-[var(--gold-pale)]">الخصوصية</Link>
            <Link href="/terms" className="focus-ring rounded hover:text-[var(--gold-pale)]">الشروط</Link>
            <a href="/api/auth/google?next=%2Fdashboard" className="focus-ring rounded hover:text-[var(--gold-pale)]">الدخول عبر Google</a>
          </div>
        </div>
      </footer>
    </main>
  );
}
