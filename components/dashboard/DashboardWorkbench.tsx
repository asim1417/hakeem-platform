import Link from "next/link";
import { CenterSearch } from "@/components/CenterSearch";
import { QuotaCounter } from "@/components/billing/QuotaCounter";
import { CreditsWidget } from "@/components/credits/CreditsWidget";
import { OnboardingBanner } from "@/components/onboarding/OnboardingBanner";
import { TRADITIONAL_SEARCH_ENABLED } from "@/lib/modules/config/search-visibility";

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
  primary?: boolean;
};

const DESTINATIONS: Dest[] = [
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
 * الصفحة الأولى للمحامي — جلسة عمل لا فهرس خدمات.
 * الهوية: حكيم أولاً، سؤال واحد، ثم متابعة العمل.
 */
export function DashboardWorkbench({
  firstName,
  isNewUser,
  showWelcome,
  legalArticles,
  continueItems,
}: WorkbenchProps) {
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
            <CenterSearch />
          </div>
          <div className="wb-cta">
            <Link href="/dashboard/ask" className="wb-cta__primary">
              اسأل حكيم
            </Link>
            <Link href="/dashboard/judicial-assistant" className="wb-cta__ghost">
              فتح قضية
            </Link>
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
                ...DESTINATIONS,
                {
                  href: "/dashboard/legal-search",
                  title: "البحث الشامل",
                  hint: "نص وفلاتر على النواة",
                } satisfies Dest,
              ]
            : DESTINATIONS
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
