"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Lock, Minus, Plus } from "lucide-react";
import type { EditorialBinding, EditorialConfig, EditorialPolicy } from "@/lib/modules/editorial/policy";
import type { SettingsView } from "@/lib/modules/editorial/settings";
import { callEditorial } from "./api";
import { ConfirmDialog } from "./ConfirmDialog";
import { Dock } from "./DecisionParts";
import { AGENT_FORBIDDEN, DESK_ROLE_OPTIONS, DOMAIN_OPTIONS, ITEM_KIND_OPTIONS, type DeskRoleValue, type ItemKindValue } from "./labels";
import { bindingSummary, CHANGES_NOUN_GEN, countNoun, eligibleApprovers, fmt, reapplyChanges, settingsChanges, unsavedChanges, type UserRef } from "./logic";
import { Badge, btnClass, Message } from "./ui";

const MIN_REASON = 5;

interface Row {
  key: string;
  binding: EditorialBinding;
  isNew: boolean;
  removed: boolean;
}

function toRows(config: EditorialConfig): Row[] {
  return config.bindings.map((b) => ({ key: b.userId, binding: { ...b, roles: [...b.roles] }, isNew: false, removed: false }));
}

function rowsToConfig(rows: Row[], policies: EditorialConfig["policies"]): EditorialConfig {
  return {
    bindings: rows.filter((r) => !r.removed && r.binding.userId).map((r) => ({ ...r.binding, roles: [...r.binding.roles] })),
    policies: JSON.parse(JSON.stringify(policies)) as EditorialConfig["policies"],
  };
}

function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={checked} className="dk-switch" disabled={disabled} onClick={() => onChange(!checked)}>
      <span className="dk-switch__track" aria-hidden>
        <span className="dk-switch__knob" />
      </span>
      <span>{label}</span>
    </button>
  );
}

function Opt({
  type,
  name,
  checked,
  onChange,
  title,
  description,
  disabled,
}: {
  type: "checkbox" | "radio";
  name: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  title: string;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <label className="dk-opt" aria-disabled={disabled ? true : undefined}>
      <input type={type} name={name} checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className="dk-opt__text">
        <span className="dk-opt__title">{title}</span>
        {description ? <span className="dk-meta">{description}</span> : null}
      </span>
    </label>
  );
}

/** صفحة الإعدادات المقسّمة (٧): لسانان بنمط APG، تكليفات مطوية، سياسات، شريط حفظ مثبت، حوار مراجعة بالأثر وبالسبب، وتعارض 409. */
export function SettingsEditor({ initial, writeEnabled }: { initial: SettingsView; writeEnabled: boolean }) {
  const router = useRouter();
  const users: UserRef[] = initial.users;
  const [base, setBase] = useState<{ version: number; config: EditorialConfig }>({ version: initial.version, config: initial.config });
  const [rows, setRows] = useState<Row[]>(() => toRows(initial.config));
  const [policies, setPolicies] = useState<EditorialConfig["policies"]>(() => JSON.parse(JSON.stringify(initial.config.policies)));
  const [tab, setTab] = useState<"bindings" | "policies">("bindings");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [reason, setReason] = useState("");
  const [reviewOpen, setReviewOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<{ current: number } | null>(null);
  const [reapplyFailed, setReapplyFailed] = useState<string[]>([]);
  const [impact, setImpact] = useState<{ state: "loading" } | { state: "done"; dropped: number; raised: number } | { state: "error" } | null>(null);
  const [savedVersion, setSavedVersion] = useState<number | null>(null);
  const [leaveTo, setLeaveTo] = useState<string | null>(null);
  const tabsId = useId();
  const tabRefs = { bindings: useRef<HTMLButtonElement>(null), policies: useRef<HTMLButtonElement>(null) };

  const draft = useMemo(() => rowsToConfig(rows, policies), [rows, policies]);
  const changes = useMemo(() => settingsChanges(base.config, draft, users), [base.config, draft, users]);
  const dirty = changes.length > 0;
  const bindingsDirty = changes.length > 0 && JSON.stringify(base.config.bindings) !== JSON.stringify(draft.bindings);
  const policiesDirty = JSON.stringify(base.config.policies) !== JSON.stringify(draft.policies);
  const nextVersion = base.version + 1;

  // الاختيار في #bindings / #policies.
  useEffect(() => {
    if (window.location.hash === "#policies") setTab("policies");
  }, []);
  const selectTab = (next: "bindings" | "policies", focus = false) => {
    setTab(next);
    try {
      window.history.replaceState(null, "", `#${next}`);
    } catch {
      // لا شيء.
    }
    if (focus) tabRefs[next].current?.focus();
  };
  const onTabKey = (event: ReactKeyboardEvent) => {
    const order: Array<"bindings" | "policies"> = ["bindings", "policies"];
    const i = order.indexOf(tab);
    // RTL: السهم الأيسر للتالي، والأيمن للسابق.
    if (event.key === "ArrowLeft") selectTab(order[(i + 1) % 2], true);
    else if (event.key === "ArrowRight") selectTab(order[(i + 1) % 2], true);
    else if (event.key === "Home") selectTab("bindings", true);
    else if (event.key === "End") selectTab("policies", true);
    else return;
    event.preventDefault();
  };

  // المغادرة بتغييرات غير محفوظة: حوار داخل التطبيق، وbeforeunload للإغلاق.
  useEffect(() => {
    if (!dirty) return;
    const onBefore = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.target === "_blank") return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin || (url.pathname === window.location.pathname && url.hash)) return;
      event.preventDefault();
      event.stopPropagation();
      setLeaveTo(`${url.pathname}${url.search}${url.hash}`);
    };
    window.addEventListener("beforeunload", onBefore);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBefore);
      document.removeEventListener("click", onClick, true);
    };
  }, [dirty]);

  const updateRow = (key: string, fn: (b: EditorialBinding) => EditorialBinding) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, binding: fn({ ...r.binding, roles: [...r.binding.roles] }) } : r)));
  const updatePolicy = (kind: ItemKindValue, patch: Partial<EditorialPolicy>) => setPolicies((p) => ({ ...p, [kind]: { ...p[kind], ...patch } }));

  const addBinding = () => {
    const key = `new-${Date.now()}`;
    setRows((rs) => [...rs, { key, isNew: true, removed: false, binding: { userId: "", kind: "human", roles: [], itemKinds: "all", domains: "all", enabled: true } }]);
    setExpanded((e) => new Set(e).add(key));
    setTab("bindings");
    setTimeout(() => document.getElementById(`set-user-${key}`)?.focus(), 0);
  };

  const fetchImpact = useCallback(async (config: EditorialConfig) => {
    setImpact({ state: "loading" });
    const res = await callEditorial<{ approvalsDropped: number; pendingRaised: number }>("POST", "/api/admin/legal/settings/preview", { config });
    if (res.ok && res.data) setImpact({ state: "done", dropped: res.data.approvalsDropped, raised: res.data.pendingRaised });
    else setImpact({ state: "error" });
  }, []);

  const openReview = () => {
    setSaveError(null);
    setConflict(null);
    setReapplyFailed([]);
    setReviewOpen(true);
    void fetchImpact(draft);
  };

  const save = async () => {
    if (reason.trim().length < MIN_REASON) return;
    setSaving(true);
    setSaveError(null);
    const res = await callEditorial<{ version: number }>("PUT", "/api/admin/legal/settings", { baseVersion: base.version, reason: reason.trim(), config: draft });
    setSaving(false);
    if (res.ok && res.data) {
      const saved = res.data.version;
      setBase({ version: saved, config: draft });
      setRows(toRows(draft));
      setReason("");
      setReviewOpen(false);
      setSavedVersion(saved);
      router.refresh();
      return;
    }
    if (res.status === 409 && res.code === "CONFLICT") {
      const current = Number(res.detail?.currentVersion ?? NaN);
      setConflict({ current: Number.isFinite(current) ? current : base.version + 1 });
      return;
    }
    setSaveError(res.message ?? "تعذّر الحفظ، ولم يُحفظ شيء.");
  };

  const reloadAndReapply = async () => {
    setSaving(true);
    const res = await callEditorial<SettingsView>("GET", "/api/admin/legal/settings");
    setSaving(false);
    if (!res.ok || !res.data) {
      setSaveError(res.message ?? "تعذّر تحميل النسخة الأحدث.");
      return;
    }
    const latest = res.data;
    const result = reapplyChanges(base.config, draft, latest.config, latest.users);
    setBase({ version: latest.version, config: latest.config });
    setRows(
      result.config.bindings.map((b) => ({
        key: b.userId,
        binding: b,
        isNew: !latest.config.bindings.some((x) => x.userId === b.userId),
        removed: false,
      })),
    );
    setPolicies(result.config.policies);
    setReapplyFailed(result.failed);
    setConflict(null);
    void fetchImpact(result.config);
  };

  const usersFor = (row: Row) => users.filter((u) => u.role !== "SUPER_ADMIN" && (u.id === row.binding.userId || !rows.some((r) => r.binding.userId === u.id && !r.removed)));
  const visibleRows = rows;

  return (
    <div className="dk-settings">
      <p className="dk-meta mt-2">النسخة الحالية: {fmt(base.version)}</p>
      {savedVersion !== null ? (
        <div className="mt-3">
          <Message tone="success" role="status">
            حُفظت النسخة {fmt(savedVersion)}.
          </Message>
        </div>
      ) : null}

      <div role="tablist" aria-label="أقسام الإعدادات" className="dk-stabs">
        {(["bindings", "policies"] as const).map((t) => (
          <button
            key={t}
            ref={tabRefs[t]}
            type="button"
            role="tab"
            id={`${tabsId}-${t}`}
            aria-selected={tab === t}
            aria-controls={`${tabsId}-${t}-panel`}
            tabIndex={tab === t ? 0 : -1}
            className="dk-stab"
            onClick={() => selectTab(t)}
            onKeyDown={onTabKey}
          >
            <span>{t === "bindings" ? `التكليفات (${fmt(rows.filter((r) => !r.removed).length)})` : `السياسات (${fmt(ITEM_KIND_OPTIONS.length)})`}</span>
            {(t === "bindings" ? bindingsDirty : policiesDirty) ? (
              <>
                <span className="dk-dot" aria-hidden />
                <span className="dk-sr">فيها تغييرات غير محفوظة</span>
              </>
            ) : null}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`${tabsId}-bindings-panel`} aria-labelledby={`${tabsId}-bindings`} hidden={tab !== "bindings"}>
        {visibleRows.length === 0 ? (
          <div className="mt-4">
            <Message tone="info">لا تكليفات بعد. المالك يملك كل الصلاحيات ضمنًا.</Message>
          </div>
        ) : (
          <ul className="dk-acc">
            {visibleRows.map((row) => {
              const b = row.binding;
              const open = expanded.has(row.key);
              const user = users.find((u) => u.id === b.userId);
              const before = base.config.bindings.find((x) => x.userId === b.userId);
              const modified = row.isNew || row.removed || (before ? JSON.stringify(before) !== JSON.stringify(b) : false);
              const agent = b.kind === "agent";
              const bodyId = `set-body-${row.key}`;
              return (
                <li key={row.key} className="dk-acc__item" data-modified={modified && !row.removed ? "" : undefined} data-removed={row.removed ? "" : undefined}>
                  <button
                    type="button"
                    className="dk-acc__head"
                    aria-expanded={open}
                    aria-controls={bodyId}
                    onClick={() =>
                      setExpanded((e) => {
                        const n = new Set(e);
                        if (n.has(row.key)) n.delete(row.key);
                        else n.add(row.key);
                        return n;
                      })
                    }
                  >
                    <div>
                      <p className="dk-card__op text-[var(--desk-text-heading)]">{user?.name || (row.isNew ? "تكليف جديد" : "مستخدم بلا اسم")}</p>
                      <p className="dk-meta">{row.isNew && !b.userId ? "اختر المستخدم" : bindingSummary(b)}</p>
                    </div>
                    {row.removed ? (
                      <Badge tone="destructive">ستُزال</Badge>
                    ) : b.enabled ? (
                      <Badge tone="success">مفعّل</Badge>
                    ) : (
                      <Badge icon={null}>معطّل</Badge>
                    )}
                    <ChevronDown size={20} aria-hidden className="dk-chev" />
                  </button>
                  {open ? (
                    <div id={bodyId} className="dk-acc__body">
                      {row.removed ? (
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="dk-meta">ستُزال عند الحفظ.</p>
                          <button type="button" className={btnClass("correct")} onClick={() => setRows((rs) => rs.map((r) => (r.key === row.key ? { ...r, removed: false } : r)))}>
                            تراجع
                          </button>
                        </div>
                      ) : (
                        <>
                          {user ? (
                            <p className="dk-meta">
                              <bdi dir="ltr" lang="en">
                                {user.email}
                              </bdi>{" "}
                              · {agent ? "وكيل آلي" : "حساب بشري"}
                            </p>
                          ) : null}
                          {row.isNew ? (
                            <>
                              <div className="dk-field">
                                <label htmlFor={`set-user-${row.key}`} className="dk-field__label">
                                  المستخدم
                                </label>
                                <select
                                  id={`set-user-${row.key}`}
                                  className="dk-input"
                                  value={b.userId}
                                  disabled={!writeEnabled}
                                  onChange={(e) => updateRow(row.key, (x) => ({ ...x, userId: e.target.value }))}
                                >
                                  <option value="" disabled>
                                    اختر المستخدم
                                  </option>
                                  {usersFor(row).map((u) => (
                                    <option key={u.id} value={u.id}>
                                      {u.name || "بلا اسم"} — {u.email}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <fieldset className="dk-fieldset">
                                <legend>نوع الحساب</legend>
                                <div className="dk-optgrid">
                                  <Opt
                                    type="radio"
                                    name={`kind-${row.key}`}
                                    checked={!agent}
                                    disabled={!writeEnabled}
                                    onChange={() => updateRow(row.key, (x) => ({ ...x, kind: "human" }))}
                                    title="حساب بشري"
                                  />
                                  <Opt
                                    type="radio"
                                    name={`kind-${row.key}`}
                                    checked={agent}
                                    disabled={!writeEnabled}
                                    onChange={() => updateRow(row.key, (x) => ({ ...x, kind: "agent", roles: x.roles.filter((r) => !AGENT_FORBIDDEN.includes(r as DeskRoleValue)) }))}
                                    title="وكيل آلي"
                                    description="يقترح فقط"
                                  />
                                </div>
                              </fieldset>
                            </>
                          ) : null}
                          <fieldset className="dk-fieldset">
                            <legend>الأدوار</legend>
                            <div className="dk-optgrid dk-optgrid--3">
                              {DESK_ROLE_OPTIONS.map((r) => {
                                const forbidden = agent && AGENT_FORBIDDEN.includes(r.value);
                                return (
                                  <Opt
                                    key={r.value}
                                    type="checkbox"
                                    name={`roles-${row.key}`}
                                    checked={b.roles.includes(r.value)}
                                    disabled={!writeEnabled || forbidden}
                                    onChange={(on) =>
                                      updateRow(row.key, (x) => ({ ...x, roles: on ? [...x.roles.filter((v) => v !== r.value), r.value] : x.roles.filter((v) => v !== r.value) }))
                                    }
                                    title={r.title}
                                    description={forbidden ? "الوكيل يقترح فقط" : r.description}
                                  />
                                );
                              })}
                            </div>
                          </fieldset>
                          <fieldset className="dk-fieldset">
                            <legend>الأنواع</legend>
                            <div className="dk-optgrid">
                              <Opt type="radio" name={`kinds-${row.key}`} checked={b.itemKinds === "all"} disabled={!writeEnabled} onChange={() => updateRow(row.key, (x) => ({ ...x, itemKinds: "all" }))} title="كل الأنواع" />
                              <Opt
                                type="radio"
                                name={`kinds-${row.key}`}
                                checked={b.itemKinds !== "all"}
                                disabled={!writeEnabled}
                                onChange={() => updateRow(row.key, (x) => ({ ...x, itemKinds: x.itemKinds === "all" ? ["set_work_status"] : x.itemKinds }))}
                                title="أنواع محددة"
                              />
                            </div>
                            {b.itemKinds !== "all" ? (
                              <div className="dk-optgrid mt-1">
                                {ITEM_KIND_OPTIONS.map((k) => {
                                  const list = b.itemKinds === "all" ? [] : b.itemKinds;
                                  return (
                                    <Opt
                                      key={k.value}
                                      type="checkbox"
                                      name={`kind-list-${row.key}`}
                                      checked={list.includes(k.value)}
                                      disabled={!writeEnabled || (list.length === 1 && list.includes(k.value))}
                                      onChange={(on) =>
                                        updateRow(row.key, (x) => {
                                          const cur = x.itemKinds === "all" ? [] : x.itemKinds;
                                          const next = on ? [...cur.filter((v) => v !== k.value), k.value] : cur.filter((v) => v !== k.value);
                                          return { ...x, itemKinds: next.length ? next : cur };
                                        })
                                      }
                                      title={k.title}
                                      description={k.description}
                                    />
                                  );
                                })}
                              </div>
                            ) : null}
                          </fieldset>
                          <fieldset className="dk-fieldset">
                            <legend>المجالات</legend>
                            <div className="dk-optgrid">
                              <Opt
                                type="radio"
                                name={`domains-${row.key}`}
                                checked={b.domains === "all"}
                                disabled={!writeEnabled}
                                onChange={() => updateRow(row.key, (x) => ({ ...x, domains: "all" }))}
                                title="كل المجالات"
                                description="المجال لا ينطبق على التعديلات والمبادئ"
                              />
                              <Opt
                                type="radio"
                                name={`domains-${row.key}`}
                                checked={b.domains !== "all"}
                                disabled={!writeEnabled}
                                onChange={() => updateRow(row.key, (x) => ({ ...x, domains: x.domains === "all" ? [DOMAIN_OPTIONS[0].value] : x.domains }))}
                                title="مجالات محددة"
                              />
                            </div>
                            {b.domains !== "all" ? (
                              <div className="dk-optgrid dk-optgrid--3 mt-1">
                                {[...DOMAIN_OPTIONS, ...(b.domains as string[]).filter((d) => !DOMAIN_OPTIONS.some((o) => o.value === d)).map((d) => ({ value: d, title: d }))].map((d) => {
                                  const list = b.domains === "all" ? [] : b.domains;
                                  return (
                                    <Opt
                                      key={d.value}
                                      type="checkbox"
                                      name={`domain-list-${row.key}`}
                                      checked={list.includes(d.value)}
                                      disabled={!writeEnabled || (list.length === 1 && list.includes(d.value))}
                                      onChange={(on) =>
                                        updateRow(row.key, (x) => {
                                          const cur = x.domains === "all" ? [] : x.domains;
                                          const next = on ? [...cur.filter((v) => v !== d.value), d.value] : cur.filter((v) => v !== d.value);
                                          return { ...x, domains: next.length ? next : cur };
                                        })
                                      }
                                      title={d.title}
                                    />
                                  );
                                })}
                              </div>
                            ) : null}
                          </fieldset>
                          <Switch checked={b.enabled} disabled={!writeEnabled} onChange={(v) => updateRow(row.key, (x) => ({ ...x, enabled: v }))} label="التكليف مفعّل" />
                          <div>
                            <button
                              type="button"
                              className={btnClass("text-danger")}
                              disabled={!writeEnabled}
                              onClick={() =>
                                row.isNew
                                  ? setRows((rs) => rs.filter((r) => r.key !== row.key))
                                  : setRows((rs) => rs.map((r) => (r.key === row.key ? { ...r, removed: true } : r)))
                              }
                            >
                              إزالة التكليف
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
        <div className="mt-3">
          <button type="button" className={btnClass("correct")} disabled={!writeEnabled} onClick={addBinding}>
            <Plus size={18} aria-hidden />
            <span>إضافة تكليف</span>
          </button>
        </div>
      </div>

      <div role="tabpanel" id={`${tabsId}-policies-panel`} aria-labelledby={`${tabsId}-policies`} hidden={tab !== "policies"}>
        <div className="dk-policies">
          {ITEM_KIND_OPTIONS.map((k) => {
            const p = policies[k.value];
            const eligible = eligibleApprovers(draft, k.value);
            return (
              <section key={k.value} className="dk-card grid gap-3" aria-labelledby={`pol-${k.value}`}>
                <div>
                  <h3 id={`pol-${k.value}`} className="dk-card__op">
                    {k.title}
                  </h3>
                  <p className="dk-meta">{k.description}</p>
                </div>
                <div className="grid gap-2">
                  <span className="dk-field__label" id={`pol-${k.value}-min`}>
                    عدد الموافقات المطلوبة
                  </span>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="dk-stepper" role="group" aria-labelledby={`pol-${k.value}-min`}>
                      <button type="button" aria-label={`إنقاص موافقات «${k.title}»`} disabled={!writeEnabled || p.minApprovals <= 1} onClick={() => updatePolicy(k.value, { minApprovals: p.minApprovals - 1 })}>
                        <Minus size={18} aria-hidden />
                      </button>
                      <output aria-live="polite">{fmt(p.minApprovals)}</output>
                      <button type="button" aria-label={`زيادة موافقات «${k.title}»`} disabled={!writeEnabled || p.minApprovals >= 5} onClick={() => updatePolicy(k.value, { minApprovals: p.minApprovals + 1 })}>
                        <Plus size={18} aria-hidden />
                      </button>
                    </div>
                    <span className="dk-meta">من مستخدمين مختلفين قبل النشر</span>
                  </div>
                </div>
                <Switch checked={p.ownerSelfApproval} disabled={!writeEnabled} onChange={(v) => updatePolicy(k.value, { ownerSelfApproval: v })} label="يعتمد المالك ما أعدّه بسبب مكتوب" />
                <Switch checked={p.enabled} disabled={!writeEnabled} onChange={(v) => updatePolicy(k.value, { enabled: v })} label="المسار مفعّل" />
                {eligible < p.minApprovals ? (
                  <Message tone="warn">
                    المعتمِدون المؤهلون لهذا النوع (مع المالك) {fmt(eligible)}، والمطلوب {fmt(p.minApprovals)}؛ ستبقى الدفعات معلّقة.
                  </Message>
                ) : null}
                {k.value === "revert" ? (
                  <Message tone="lock" title="التراجع العاجل للمالك">
                    متاح دائمًا ولا تعطّله السياسة.
                  </Message>
                ) : null}
              </section>
            );
          })}
        </div>
      </div>

      <Dock>
        <div className="dk-bar">
          <div className="dk-savebar__inner">
            <div className="dk-savebar__row">
              <p className="dk-bar__count" aria-live="polite">
                {!writeEnabled ? (
                  <span className="inline-flex items-center gap-2">
                    <Lock size={16} aria-hidden /> الكتابة مقفلة حتى يفعّلها المالك
                  </span>
                ) : dirty ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="dk-dot" aria-hidden />
                    {unsavedChanges(changes.length)}
                  </span>
                ) : (
                  <span className="dk-meta">لا تغييرات</span>
                )}
              </p>
              <label className="dk-savebar__reason">
                <span className="dk-sr">سبب الحفظ (إلزامي)</span>
                <input className="dk-input" placeholder="سبب الحفظ (إلزامي)" value={reason} disabled={!writeEnabled || !dirty} onChange={(e) => setReason(e.target.value)} />
              </label>
              <button type="button" className={btnClass("primary", { lg: true })} disabled={!writeEnabled || !dirty} aria-describedby={!dirty ? "set-nochange" : undefined} onClick={openReview}>
                <span>حفظ…</span>
              </button>
              <span id="set-nochange" className="dk-sr">
                لا تغييرات لحفظها
              </span>
            </div>
          </div>
        </div>
      </Dock>

      <ConfirmDialog
        open={reviewOpen}
        title={`حفظ إعدادات المكتب (النسخة ${fmt(nextVersion)})`}
        consequence="تُحفظ نسخة جديدة إلحاقية بسببك، وتسري على كل أفعال المكتب فورًا."
        confirmLabel={`حفظ النسخة ${fmt(nextVersion)}`}
        busyLabel="جارٍ الحفظ…"
        cancelLabel="رجوع"
        busy={saving}
        error={
          conflict ? (
            <>
              <strong>
                حُفظت نسخة أحدث ({fmt(conflict.current)}) بعد أن فتحتَ الصفحة على النسخة {fmt(base.version)}.
              </strong>{" "}
              لم يُحفظ شيء، وتغييراتك ({fmt(changes.length)}) باقية هنا.
            </>
          ) : (
            saveError
          )
        }
        confirmDisabled={reason.trim().length < MIN_REASON || conflict !== null}
        confirmHelp={conflict ? "حمّل النسخة الأحدث أولًا ثم احفظ." : `اكتب سبب الحفظ (${fmt(MIN_REASON)} أحرف على الأقل) لتفعيل الحفظ.`}
        onConfirm={() => void save()}
        onClose={() => setReviewOpen(false)}
        extraActions={
          conflict ? (
            <button type="button" className={btnClass("primary", { lg: true })} disabled={saving} onClick={() => void reloadAndReapply()}>
              <span>تحميل النسخة {fmt(conflict.current)} وإعادة تطبيق تغييراتي</span>
            </button>
          ) : null
        }
      >
        {reapplyFailed.length ? (
          <Message tone="warn" title="تعذّر تطبيق بعض التغييرات على النسخة الأحدث:">
            <ul className="list-disc ps-5">
              {reapplyFailed.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </Message>
        ) : null}
        <ul className="dk-sheet__list">
          {changes.map((c) => (
            <li key={c}>
              <span className="dk-body-text">{c}</span>
            </li>
          ))}
        </ul>
        {impact?.state === "loading" ? <p className="dk-meta">جارٍ حساب الأثر على الدفعات والعناصر القائمة…</p> : null}
        {impact?.state === "error" ? <p className="dk-meta">تعذّر حساب الأثر على القائم قبل الحفظ.</p> : null}
        {impact?.state === "done" && (impact.dropped > 0 || impact.raised > 0) ? (
          <Message tone="warn" title="أثر الحفظ على القائم">
            <ul className="list-disc ps-5">
              {impact.dropped > 0 ? <li>تسقط موافقات قائمة على {fmt(impact.dropped)} دفعة أو عنصر معلّق.</li> : null}
              {impact.raised > 0 ? <li>ترتفع الموافقات المطلوبة لـ {fmt(impact.raised)} عنصر معلّق.</li> : null}
            </ul>
          </Message>
        ) : null}
        <label className="dk-field">
          <span className="dk-field__label">سبب الحفظ (إلزامي)</span>
          <textarea rows={2} className="dk-input" value={reason} onChange={(e) => setReason(e.target.value)} />
        </label>
      </ConfirmDialog>

      <ConfirmDialog
        open={leaveTo !== null}
        title={`تغادر دون حفظ ${countNoun(changes.length, CHANGES_NOUN_GEN)}؟`}
        consequence="تضيع التغييرات غير المحفوظة."
        confirmLabel="المغادرة دون حفظ"
        confirmVariant="reject"
        cancelLabel="البقاء"
        onConfirm={() => {
          const to = leaveTo;
          setLeaveTo(null);
          setRows(toRows(base.config));
          setPolicies(JSON.parse(JSON.stringify(base.config.policies)));
          if (to) setTimeout(() => router.push(to), 0);
        }}
        onClose={() => setLeaveTo(null)}
      />
    </div>
  );
}
