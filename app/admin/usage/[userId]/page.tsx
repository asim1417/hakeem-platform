import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminPageShell } from "@/components/admin/AdminPageShell";
import { requirePagePermission } from "@/lib/modules/auth/session";
import { getUsageUserDetail } from "@/lib/modules/billing/usage-user-detail";
import { statusLabel } from "@/lib/activity-labels";

export const dynamic = "force-dynamic";

const SERVICE_LABEL: Record<string, string> = {
  ask: "اسأل حكيم",
  "legal-chat": "محادثة قانونية",
  "judicial-assistant": "المساعد القضائي",
};

export default async function AdminUsageUserPage({
  params,
}: {
  params: { userId: string };
}) {
  await requirePagePermission("ADMIN_REPORTS_VIEW");
  const detail = await getUsageUserDetail(decodeURIComponent(params.userId));
  if (!detail) notFound();
  const { user, stats, timeline, recentConsultations, recentSimulations, recentConversations } =
    detail;

  return (
    <AdminPageShell currentPath="/admin/usage">
      <p className="text-sm font-semibold text-[#8B6914]">
        <Link href="/admin/usage" className="hover:underline">
          لوحة الاستهلاك
        </Link>{" "}
        / تفاصيل المستخدم
      </p>
      <h1 className="mt-2 text-3xl font-bold text-[#0E3435]">{user.name || "مستخدم"}</h1>
      <p className="mt-2 text-sm text-[rgba(14,52,53,0.65)]" dir="ltr">
        {user.email || user.id}
      </p>
      <p className="mt-1 text-sm text-[rgba(14,52,53,0.55)]">
        دور: {user.role || "—"} · حساب: {user.isActive ? "نشط" : "موقوف"} · إنشاء:{" "}
        {new Date(user.createdAt).toLocaleDateString("ar-SA")}
      </p>

      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="الحصّة المجانية"
          value={`${user.freeQuotaUsed.toLocaleString("ar-SA")} / ${user.freeQuotaTotal.toLocaleString("ar-SA")}`}
        />
        <Stat
          label="الاشتراك"
          value={
            user.subscriptionStatus === "active"
              ? "مشترك"
              : user.exhausted
                ? "مستنفد"
                : "مجاني"
          }
        />
        <Stat label="رصيد النقاط" value={user.creditsBalance.toLocaleString("ar-SA")} />
        <Stat
          label="نقاط (مكتسب / مخصوم)"
          value={`${stats.creditsEarned.toLocaleString("ar-SA")} / ${stats.creditsSpent.toLocaleString("ar-SA")}`}
        />
        <Stat label="استشارات" value={stats.consultations.toLocaleString("ar-SA")} />
        <Stat label="محاكاة" value={stats.simulations.toLocaleString("ar-SA")} />
        <Stat label="اسأل حكيم" value={stats.askConversations.toLocaleString("ar-SA")} />
        <Stat label="أحداث ذكاء" value={stats.aiEvents.toLocaleString("ar-SA")} />
        <Stat label="محادثة قانونية" value={stats.legalChatConversations.toLocaleString("ar-SA")} />
        <Stat label="مساعد قضائي" value={stats.jaConversations.toLocaleString("ar-SA")} />
        <Stat label="كل أحداث التدقيق" value={stats.auditEvents.toLocaleString("ar-SA")} />
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <section className="overflow-hidden rounded-[0.75rem] border border-[rgba(14,52,53,0.1)] bg-[#FFFcf7]">
          <div className="border-b border-[rgba(14,52,53,0.08)] px-5 py-4">
            <h2 className="text-lg font-bold text-[#0E3435]">آخر الاستشارات</h2>
          </div>
          {recentConsultations.length === 0 ? (
            <p className="p-5 text-sm text-[rgba(14,52,53,0.55)]">لا استشارات.</p>
          ) : (
            <ul className="divide-y divide-[rgba(14,52,53,0.06)]">
              {recentConsultations.map((c) => (
                <li key={c.id} className="px-5 py-3 text-sm">
                  <p className="font-semibold text-[#0E3435]">{statusLabel(c.status)}</p>
                  <p className="mt-1 line-clamp-2 text-[rgba(14,52,53,0.65)]">{c.preview || "—"}</p>
                  <p className="mt-1 text-xs text-[rgba(14,52,53,0.45)]">
                    {new Date(c.createdAt).toLocaleString("ar-SA")}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="overflow-hidden rounded-[0.75rem] border border-[rgba(14,52,53,0.1)] bg-[#FFFcf7]">
          <div className="border-b border-[rgba(14,52,53,0.08)] px-5 py-4">
            <h2 className="text-lg font-bold text-[#0E3435]">آخر المحاكاة</h2>
          </div>
          {recentSimulations.length === 0 ? (
            <p className="p-5 text-sm text-[rgba(14,52,53,0.55)]">لا جلسات محاكاة.</p>
          ) : (
            <ul className="divide-y divide-[rgba(14,52,53,0.06)]">
              {recentSimulations.map((s) => (
                <li key={s.id} className="px-5 py-3 text-sm">
                  <p className="font-semibold text-[#0E3435]">{s.title}</p>
                  <p className="mt-1 text-[rgba(14,52,53,0.55)]">{s.stage}</p>
                  <p className="mt-1 text-xs text-[rgba(14,52,53,0.45)]">
                    {new Date(s.createdAt).toLocaleString("ar-SA")}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="mt-6 overflow-hidden rounded-[0.75rem] border border-[rgba(14,52,53,0.1)] bg-[#FFFcf7]">
        <div className="border-b border-[rgba(14,52,53,0.08)] px-5 py-4">
          <h2 className="text-lg font-bold text-[#0E3435]">المحادثات</h2>
        </div>
        {recentConversations.length === 0 ? (
          <p className="p-5 text-sm text-[rgba(14,52,53,0.55)]">لا محادثات.</p>
        ) : (
          <ul className="divide-y divide-[rgba(14,52,53,0.06)]">
            {recentConversations.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm"
              >
                <div>
                  <p className="font-semibold text-[#0E3435]">{c.title || "محادثة"}</p>
                  <p className="text-xs text-[rgba(14,52,53,0.55)]">
                    {SERVICE_LABEL[c.serviceKey] || c.serviceKey}
                  </p>
                </div>
                <span className="text-xs text-[rgba(14,52,53,0.45)]">
                  {new Date(c.updatedAt).toLocaleString("ar-SA")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-6 overflow-hidden rounded-[0.75rem] border border-[rgba(14,52,53,0.1)] bg-[#FFFcf7]">
        <div className="border-b border-[rgba(14,52,53,0.08)] px-5 py-4">
          <h2 className="text-lg font-bold text-[#0E3435]">الخط الزمني للنشاط</h2>
          <p className="mt-1 text-sm text-[rgba(14,52,53,0.55)]">
            أحداث التدقيق + حركات النقاط (الأحدث أولًا)
          </p>
        </div>
        {timeline.length === 0 ? (
          <p className="p-5 text-sm text-[rgba(14,52,53,0.55)]">لا نشاط مسجّل بعد.</p>
        ) : (
          <ul className="divide-y divide-[rgba(14,52,53,0.06)]">
            {timeline.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-start justify-between gap-3 px-5 py-3 text-sm"
              >
                <div>
                  <p className="font-semibold text-[#0E3435]">
                    {item.kind === "credit" ? "نقاط · " : ""}
                    {item.title}
                  </p>
                  <p className="mt-0.5 text-[rgba(14,52,53,0.55)]" dir="ltr">
                    {item.detail}
                  </p>
                </div>
                <div className="text-left text-xs text-[rgba(14,52,53,0.5)]">
                  {item.amount != null ? (
                    <p className="mb-1 font-semibold text-[#0E3435]" dir="ltr">
                      {item.amount > 0 ? `+${item.amount}` : item.amount}
                    </p>
                  ) : null}
                  <p>{new Date(item.at).toLocaleString("ar-SA")}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AdminPageShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[0.75rem] border border-[rgba(14,52,53,0.1)] bg-[#FFFcf7] p-4">
      <p className="text-sm text-[rgba(14,52,53,0.55)]">{label}</p>
      <p className="mt-2 text-lg font-bold text-[#0E3435]">{value}</p>
    </div>
  );
}
