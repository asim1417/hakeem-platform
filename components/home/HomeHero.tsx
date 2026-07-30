import Link from "next/link";
import {
  ArrowLeft,
  BookOpenCheck,
  CheckCircle2,
  FileSearch,
  Files,
  Gavel,
  Landmark,
  LockKeyhole,
  MessageSquareText,
  Scale,
  SearchCheck,
  ShieldCheck,
  Sparkles,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import { HomeAuthActions } from "@/components/home/HomeAuthActions";
import { GuestAskComposer } from "@/components/home/GuestAskComposer";
import { hasAnySignInProvider } from "@/lib/modules/auth/auth-providers";
import { signUpWithNext } from "@/lib/modules/auth/safe-next";
import { isAskFirstHomeEnabled } from "@/lib/modules/config/ask-first-home";
import {
  DEFAULT_HOME,
  type SiteHomeContent,
} from "@/lib/modules/site/defaults";

type LandingCard = {
  title: string;
  description: string;
  icon: LucideIcon;
  href?: string;
  action?: string;
};

const VALUE_PROPS: LandingCard[] = [
  {
    title: "سعوديّ التخصّص",
    description: "مصمم لفهم الأنظمة والإجراءات والممارسة القضائية السعودية، لا كواجهة عامة معرّبة.",
    icon: Landmark,
  },
  {
    title: "سند ظاهر",
    description: "يفصل بين النص النظامي والتحليل والاستنتاج، ويعرض المواد والمصادر المرتبطة بالجواب.",
    icon: BookOpenCheck,
  },
  {
    title: "يفهم الواقعة",
    description: "يستخرج المسائل والطلبات والنقاط الناقصة قبل أن ينتقل إلى البحث وصياغة التحليل.",
    icon: SearchCheck,
  },
  {
    title: "عمل متصل",
    description: "احفظ الجلسة، أضف المستندات، ثم حوّل المسألة إلى ملف قضية قابل للمتابعة.",
    icon: Workflow,
  },
];

const CAPABILITIES: LandingCard[] = [
  {
    title: "اسأل حكيم",
    description: "ابدأ بسؤال أو واقعة، واحصل على تحليل منظم مع السند والخطوة التالية.",
    icon: MessageSquareText,
    href: "/dashboard/ask",
    action: "ابدأ بالسؤال",
  },
  {
    title: "دراسة القضية",
    description: "نظّم الوقائع والأطراف والمستندات والدفوع والإجراءات في مساحة واحدة.",
    icon: Scale,
    href: "/dashboard/judicial-assistant",
    action: "افتح قضية",
  },
  {
    title: "تحليل المستندات",
    description: "استخرج النصوص والبيانات، ثم اربط محتوى المستند بالمسائل النظامية ذات الصلة.",
    icon: FileSearch,
    href: "/documents",
    action: "حلّل مستندًا",
  },
  {
    title: "المكتبة القانونية",
    description: "تصفّح الأنظمة والمواد والمصادر، وانتقل من النص إلى السياق والعلاقات المرتبطة به.",
    icon: Files,
    href: "/dashboard/legal-core",
    action: "افتح المكتبة",
  },
  {
    title: "المحاكاة القضائية",
    description: "اختبر المرافعة والدفوع وتسلسل الجلسة في بيئة تدريبية تساعد على كشف الفجوات.",
    icon: Gavel,
    href: "/dashboard/simulations",
    action: "جرّب المحاكاة",
  },
];

const AUDIENCES = [
  {
    title: "للمحامي",
    description: "لفهم الملف، اختبار الدفوع، تنظيم السند، ومتابعة العمل دون تشتيت بين أدوات منفصلة.",
  },
  {
    title: "للمستشار القانوني",
    description: "لتحويل السؤال الداخلي إلى مسألة محررة، خيارات عملية، ومخرجات قابلة للمراجعة.",
  },
  {
    title: "للباحث",
    description: "للوصول إلى النصوص ذات الصلة وبناء مسار بحث منضبط بدل الاكتفاء بنتيجة بحث سطحية.",
  },
  {
    title: "للمكتب والمنشأة",
    description: "لتوحيد طريقة استقبال الوقائع والوثائق، وحفظ المعرفة والعمل السابق داخل مساحة منظمة.",
  },
];

const FAQ = [
  {
    question: "هل حكيم بديل عن المحامي أو الرأي القانوني النهائي؟",
    answer:
      "لا. حكيم أداة مساعدة للبحث والتحليل وتنظيم العمل. تبقى مراجعة المختص وتقديره المهني لازمة قبل اتخاذ القرار أو تقديم المخرج للغير.",
  },
  {
    question: "هل يجيب حكيم من معرفته العامة فقط؟",
    answer:
      "صُممت التجربة لإظهار السند المرتبط بالجواب، مع التمييز بين النص النظامي والتحليل والاستنتاج، وبيان الحدود عند غياب نص صريح أو مصدر كافٍ.",
  },
  {
    question: "هل أستطيع رفع مستندات القضية؟",
    answer:
      "نعم. توجد مسارات لتحليل المستندات وربطها بالمسألة أو ملف القضية، مع بقاء مسؤولية مراجعة الاستخراج والنتائج على المستخدم المختص.",
  },
  {
    question: "هل يمكن متابعة العمل لاحقًا؟",
    answer:
      "نعم. تحفظ جلسات «اسأل حكيم» ويمكن استعادتها، كما يمكن تنظيم العمل في ملفات قضايا ومساحات مخصصة للمستندات والمخرجات.",
  },
];

function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span
        className={`grid place-items-center rounded-[var(--r-md)] bg-[var(--navy)] font-judicial font-bold text-[var(--gold-bright)] shadow-[var(--sh-xs)] ${
          compact ? "h-10 w-10 text-lg" : "h-11 w-11 text-xl"
        }`}
        aria-hidden
      >
        ح
      </span>
      <div className="leading-tight">
        <p className="text-lg font-bold text-[var(--navy)]">حكيم</p>
        <p className="text-[11px] text-[var(--ink-60)]">منصة المعرفة القضائية السعودية</p>
      </div>
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
  align = "center",
}: {
  eyebrow: string;
  title: string;
  description: string;
  align?: "center" | "start";
}) {
  return (
    <div className={align === "center" ? "mx-auto max-w-3xl text-center" : "max-w-2xl text-start"}>
      <p className="text-sm font-semibold text-[var(--gold-dark)]">{eyebrow}</p>
      <h2 className="mt-2 font-display text-2xl font-bold leading-tight text-[var(--navy)] sm:text-3xl">
        {title}
      </h2>
      <p className="mt-4 text-sm leading-8 text-[var(--ink-60)] sm:text-base">{description}</p>
    </div>
  );
}

export function HomeHero({
  content = DEFAULT_HOME,
}: {
  content?: SiteHomeContent;
}) {
  const authReady = hasAnySignInProvider();
  const askFirst = isAskFirstHomeEnabled();
  const home = content;

  return (
    <main className="min-h-[100dvh] overflow-hidden bg-[var(--hakeem-bg)] text-[var(--ink)]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[720px] opacity-[0.09]"
        style={{
          background:
            "radial-gradient(55% 75% at 52% 0%, var(--navy) 0%, transparent 72%), radial-gradient(40% 55% at 88% 6%, var(--gold) 0%, transparent 68%)",
        }}
      />

      <header className="sticky top-0 z-40 border-b border-[var(--ink-08)] bg-[rgba(239,243,242,0.88)] backdrop-blur-xl">
        <div className="mx-auto flex min-h-[72px] max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/" aria-label="حكيم — الصفحة الرئيسية">
            <BrandMark compact />
          </Link>

          <nav className="hidden items-center gap-5 text-sm font-semibold text-[var(--navy)] lg:flex" aria-label="التنقل العام">
            <a href="#why" className="transition hover:text-[var(--gold-dark)]">لماذا حكيم</a>
            <a href="#capabilities" className="transition hover:text-[var(--gold-dark)]">ماذا ينجز</a>
            <a href="#how" className="transition hover:text-[var(--gold-dark)]">كيف يعمل</a>
            <a href="#trust" className="transition hover:text-[var(--gold-dark)]">الثقة والخصوصية</a>
            <Link href="/pricing" className="transition hover:text-[var(--gold-dark)]">الأسعار</Link>
          </nav>

          <HomeAuthActions
            guest={
              <div className="flex items-center gap-2">
                <Link
                  href="/sign-in"
                  className="focus-ring hidden min-h-[44px] items-center justify-center rounded-[var(--r-md)] border border-[var(--gold-border)] bg-[var(--paper)] px-4 text-sm font-semibold text-[var(--navy)] sm:inline-flex"
                >
                  {home.ctaSecondary}
                </Link>
                <Link
                  href="/sign-up"
                  className="focus-ring inline-flex min-h-[44px] items-center justify-center rounded-[var(--r-md)] bg-[var(--navy)] px-4 text-sm font-semibold text-white shadow-[var(--sh-xs)] transition hover:bg-[var(--navy-mid)]"
                >
                  ابدأ الآن
                </Link>
              </div>
            }
            user={
              <Link
                href="/dashboard"
                className="focus-ring inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[var(--r-md)] bg-[var(--navy)] px-5 text-sm font-semibold text-white"
              >
                المتابعة إلى المنصة
                <ArrowLeft className="h-4 w-4" aria-hidden />
              </Link>
            }
          />
        </div>
      </header>

      <section className="relative mx-auto max-w-7xl px-4 pb-14 pt-12 sm:px-6 sm:pt-16 lg:pb-20 lg:pt-20">
        <div className="mx-auto max-w-4xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--gold-border)] bg-[var(--paper)] px-4 py-2 text-xs font-semibold text-[var(--navy)] shadow-[var(--sh-xs)]">
            <Sparkles className="h-4 w-4 text-[var(--gold-dark)]" aria-hidden />
            ذكاء قانوني مبني للممارسة السعودية
          </div>

          <h1 className="mt-6 font-display text-4xl font-bold leading-[1.25] text-[var(--navy)] sm:text-5xl lg:text-6xl">
            من الواقعة إلى السند
            <span className="block text-[var(--gold-dark)]">والخطوة القانونية التالية</span>
          </h1>

          <p className="mx-auto mt-5 max-w-3xl text-base leading-8 text-[var(--ink-70)] sm:text-lg sm:leading-9">
            حكيم مساحة عمل قانونية سعودية تساعدك على فهم الوقائع، تحديد المسائل، البحث في المصادر،
            وتحويل التحليل إلى عمل يمكن متابعته — دون أن تضيع بين أدوات منفصلة.
          </p>
        </div>

        <div className="mx-auto mt-9 max-w-4xl">
          {askFirst ? (
            <HomeAuthActions
              guest={
                <div className="rounded-[var(--r-2xl)] border border-[var(--gold-border)] bg-[var(--paper)] p-3 shadow-[var(--sh-md)] sm:p-5">
                  <div className="mb-3 flex items-center justify-between gap-3 px-1 text-start">
                    <div>
                      <p className="text-sm font-bold text-[var(--navy)]">ابدأ من الواقعة أو السؤال</p>
                      <p className="mt-1 text-xs leading-6 text-[var(--ink-60)]">
                        اكتب بطريقتك؛ يحفظ حكيم السؤال ثم يكمل التحليل بعد تسجيل الدخول.
                      </p>
                    </div>
                    <MessageSquareText className="hidden h-6 w-6 text-[var(--gold-dark)] sm:block" aria-hidden />
                  </div>
                  <GuestAskComposer />
                </div>
              }
              user={
                <div className="rounded-[var(--r-2xl)] border border-[var(--gold-border)] bg-[var(--paper)] p-6 text-center shadow-[var(--sh-md)]">
                  <p className="font-bold text-[var(--navy)]">مساحة العمل جاهزة</p>
                  <p className="mt-2 text-sm leading-7 text-[var(--ink-60)]">انتقل إلى جلساتك أو ابدأ سؤالًا جديدًا داخل المنصة.</p>
                  <Link
                    href="/dashboard"
                    className="focus-ring mt-5 inline-flex min-h-[48px] items-center justify-center gap-2 rounded-[var(--r-md)] bg-[var(--navy)] px-6 text-sm font-semibold text-white"
                  >
                    افتح حكيم
                    <ArrowLeft className="h-4 w-4" aria-hidden />
                  </Link>
                </div>
              }
            />
          ) : (
            <HomeAuthActions
              guest={
                <div className="flex flex-col items-stretch justify-center gap-3 sm:flex-row">
                  <Link
                    href={authReady ? "/sign-up" : "/sign-in"}
                    className="focus-ring inline-flex min-h-[52px] items-center justify-center gap-2 rounded-[var(--r-md)] bg-[var(--navy)] px-7 text-base font-semibold text-white shadow-[var(--sh-sm)]"
                  >
                    {home.ctaPrimary}
                    <ArrowLeft className="h-4 w-4" aria-hidden />
                  </Link>
                  <a
                    href="#sample"
                    className="focus-ring inline-flex min-h-[52px] items-center justify-center rounded-[var(--r-md)] border border-[var(--gold-border)] bg-[var(--paper)] px-7 text-base font-semibold text-[var(--navy)]"
                  >
                    شاهد طريقة العمل
                  </a>
                </div>
              }
              user={
                <Link
                  href="/dashboard"
                  className="focus-ring mx-auto inline-flex min-h-[52px] items-center justify-center gap-2 rounded-[var(--r-md)] bg-[var(--navy)] px-8 text-base font-semibold text-white"
                >
                  المتابعة إلى المنصة
                  <ArrowLeft className="h-4 w-4" aria-hidden />
                </Link>
              }
            />
          )}
        </div>

        <ul className="mx-auto mt-8 flex max-w-4xl flex-wrap items-center justify-center gap-x-6 gap-y-3 text-xs font-semibold text-[var(--ink-60)]" aria-label="سمات حكيم">
          {["متخصص في الأنظمة السعودية", "إجابات مسندة", "جلسات محفوظة", "حدود مهنية واضحة"].map((item) => (
            <li key={item} className="inline-flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-[var(--emerald)]" aria-hidden />
              {item}
            </li>
          ))}
        </ul>
      </section>

      <section id="sample" className="relative border-y border-[var(--ink-08)] bg-[var(--paper)] px-4 py-16 sm:px-6 lg:py-20">
        <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[0.8fr_1.2fr]">
          <SectionHeading
            align="start"
            eyebrow="ليست إجابة صندوق أسود"
            title="ترى كيف وصل حكيم إلى النتيجة"
            description="بدل جواب عام، تُنظّم النتيجة إلى فهم للواقعة، ومسائل قانونية، وسند نظامي، وتحليل، وخطوة عملية تالية — مع بيان ما يحتاج إلى تحقق إضافي."
          />

          <div className="overflow-hidden rounded-[var(--r-2xl)] border border-[var(--ink-08)] bg-[var(--hakeem-bg)] shadow-[var(--sh-md)]">
            <div className="border-b border-[var(--ink-08)] bg-[var(--navy)] px-5 py-4 text-start text-white">
              <p className="text-xs font-semibold text-[var(--gold-pale)]">مثال توضيحي لشكل المخرج</p>
              <p className="mt-2 text-sm leading-7 text-white/85">
                «تعاقدت الشركة مع مورد، وتأخر في التسليم وطلب زيادة السعر بعد توقيع العقد. ما الخيارات المتاحة؟»
              </p>
            </div>

            <div className="grid gap-4 p-4 sm:p-6">
              <div className="rounded-[var(--r-lg)] border border-[var(--ink-08)] bg-[var(--paper)] p-4 text-start">
                <p className="text-xs font-bold text-[var(--gold-dark)]">فهم المسألة</p>
                <p className="mt-2 text-sm leading-7 text-[var(--ink-70)]">
                  نزاع عقد توريد يتصل بالتأخر في التنفيذ، ومدى جواز تعديل المقابل، والآثار المترتبة على الإخلال.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-[var(--r-lg)] border border-[var(--ink-08)] bg-[var(--paper)] p-4 text-start">
                  <p className="text-xs font-bold text-[var(--gold-dark)]">المسائل التي سيبحثها</p>
                  <ul className="mt-3 space-y-2 text-sm leading-7 text-[var(--ink-70)]">
                    <li>• التزام المورد بموعد التسليم.</li>
                    <li>• أثر طلب زيادة السعر بعد العقد.</li>
                    <li>• الإعذار والفسخ والتعويض.</li>
                  </ul>
                </div>
                <div className="rounded-[var(--r-lg)] border border-[var(--gold-border)] bg-[rgba(198,151,99,0.08)] p-4 text-start">
                  <p className="text-xs font-bold text-[var(--gold-dark)]">السند والحدود</p>
                  <p className="mt-3 text-sm leading-7 text-[var(--ink-70)]">
                    يعرض المواد ذات الصلة، ويميز النص الصريح عن التطبيق المحتمل، وينبه إلى الوقائع أو المستندات الناقصة.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--r-lg)] bg-[var(--navy)] px-4 py-4 text-start text-white">
                <div>
                  <p className="text-xs font-semibold text-[var(--gold-pale)]">الخطوة التالية</p>
                  <p className="mt-1 text-sm">راجع بند المدة والتعديل، ثم جهّز إشعار الإعذار والمستندات المثبتة للتأخر.</p>
                </div>
                <span className="rounded-full border border-white/15 px-3 py-1.5 text-xs text-white/80">قابل للتحويل إلى ملف قضية</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="why" className="px-4 py-16 sm:px-6 lg:py-24">
        <div className="mx-auto max-w-7xl">
          <SectionHeading
            eyebrow="لماذا حكيم"
            title="منصة قانونية تفهم طبيعة العمل، لا مجرد نص السؤال"
            description="بُنيت التجربة حول طريقة عمل الممارس القانوني: واقعة تحتاج تحريرًا، مصادر تحتاج تحققًا، ومستندات وإجراءات يجب أن تبقى في سياق واحد."
          />

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {VALUE_PROPS.map(({ title, description, icon: Icon }) => (
              <article key={title} className="rounded-[var(--r-xl)] border border-[var(--ink-08)] bg-[var(--paper)] p-5 text-start shadow-[var(--sh-xs)]">
                <span className="grid h-11 w-11 place-items-center rounded-[var(--r-md)] bg-[var(--gold-ghost)] text-[var(--gold-dark)]">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <h3 className="mt-5 font-display text-lg font-bold text-[var(--navy)]">{title}</h3>
                <p className="mt-2 text-sm leading-7 text-[var(--ink-60)]">{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="capabilities" className="border-y border-[var(--ink-08)] bg-[var(--paper)] px-4 py-16 sm:px-6 lg:py-24">
        <div className="mx-auto max-w-7xl">
          <SectionHeading
            eyebrow="ماذا ينجز"
            title="ابدأ من مهمة واحدة، ثم توسع عندما تحتاج"
            description="لا تحتاج إلى معرفة أسماء الأدوات مسبقًا. ابدأ بالسؤال أو القضية، وانتقل إلى المستندات والمكتبة والمحاكاة من داخل سياق العمل."
          />

          <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {CAPABILITIES.map(({ title, description, icon: Icon, href, action }) => (
              <Link
                key={title}
                href={signUpWithNext(href || "/dashboard")}
                className="group flex min-h-full flex-col rounded-[var(--r-xl)] border border-[var(--ink-08)] bg-[var(--hakeem-bg)] p-5 text-start transition hover:-translate-y-0.5 hover:border-[var(--gold-border)] hover:shadow-[var(--sh-sm)]"
              >
                <span className="grid h-11 w-11 place-items-center rounded-[var(--r-md)] bg-[var(--navy)] text-[var(--gold-pale)]">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <h3 className="mt-5 font-display text-lg font-bold text-[var(--navy)]">{title}</h3>
                <p className="mt-2 flex-1 text-sm leading-7 text-[var(--ink-60)]">{description}</p>
                <span className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-[var(--gold-dark)]">
                  {action}
                  <ArrowLeft className="h-4 w-4 transition group-hover:-translate-x-1" aria-hidden />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section id="how" className="px-4 py-16 sm:px-6 lg:py-24">
        <div className="mx-auto max-w-7xl">
          <SectionHeading
            eyebrow="كيف يعمل"
            title="ثلاث مراحل واضحة من السؤال إلى العمل"
            description="يبقى الحوار بسيطًا للمستخدم، بينما تنظم المنصة الفهم والبحث والتحليل في الخلفية وتعرض النتيجة بصورة قابلة للمراجعة."
          />

          <ol className="mt-12 grid gap-5 lg:grid-cols-3">
            {[
              {
                number: "١",
                title: "اكتب الواقعة بطريقتك",
                description: "سؤال مختصر أو تفاصيل كاملة أو مستندات؛ يبدأ حكيم بفهم مقصدك وما تريد إنجازه.",
                icon: MessageSquareText,
              },
              {
                number: "٢",
                title: "تحديد المسائل والبحث",
                description: "يفكك الواقعة إلى مسائل، ويبحث في المصادر ذات الصلة، ويكشف ما يحتاج إلى استكمال أو تحقق.",
                icon: SearchCheck,
              },
              {
                number: "٣",
                title: "تحليل قابل للمتابعة",
                description: "يعرض السند والتحليل والخطوة التالية، ويمكن حفظ الجلسة أو تحويلها إلى قضية أو مستند عمل.",
                icon: Workflow,
              },
            ].map(({ number, title, description, icon: Icon }) => (
              <li key={number} className="relative rounded-[var(--r-2xl)] border border-[var(--ink-08)] bg-[var(--paper)] p-6 text-start shadow-[var(--sh-xs)]">
                <div className="flex items-center justify-between gap-4">
                  <span className="font-judicial text-4xl font-bold text-[var(--gold)]">{number}</span>
                  <span className="grid h-11 w-11 place-items-center rounded-[var(--r-md)] bg-[var(--navy)] text-[var(--gold-pale)]">
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                </div>
                <h3 className="mt-5 font-display text-xl font-bold text-[var(--navy)]">{title}</h3>
                <p className="mt-3 text-sm leading-8 text-[var(--ink-60)]">{description}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="border-y border-[var(--ink-08)] bg-[var(--paper)] px-4 py-16 sm:px-6 lg:py-24">
        <div className="mx-auto max-w-7xl">
          <SectionHeading
            eyebrow="لمن صُمم"
            title="للممارس الذي يحتاج نتيجة يمكن العمل عليها"
            description="سواء كنت تعمل منفردًا أو ضمن مكتب أو إدارة قانونية، يختصر حكيم المسافة بين السؤال الأول والمخرج المنظم القابل للمراجعة."
          />

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {AUDIENCES.map((audience) => (
              <article key={audience.title} className="rounded-[var(--r-xl)] border border-[var(--ink-08)] bg-[var(--hakeem-bg)] p-5 text-start">
                <h3 className="font-display text-lg font-bold text-[var(--navy)]">{audience.title}</h3>
                <p className="mt-3 text-sm leading-7 text-[var(--ink-60)]">{audience.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="trust" className="px-4 py-16 sm:px-6 lg:py-24">
        <div className="mx-auto grid max-w-7xl overflow-hidden rounded-[var(--r-2xl)] bg-[var(--navy)] shadow-[var(--sh-lg)] lg:grid-cols-[1.1fr_0.9fr]">
          <div className="p-7 text-start sm:p-10 lg:p-12">
            <p className="text-sm font-semibold text-[var(--gold-pale)]">الثقة والخصوصية</p>
            <h2 className="mt-3 font-display text-3xl font-bold leading-tight text-white sm:text-4xl">
              التقنية تساعدك، ولا تخفي عنك حدودها
            </h2>
            <p className="mt-5 max-w-2xl text-sm leading-8 text-white/70 sm:text-base">
              صُممت حكيم لتقليل الادعاء غير المسند، وإظهار المصدر والحدود المهنية، وإبقاء المستخدم المختص صاحب القرار النهائي.
            </p>

            <ul className="mt-8 grid gap-4 sm:grid-cols-2">
              {[
                "تمييز النص عن التحليل والاستنتاج",
                "تنبيه عند نقص الوقائع أو المستندات",
                "عدم اعتبار المخرج حكمًا أو رأيًا نهائيًا",
                "حفظ العمل داخل حساب المستخدم",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm leading-7 text-white/85">
                  <ShieldCheck className="mt-1 h-5 w-5 shrink-0 text-[var(--gold-bright)]" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="border-t border-white/10 bg-white/[0.05] p-7 sm:p-10 lg:border-r lg:border-t-0 lg:p-12">
            <div className="flex h-full flex-col justify-center rounded-[var(--r-xl)] border border-white/10 bg-black/10 p-6 text-start">
              <LockKeyhole className="h-9 w-9 text-[var(--gold-bright)]" aria-hidden />
              <h3 className="mt-5 font-display text-xl font-bold text-white">خصوصية مهنية تبدأ من التصميم</h3>
              <p className="mt-3 text-sm leading-8 text-white/70">
                لا يوضع نص السؤال في رابط الصفحة عند الانتقال إلى التسجيل، وتُحفظ المسودة محليًا لإكمال الرحلة بعد الدخول.
              </p>
              <div className="mt-6 flex flex-wrap gap-2 text-xs font-semibold text-[var(--gold-pale)]">
                <span className="rounded-full border border-white/10 px-3 py-1.5">مسودة محلية</span>
                <span className="rounded-full border border-white/10 px-3 py-1.5">حساب آمن</span>
                <span className="rounded-full border border-white/10 px-3 py-1.5">حدود استخدام واضحة</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-[var(--ink-08)] bg-[var(--paper)] px-4 py-16 sm:px-6 lg:py-24">
        <div className="mx-auto max-w-4xl">
          <SectionHeading
            eyebrow="أسئلة شائعة"
            title="ما تحتاج إلى معرفته قبل أن تبدأ"
            description="إجابات مباشرة حول طبيعة حكيم وحدود استخدامه وطريقة حفظ العمل ومتابعته."
          />

          <div className="mt-10 space-y-3">
            {FAQ.map((item) => (
              <details key={item.question} className="group rounded-[var(--r-lg)] border border-[var(--ink-08)] bg-[var(--hakeem-bg)] px-5 py-4 text-start open:border-[var(--gold-border)]">
                <summary className="cursor-pointer list-none font-display text-base font-bold text-[var(--navy)] marker:hidden">
                  <span className="flex items-center justify-between gap-4">
                    {item.question}
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-[var(--ink-08)] text-lg font-normal text-[var(--gold-dark)] group-open:rotate-45">+</span>
                  </span>
                </summary>
                <p className="mt-4 border-t border-[var(--ink-08)] pt-4 text-sm leading-8 text-[var(--ink-60)]">{item.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6 lg:py-24">
        <div className="mx-auto max-w-5xl rounded-[var(--r-2xl)] border border-[var(--gold-border)] bg-[var(--paper)] px-6 py-10 text-center shadow-[var(--sh-md)] sm:px-10 sm:py-14">
          <Sparkles className="mx-auto h-7 w-7 text-[var(--gold-dark)]" aria-hidden />
          <h2 className="mt-4 font-display text-3xl font-bold text-[var(--navy)] sm:text-4xl">ابدأ من مسألتك، لا من قائمة الأدوات</h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-8 text-[var(--ink-60)] sm:text-base">
            اكتب الواقعة أو السؤال، ودع حكيم ينظم الطريق من الفهم إلى السند والتحليل والعمل التالي.
          </p>
          <HomeAuthActions
            guest={
              <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
                <Link
                  href="/sign-up"
                  className="focus-ring inline-flex min-h-[50px] items-center justify-center gap-2 rounded-[var(--r-md)] bg-[var(--navy)] px-7 text-sm font-semibold text-white"
                >
                  ابدأ مجانًا
                  <ArrowLeft className="h-4 w-4" aria-hidden />
                </Link>
                <Link
                  href="/pricing"
                  className="focus-ring inline-flex min-h-[50px] items-center justify-center rounded-[var(--r-md)] border border-[var(--gold-border)] bg-[var(--hakeem-bg)] px-7 text-sm font-semibold text-[var(--navy)]"
                >
                  عرض الخطط
                </Link>
              </div>
            }
            user={
              <Link
                href="/dashboard"
                className="focus-ring mt-7 inline-flex min-h-[50px] items-center justify-center gap-2 rounded-[var(--r-md)] bg-[var(--navy)] px-7 text-sm font-semibold text-white"
              >
                افتح مساحة العمل
                <ArrowLeft className="h-4 w-4" aria-hidden />
              </Link>
            }
          />
        </div>
      </section>

      <footer className="border-t border-[var(--ink-08)] bg-[var(--navy)] px-4 py-10 text-white sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-col gap-8 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="[&_p:first-of-type]:text-white [&_p:last-of-type]:text-white/55">
              <BrandMark compact />
            </div>
            <p className="mt-4 max-w-xl text-xs leading-7 text-white/55">{home.disclaimer}</p>
          </div>

          <div className="flex flex-wrap gap-x-5 gap-y-3 text-xs font-semibold text-white/70">
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
