import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { DeskHeader, DeskNav, deskNavAccess } from "@/components/editorial/DeskNav";
import { ACTOR_KIND_LABEL, AUDIT_ACTION_GROUPS, AUDIT_ACTIONS, AUDIT_OBJECT_TYPES, auditActionLabel, objectTypeLabel } from "@/components/editorial/labels";
import { fmtDateTime } from "@/components/editorial/logic";
import { btnClass, DeskRoot, isMissingRelation, LoadFailed, Ltr, Message, NotMigrated, PageDenied } from "@/components/editorial/ui";
import { canReadAudit } from "@/lib/modules/editorial/access";
import { pgErrorCode } from "@/lib/modules/editorial/db";
import { editorialDb, requireEditorialPage } from "@/lib/modules/editorial/guard";
import { listAudit, type AuditRow } from "@/lib/modules/editorial/read";

export const dynamic = "force-dynamic";

type Search = { action?: string; objectType?: string; actor?: string };

function AuditFilters({ search }: { search: Search }) {
  return (
  <form method="get" action="/admin/legal/audit" className="dk-filterform">
    <label className="dk-field">
      <span className="dk-field__label">نوع الحدث</span>
      <select name="action" defaultValue={search.action ?? ""} className="dk-input">
        <option value="">كل الأحداث</option>
        <optgroup label="مجموعات">
          {AUDIT_ACTION_GROUPS.map((g) => (
            <option key={g.value} value={g.value}>
              {g.label}
            </option>
          ))}
        </optgroup>
        <optgroup label="حدث بعينه">
          {AUDIT_ACTIONS.map((a) => (
            <option key={a.value} value={a.value}>
              {a.label}
            </option>
          ))}
        </optgroup>
      </select>
    </label>
    <label className="dk-field">
      <span className="dk-field__label">نوع الهدف</span>
      <select name="objectType" defaultValue={search.objectType ?? ""} className="dk-input">
        <option value="">كل الأهداف</option>
        {AUDIT_OBJECT_TYPES.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </select>
    </label>
    <label className="dk-field">
      <span className="dk-field__label">معرّف المنفّذ</span>
      <input name="actor" dir="ltr" lang="en" defaultValue={search.actor ?? ""} className="dk-input" />
    </label>
    <button type="submit" className={btnClass("primary")}>
      تطبيق
    </button>
  </form>
);
}

export default async function EditorialAuditPage({ searchParams = {} }: { searchParams?: Search }) {
const actor = await requireEditorialPage("view");
const allowed = canReadAudit(actor.access);
let rows: AuditRow[] | null = null;
let failure: "missing" | "error" | null = null;
if (allowed) {
  try {
    rows = await listAudit(editorialDb(), actor, { action: searchParams.action, objectType: searchParams.objectType, actor: searchParams.actor, limit: 200 });
  } catch (error) {
    failure = isMissingRelation(pgErrorCode(error)) ? "missing" : "error";
  }
}
const filtered = Boolean(searchParams.action || searchParams.objectType || searchParams.actor);
const chips = [
  searchParams.action ? AUDIT_ACTION_GROUPS.find((g) => g.value === searchParams.action)?.label ?? auditActionLabel(searchParams.action) : null,
  searchParams.objectType ? objectTypeLabel(searchParams.objectType) : null,
  searchParams.actor ? "منفّذ محدد" : null,
].filter((c): c is string => Boolean(c));
const retry = `/admin/legal/audit${filtered ? `?${new URLSearchParams(searchParams as Record<string, string>).toString()}` : ""}`;

return (
    <DeskRoot>
      <DeskHeader title="سجل التدقيق" lead="كل فعل في المكتب مسجّل هنا، والقاعدة نفسها ترفض تعديل السجل أو حذفه." />
      <DeskNav current="/admin/legal/audit" access={deskNavAccess(actor.access)} />
      {!allowed ? (
        <PageDenied title="سجل التدقيق لصاحب عرض الجودة أو المعتمِد." />
      ) : (
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
            <AuditFilters search={searchParams} />
          </details>
          <div className="dk-filters dk-filters--wide">
            <AuditFilters search={searchParams} />
          </div>
          <div className="mt-4">
            {failure === "missing" ? (
              <NotMigrated what="جداول سجل المكتب غير موجودة" />
            ) : failure === "error" || rows === null ? (
              <LoadFailed what="قراءة السجل" retryHref={retry} />
            ) : rows.length === 0 ? (
              <Message tone="info" actions={filtered ? <Link href="/admin/legal/audit" className={btnClass("text")}>مسح المرشحات</Link> : undefined}>
                لا أحداث بهذه المرشحات.
              </Message>
            ) : (
              <ol className="dk-rows">
                {rows.map((row) => (
                  <li key={row.id}>
                    <div className="dk-row__top">
                      <span className="dk-row__title">{auditActionLabel(row.action)}</span>
                      <time className="dk-meta dk-nowrap" dateTime={new Date(row.at).toISOString()}>
                        {fmtDateTime(row.at)}
                      </time>
                    </div>
                    <p className="dk-meta">
                      الهدف: {objectTypeLabel(row.object_type)} <Ltr>{row.object_id}</Ltr> · المنفّذ: {ACTOR_KIND_LABEL[row.actor_kind] ?? "منفّذ"}
                      {row.actor_id ? (
                        <>
                          {" "}
                          <Ltr>{row.actor_id}</Ltr>
                        </>
                      ) : null}
                    </p>
                    <p className="dk-meta">
                      الرمز: <Ltr>{row.action}</Ltr>
                      {row.after_hash ? (
                        <>
                          {" · بصمة بعد: "}
                          <Ltr>{row.after_hash.slice(0, 12)}</Ltr>
                        </>
                      ) : null}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </>
      )}
    </DeskRoot>
  );
}
