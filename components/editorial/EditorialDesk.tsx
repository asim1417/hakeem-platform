"use client";
import Link from "next/link";
import { useState } from "react";
import { useCustom, useCustomMutation } from "@refinedev/core";
import {
  BookOpen,
  ClipboardCheck,
  FileClock,
  LayoutDashboard,
  ListChecks,
  Settings2,
  ShieldCheck,
  RefreshCw,
  Plus,
} from "lucide-react";
import {
  DeskConfig,
  EditorialPermission,
} from "@/lib/modules/editorial/contracts";
import { DeskSettings } from "./DeskSettings";
import { FIELD_LABELS, ProposalForm } from "./ProposalForm";

type Change = {
  id: string;
  targetType: string;
  targetId: string;
  op: string;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  evidenceInstrument: string;
  evidenceUrl: string;
  evidenceQuote: string;
};
type Item = {
  id: string;
  title?: string;
  name?: string;
  status?: string;
  createdAt?: string;
  changes?: Change[];
  decisions?: { reviewerId: string; decision: string; reason: string }[];
  data?: Record<string, unknown>;
  domain?: string;
  articleCount?: number;
  action?: string;
  actorId?: string;
  at?: string;
  lastError?: string;
  completedAt?: string;
  attempts?: number;
  searchNormAt?: string;
  opensearchAt?: string;
  revalidatedAt?: string;
  assigneeId?: string;
  dueAt?: string;
  targetId?: string;
};
type DeskData = {
  owner?: boolean;
  facets?: { complete: number; incomplete: number; conflicts: number };
  health?: {
    type: string;
    database: number;
    indexed: number | null;
    difference: number | null;
    error: string | null;
  }[];
  installed: boolean;
  writeEnabled: boolean;
  permissions: EditorialPermission[];
  actorId: string;
  items?: Item[];
  total?: number;
  elapsedMs?: number;
  message?: string;
  config?: DeskConfig;
  revision?: number;
  users?: { id: string; name: string }[];
  amendments?: {
    id: string;
    title: string;
    quote: string;
    source_url: string;
    confidence: string;
    verbatim: boolean;
  }[];
  principles?: { id: string; title: string; principleText: string }[];
  amendmentTotal?: number;
  principlesTotal?: number;
};
const NAV = [
  { key: "queue", label: "طابور التحرير", icon: LayoutDashboard },
  { key: "intake", label: "الاستقبال والتحكيم", icon: ClipboardCheck },
  { key: "systems", label: "الوثائق التنظيمية", icon: BookOpen },
  { key: "tasks", label: "مهام الفريق", icon: ListChecks },
  { key: "audit", label: "سجل التدقيق", icon: FileClock },
  { key: "index", label: "حالة النشر", icon: RefreshCw },
  { key: "settings", label: "الصلاحيات والسياسات", icon: Settings2 },
];
const STATUS: Record<string, string> = {
  draft: "مسودة",
  pending: "بانتظار الاعتماد",
  approved: "معتمد للنشر",
  rejected: "مرفوض",
  published: "منشور",
  reverted: "تم التراجع",
  checks_failed: "فشل الفحص",
  open: "مفتوحة",
  in_progress: "قيد التنفيذ",
  done: "مكتملة",
  cancelled: "ملغاة",
};
const display = (value: unknown): string =>
  value == null
    ? "غير مسجل"
    : typeof value === "object"
      ? JSON.stringify(value)
      : String(value);
const date = (v?: string) =>
  v
    ? new Date(v).toLocaleString("ar-SA", {
        dateStyle: "short",
        timeStyle: "short",
      })
    : "—";

export function EditorialDesk({ view = "queue" }: { view?: string }) {
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState({
    target: "",
    author: "",
    olderDays: "",
    event: "",
    since: "",
    q: "",
    domain: "",
    status: "",
    kind: "",
    source: "",
    completeness: "",
    conflict: "",
  });
  const [filters, setFilters] = useState(filter);
  const [proposal, setProposal] = useState<string | false>(false);
  const [notice, setNotice] = useState("");
  const [reason, setReason] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const { query } = useCustom<DeskData>({
    url: "/api/admin/legal",
    method: "get",
    config: { query: { view, page, ...filters } },
    queryOptions: { refetchInterval: view === "index" ? 30000 : false },
  });
  const { mutation } = useCustomMutation<{ syncWarning?: string }>();
  const data = query.data?.data;
  const disabled = !data?.writeEnabled || mutation.isPending;
  const can = (p: EditorialPermission) =>
    data?.permissions.includes(p) ?? false;
  const act = async (value: object) => {
    setNotice("");
    try {
      const result = await mutation.mutateAsync({
        url: "/api/admin/legal",
        method: "post",
        values: value,
      });
      setNotice(
        result.data.syncWarning ??
          "تم تسجيل الإجراء. راجع الحالة المحدثة أدناه.",
      );
      setSelected([]);
      await query.refetch();
    } catch (e) {
      setNotice(
        e && typeof e === "object" && "message" in e
          ? String(e.message)
          : "تعذر الإجراء.",
      );
    }
  };
  const title = NAV.find((x) => x.key === view)?.label ?? "مكتب التحرير";
  return (
    <div className="editorial-desk" dir="rtl">
      <aside className="desk-sidebar">
        <Link href="/admin/legal" className="desk-brand">
          حكيم<span>مكتب التحرير التشريعي</span>
        </Link>
        <p className="desk-nav-caption">إدارة المعرفة القانونية</p>
        <nav aria-label="مكتب التحرير">
          {NAV.map(({ key, label, icon: Icon }) => (
            <Link
              key={key}
              href={`/admin/legal/${key}`}
              aria-current={key === view ? "page" : undefined}
            >
              <Icon size={19} />
              {label}
            </Link>
          ))}
        </nav>
        <div className="desk-sidebar-note">
          <ShieldCheck size={25} />
          <p>
            كل اعتماد له صاحب.
            <br />
            وكل تغيير له سند.
          </p>
        </div>
        <Link href="/admin" className="desk-back">
          العودة إلى الإدارة
        </Link>
      </aside>
      <main className="desk-main">
        <header className="desk-header">
          <div>
            <p className="desk-eyebrow">حكيم / مكتب التحرير</p>
            <h1>{title}</h1>
            <p>من المصدر إلى المراجعة، ثم النشر الموثق.</p>
          </div>
          <button
            className="desk-secondary"
            onClick={() => void query.refetch()}
            aria-label="تحديث السجلات"
          >
            <RefreshCw size={18} />
            تحديث
          </button>
        </header>
        {!data?.writeEnabled && (
          <div className="desk-notice" role="status">
            <ShieldCheck size={20} />
            <div>
              <strong>اللوحة للقراءة فقط</strong>
              <p>
                {data?.installed
                  ? "الكتابة غير مفعلة في هذه البيئة."
                  : "يلزم تجهيز بيئة مكتب التحرير قبل تفعيل الإجراءات."}
              </p>
            </div>
          </div>
        )}
        {notice && (
          <div className="desk-notice" role="status">
            {notice}
          </div>
        )}
        {query.isError ? (
          <div className="desk-error" role="alert">
            {query.error.message}
          </div>
        ) : query.isLoading ? (
          <p role="status">جارٍ تحميل السجلات…</p>
        ) : (
          <>
            {view === "settings" && data?.config && (
              <DeskSettings
                key={data.revision}
                initial={data.config}
                revision={data.revision ?? 0}
                users={data.users ?? []}
                disabled={disabled}
                save={act}
              />
            )}
            {view === "intake" && (
              <>
                <div className="desk-metrics">
                  <div>
                    <span>تعديلات بانتظار القرار</span>
                    <strong>
                      {data?.amendmentTotal?.toLocaleString("ar-SA") ?? "—"}
                    </strong>
                  </div>
                  <div>
                    <span>مبادئ بانتظار المراجعة</span>
                    <strong>
                      {data?.principlesTotal?.toLocaleString("ar-SA") ?? "—"}
                    </strong>
                  </div>
                  <div>
                    <span>مصدر الطابور</span>
                    <strong className="desk-small">قراءة مباشرة</strong>
                    <p>دون نسخ السجلات قبل قرار المراجع</p>
                  </div>
                </div>
                <section className="desk-card">
                  <h2>عمليات التعديل المستخرجة</h2>
                  <label>
                    سبب اعتماد الدفعة
                    <textarea
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      maxLength={2000}
                    />
                  </label>
                  <button
                    disabled={
                      disabled ||
                      !can("LEGAL_REVIEWER") ||
                      !selected.length ||
                      !reason.trim()
                    }
                    onClick={() =>
                      void act({
                        action: "intake_batch",
                        ids: selected,
                        reason,
                      })
                    }
                  >
                    اعتماد المحدد المطابق للمصدر ({selected.length})
                  </button>
                  <p>
                    القرار يراجع الاستخراج فقط؛ تطبيق النص المعدل يتطلب مسار نشر
                    مستقلًا.
                  </p>
                  {data?.amendments?.map((x) => (
                    <div key={x.id}>
                      <label className="desk-check">
                        <input
                          type="checkbox"
                          checked={selected.includes(x.id)}
                          disabled={
                            disabled ||
                            !can("LEGAL_REVIEWER") ||
                            x.confidence !== "rule_exact" ||
                            !x.verbatim
                          }
                          onChange={(e) =>
                            setSelected((v) =>
                              e.target.checked
                                ? [...v, x.id]
                                : v.filter((id) => id !== x.id),
                            )
                          }
                        />
                        تضمين في الدفعة
                      </label>
                      <IntakeCard
                        key={x.id}
                        id={x.id}
                        title={x.title}
                        quote={x.quote}
                        source="amendment"
                        confidence={`${x.confidence} · ${x.verbatim ? "مطابق للمصدر" : "يحتاج مطابقة"}`}
                        disabled={disabled || !can("LEGAL_REVIEWER")}
                        act={act}
                      />
                    </div>
                  ))}
                </section>
                <section className="desk-card">
                  <h2>المبادئ القضائية</h2>
                  {data?.principles?.map((x) => (
                    <IntakeCard
                      key={x.id}
                      id={x.id}
                      title={x.title}
                      quote={x.principleText}
                      source="principle"
                      disabled={disabled || !can("LEGAL_REVIEWER")}
                      act={act}
                    />
                  ))}
                </section>
              </>
            )}
            {view === "systems" && (
              <>
                <form
                  className="desk-card desk-filters"
                  onSubmit={(e) => {
                    e.preventDefault();
                    setFilters(filter);
                    setPage(1);
                  }}
                >
                  <label>
                    بحث بالاسم
                    <input
                      value={filter.q}
                      onChange={(e) =>
                        setFilter((v) => ({ ...v, q: e.target.value }))
                      }
                    />
                  </label>
                  <label>
                    المجال
                    <input
                      value={filter.domain}
                      onChange={(e) =>
                        setFilter((v) => ({ ...v, domain: e.target.value }))
                      }
                    />
                  </label>
                  <label>
                    الحالة القانونية
                    <select
                      value={filter.status}
                      onChange={(e) =>
                        setFilter((v) => ({ ...v, status: e.target.value }))
                      }
                    >
                      <option value="">جميع الحالات</option>
                      {[
                        "ساري",
                        "ملغى",
                        "مستبدل",
                        "صادر لم يسرِ بعد",
                        "unverified",
                      ].map((v) => (
                        <option key={v} value={v}>
                          {v === "unverified" ? "قيد التحقق" : v}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    نوع الوثيقة
                    <input
                      value={filter.kind}
                      onChange={(e) =>
                        setFilter((v) => ({ ...v, kind: e.target.value }))
                      }
                    />
                  </label>
                  <label>
                    المصدر
                    <input
                      value={filter.source}
                      onChange={(e) =>
                        setFilter((v) => ({ ...v, source: e.target.value }))
                      }
                      placeholder="نطاق المصدر أو رابطه"
                    />
                  </label>
                  <label>
                    اكتمال البطاقة
                    <select
                      value={filter.completeness}
                      onChange={(e) =>
                        setFilter((v) => ({
                          ...v,
                          completeness: e.target.value,
                        }))
                      }
                    >
                      <option value="">الجميع</option>
                      <option value="complete">
                        مكتملة ({data?.facets?.complete ?? 0})
                      </option>
                      <option value="incomplete">
                        تحتاج استكمالًا ({data?.facets?.incomplete ?? 0})
                      </option>
                    </select>
                  </label>
                  <label>
                    التعارض
                    <select
                      value={filter.conflict}
                      onChange={(e) =>
                        setFilter((v) => ({ ...v, conflict: e.target.value }))
                      }
                    >
                      <option value="">الجميع</option>
                      <option value="yes">
                        تعارض نسخة ({data?.facets?.conflicts ?? 0})
                      </option>
                    </select>
                  </label>
                  <button className="desk-primary">تطبيق المرشحات</button>
                </form>
                <p className="desk-muted">
                  {data?.total ?? 0} وثيقة · زمن الاستعلام{" "}
                  {data?.elapsedMs ?? 0} مللي ثانية
                </p>
              </>
            )}
            {(view === "queue" || view === "systems") && (
              <div className="desk-row">
                <p className="desk-muted">
                  {view === "queue"
                    ? `${data?.total ?? 0} حزمة تغيير ضمن نطاقك`
                    : "الاعتماد التحريري منفصل عن الحالة القانونية للوثيقة."}
                </p>
                <button
                  className="desk-primary"
                  disabled={
                    disabled ||
                    !(
                      can("LEGAL_EDITOR_LAWS") ||
                      can("LEGAL_EDITOR_RULINGS") ||
                      can("LEGAL_AGENT_PROPOSE")
                    )
                  }
                  onClick={() => setProposal("")}
                >
                  <Plus size={18} />
                  تغيير جديد
                </button>
              </div>
            )}
            {proposal !== false && (
              <ProposalForm
                key={proposal}
                targetId={proposal}
                disabled={disabled}
                onSave={act}
                onClose={() => setProposal(false)}
              />
            )}
            {view === "queue" && (
              <>
                <form
                  className="desk-card desk-filters"
                  onSubmit={(e) => {
                    e.preventDefault();
                    setFilters(filter);
                    setPage(1);
                  }}
                >
                  <label>
                    نوع الهدف
                    <select
                      value={filter.target}
                      onChange={(e) =>
                        setFilter((v) => ({ ...v, target: e.target.value }))
                      }
                    >
                      <option value="">الجميع</option>
                      {Object.entries({
                        work: "وثيقة",
                        unit: "مادة",
                        ruling: "حكم",
                        principle: "مبدأ",
                        amendment: "تعديل",
                        relation: "علاقة",
                      }).map(([v, l]) => (
                        <option key={v} value={v}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    معرف المعد
                    <input
                      value={filter.author}
                      onChange={(e) =>
                        setFilter((v) => ({ ...v, author: e.target.value }))
                      }
                    />
                  </label>
                  <label>
                    الحالة
                    <select
                      value={filter.status}
                      onChange={(e) =>
                        setFilter((v) => ({ ...v, status: e.target.value }))
                      }
                    >
                      <option value="">الجميع</option>
                      {Object.entries(STATUS)
                        .slice(0, 7)
                        .map(([v, l]) => (
                          <option key={v} value={v}>
                            {l}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label>
                    أقدم من (أيام)
                    <input
                      type="number"
                      min={1}
                      max={3650}
                      value={filter.olderDays}
                      onChange={(e) =>
                        setFilter((v) => ({ ...v, olderDays: e.target.value }))
                      }
                    />
                  </label>
                  <button className="desk-primary">تطبيق المرشحات</button>
                </form>
                <label className="desk-card">
                  سبب الإجراء
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="سبب الاعتماد أو الرفض أو التراجع"
                    maxLength={2000}
                  />
                </label>
                {data?.items?.map((item) => (
                  <section key={item.id} className="desk-card">
                    <div className="desk-row">
                      <h2>{item.title}</h2>
                      <span
                        className={`desk-badge ${item.status === "published" ? "desk-success" : ""}`}
                      >
                        {STATUS[item.status ?? ""] ?? item.status}
                      </span>
                    </div>
                    <p className="desk-muted">
                      {date(item.createdAt)} · {item.id}
                    </p>
                    {item.changes?.map((ch) => (
                      <details key={ch.id} className="desk-role">
                        <summary>مقارنة التغيير · {ch.targetId}</summary>
                        <div className="desk-diff">
                          <div>
                            <h3>قبل</h3>
                            {Object.keys(ch.after).map((k) => (
                              <p key={k}>
                                <strong>{FIELD_LABELS[k] ?? k}: </strong>
                                {display(ch.before[k])}
                              </p>
                            ))}
                          </div>
                          <div>
                            <h3>بعد</h3>
                            {Object.entries(ch.after).map(([k, v]) => (
                              <p key={k}>
                                <strong>{FIELD_LABELS[k] ?? k}: </strong>
                                {display(v)}
                              </p>
                            ))}
                          </div>
                        </div>
                        <blockquote>{ch.evidenceQuote}</blockquote>
                        <p>
                          {ch.evidenceInstrument} ·{" "}
                          <a
                            href={
                              /^(https?:\/\/|\/(?!\/))/.test(ch.evidenceUrl)
                                ? ch.evidenceUrl
                                : undefined
                            }
                            target="_blank"
                            rel="noreferrer"
                          >
                            فتح المصدر
                          </a>
                        </p>
                      </details>
                    ))}
                    {item.decisions?.map((d, i) => (
                      <p key={i} className="desk-muted">
                        {d.decision === "approve" ? "اعتماد" : "رفض"} ·{" "}
                        {d.reviewerId} · {d.reason}
                      </p>
                    ))}
                    <div className="desk-actions">
                      {[
                        "draft",
                        "checks_failed",
                        "pending",
                        "approved",
                      ].includes(item.status ?? "") && (
                        <button
                          disabled={disabled || !reason.trim()}
                          onClick={() =>
                            void act({
                              action: "withdraw",
                              id: item.id,
                              reason,
                            })
                          }
                        >
                          سحب الطلب
                        </button>
                      )}
                      {item.status === "draft" && (
                        <button
                          disabled={disabled}
                          onClick={() =>
                            void act({ action: "submit", id: item.id })
                          }
                        >
                          إرسال للمراجعة
                        </button>
                      )}
                      {["pending", "approved"].includes(item.status ?? "") &&
                        can("LEGAL_REVIEWER") && (
                          <>
                            <button
                              disabled={disabled || !reason.trim()}
                              onClick={() =>
                                void act({
                                  action: "decide",
                                  id: item.id,
                                  decision: "approve",
                                  reason,
                                })
                              }
                            >
                              اعتماد
                            </button>
                            <button
                              className="desk-danger"
                              disabled={disabled || !reason.trim()}
                              onClick={() =>
                                void act({
                                  action: "decide",
                                  id: item.id,
                                  decision: "reject",
                                  reason,
                                })
                              }
                            >
                              رفض
                            </button>
                          </>
                        )}
                      {item.status === "approved" && can("LEGAL_PUBLISHER") && (
                        <button
                          className="desk-primary"
                          disabled={disabled}
                          onClick={() =>
                            void act({ action: "publish", id: item.id })
                          }
                        >
                          نشر النسخة المعتمدة
                        </button>
                      )}
                      {item.status === "published" &&
                        can("LEGAL_PUBLISHER") && (
                          <button
                            disabled={disabled || reason.trim().length < 10}
                            onClick={() =>
                              void act({
                                action: "revert",
                                id: item.id,
                                reason,
                              })
                            }
                          >
                            إنشاء طلب تراجع
                          </button>
                        )}
                      {item.status === "published" && data?.owner && (
                        <button
                          className="desk-danger"
                          disabled={disabled || reason.trim().length < 10}
                          onClick={() =>
                            void act({
                              action: "urgent_revert",
                              id: item.id,
                              reason,
                            })
                          }
                        >
                          تراجع عاجل بحسب السياسة
                        </button>
                      )}
                    </div>
                  </section>
                ))}
              </>
            )}
            {view === "audit" && (
              <form
                className="desk-card desk-filters"
                onSubmit={(e) => {
                  e.preventDefault();
                  setFilters(filter);
                  setPage(1);
                }}
              >
                <label>
                  معرف المنفذ
                  <input
                    value={filter.author}
                    onChange={(e) =>
                      setFilter((v) => ({ ...v, author: e.target.value }))
                    }
                  />
                </label>
                <label>
                  نوع الحدث
                  <input
                    value={filter.event}
                    onChange={(e) =>
                      setFilter((v) => ({ ...v, event: e.target.value }))
                    }
                  />
                </label>
                <label>
                  من تاريخ
                  <input
                    type="date"
                    value={filter.since}
                    onChange={(e) =>
                      setFilter((v) => ({ ...v, since: e.target.value }))
                    }
                  />
                </label>
                <button className="desk-primary">تطبيق المرشحات</button>
              </form>
            )}
            {view === "systems" &&
              data?.items?.map((item) => (
                <section key={item.id} className="desk-card">
                  <div className="desk-row">
                    <h2>{display(item.data?.officialName ?? item.name)}</h2>
                    <span className="desk-badge">
                      {item.status ?? "قيد التحقق"}
                    </span>
                  </div>
                  <p>
                    {item.domain ?? "مجال غير محدد"} · {item.articleCount ?? 0}{" "}
                    مادة
                  </p>
                  <details>
                    <summary>بطاقة الوثيقة</summary>
                    <dl className="desk-grid">
                      {Object.entries(item.data ?? {})
                        .filter(([k]) => !k.startsWith("_"))
                        .map(([k, v]) => (
                          <div key={k}>
                            <dt>{FIELD_LABELS[k] ?? k}</dt>
                            <dd>{display(v)}</dd>
                          </div>
                        ))}
                    </dl>
                    <p className="desk-muted">المعرف: {item.id}</p>
                  </details>
                  <div className="desk-actions">
                    <Link href={`/legal/${item.id}`}>فتح النص</Link>
                    <button
                      disabled={disabled || !can("LEGAL_EDITOR_LAWS")}
                      onClick={() => setProposal(item.id)}
                    >
                      اقتراح تعديل
                    </button>
                  </div>
                </section>
              ))}
            {view === "audit" && (
              <div className="desk-card desk-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>التاريخ</th>
                      <th>الإجراء</th>
                      <th>المستخدم</th>
                      <th>العنصر</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data?.items?.map((x) => (
                      <tr key={x.id}>
                        <td>{date(x.at)}</td>
                        <td>{x.action}</td>
                        <td>{x.actorId}</td>
                        <td>{x.targetId ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {view === "index" && (
              <>
                <div className="desk-metrics">
                  {data?.health?.map((h) => (
                    <div key={h.type}>
                      <span>
                        {
                          {
                            article: "المواد",
                            ruling: "الأحكام",
                            principle: "المبادئ",
                          }[h.type]
                        }
                      </span>
                      <strong>{h.database.toLocaleString("ar-SA")}</strong>
                      <p>
                        في الفهرس: {h.indexed ?? "غير متاح"} · الفرق:{" "}
                        {h.difference ?? "—"}
                      </p>
                      {h.error && <p role="status">{h.error}</p>}
                    </div>
                  ))}
                </div>
                <p className="desk-muted">
                  اكتمال النشر التقني يستلزم نجاح تطبيع البحث والفهرسة وتحديث
                  الصفحات. تظهر الأخطاء هنا لإعادة المحاولة.
                </p>
                <button
                  className="desk-primary"
                  disabled={disabled || !can("LEGAL_PUBLISHER")}
                  onClick={async () => {
                    const r = await fetch("/api/admin/legal/sync", {
                      method: "POST",
                    });
                    const v = await r.json();
                    setNotice(v.message ?? "تمت محاولة المزامنة");
                    void query.refetch();
                  }}
                >
                  معالجة مهام المزامنة
                </button>
                {data?.items?.map((x) => (
                  <section className="desk-card" key={x.id}>
                    <h2>{x.targetId}</h2>
                    <span className="desk-badge">
                      {x.completedAt ? "اكتملت المزامنة" : "بانتظار المزامنة"}
                    </span>
                    <div className="desk-grid">
                      <p>تطبيع البحث: {date(x.searchNormAt)}</p>
                      <p>فهرس البحث: {date(x.opensearchAt)}</p>
                      <p>تحديث الصفحات: {date(x.revalidatedAt)}</p>
                    </div>
                    <p>المحاولات: {x.attempts}</p>
                    {x.lastError && <p className="desk-error">{x.lastError}</p>}
                  </section>
                ))}
              </>
            )}
            {view === "tasks" &&
              data?.items?.map((x) => (
                <section className="desk-card" key={x.id}>
                  <h2>{x.title}</h2>
                  <p>
                    {STATUS[x.status ?? ""]} · موعد الإنجاز: {date(x.dueAt)}
                  </p>
                  <form
                    className="desk-grid"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const f = new FormData(e.currentTarget);
                      void act({
                        action: "task",
                        id: x.id,
                        assigneeId: String(f.get("assigneeId") ?? "") || null,
                        status: f.get("status"),
                      });
                    }}
                  >
                    <label>
                      معرف المكلف
                      <input
                        name="assigneeId"
                        defaultValue={x.assigneeId ?? ""}
                      />
                    </label>
                    <label>
                      الحالة
                      <select name="status" defaultValue={x.status}>
                        {["open", "in_progress", "done", "cancelled"].map(
                          (s) => (
                            <option key={s} value={s}>
                              {STATUS[s]}
                            </option>
                          ),
                        )}
                      </select>
                    </label>
                    <button disabled={disabled || !can("LEGAL_TASK_MANAGE")}>
                      حفظ المهمة
                    </button>
                  </form>
                </section>
              ))}
            {view !== "settings" && (
              <div className="desk-pagination">
                <button
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  السابق
                </button>
                <span>صفحة {page}</span>
                <button
                  disabled={
                    view !== "intake" && (data?.items?.length ?? 0) < 30
                  }
                  onClick={() => setPage((p) => p + 1)}
                >
                  التالي
                </button>
              </div>
            )}
            {data?.items?.length === 0 && (
              <div className="desk-empty">
                <ClipboardCheck size={32} />
                <h2>لا سجلات في هذا العرض</h2>
                <p>ستظهر العناصر التي تطابق المرشحات وصلاحيات حسابك.</p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
function IntakeCard({
  id,
  title,
  quote,
  source,
  confidence,
  disabled,
  act,
}: {
  id: string;
  title: string;
  quote: string;
  source: "amendment" | "principle";
  confidence?: string;
  disabled: boolean;
  act: (v: object) => Promise<void>;
}) {
  const [verdict, setVerdict] = useState("approve");
  const [reason, setReason] = useState("");
  const [field, setField] = useState("new_text");
  const [correction, setCorrection] = useState("");
  return (
    <details className="desk-role">
      <summary>
        {title}
        <small>{confidence}</small>
      </summary>
      <blockquote>{quote}</blockquote>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void act({
            action: "intake",
            source,
            id,
            decision: verdict === "correct" ? "approve" : verdict,
            reason,
            corrections:
              verdict === "correct"
                ? {
                    [field]:
                      field === "article_number"
                        ? Number(correction)
                        : correction,
                  }
                : {},
          });
        }}
      >
        <div className="desk-grid">
          <label>
            القرار
            <select
              value={verdict}
              onChange={(e) => setVerdict(e.target.value)}
            >
              <option value="approve">موافق</option>
              <option value="reject">مرفوض</option>
              {source === "amendment" && (
                <option value="correct">موافق مع تصحيح</option>
              )}
            </select>
          </label>
          <label>
            سبب القرار
            <input
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
        </div>
        {verdict === "correct" && (
          <div className="desk-grid">
            <label>
              الحقل المصحح
              <select value={field} onChange={(e) => setField(e.target.value)}>
                {Object.entries({
                  new_text: "النص",
                  article_number: "رقم المادة",
                  paragraph_label: "الفقرة",
                  op_type: "العملية",
                  old_phrase: "العبارة القديمة",
                  new_phrase: "العبارة الجديدة",
                  target_law_title: "النظام",
                  effective_from_hijri: "تاريخ السريان الهجري",
                }).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <label>
              القيمة الصحيحة
              <textarea
                required
                value={correction}
                onChange={(e) => setCorrection(e.target.value)}
              />
            </label>
          </div>
        )}
        <button
          className="desk-primary"
          disabled={
            disabled ||
            !reason.trim() ||
            (verdict === "correct" && !correction.trim())
          }
        >
          تسجيل قرار المراجعة
        </button>
      </form>
    </details>
  );
}
