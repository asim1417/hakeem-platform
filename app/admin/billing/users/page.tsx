import Link from "next/link";
import { AdminPageShell } from "@/components/admin/AdminPageShell";
import { requireSuperAdminPage } from "@/lib/modules/auth/super-admin";
import { milliToPoints } from "@/lib/modules/credits/points";
import { GrantPointsForm } from "./GrantPointsForm";

export const dynamic = "force-dynamic";

type Search = { q?: string; userId?: string };

type AccountRow = {
  balanceMilliUnits: bigint | number;
  reservedMilliUnits: bigint | number;
};
type LedgerRow = {
  id: string;
  entryType: string;
  amountMilliUnits: bigint | number;
  balanceAfterMilliUnits: bigint | number;
  source: string;
  description: string | null;
  serviceCode: string | null;
  createdAt: Date;
};
type BucketRow = {
  sourceType: string;
  remaining: bigint | number;
  granted: bigint | number;
  buckets: bigint | number;
};

export default async function AdminBillingUsersPage({
  searchParams,
}: {
  searchParams?: Search;
}) {
  await requireSuperAdminPage();
  const q = (searchParams?.q || "").trim();
  const userId = (searchParams?.userId || "").trim();

  const { prisma } = await import("@/lib/prisma");

  const matches = q
    ? await prisma.user.findMany({
        where: { email: { contains: q, mode: "insensitive" } },
        select: { id: true, name: true, email: true },
        orderBy: { email: "asc" },
        take: 25,
      })
    : [];

  let target: { id: string; name: string; email: string } | null = null;
  let account: AccountRow | null = null;
  let ledger: LedgerRow[] = [];
  let buckets: BucketRow[] = [];

  if (userId) {
    target = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true },
    });
    if (target) {
      const accRows = await prisma
        .$queryRawUnsafe<AccountRow[]>(
          `SELECT "balanceMilliUnits","reservedMilliUnits"
             FROM "usage_credit_accounts" WHERE "userId" = $1 LIMIT 1`,
          userId
        )
        .catch(() => [] as AccountRow[]);
      account = accRows[0] ?? null;

      ledger = await prisma
        .$queryRawUnsafe<LedgerRow[]>(
          `SELECT "id","entryType","amountMilliUnits","balanceAfterMilliUnits","source",
                  "description","serviceCode","createdAt"
             FROM "usage_credit_ledger" WHERE "userId" = $1
            ORDER BY "createdAt" DESC LIMIT 30`,
          userId
        )
        .catch(() => [] as LedgerRow[]);

      buckets = await prisma
        .$queryRawUnsafe<BucketRow[]>(
          `SELECT "sourceType",
                  COALESCE(SUM("remainingMilliUnits"),0) AS remaining,
                  COALESCE(SUM("grantedMilliUnits"),0) AS granted,
                  COUNT(*) AS buckets
             FROM "usage_credit_buckets"
            WHERE "userId" = $1 AND "status" = 'active'
            GROUP BY "sourceType" ORDER BY "sourceType"`,
          userId
        )
        .catch(() => [] as BucketRow[]);
    }
  }

  const balancePts = account ? milliToPoints(Number(account.balanceMilliUnits)) : 0;
  const reservedPts = account ? milliToPoints(Number(account.reservedMilliUnits)) : 0;

  return (
    <AdminPageShell currentPath="/admin/billing/users">
      <p className="text-sm font-semibold text-[#8B6914]">السوبر أدمن · الفوترة</p>
      <h1 className="mt-2 text-3xl font-bold text-[#0E3435]">محافظ المستخدمين</h1>
      <p className="mt-3 max-w-3xl leading-8 text-[rgba(14,52,53,0.72)]">
        ابحث بالبريد الإلكتروني لعرض رصيد المستخدم بالنقاط، وحركاته الأخيرة، ومنح/سحب النقاط بسبب إلزامي.
        للعودة إلى{" "}
        <Link href="/admin/billing" className="font-semibold text-[#8B6914]">
          نظرة الفوترة
        </Link>
        .
      </p>

      <section className="mt-6 rounded-[0.75rem] border border-[rgba(14,52,53,0.1)] bg-[#FFFcf7] p-5">
        <form method="get" className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="بريد المستخدم…"
            dir="ltr"
            aria-label="بحث بالبريد الإلكتروني"
            className="min-w-[240px] flex-1 rounded-md border border-[rgba(14,52,53,0.15)] bg-white px-3 py-2 text-sm text-[#0E3435]"
          />
          <button
            type="submit"
            className="rounded-md bg-[#0E3435] px-4 py-2 text-sm font-semibold text-[#FFFcf7]"
          >
            بحث
          </button>
        </form>
        {q ? (
          matches.length === 0 ? (
            <p className="mt-4 text-sm text-[rgba(14,52,53,0.55)]">لا مستخدم يطابق «{q}».</p>
          ) : (
            <ul className="mt-4 divide-y divide-[rgba(14,52,53,0.06)]">
              {matches.map((u) => (
                <li key={u.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <span>
                    <span className="font-semibold text-[#0E3435]">{u.name || "—"}</span>{" "}
                    <span className="text-xs text-[rgba(14,52,53,0.55)]" dir="ltr">
                      {u.email}
                    </span>
                  </span>
                  <Link
                    href={`/admin/billing/users?userId=${encodeURIComponent(u.id)}`}
                    className="rounded-md border border-[rgba(14,52,53,0.15)] bg-white px-2.5 py-1 text-xs font-semibold text-[#0E3435] hover:bg-[#F7F2EA]"
                  >
                    عرض المحفظة
                  </Link>
                </li>
              ))}
            </ul>
          )
        ) : null}
      </section>

      {userId && !target ? (
        <p className="mt-6 rounded-md bg-amber-50 p-3 text-sm text-amber-900">المستخدم غير موجود.</p>
      ) : null}

      {target ? (
        <>
          <section className="mt-6 rounded-[0.75rem] border border-[rgba(14,52,53,0.1)] bg-[#FFFcf7] p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-[#0E3435]">{target.name || "—"}</h2>
                <p className="mt-1 text-sm text-[rgba(14,52,53,0.55)]" dir="ltr">
                  {target.email}
                </p>
              </div>
              {!account ? (
                <span className="text-sm text-[rgba(14,52,53,0.55)]">لا محفظة v2 بعد.</span>
              ) : null}
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-md border border-[rgba(14,52,53,0.08)] bg-white p-4">
                <p className="text-sm text-[rgba(14,52,53,0.55)]">الرصيد المتاح</p>
                <p className="mt-2 text-xl font-bold text-[#0E3435]">
                  {balancePts.toLocaleString("ar-SA")} نقطة
                </p>
              </div>
              <div className="rounded-md border border-[rgba(14,52,53,0.08)] bg-white p-4">
                <p className="text-sm text-[rgba(14,52,53,0.55)]">المحجوز</p>
                <p className="mt-2 text-xl font-bold text-[#0E3435]">
                  {reservedPts.toLocaleString("ar-SA")} نقطة
                </p>
              </div>
              <div className="rounded-md border border-[rgba(14,52,53,0.08)] bg-white p-4">
                <p className="text-sm text-[rgba(14,52,53,0.55)]">الصافي القابل للاستخدام</p>
                <p className="mt-2 text-xl font-bold text-[#0E3435]">
                  {Math.max(0, balancePts - reservedPts).toLocaleString("ar-SA")} نقطة
                </p>
              </div>
            </div>
          </section>

          <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
            <section className="overflow-hidden rounded-[0.75rem] border border-[rgba(14,52,53,0.1)] bg-[#FFFcf7]">
              <div className="border-b border-[rgba(14,52,53,0.08)] px-5 py-4">
                <h2 className="text-lg font-bold text-[#0E3435]">آخر حركات الدفتر</h2>
              </div>
              {ledger.length === 0 ? (
                <p className="p-6 text-sm text-[rgba(14,52,53,0.55)]">لا حركات بعد.</p>
              ) : (
                <div className="table-scroll overflow-x-auto">
                  <table className="w-full min-w-[640px] border-collapse text-right text-sm">
                    <thead className="bg-[#F7F2EA]">
                      <tr className="[&>th]:px-4 [&>th]:py-3 [&>th]:font-semibold">
                        <th>النوع</th>
                        <th>النقاط</th>
                        <th>الرصيد بعده</th>
                        <th>المصدر</th>
                        <th>الوقت</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ledger.map((e) => {
                        const pts = milliToPoints(Number(e.amountMilliUnits));
                        const after = milliToPoints(Number(e.balanceAfterMilliUnits));
                        return (
                          <tr key={e.id} className="border-t border-[rgba(14,52,53,0.06)]">
                            <td className="px-4 py-3 font-semibold text-[#0E3435]" dir="ltr">
                              {e.entryType}
                            </td>
                            <td className="px-4 py-3 font-semibold text-[#0E3435]">
                              {pts > 0 ? `+${pts.toLocaleString("ar-SA")}` : pts.toLocaleString("ar-SA")}
                            </td>
                            <td className="px-4 py-3">{after.toLocaleString("ar-SA")}</td>
                            <td className="px-4 py-3 text-[rgba(14,52,53,0.65)]">
                              {e.source}
                              {e.serviceCode ? (
                                <span className="mt-0.5 block text-xs text-[rgba(14,52,53,0.5)]" dir="ltr">
                                  {e.serviceCode}
                                </span>
                              ) : null}
                            </td>
                            <td className="px-4 py-3 text-xs text-[rgba(14,52,53,0.55)]">
                              {new Date(e.createdAt).toLocaleString("ar-SA")}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <div className="space-y-6">
              <GrantPointsForm userId={target.id} />

              <section className="rounded-[0.75rem] border border-[rgba(14,52,53,0.1)] bg-[#FFFcf7] p-5">
                <h3 className="font-bold text-[#0E3435]">الأرصدة حسب المصدر</h3>
                {buckets.length === 0 ? (
                  <p className="mt-3 text-sm text-[rgba(14,52,53,0.55)]">لا أرصدة نشطة.</p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {buckets.map((b) => (
                      <li
                        key={b.sourceType}
                        className="flex items-center justify-between rounded-md border border-[rgba(14,52,53,0.08)] bg-white px-3 py-2 text-sm"
                      >
                        <span className="font-semibold text-[#0E3435]" dir="ltr">
                          {b.sourceType}
                        </span>
                        <span className="text-[rgba(14,52,53,0.7)]">
                          {milliToPoints(Number(b.remaining)).toLocaleString("ar-SA")} /{" "}
                          {milliToPoints(Number(b.granted)).toLocaleString("ar-SA")} نقطة
                          <span className="mr-1 text-xs text-[rgba(14,52,53,0.5)]">
                            ({Number(b.buckets).toLocaleString("ar-SA")})
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </div>
        </>
      ) : null}
    </AdminPageShell>
  );
}
