/** @type {import('next').NextConfig} */
const nextConfig = {
  // تضمين فهرس البحث المضغوط مع دوال الخادم على Vercel (يُقرأ عبر fs وقت التشغيل)
  outputFileTracingIncludes: {
    "/search": ["./data/legal-bm25-index.json.gz"],
    "/api/legal-core/bm25-search": ["./data/legal-bm25-index.json.gz"]
  },
  experimental: {
    serverActions: {
      allowedOrigins: ["localhost:3000"]
    }
  },
  // ترويسات أمنية على كل المسارات. القفل الصارم على object/base/form/frame؛
  // وscript/style مرنة (unsafe-inline) وworker/blob مسموحة لأن Next/Tailwind
  // ومحرّك OCR (WASM) والألعاب تحتاجها — فلا تتعطّل أي ميزة. أساس نشدّه لاحقًا
  // بـ nonces عند الحاجة لتصلّب أعلى ضد XSS.
  async headers() {
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' blob:",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https:",
      "worker-src 'self' blob:",
      "frame-ancestors 'self'",
      "base-uri 'self'",
      "form-action 'self'",
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
      afterFiles: [
        { source: "/penalty-stars", destination: "/penalty-stars/index.html" },
        // لعبة فوتبول فيوتشر — تجربة مستقلة تماماً عن واجهة حكيم، تُقدَّم من public
        { source: "/football-future", destination: "/football-future/index.html" }
      ]
    };
  }
};

export default nextConfig;
