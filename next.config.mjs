/** @type {import('next').NextConfig} */
const nextConfig = {
  // تضمين فهرس البحث المضغوط مع دوال الخادم على Vercel (يُقرأ عبر fs وقت التشغيل)
  outputFileTracingIncludes: {
    "/search": ["./data/legal-bm25-index.json.gz"],
    "/api/legal-core/bm25-search": ["./data/legal-bm25-index.json.gz"]
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
      allowedOrigins: ["localhost:3000"]
    }
  },
  // ترويسات أمنية على كل المسارات. القفل الصارم على object/base/form/frame؛
  // وscript/style مرنة (unsafe-inline) وworker/blob مسموحة لأن Next/Tailwind
  // ومحرّك OCR (WASM) والألعاب تحتاجها — فلا تتعطّل أي ميزة. أساس نشدّه لاحقًا
  // بـ nonces عند الحاجة لتصلّب أعلى ضد XSS.
  async headers() {
    // Clerk: clerk.browser.js + CAPTCHA (Cloudflare Turnstile / protect.clerk.com)
    // + clerk.shared.lcl.dev لـ OAuth في Development instances
    const clerkHosts =
      "https://*.clerk.accounts.dev https://*.clerk.com https://*.protect.clerk.com https://*.accounts.dev https://clerk.shared.lcl.dev";
    const turnstile = "https://challenges.cloudflare.com";
    const googleFonts = "https://fonts.googleapis.com";
    const googleFontsStatic = "https://fonts.gstatic.com";
    const oauthFormTargets =
      "https://accounts.google.com https://appleid.apple.com";
    const csp = [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' blob: ${clerkHosts} ${turnstile}`,
      // خطوط هوية حكيم تُحمَّل من Google Fonts في layout.tsx
      `style-src 'self' 'unsafe-inline' ${googleFonts}`,
      "img-src 'self' data: blob: https:",
      `font-src 'self' data: ${googleFontsStatic}`,
      "connect-src 'self' https:",
      `frame-src 'self' ${clerkHosts} ${turnstile}`,
      "worker-src 'self' blob:",
      "frame-ancestors 'self'",
      "base-uri 'self'",
      // OAuth: نماذج Clerk قد تُرسل إلى FAPI / مزوّدي Google وApple
      `form-action 'self' ${clerkHosts} ${oauthFormTargets}`,
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
