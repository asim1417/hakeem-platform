import Link from "next/link";
import dynamic from "next/dynamic";
import { HomeAskSurface } from "@/components/home/HomeAskSurface";
import { QuotaCounter } from "@/components/billing/QuotaCounter";
import { CreditsWidget } from "@/components/credits/CreditsWidget";
import { OnboardingBanner } from "@/components/onboarding/OnboardingBanner";
import { TRADITIONAL_SEARCH_ENABLED } from "@/lib/modules/config/search-visibility";
import { isHomeInlineAskEnabled } from "@/lib/modules/config/home-inline-ask";
import { isAskFirstHomeEnabled } from "@/lib/modules/config/ask-first-home";

const HakeemAskWorkspace = dynamic(
  () =>
    import("@/components/ask/HakeemAskWorkspace").then((m) => m.HakeemAskWorkspace),
  {
    ssr: false,
    loading: () => (
      <div
        className="flex min-h-[48vh] items-center justify-center text-sm text-[var(--ink-60)]"
        aria-busy="true"
        aria-label="جارٍ تجهيز مساحة اسأل حكيم"
      >
        جارٍ تجهيز مساحة السؤال…
      </div>
    ),
  }
);

export type WorkItem = {
  id: string;
  title: string;
  meta: string;
  href: string;
};

export type WorkbenchProps = {
  firstName: string;
  isNewUser: boolean;
  showWelcome: boolean;
  legalArticles: number;
  continueItems: WorkItem[];
};

type Dest = {
  href: string;
  title: string;
  hint: string;
  cta: string;
};

const SUPPORTING_TOOLS: Dest[] = [
  {
    href: "/dashboard/judicial-assistant",
    title: "فتح قضية",
    hint: "حوّل هذه المسألة إلى ملف قضية منظم.",
    cta: "فتح قضية",
  },
  {
    href: "/dashboard/judicial-assistant",
    title: "المعاون القضائي",
    hint: "تابع دراسة القضية وإجراءاتها وأعمالها القضائية.",
    cta: "فتح المعاون",
  },
  {
    href: "/documents",
    title: "تحليل المستندات",
    hint: "أرفق مستندًا للحصول على تحليل منظم.",
    cta: "تحليل مستند",
  },
  {
    href: "/dashboard/legal-core",
    title: "المكتبة القانونية",
    hint: "تصفّح النصوص والأنظمة والمصادر ذات الصلة.",
    cta: "فتح المكتبة",
  },
  {
    href: "/dashboard/files",
    title: "مساحتي",
    hint: "ارجع إلى محادثاتك وقضاياك وتقاريرك المحفوظة.",
    cta: "فتح مساحتي",
  },
];

const LEGACY_DESTINATIONS: Array<{
  href: string;
  title: string;
  hint: string;
  primary?: boolean;
}> = [
  {
    href: "/dashboard/ask",
    title: "اسأل حكيم",
    hint: "تحليل ودفوع واستراتيجية",
    primary: true,
  },
  {
    href: "/dashboard/judicial-assistant",
    title: "المعاون القضائي",
    hint: "ملف القضية والمتابعة",
  },
  {
    href: "/dashboard/simulations",
    title: "القاضي التفاعلي",
    hint: "محاكاة الجلسة والحكم",
  },
  {
    href: "/dashboard/legal-core",
    title: "المكتبة النظامية",
    hint: "أنظمة ومواد وأحكام",
  },
  {
    href: "/documents",
    title: "الوثائق",
    hint: "رفع واستخراج نص",
  },
];

/**
 * بعد الدخول: عند ASK_FIRST_HOME تكون الواجهة هي مساحة اسأل حكيم الكاملة (نفس مكوّن /dashboard/ask).
 * لا تحويل أثناء السؤال — التنفيذ داخل الصفحة.
 */
export function DashboardWorkbench({
  firstName,
  isNewUser,
  showWelcome,
  legalArticles,
  continueItems,
}: WorkbenchProps) {
  const inlineAsk = isHomeInlineAskEnabled();
  const askFirst = isAskFirstHomeEnabled();

  if (askFirst) {
    return (
      <div className="wb wb--ask-first">
        <div className="wb-meta wb-meta--top">
          <QuotaCounter />
          <OnboardingBanner />
          {!isNewUser ? <CreditsWidget /> : null}
        </div>

        <section className="wb-ask-full" aria-label="اسأل حكيم">
          <HakeemAskWorkspace userName={firstName} variant="home" />
        </section>

        {continueItems.length > 0 ? (
          <section className="wb-continue" aria-labelledby="wb-continue-title">
            <div className="wb-section-head">
              <h2 id="wb-continue-title">تابع آخر عمل</h2>
              <p>آخر ما اشتغلت عليه — بضغطة واحدة.</p>
            </div>
            <ul className="wb-continue__list">
              {continueItems.map((item) => (
                <li key={item.id}>
                  <Link href={item.href} className="wb-continue__item">
                    <span className="wb-continue__title">{item.title}</span>
                    <span className="wb-continue__meta">{item.meta}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="wb-tools" aria-labelledby="wb-tools-title">
          <div className="wb-section-head">
            <h2 id="wb-tools-title">أدوات أعمق عندما تحتاجها</h2>
            <p>
              {legalArticles > 0
                ? `خدمات مساندة · النواة: ${legalArticles.toLocaleString("ar-SA")} مادة`
                : "استخدمها عند الحاجة دون أن تنافس مساحة السؤال."}
            </p>
          </div>
          <nav className="wb-tools__nav" aria-label="أدوات مساندة">
            {SUPPORTING_TOOLS.map((d) => (
              <Link key={`${d.title}-${d.href}`} href={d.href} className="wb-tools__link">
                <span className="wb-tools__name">{d.title}</span>
                <span className="wb-tools__hint">{d.hint}</span>
                <span className="wb-tools__cta">{d.cta}</span>
              </Link>
            ))}
            {TRADITIONAL_SEARCH_ENABLED ? (
              <Link href="/dashboard/legal-search" className="wb-tools__link">
                <span className="wb-tools__name">البحث الشامل</span>
                <span className="wb-tools__hint">نص وفلاتر على النواة القانونية.</span>
                <span className="wb-tools__cta">فتح البحث</span>
              </Link>
            ) : null}
          </nav>
        </section>

        <section className="wb-trust" aria-labelledby="wb-trust-title">
          <h2 id="wb-trust-title" className="sr-only">
            الثقة والخصوصية
          </h2>
          <p>
            مخرجات حكيم مساعدة تعليمية وليست حكمًا أو قرارًا ملزمًا. تُطبَّق حدود الاستخدام والرصيد على
            الخادم.
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="wb">
      <section className="wb-stage" aria-labelledby="wb-brand">
        <div className="wb-stage__veil" aria-hidden />
        <div className="wb-stage__inner">
          <p id="wb-brand" className="wb-brand">
            حكيم
          </p>
          <h1 className="wb-title">
            {showWelcome || isNewUser
              ? `${firstName}، ابدأ من الواقعة`
              : `${firstName}، ماذا تعمل الآن؟`}
          </h1>
          <p className="wb-lede">
            من الوقائع إلى التحليل والاستراتيجية — برفاقٍ يفكّر كما في القاعة.
          </p>
          <div className="wb-ask">
            <HomeAskSurface />
          </div>
          <div className="wb-cta">
            {inlineAsk ? (
              <p className="wb-cta__hint">
                <span className="wb-cta__hint-ask">اسأل</span> للحصول على بحث وتحليل قانوني مباشر ·{" "}
                <span className="wb-cta__hint-case">فتح قضية</span> لتنظيم ملف ومتابعة إجراءاته
              </p>
            ) : (
              <Link href="/dashboard/ask" className="wb-cta__primary">
                اسأل حكيم
              </Link>
            )}
            <Link
              href="/dashboard/judicial-assistant"
              className={inlineAsk ? "wb-cta__primary" : "wb-cta__ghost"}
              title="تنظيم ملف قضية ودراسة مستنداتها وإجراءاتها"
            >
              فتح قضية
            </Link>
            {inlineAsk ? (
              <Link href="/dashboard/ask" className="wb-cta__ghost" title="الأوضاع المتقدمة والمرفقات">
                مساحة العمل الكاملة
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      <div className="wb-meta">
        <QuotaCounter />
        <OnboardingBanner />
        {!isNewUser ? <CreditsWidget /> : null}
      </div>

      {continueItems.length > 0 ? (
        <section className="wb-continue" aria-labelledby="wb-continue-title">
          <div className="wb-section-head">
            <h2 id="wb-continue-title">تابع عملك</h2>
            <p>آخر ما اشتغلت عليه — بضغطة واحدة.</p>
          </div>
          <ul className="wb-continue__list">
            {continueItems.map((item) => (
              <li key={item.id}>
                <Link href={item.href} className="wb-continue__item">
                  <span className="wb-continue__title">{item.title}</span>
                  <span className="wb-continue__meta">{item.meta}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="wb-dest" aria-labelledby="wb-dest-title">
        <div className="wb-section-head">
          <h2 id="wb-dest-title">{isNewUser ? "مسارات البداية" : "أدوات القاعة"}</h2>
          <p>
            {legalArticles > 0
              ? `النواة جاهزة · ${legalArticles.toLocaleString("ar-SA")} مادة`
              : "اختر مساراً واحداً وابدأ"}
          </p>
        </div>
        <nav className="wb-dest__nav" aria-label="أدوات العمل">
          {(TRADITIONAL_SEARCH_ENABLED
            ? [
                ...LEGACY_DESTINATIONS,
                {
                  href: "/dashboard/legal-search",
                  title: "البحث الشامل",
                  hint: "نص وفلاتر على النواة",
                },
              ]
            : LEGACY_DESTINATIONS
          ).map((d) => (
            <Link
              key={d.href}
              href={d.href}
              className={d.primary ? "wb-dest__link wb-dest__link--primary" : "wb-dest__link"}
            >
              <span className="wb-dest__name">{d.title}</span>
              <span className="wb-dest__hint">{d.hint}</span>
            </Link>
          ))}
        </nav>
      </section>
    </div>
  );
}
