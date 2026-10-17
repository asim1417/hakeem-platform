import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { AmendmentQueue } from "@/components/editorial/AmendmentQueue";
import { ChangeSetList } from "@/components/editorial/ChangeSetList";
import { DeskHeader, DeskNav, deskNavAccess } from "@/components/editorial/DeskNav";
import { CHANGE_SET_STATUS } from "@/components/editorial/labels";
import { PrincipleQueue } from "@/components/editorial/PrincipleQueue";
import { QueueFrame, type QueueTabDef } from "@/components/editorial/QueueFrame";
import { btnClass, DeskRoot, isMissingRelation, LoadFailed, Message, NotMigrated, ReadOnlyBanner } from "@/components/editorial/ui";
import { canPublish, canReview } from "@/lib/modules/editorial/access";
import { pgErrorCode } from "@/lib/modules/editorial/db";
import { editorialDb, requireEditorialPage } from "@/lib/modules/editorial/guard";
import { listAmendmentQueue, listPrincipleQueue } from "@/lib/modules/editorial/intake";
import { listChangeSetsDetailed } from "@/lib/modules/editorial/read";
import { isEditorialError } from "@/lib/modules/editorial/types";
import { isEditorialWriteEnabled } from "@/lib/modules/editorial/write-gate";

export const dynamic = "force-dynamic";

const PAGE = 20;
const TABS = [
  { key: "amendments", label: "تعديلات الأنظمة" },
  { key: "principles", label: "المبادئ" },
  { key: "changes", label: "دفعات المحررين" },
] as const;
type TabKey = (typeof TABS)[number]["key"];
const CHANGE_FILTERS = ["open", "published", "rejected", "reverted"] as const;

type Search = {
  tab?: string;
  confidence?: string;
  target?: string;
  bulk?: string;
  after?: string;
  view?: string;
  topic?: string;
  status?: string;
  created?: string;
};

function qs(base: Search, patch: Partial<Record<keyof Search, string | undefined>>): string {
  const merged: Record<string, string | undefined> = { ...base, ...patch };
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(merged)) if (v) params.set(k, String(v));
  const s = params.toString();
  return s ? `/admin/legal/queue?${s}` : "/admin/legal/queue";
}

async function safeCount(fn: () => Promise<number>): Promise<number | null> {
  try {
    return await fn();
  } catch {
    return null;
  }
}

function FilterForm({ tab, search, children }: { tab: TabKey; search: Search; children: React.ReactNode }) {
  return (
  <form method="get" action="/admin/legal/queue" data-desk-nav="" className="dk-filterform">
    <input type="hidden" name="tab" value={tab} />
    {search.view === "waiting_others" ? <input type="hidden" name="view" value="waiting_others" /> : null}
    {children}
    <button type="submit" className={btnClass("primary")}>
      تطبيق
    </button>
  </form>
);
}

/** المرشحات مطوية تحت 1024 بسطر 44 فيه الشرائح المفعّلة، ومفتوحة من 1024 (٥-٢). */
function Filters({ tab, search, chips, fields }: { tab: TabKey; search: Search; chips: string[]; fields: () => React.ReactNode }) {
const clearHref = qs({ tab, view: search.view }, {});
return (
  <>
    <details className="dk-filters dk-filters--narrow">
      <summary>
        <span>المرشحات</span>
        {chips.map((c) => (
          <span key={c} className="dk-chip">
            {c}
          </span>
        ))}
        <ChevronDown size={20} aria-hidden className="dk-chev" />
      </summary>
      <FilterForm tab={tab} search={search}>
        {fields()}
      </FilterForm>
      {chips.length ? (
        <div className="px-4 pb-3">
          <Link href={clearHref} className={btnClass("text")}>
            مسح المرشحات
          </Link>
        </div>
      ) : null}
    </details>
    <div className="dk-filters dk-filters--wide">
      <FilterForm tab={tab} search={search}>
        {fields()}
      </FilterForm>
      {chips.length ? (
        <div className="px-4 pb-3">
          <Link href={clearHref} className={btnClass("text")}>
            مسح المرشحات
          </Link>
        </div>
      ) : null}
    </div>
  </>
);
}

export default async function EditorialQueuePage({ searchParams = {} }: { searchParams?: Search }) {
const actor = await requireEditorialPage("view");
const db = editorialDb();
const writeEnabled = isEditorialWriteEnabled();
const tab: TabKey = TABS.some((t) => t.key === searchParams.tab) ? (searchParams.tab as TabKey) : "amendments";
const reviewer = canReview(actor.access);
const publisher = canPublish(actor.access);
const view = searchParams.view === "waiting_others" ? "waiting_others" : "mine";
const after = searchParams.after?.trim() || null;
const listBase: Search = { ...searchParams, after: undefined, created: undefined };
const key = JSON.stringify(searchParams);

const counts: Record<TabKey, number | null> = { amendments: null, principles: null, changes: null };
let waiting = 0;
let body: React.ReactNode = null;

try {
  if (tab === "amendments") {
    const confidence = searchParams.confidence === "rule_exact" || searchParams.confidence === "needs_review" ? searchParams.confidence : undefined;
    const filters = { confidence, target: searchParams.target, bulkOnly: searchParams.bulk === "1" } as const;
    const result = await listAmendmentQueue(db, { ...filters, limit: PAGE, after, view }, actor);
    counts.amendments = view === "mine" ? result.total : await safeCount(async () => (await listAmendmentQueue(db, { ...filters, limit: 1, view: "mine" }, actor)).total);
    waiting = result.waiting_others;
    const chips = [
      confidence === "rule_exact" ? "مطابقة بالقاعدة" : confidence === "needs_review" ? "تحتاج مراجعة" : null,
      searchParams.target ? `النظام: ${searchParams.target}` : null,
      searchParams.bulk === "1" ? "يقبل الجماعي" : null,
    ].filter((c): c is string => Boolean(c));
    body = (
      <>
        <Filters
          tab="amendments"
          search={searchParams}
          chips={chips}
          fields={() => (
            <>
              <label className="dk-field">
                <span className="dk-field__label">الثقة</span>
                <select name="confidence" defaultValue={confidence ?? ""} className="dk-input">
                  <option value="">الكل</option>
                  <option value="rule_exact">مطابقة بالقاعدة</option>
                  <option value="needs_review">تحتاج مراجعة</option>
                </select>
              </label>
              <label className="dk-field">
                <span className="dk-field__label">النظام المستهدف</span>
                <input name="target" defaultValue={searchParams.target ?? ""} className="dk-input" />
              </label>
              <label className="dk-check">
                <input type="checkbox" name="bulk" value="1" defaultChecked={searchParams.bulk === "1"} />
                ما يقبل الاعتماد الجماعي فقط
              </label>
            </>
          )}
        />
        <AmendmentQueue
          key={key}
          items={JSON.parse(JSON.stringify(result.items))}
          canDecide={reviewer}
          writeEnabled={writeEnabled}
          view={view}
          bulkView={searchParams.bulk === "1"}
          nextHref={result.next_cursor ? qs(listBase, { after: result.next_cursor }) : null}
          firstHref={after ? qs(listBase, {}) : null}
          total={result.total}
          mineHref={qs(listBase, { view: undefined })}
          waitingHref={qs(listBase, { view: "waiting_others" })}
        />
      </>
    );
  } else if (tab === "principles") {
    const result = await listPrincipleQueue(db, { topic: searchParams.topic, limit: PAGE, after, view }, actor);
    counts.principles =
      view === "mine" ? result.total : await safeCount(async () => (await listPrincipleQueue(db, { topic: searchParams.topic, limit: 1, view: "mine" }, actor)).total);
    waiting = result.waiting_others;
    body = (
      <>
        <Filters
          tab="principles"
          search={searchParams}
          chips={searchParams.topic ? [`الموضوع: ${searchParams.topic}`] : []}
          fields={() => (
            <label className="dk-field">
              <span className="dk-field__label">الموضوع أو العنوان</span>
              <input name="topic" defaultValue={searchParams.topic ?? ""} className="dk-input" />
            </label>
          )}
        />
        <PrincipleQueue
          key={key}
          items={JSON.parse(JSON.stringify(result.items))}
          canDecide={reviewer}
          writeEnabled={writeEnabled}
          view={view}
          nextHref={result.next_cursor ? qs(listBase, { after: result.next_cursor }) : null}
          firstHref={after ? qs(listBase, {}) : null}
          total={result.total}
          mineHref={qs(listBase, { view: undefined })}
          waitingHref={qs(listBase, { view: "waiting_others" })}
        />
      </>
    );
  } else {
    const status = (CHANGE_FILTERS as readonly string[]).includes(searchParams.status ?? "") ? (searchParams.status as string) : "open";
    const sets = await listChangeSetsDetailed(db, actor, { status, limit: 100 });
    counts.changes = status === "open" ? sets.length : await safeCount(async () => (await listChangeSetsDetailed(db, actor, { status: "open", limit: 200 })).length);
    const created = searchParams.created ? sets.find((s) => s.id === searchParams.created) ?? null : null;
    body = (
      <>
        <nav aria-label="حالة الدفعات" className="dk-subnav">
          {CHANGE_FILTERS.map((s) => (
            <Link key={s} href={qs({ tab: "changes" }, { status: s === "open" ? undefined : s })} aria-current={status === s ? "page" : undefined}>
              {s === "open" ? "المفتوحة" : CHANGE_SET_STATUS[s]}
            </Link>
          ))}
        </nav>
        {created ? (
          <div className="mt-4">
            <Message tone={created.status === "checks_failed" ? "warn" : "success"} role="status">
              {created.status === "checks_failed"
                ? `أُنشئ التغيير «${created.title}» وفشلت فحوصه؛ رسالة الفحص في بطاقته.`
                : `أُرسل التغيير «${created.title}» إلى طابور الاعتماد.`}
            </Message>
          </div>
        ) : null}
        <ChangeSetList
          key={key}
          sets={JSON.parse(JSON.stringify(sets))}
          actorId={actor.id}
          isOwner={actor.access.superAdmin}
          canReview={reviewer}
          canPublish={publisher}
          writeEnabled={writeEnabled}
          createdId={created?.id ?? null}
        />
      </>
    );
  }
} catch (error) {
  if (isEditorialError(error) && error.code === "INVALID_INPUT") {
    body = (
      <div className="mt-4">
        <Message tone="warn" title="رابط الصفحة غير صالح." actions={<Link href={qs({ tab }, {})} className={btnClass("text")}>أول الطابور</Link>}>
          {error.message}
        </Message>
      </div>
    );
  } else {
    body = <div className="mt-4">{isMissingRelation(pgErrorCode(error)) ? <NotMigrated /> : <LoadFailed what="تحميل الطابور" retryHref={qs(searchParams, {})} />}</div>;
  }
}

// أعداد الألسنة الأخرى بلا مرشحات (العرض «ينتظر قراري»).
const others = await Promise.all([
  tab === "amendments" ? Promise.resolve(counts.amendments) : safeCount(async () => (await listAmendmentQueue(db, { limit: 1, view: "mine" }, actor)).total),
  tab === "principles" ? Promise.resolve(counts.principles) : safeCount(async () => (await listPrincipleQueue(db, { limit: 1, view: "mine" }, actor)).total),
  tab === "changes" ? Promise.resolve(counts.changes) : safeCount(async () => (await listChangeSetsDetailed(db, actor, { status: "open", limit: 200 })).length),
]);
const tabs: QueueTabDef[] = TABS.map((t, i) => ({ key: t.key, label: t.label, href: qs({ tab: t.key }, {}), count: others[i] }));

return (
    <DeskRoot>
      <DeskHeader
        queue
        title="طابور الاعتماد"
        lead="يعرض مقترحات الذكاء الاصطناعي ودفعات المحررين بسندها. الاعتماد لمعتمِد غير المُعِدّ، والوكيل يقترح فقط."
      />
      <DeskNav current="/admin/legal/queue" access={deskNavAccess(actor.access)} />
      <ReadOnlyBanner writeEnabled={writeEnabled} />
      {!reviewer ? (
        <div className="mt-4">
          <Message tone="info">تعرض الطابور دون صلاحية الاعتماد؛ تُطلب من المالك.</Message>
        </div>
      ) : null}
      <QueueFrame key={key} tabs={tabs} current={tab} waiting={waiting}>
        {body}
      </QueueFrame>
    </DeskRoot>
  );
}
