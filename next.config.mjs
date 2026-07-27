/** @type {import('next').NextConfig} */

/**
 * أصل الروابط القانونية (canonical وغيرها) وقت البناء.
 * NEXT_PUBLIC_ يُحسم عند build — مصدر canonical فقط، لا يتحكم وحده بـ Server Actions.
 */
function resolveSiteUrl() {
  const raw = (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXTAUTH_URL || "").trim();
  const fallback = "https://hakeem-platform.vercel.app";
  const normalized = (raw || fallback).replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(normalized)) return `https://${normalized}`;
  return normalized;
}

function hostFromUrlOrHost(raw) {
  const t = (raw || "").trim().replace(/\/+$/, "");
  if (!t) return "";
  try {
    const withProto = /^https?:\/\//i.test(t) ? t : `https://${t}`;
    return new URL(withProto).host;
  } catch {
    return t.replace(/^https?:\/\//i, "").split("/")[0] || "";
  }
}

const siteUrl = resolveSiteUrl();

/**
 * مضيفات Server Actions — قائمة تراكمية (يُضاف بجوار الحالي لا بدله).
 * لا تُشتق كقيمة واحدة من NEXT_PUBLIC_SITE_URL حتى لا يسقط vercel.app عند القطع.
 * اختياري: SERVER_ACTIONS_ALLOWED_ORIGINS=host1,host2 لإضافات وقت البناء.
 */
function resolveServerActionOrigins() {
  const base = [
    "localhost:3000",
    "hakeem-platform.vercel.app",
    "hakeemsa.com",
    "www.hakeemsa.com",
  ];
  const extras = [];
  const fromSite = hostFromUrlOrHost(siteUrl);
  if (fromSite) extras.push(fromSite);
  const vercelHost = hostFromUrlOrHost(process.env.VERCEL_URL || "");
  if (vercelHost) extras.push(vercelHost);
  const csv = (process.env.SERVER_ACTIONS_ALLOWED_ORIGINS || "").trim();
  if (csv) {
    for (const part of csv.split(",")) {
      const h = hostFromUrlOrHost(part);
      if (h) extras.push(h);
    }
  }
  return Array.from(new Set([...base, ...extras]));
}

const serverActionOrigins = resolveServerActionOrigins();

const nextConfig = {
  // تضمين فهرس البحث المضغوط مع دوال الخادم على Vercel (يُقرأ عبر fs وقت التشغيل)
  outputFileTracingIncludes: {
    "/search": ["./data/legal-bm25-index.json.gz"],
    "/api/legal-core/bm25-search": ["./data/legal-bm25-index.json.gz"],
    // fixtures فقط لمسارات رصد التي قد تعمل fixtures-only على Preview — بدون snapshots
    "/api/admin/rasd/runs": ["./data/rasd/fixtures/**/*"],
    "/api/admin/rasd/health": ["./data/rasd/fixtures/**/*"],
    "/api/cron/rasd-weekly": ["./data/rasd/fixtures/**/*"],
    "/api/cron/rasd/weekly": ["./data/rasd/fixtures/**/*"]
  },
  // منع تضخم Serverless: مسارات رصد تستخدم fs+cwd فتسحب .git/.next/data بالكامل بدون هذا الاستثناء
  outputFileTracingExcludes: {
    "*": [
      "./.git/**",
      "./.next/**",
      "./.npm-cache/**",
      "./coverage/**",
      "./docs/**",
      "./scripts/**",
      "./tools/**",
      "./reports/**",
      "./audit/**",
      "./.github/**",
      "./data/rasd/snapshots/**",
      "./data/fiqh*/**",
      "./data/saudi_systems.json",
      "./data/legal_articles_export.json",
      "./data/legal-issues-browse.json",
      "./data/fiqh-nizam-links.json",
      "./data/fiqh-issues-tree.json",
      "./data/fiqh_issue_tree.json",
      "./data/fiqh_issue_candidates.csv",
      "./data/fiqh-article-index.json",
      "./tsconfig.tsbuildinfo",
      "./package-lock.json"
    ]
  },
  // أحدث ممارسات Next: ضغط + إزالة X-Powered-By + صور حديثة
  poweredByHeader: false,
  compress: true,
  images: {
    formats: ["image/avif", "image/webp"],
  },
  experimental: {
    // يُفعّل instrumentation.ts (تحميل إعدادات اللوحة إلى البيئة عند الإقلاع).
    instrumentationHook: true,
    serverActions: {
      allowedOrigins: serverActionOrigins
    }
  },
  // ترويسات أمنية على كل المسارات. القفل الصارم على object/base/form/frame؛
  // وscript/style مرنة (unsafe-inline) وworker/blob مسموحة لأن Next/Tailwind
  // ومحرّك OCR (WASM) والألعاب تحتاجها — فلا تتعطّل أي ميزة. أساس نشدّه لاحقًا
  // بـ nonces عند الحاجة لتصلّب أعلى ضد XSS.
  async headers() {
    // Clerk: لا تُحذف هذه النطاقات — نسخة التطوير الحالية تعتمد عليها في الإنتاج المؤقت
    const clerkHosts =
      "https://*.clerk.accounts.dev https://*.clerk.com https://*.protect.clerk.com https://*.accounts.dev https://clerk.shared.lcl.dev";
    const turnstile = "https://challenges.cloudflare.com";
    const googleFonts = "https://fonts.googleapis.com";
    const googleFontsStatic = "https://fonts.gstatic.com";
    const oauthFormTargets =
      "https://accounts.google.com https://appleid.apple.com";
    // أصل الموقع من المتغير (وقت البناء) — 'self' يغطي المضيف الحالي؛ الإضافة صريحة للتوثيق والتعدد لاحقًا
    const siteOrigin = siteUrl;
    const csp = [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' blob: ${clerkHosts} ${turnstile}`,
      `style-src 'self' 'unsafe-inline' ${googleFonts}`,
      "img-src 'self' data: blob: https:",
      `font-src 'self' data: ${googleFontsStatic}`,
      `connect-src 'self' ${siteOrigin} https:`,
      `frame-src 'self' ${clerkHosts} ${turnstile}`,
      "worker-src 'self' blob:",
      "frame-ancestors 'self'",
      "base-uri 'self'",
      `form-action 'self' ${siteOrigin} ${clerkHosts} ${oauthFormTargets}`,
      "object-src 'none'"
    ].join("; ");
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }
        ]
      }
    ];
  },
  // لعبة نجوم البلنتيات — ملف ثابت في public يُقدَّم على مسار نظيف
  async rewrites() {
    // أداة معالجة الوثائق العربية: تُقدَّم على نفس الدومين تحت /doc-tool
    // عبر بروكسي إلى خدمة FastAPI المعرَّفة في DOC_TOOL_URL (tools/arabic-doc-tool).
    // بدون المتغيّر تُعرض صفحة تعليمات الإعداد (app/doc-tool/page.tsx) بدلاً منه.
    const docToolUrl = (process.env.DOC_TOOL_URL ?? "").trim().replace(/\/+$/, "");
    const docToolProxy = docToolUrl
      ? [
          { source: "/doc-tool", destination: `${docToolUrl}/` },
          { source: "/doc-tool/:path*", destination: `${docToolUrl}/:path*` }
        ]
      : [];
    return {
      beforeFiles: docToolProxy,
      afterFiles: []
    };
  }
};

export default nextConfig;
