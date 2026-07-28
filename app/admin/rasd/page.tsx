import Link from "next/link";
import { AdminPageShell } from "@/components/admin/AdminPageShell";
import { requirePagePermission } from "@/lib/modules/auth/session";
import { getRasdOverview } from "@/lib/modules/rasd/admin-data";

export const dynamic = "force-dynamic";

const links = [
  { href: "/admin/rasd/runs", label: "التشغيلات" },
  { href: "/admin/rasd/gaps", label: "الفجوات" },
  { href: "/admin/rasd/comparisons", label: "المقارنات" },
  { href: "/admin/rasd/conflicts", label: "التعارضات" },
  { href: "/admin/rasd/reviews", label: "المراجعات" },
  { href: "/admin/rasd/sources", label: "المصادر" }
];

export default async function RasdAdminPage() {
  await requirePagePermission("RASD_VIEW");
  const overview = await getRasdOverview();

  return (
    <AdminPageShell currentPath="/admin/rasd">
      <section dir="rtl">
        <p className="text-sm font-semibold text-[#8B6914]">رصد التشريعات</p>
        <h1 className="mt-2 text-3xl font-bold text-[#0E3435]">لوحة رصد</h1>
        <p className="mt-3 max-w-3xl leading-8 text-[rgba(14,52,53,0.72)]">
          طبقة مراقبة ومقارنة لا تكتب في المكتبة القانونية إلا بعد مراجعة واعتماد.
        </p>

        {!overview.enabled ? (
          <div className="mt-5 rounded-[0.75rem] border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            رصد غير مفعّل حالياً. اضبط RASD_ENABLED=true للتشغيل الحي، أو استخدم fixtures للتجارب.
          </div>
        ) : null}
        {!overview.dbAvailable ? (
          <div className="mt-3 rounded-[0.75rem] border border-[rgba(14,52,53,0.1)] bg-white p-4 text-sm text-[rgba(14,52,53,0.65)]">
            جداول رصد غير متاحة بعد أو لم تُطبّق الهجرة. ستظهر البيانات بعد تشغيل migration و prisma generate.
          </div>
        ) : null}

        <div className="mt-6 grid gap-4 md:grid-cols-4">
          {[
            ["التشغيلات", overview.runs],
            ["المصادر النشطة", overview.activeSources],
            ["تغييرات للمراجعة", overview.pendingChanges],
            ["تعارضات مفتوحة", overview.openConflicts]
          ].map(([label, value]) => (
            <div key={label} className="rounded-[0.75rem] border border-[rgba(14,52,53,0.1)] bg-[#FFFcf7] p-5">
              <p className="text-sm text-[rgba(14,52,53,0.6)]">{label}</p>
              <p className="mt-2 text-3xl font-bold text-[#0E3435]">{Number(value).toLocaleString("ar-SA")}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-3">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-[0.75rem] border border-[rgba(14,52,53,0.1)] bg-white p-4 font-semibold text-[#0E3435] hover:bg-[#F7F2EA]"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </section>
    </AdminPageShell>
  );
}
