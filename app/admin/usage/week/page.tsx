import Link from "next/link";
import { AdminPageShell } from "@/components/admin/AdminPageShell";
import { requirePagePermission } from "@/lib/modules/auth/session";
import { getWeekVerifiedReport } from "@/lib/modules/billing/week-verified-report";

export const dynamic = "force-dynamic";

export default async function AdminWeekUsagePage() {
  await requirePagePermission("ADMIN_REPORTS_VIEW");
  const report = await getWeekVerifiedReport();
  const { summary, users, evidence, limitations } = report;

  return (
    <AdminPageShell currentPath="/admin/usage">
      <p className="text-sm font-semibold text-[#8B6914]">
        <Link href="/admin/usage" className="hover:underline">
          لوحة الاستهلاك
        </Link>{" "}
        / رصد الأسبوع
      </p>
      <h1 className="mt-2 text-3xl font-bold text-[#0E3435]">رصد الأسبوع الماضي — بيانات مؤكّدة</h1>
      <p className="mt-3 max-w-3xl leading-8 text-[rgba(14,52,53,0.72)]">
        من {new Date(report.from).toLocaleString("ar-SA")} إلى{" "}
        {new Date(report.to).toLocaleString("ar-SA")}. يُعرض فقط ما يمكن إثباته من سجلات
        مؤرخة في القاعدة (نقاط، إنشاء خدمات، رسائل، تدقيق، رموز Claude المسجّلة).
      </p>

      <div className="mt-4 flex flex-wrap gap-3">
        <a
          href="/api/admin/usage/week/export"
          className="inline-flex min-h-[44px] items-center rounded-md bg-[#0E3435] px-4 py-2 text-sm font-semibold text-[#FFFcf7]"
        >
          تصدير CSV للأسبوع
        </a>
        <Link
          href="/admin/usage"
          className="inline-flex min-h-[44px] items-center rounded-md bg-white px-4 py-2 text-sm font-semibold text-[#0E3435] ring-1 ring-[rgba(14,52,53,0.12)]"
        >
          العودة للوحة العامة
        </Link>
      </div>

      <section className="mt-6 rounded-[0.75rem] border border-[rgba(180,35,24,0.2)] bg-[#FFF8F6] p-4">
        <h2 className="text-base font-bold text-[#0E3435]">حدود الدقة (صراحةً)</h2>
        <ul className="mt-2 list-disc space-y-1 pr-5 text-sm leading-7 text-[rgba(14,52,53,0.75)]">
          {limitations.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </section>

      <section className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {evidence.map((e) => (
          <div
            key={e.metric}
            className="rounded-[0.75rem] border border-[rgba(14,52,53,0.1)] bg-[#FFFcf7] p-4"
          >
            <p className="text-sm font-bold text-[#0E3435]">{e.metric}</p>
            <p className="mt-1 text-xs font-semibold text-[#8B6914]">
              {e.level === "verified" ? "مؤكّد" : e.level === "partial" ? "جزئي" : "غير متاح"}
            </p>
            <p className="mt-2 text-xs leading-6 text-[rgba(14,52,53,0.65)]">{e.note}</p>
          </div>
        ))}
      </section>

      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        <Stat label="مستخدمون بنشاط مؤكّد" value={summary.usersWithActivity} />
        <Stat label="نقاط مخصومة" value={summary.creditsSpent} />
        <Stat label="استشارات منشأة" value={summary.consultationsCreated} />
        <Stat label="محاكاة منشأة" value={summary.simulationsCreated} />
        <Stat label="رسائل مستخدم" value={summary.chatUserMessages} />
        <Stat label="أحداث تدقيق AI" value={summary.aiAuditEvents} />
        <Stat label="نداءات Claude (مسجّلة)" value={summary.claudeCallsVerified} />
        <Stat label="رموز داخل (مسجّلة)" value={summary.claudeInputTokens} />
        <Stat label="رموز خارج (مسجّلة)" value={summary.claudeOutputTokens} />
      </section>

      <section className="mt-6 overflow-hidden rounded-[0.75rem] border border-[rgba(14,52,53,0.1)] bg-[#FFFcf7]">
        <div className="border-b border-[rgba(14,52,53,0.08)] px-5 py-4">
          <h2 className="text-lg font-bold text-[#0E3435]">المستخدمون ذوو النشاط خلال الأسبوع</h2>
          <p className="mt-1 text-sm text-[rgba(14,52,53,0.55)]">
            مرتَّبون حسب مجموع الأدلة المؤكّدة. لا يظهر من بلا نشاط مسجّل.
          </p>
        </div>
        {users.length === 0 ? (
          <p className="p-5 text-sm text-[rgba(14,52,53,0.55)]">
            لا نشاط مؤكّد في سجلات القاعدة خلال هذه النافذة.
          </p>
        ) : (
          <div className="max-h-[70vh] overflow-auto">
            <table className="w-full min-w-[1280px] border-collapse text-right text-sm">
              <thead className="sticky top-0 bg-[#F7F2EA]">
                <tr className="border-b border-[rgba(14,52,53,0.1)] text-[#0E3435] [&>th]:px-3 [&>th]:py-3">
                  <th>المستخدم</th>
                  <th>نقاط مخصومة</th>
                  <th>استشارات</th>
                  <th>محاكاة</th>
                  <th>رسائل (اسأل/قانوني/معاون)</th>
                  <th>تدقيق AI</th>
                  <th>Claude مسجّل</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-[rgba(14,52,53,0.06)] odd:bg-white">
                    <td className="px-3 py-3">
                      <p className="font-semibold text-[#0E3435]">{u.name || "—"}</p>
                      <p className="font-mono text-xs text-[rgba(14,52,53,0.55)]" dir="ltr">
                        {u.email || u.id}
                      </p>
                      {u.creditSources.length ? (
                        <p className="mt-1 text-[11px] text-[rgba(14,52,53,0.55)]">
                          مصادر الخصم:{" "}
                          {u.creditSources.map((s) => `${s.source}(${s.amount})`).join(" · ")}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 font-semibold">{u.creditsSpent.toLocaleString("ar-SA")}</td>
                    <td className="px-3 py-3">{u.consultationsCreated.toLocaleString("ar-SA")}</td>
                    <td className="px-3 py-3">{u.simulationsCreated.toLocaleString("ar-SA")}</td>
                    <td className="px-3 py-3 text-xs leading-6">
                      الكل: {u.chatUserMessages.toLocaleString("ar-SA")}
                      <br />
                      اسأل {u.askUserMessages.toLocaleString("ar-SA")} · قانوني{" "}
                      {u.legalChatUserMessages.toLocaleString("ar-SA")} · معاون{" "}
                      {u.jaUserMessages.toLocaleString("ar-SA")}
                    </td>
                    <td className="px-3 py-3">{u.aiAuditEvents.toLocaleString("ar-SA")}</td>
                    <td className="px-3 py-3 text-xs leading-6">
                      {u.claudeTokensVerified ? (
                        <>
                          {u.claudeCalls.toLocaleString("ar-SA")} نداء
                          <br />
                          <span dir="ltr" className="font-mono">
                            in {u.claudeInputTokens.toLocaleString("en-US")} / out{" "}
                            {u.claudeOutputTokens.toLocaleString("en-US")}
                          </span>
                        </>
                      ) : (
                        <span className="text-[rgba(14,52,53,0.45)]">لا رموز مسجّلة</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <Link
                        href={`/admin/usage/${encodeURIComponent(u.id)}`}
                        className="text-xs font-semibold text-[#8B6914] underline underline-offset-4"
                      >
                        تفاصيل
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <p className="mt-3 text-xs text-[rgba(14,52,53,0.45)]">
        وُلد التقرير: {new Date(report.generatedAt).toLocaleString("ar-SA")}
      </p>
    </AdminPageShell>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[0.75rem] border border-[rgba(14,52,53,0.1)] bg-[#FFFcf7] px-4 py-3">
      <p className="text-xs font-semibold text-[rgba(14,52,53,0.55)]">{label}</p>
      <p className="mt-1 text-2xl font-bold text-[#0E3435]">{value.toLocaleString("ar-SA")}</p>
    </div>
  );
}
