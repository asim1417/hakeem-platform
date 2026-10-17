import Link from "next/link";
import { AdminPageShell } from "@/components/admin/AdminPageShell";
import { AmendmentQueue, type AmendmentItem } from "@/components/editorial/AmendmentQueue";
import { ChangeSetActions } from "@/components/editorial/ChangeSetActions";
import { DeskHeader, DeskNav } from "@/components/editorial/DeskNav";
import { PrincipleQueue, type PrincipleItem } from "@/components/editorial/PrincipleQueue";
import { Ltr, Notice, Pill, ReadOnlyBanner } from "@/components/editorial/ui";
import { canProposeLaws, canReview } from "@/lib/modules/editorial/access";
import { editorialDb, requireEditorialPage } from "@/lib/modules/editorial/guard";
import { listAmendmentQueue, listPrincipleQueue } from "@/lib/modules/editorial/intake";
import { listChangeSets, type ChangeRow } from "@/lib/modules/editorial/service";
import { isEditorialWriteEnabled } from "@/lib/modules/editorial/write-gate";

export const dynamic = "force-dynamic";

const PAGE = 20;
const TABS = [
  { key: "amendments", label: "تعديلات الأنظمة" },
  { key: "principles", label: "المبادئ" },
  { key: "changes", label: "دفعات المحررين" },
] as const;

const STATUS_LABEL: Record<string, string> = {
  draft: "مسودة",
  checks_failed: "فشلت الفحوص",
  pending: "في الطابور",
  approved: "معتمدة",
  rejected: "مرفوضة",
  published: "منشورة",
  reverted: "متراجع عنها",
};

type Search = { tab?: string; confidence?: string; target?: string; bulk?: string; page?: string; topic?: string; status?: string };

function qs(base: Search, patch: Partial<Search>) {
  const merged = { ...base, ...patch };
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(merged)) if (v) params.set(k, String(v));
  return `/admin/legal/queue?${params.toString()}`;
}

export default async function EditorialQueuePage({ searchParams = {} }: { searchParams?: Search }) {
  const actor = await requireEditorialPage("view");
  const db = editorialDb();
  const writeEnabled = isEditorialWriteEnabled();
  const tab = TABS.some((t) => t.key === searchParams.tab) ? (searchParams.tab as (typeof TABS)[number]["key"]) : "amendments";
  const page = Math.max(Number(searchParams.page ?? 1) || 1, 1);
  const offset = (page - 1) * PAGE;
  const reviewer = canReview(actor.access);

  let body: React.ReactNode = null;
  let total = 0;
  try {
    if (tab === "amendments") {
      const confidence = searchParams.confidence === "rule_exact" || searchParams.confidence === "needs_review" ? searchParams.confidence : undefined;
      const result = await listAmendmentQueue(db, {
        confidence,
        target: searchParams.target,
        bulkOnly: searchParams.bulk === "1",
        limit: PAGE,
        offset,
      });
      total = result.total;
      body = (
        <>
          <form method="get" className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="tab" value="amendments" />
            <label className="text-sm">
              <span className="mb-1 block text-[rgba(18,33,31,0.6)]">الثقة</span>
              <select name="confidence" defaultValue={confidence ?? ""} className="min-h-[44px] rounded-md border border-[rgba(14,52,53,0.15)] bg-white px-3">
                <option value="">الكل</option>
                <option value="rule_exact">مطابقة بالقاعدة</option>
                <option value="needs_review">تحتاج مراجعة</option>
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-[rgba(18,33,31,0.6)]">النظام المستهدف</span>
              <input name="target" defaultValue={searchParams.target ?? ""} className="min-h-[44px] w-56 max-w-full rounded-md border border-[rgba(14,52,53,0.15)] bg-white px-3" />
            </label>
            <label className="inline-flex min-h-[44px] items-center gap-2 text-sm">
              <input type="checkbox" name="bulk" value="1" defaultChecked={searchParams.bulk === "1"} className="h-5 w-5 accent-[#1A5C41]" />
              ما يقبل الاعتماد الجماعي فقط
            </label>
            <button type="submit" className="min-h-[44px] rounded-md bg-[#0E3435] px-4 text-sm font-semibold text-white">
              تطبيق
            </button>
          </form>
          <div className="mt-4">
            <AmendmentQueue items={JSON.parse(JSON.stringify(result.items)) as AmendmentItem[]} canDecide={reviewer} writeEnabled={writeEnabled} />
          </div>
        </>
      );
    } else if (tab === "principles") {
      const result = await listPrincipleQueue(db, { topic: searchParams.topic, limit: PAGE, offset });
      total = result.total;
      body = (
        <>
          <form method="get" className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="tab" value="principles" />
            <label className="text-sm">
              <span className="mb-1 block text-[rgba(18,33,31,0.6)]">الموضوع أو العنوان</span>
              <input name="topic" defaultValue={searchParams.topic ?? ""} className="min-h-[44px] w-56 max-w-full rounded-md border border-[rgba(14,52,53,0.15)] bg-white px-3" />
            </label>
            <button type="submit" className="min-h-[44px] rounded-md bg-[#0E3435] px-4 text-sm font-semibold text-white">
              تطبيق
            </button>
          </form>
          <div className="mt-4">
            <PrincipleQueue items={JSON.parse(JSON.stringify(result.items)) as PrincipleItem[]} canDecide={reviewer} writeEnabled={writeEnabled} />
          </div>
        </>
      );
    } else {
      const status = searchParams.status && STATUS_LABEL[searchParams.status] ? (searchParams.status as keyof typeof STATUS_LABEL) : "open";
      const sets = await listChangeSets(db, { status: status as never, limit: 50 });
      total = sets.length;
      const changes = sets.length
        ? await db.query<ChangeRow>(`SELECT * FROM editorial_change WHERE change_set_id = ANY($1::text[]) ORDER BY created_at`, [sets.map((s) => s.id)])
        : [];
      body = (
        <>
          <div className="flex flex-wrap gap-1">
            {["open", "published", "rejected", "reverted"].map((s) => (
              <Link
                key={s}
                href={qs({ tab: "changes" }, { status: s })}
                className={`inline-flex min-h-[44px] items-center rounded-md px-3 text-sm ${status === s ? "bg-[rgba(14,52,53,0.08)] font-semibold" : ""}`}
              >
                {s === "open" ? "المفتوحة" : STATUS_LABEL[s]}
              </Link>
            ))}
          </div>
          {sets.length ? (
            <ol className="mt-4 space-y-4">
              {sets.map((set) => (
                <li key={set.id} className="rounded-xl border border-[rgba(14,52,53,0.12)] bg-white p-4 sm:p-5">
                  <header className="flex flex-wrap items-start justify-between gap-2">
                    <h3 className="min-w-0 text-base font-bold text-[#0E3435]">{set.title}</h3>
                    <Pill tone={set.status === "pending" ? "gold" : set.status === "published" ? "good" : set.status === "checks_failed" || set.status === "rejected" ? "bad" : "neutral"}>
                      {STATUS_LABEL[set.status] ?? set.status}
                    </Pill>
                  </header>
                  <p className="mt-1 text-xs text-[rgba(18,33,31,0.6)]">
                    {set.author_kind === "agent" ? `وكيل: ${set.author_agent}` : "مُعِدّ بشري"} · {new Date(set.created_at).toLocaleString("ar-SA", { timeZone: "Asia/Riyadh" })} · <Ltr>{set.id}</Ltr>
                  </p>
                  <ul className="mt-3 space-y-2 text-sm leading-7">
                    {changes
                      .filter((c) => c.change_set_id === set.id)
                      .map((c) => (
                        <li key={c.id} className="rounded-md bg-[#FBFAF6] p-3">
                          <span className="font-semibold">
                            {c.op === "set_work_status" ? "حالة نظام" : c.op === "review_amendment_op" ? "قرار عملية تعديل" : c.op === "review_principle" ? "مراجعة مبدأ" : c.op}
                          </span>{" "}
                          <Ltr>{c.target_id}</Ltr>: {c.before && "status" in c.before ? `${c.before.status ?? "بلا حالة"} ← ` : ""}
                          <strong>{c.after?.status ?? JSON.stringify(c.after)}</strong>
                          {c.evidence_url ? (
                            <a href={c.evidence_url} target="_blank" rel="noopener noreferrer" className="ms-2 underline underline-offset-4">
                              {c.evidence_instrument ?? "السند"}
                            </a>
                          ) : null}
                          {c.status === "checks_failed" && typeof c.checks?.message === "string" ? (
                            <p className="mt-1 text-[#8C281E]">{c.checks.message}</p>
                          ) : null}
                        </li>
                      ))}
                  </ul>
                  <ChangeSetActions
                    id={set.id}
                    status={set.status}
                    isAuthor={set.author_kind === "human" && set.author_id === actor.id}
                    canReview={reviewer}
                    canPropose={canProposeLaws(actor.access)}
                    isOwner={actor.access.superAdmin}
                    writeEnabled={writeEnabled}
                  />
                </li>
              ))}
            </ol>
          ) : (
            <div className="mt-4">
              <Notice>لا دفعات في هذا القسم.</Notice>
            </div>
          )}
        </>
      );
    }
  } catch {
    body = <Notice>تعذّر تحميل الطابور. إن لم يُطبَّق ترحيل مكتب التحرير على هذه القاعدة بعد، فهذا متوقع.</Notice>;
  }

  const pages = tab === "changes" ? 1 : Math.max(Math.ceil(total / PAGE), 1);
  return (
    <AdminPageShell currentPath="/admin/legal">
      <DeskHeader title="طابور الاعتماد" lead="يعرض مقترحات الذكاء الاصطناعي ودفعات المحررين بسندها. الاعتماد لمعتمِد غير المُعِدّ، والوكيل يقترح فقط." />
      <DeskNav current="/admin/legal/queue" />
      <ReadOnlyBanner writeEnabled={writeEnabled} />
      {!reviewer ? (
        <div className="mt-4">
          <Notice>تعرض الطابور دون صلاحية الاعتماد (LEGAL_REVIEWER).</Notice>
        </div>
      ) : null}
      <div role="tablist" aria-label="أقسام الطابور" className="mt-6 flex flex-wrap gap-1 border-b border-[rgba(14,52,53,0.12)]">
        {TABS.map((t) => (
          <Link
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            href={qs({}, { tab: t.key })}
            className={`inline-flex min-h-[44px] items-center px-3 text-sm font-semibold ${
              tab === t.key ? "border-b-2 border-[#C69763] text-[#0E3435]" : "text-[rgba(18,33,31,0.6)]"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>
      <p className="mt-3 text-sm text-[rgba(18,33,31,0.65)]">العدد: {total.toLocaleString("ar-SA")}</p>
      <div className="mt-3">{body}</div>
      {pages > 1 ? (
        <nav aria-label="الصفحات" className="mt-6 flex flex-wrap items-center gap-2 text-sm">
          {page > 1 ? (
            <Link href={qs(searchParams, { page: String(page - 1) })} className="inline-flex min-h-[44px] items-center rounded-md border px-3">
              السابق
            </Link>
          ) : null}
          <span>
            صفحة {page.toLocaleString("ar-SA")} من {pages.toLocaleString("ar-SA")}
          </span>
          {page < pages ? (
            <Link href={qs(searchParams, { page: String(page + 1) })} className="inline-flex min-h-[44px] items-center rounded-md border px-3">
              التالي
            </Link>
          ) : null}
        </nav>
      ) : null}
    </AdminPageShell>
  );
}
