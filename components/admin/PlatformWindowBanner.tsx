import Link from "next/link";

/**
 * بانر يظهر للسوبر داخل نافذة المنصة (عرض كعميل) مع عودة سريعة للإدارة.
 */
export function PlatformWindowBanner() {
  return (
    <div
      className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[0.75rem] border border-[#C9A84C]/40 bg-[#0E3435] px-4 py-3 text-[#FFFcf7]"
      role="status"
    >
      <p className="text-sm leading-6">
        <span className="font-bold text-[#C9A84C]">نافذة المنصة</span>
        {" — "}
        أنت تعرض تجربة العميل. إدارة التشغيل منفصلة.
      </p>
      <Link
        href="/admin"
        className="touch-target inline-flex min-h-[40px] items-center rounded-md bg-[#C9A84C] px-3 py-1.5 text-sm font-semibold text-[#0E3435]"
      >
        العودة للإدارة
      </Link>
    </div>
  );
}
