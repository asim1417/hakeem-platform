/**
 * القيم الافتراضية لموقع حكيم — تطابق الهوية الحالية عند غياب إعدادات القاعدة.
 */

export type SiteTheme = {
  navy: string;
  gold: string;
  bg: string;
  paper: string;
  ink: string;
};

export type SiteHomeContent = {
  brandName: string;
  tagline: string;
  headline: string;
  lede: string;
  ctaPrimary: string;
  ctaSecondary: string;
  footnote: string;
  disclaimer: string;
  features: Array<{ title: string; desc: string; next: string }>;
};

export type BuiltinPageKey = "home" | "pricing" | "privacy" | "terms";

export type BuiltinPageState = {
  key: BuiltinPageKey;
  label: string;
  path: string;
  enabled: boolean;
};

export type SiteConfig = {
  theme: SiteTheme;
  home: SiteHomeContent;
  pages: Record<BuiltinPageKey, boolean>;
};

export type CustomSitePage = {
  id: string;
  slug: string;
  title: string;
  body: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export const DEFAULT_THEME: SiteTheme = {
  navy: "#0E3435",
  gold: "#C69763",
  bg: "#EFF3F2",
  paper: "#FBFAF6",
  ink: "#12211F",
};

export const DEFAULT_HOME: SiteHomeContent = {
  brandName: "حكيم",
  tagline: "منصة المعرفة القضائية",
  headline: "رفيق المحامي في القاعة",
  lede: "حلّل الوقائع، اقترح الدفوع، وتابع أعمالك القانونية من مكان واحد — بمصدر نظامي موثّق.",
  ctaPrimary: "ابدأ مجانًا",
  ctaSecondary: "تسجيل الدخول",
  footnote: "بوابة دخول موحّدة — اختر Google من صفحة الدخول الآمنة.",
  disclaimer:
    "تنبيه مهني: مخرجات الذكاء الاصطناعي في حكيم مساعدة وتعليمية ولا تُعدّ رأيًا قانونيًا نهائيًا أو حكمًا فعليًا.",
  features: [
    {
      title: "اسأل حكيم",
      desc: "تحليل واقعة واقتراح أساس نظامي",
      next: "/dashboard/ask",
    },
    {
      title: "المعاون القضائي",
      desc: "مساحة قضية وتحليل متكامل",
      next: "/dashboard/judicial-assistant",
    },
    {
      title: "محاكاة قضائية",
      desc: "تدريب على تفكير القاضي",
      next: "/dashboard/simulations",
    },
  ],
};

export const BUILTIN_PAGE_META: Array<{
  key: BuiltinPageKey;
  label: string;
  path: string;
}> = [
  { key: "home", label: "الصفحة الرئيسية", path: "/" },
  { key: "pricing", label: "الأسعار", path: "/pricing" },
  { key: "privacy", label: "الخصوصية", path: "/privacy" },
  { key: "terms", label: "الشروط", path: "/terms" },
];

export const DEFAULT_PAGES: Record<BuiltinPageKey, boolean> = {
  home: true,
  pricing: true,
  privacy: true,
  terms: true,
};

export function defaultSiteConfig(): SiteConfig {
  return {
    theme: { ...DEFAULT_THEME },
    home: {
      ...DEFAULT_HOME,
      features: DEFAULT_HOME.features.map((f) => ({ ...f })),
    },
    pages: { ...DEFAULT_PAGES },
  };
}

const HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function sanitizeHex(raw: string, fallback: string): string {
  const v = (raw || "").trim();
  return HEX.test(v) ? v : fallback;
}

export type SiteConfigPatch = {
  theme?: Partial<SiteTheme>;
  home?: Partial<Omit<SiteHomeContent, "features">> & {
    features?: SiteHomeContent["features"];
  };
  pages?: Partial<Record<BuiltinPageKey, boolean>>;
};

export function mergeSiteConfig(partial: SiteConfigPatch | null | undefined): SiteConfig {
  const base = defaultSiteConfig();
  if (!partial) return base;
  return {
    theme: {
      navy: sanitizeHex(partial.theme?.navy || "", base.theme.navy),
      gold: sanitizeHex(partial.theme?.gold || "", base.theme.gold),
      bg: sanitizeHex(partial.theme?.bg || "", base.theme.bg),
      paper: sanitizeHex(partial.theme?.paper || "", base.theme.paper),
      ink: sanitizeHex(partial.theme?.ink || "", base.theme.ink),
    },
    home: {
      ...base.home,
      ...(partial.home || {}),
      features:
        partial.home?.features?.length
          ? partial.home.features
              .slice(0, 6)
              .map((f) => ({
                title: String(f.title || "").slice(0, 80),
                desc: String(f.desc || "").slice(0, 200),
                next: String(f.next || "/dashboard").startsWith("/")
                  ? String(f.next).slice(0, 120)
                  : "/dashboard",
              }))
          : base.home.features,
      brandName: String(partial.home?.brandName ?? base.home.brandName).slice(0, 40),
      tagline: String(partial.home?.tagline ?? base.home.tagline).slice(0, 80),
      headline: String(partial.home?.headline ?? base.home.headline).slice(0, 120),
      lede: String(partial.home?.lede ?? base.home.lede).slice(0, 400),
      ctaPrimary: String(partial.home?.ctaPrimary ?? base.home.ctaPrimary).slice(0, 40),
      ctaSecondary: String(partial.home?.ctaSecondary ?? base.home.ctaSecondary).slice(0, 40),
      footnote: String(partial.home?.footnote ?? base.home.footnote).slice(0, 200),
      disclaimer: String(partial.home?.disclaimer ?? base.home.disclaimer).slice(0, 500),
    },
    pages: {
      home: partial.pages?.home ?? true,
      pricing: partial.pages?.pricing ?? true,
      privacy: partial.pages?.privacy ?? true,
      terms: partial.pages?.terms ?? true,
    },
  };
}

/** CSS variables حقن من الثيم — يحدّث الهوية دون كسر باقي الرموز. */
export function themeToCssVars(theme: SiteTheme): string {
  const t = {
    navy: sanitizeHex(theme.navy, DEFAULT_THEME.navy),
    gold: sanitizeHex(theme.gold, DEFAULT_THEME.gold),
    bg: sanitizeHex(theme.bg, DEFAULT_THEME.bg),
    paper: sanitizeHex(theme.paper, DEFAULT_THEME.paper),
    ink: sanitizeHex(theme.ink, DEFAULT_THEME.ink),
  };
  return `:root{
  --navy:${t.navy};
  --hakeem-navy:${t.navy};
  --petrol:${t.navy};
  --gold:${t.gold};
  --hakeem-gold:${t.gold};
  --copper:${t.gold};
  --hakeem-bg:${t.bg};
  --surface:${t.bg};
  --paper:${t.paper};
  --parchment:${t.paper};
  --hakeem-paper:${t.paper};
  --doc-ivory:${t.paper};
  --ivory:${t.paper};
  --ink:${t.ink};
  --hakeem-text:${t.ink};
  --doc-ink:${t.ink};
}`;
}

export function slugifyAr(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\u0600-\u06FF-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}
