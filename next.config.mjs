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
    return [{ source: "/penalty-stars", destination: "/penalty-stars/index.html" }];
  }
};

export default nextConfig;
