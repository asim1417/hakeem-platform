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
