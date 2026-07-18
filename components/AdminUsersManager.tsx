"use client";

import { useMemo, useState } from "react";
import { GoldButton, LegalAlert, LegalCard, NavyButton } from "@/components/ui/legal";
import { generateEasyPassword, generateUsername } from "@/lib/modules/auth/credentials";
import { ROLE_PERMISSIONS, type Permission } from "@/lib/modules/auth/role-permissions";

type UserItem = {
  id: string;
  name: string;
  email: string;
  username?: string | null;
  role: string;
  status?: string;
  isActive?: boolean;
  createdAt: string;
};

type CredsReveal = {
  name: string;
  username?: string | null;
  email: string;
  password: string;
  roleLabel: string;
  permissions: Array<{ key: string; label: string }>;
};

const roles = [
  { value: "SYSTEM_ADMIN", label: "مدير النظام (المالك)" },
  { value: "LAWYER", label: "محامٍ" },
  { value: "TRAINER", label: "مدرب / مشرف" },
  { value: "TRAINEE", label: "متدرب" },
];

const statuses = [
  { value: "ACTIVE", label: "نشط" },
  { value: "INACTIVE", label: "غير نشط" },
];

const PERMISSION_LABELS: Record<Permission, string> = {
  CONSULTATIONS_FULL: "الاستشارات (كامل)",
  CONSULTATIONS_LIMITED: "الاستشارات (محدود)",
  SIMULATIONS_USE: "المحاكاة القضائية",
  TRAINING_USE: "استخدام التدريب",
  TRAINING_MANAGE: "إدارة التدريب",
  LIBRARY_READ: "قراءة المكتبة",
  LEGAL_CORE_VIEW: "عرض النواة القانونية",
  LEGAL_CORE_EDIT: "تعديل النواة القانونية",
  LEGAL_CORE_ADMIN: "إدارة النواة القانونية",
  ATTACHMENTS_FULL: "المرفقات (كامل)",
  ATTACHMENTS_LIMITED: "المرفقات (محدود)",
  USERS_MANAGE: "إدارة المستخدمين",
  ADMIN_REPORTS_VIEW: "تقارير الإدارة",
  GOVERNANCE_AUDIT_VIEW: "سجل التدقيق والحوكمة",
};

export function AdminUsersManager({
  initialUsers,
  defaultRole = "TRAINEE",
  title = "إضافة مستخدم",
  eyebrow = "توليد بيانات الدخول",
}: {
  initialUsers: UserItem[];
  defaultRole?: string;
  title?: string;
  eyebrow?: string;
}) {
  const [users, setUsers] = useState(initialUsers);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState(defaultRole);
  const [status, setStatus] = useState("ACTIVE");
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [reveal, setReveal] = useState<CredsReveal | null>(null);
  const [copied, setCopied] = useState(false);

  const permissionPreview = useMemo(() => {
    const list = ROLE_PERMISSIONS[role as keyof typeof ROLE_PERMISSIONS] ?? [];
    return list.map((key) => ({ key, label: PERMISSION_LABELS[key] ?? key }));
  }, [role]);

  function fillGeneratedCredentials() {
    const u = generateUsername(name || undefined);
    const p = generateEasyPassword();
    setUsername(u);
    setTemporaryPassword(p);
    if (!email.trim()) setEmail(`${u}@hakeem.local`);
  }

  async function createUser() {
    setLoading(true);
    setMessage("");
    setError("");
    setReveal(null);
    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          name,
          email: email || undefined,
          username: username || undefined,
          role,
          status,
          temporaryPassword: temporaryPassword || undefined,
          generateCredentials: true,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.message ?? "تعذر إنشاء المستخدم.");
      const created = payload.user as UserItem & {
        temporaryPassword: string;
        roleLabel: string;
        permissions: Array<{ key: string; label: string }>;
      };
      setUsers((current) => [created, ...current]);
      setReveal({
        name: created.name,
        username: created.username,
        email: created.email,
        password: created.temporaryPassword,
        roleLabel: created.roleLabel ?? roleLabel(created.role),
        permissions: created.permissions ?? permissionPreview,
      });
      setName("");
      setUsername("");
      setEmail("");
      setRole(defaultRole);
      setStatus("ACTIVE");
      setTemporaryPassword("");
      setMessage("تم إنشاء المستخدم — احفظ بيانات الدخول الآن (لن تُعرض مرة أخرى).");
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر إنشاء المستخدم.");
    } finally {
      setLoading(false);
    }
  }

  async function updateUser(
    id: string,
    payload: { role?: string; status?: string; regeneratePassword?: boolean }
  ) {
    setError("");
    setMessage("");
    const response = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await response.json();
    if (!response.ok) {
      setError(body?.message ?? "تعذر تحديث المستخدم.");
      return;
    }
    setUsers((current) => current.map((user) => (user.id === id ? { ...user, ...body.user } : user)));
    if (body.user?.temporaryPassword) {
      setReveal({
        name: body.user.name,
        username: body.user.username,
        email: body.user.email,
        password: body.user.temporaryPassword,
        roleLabel: body.user.roleLabel ?? roleLabel(body.user.role),
        permissions: body.user.permissions ?? [],
      });
      setMessage("أُعيد توليد كلمة المرور — احفظها الآن.");
    } else {
      setMessage("تم تحديث المستخدم بنجاح.");
    }
  }

  async function copyReveal() {
    if (!reveal) return;
    const text = [
      `الاسم: ${reveal.name}`,
      reveal.username ? `اسم المستخدم: ${reveal.username}` : null,
      `البريد: ${reveal.email}`,
      `كلمة المرور: ${reveal.password}`,
      `الدور: ${reveal.roleLabel}`,
      `صفحة الدخول: /login`,
    ]
      .filter(Boolean)
      .join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("تعذّر النسخ إلى الحافظة.");
    }
  }

  return (
    <div className="space-y-6">
      <LegalCard title={title} eyebrow={eyebrow}>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Field label="الاسم الظاهر" value={name} onChange={setName} placeholder="مثال: مالك المنصة" />
          <Field
            label="اسم المستخدم"
            value={username}
            onChange={setUsername}
            dir="ltr"
            placeholder="يُولَّد تلقائيًا"
          />
          <Field
            label="البريد الإلكتروني"
            value={email}
            onChange={setEmail}
            dir="ltr"
            placeholder="اختياري — يُبنى من اسم المستخدم"
          />
          <Field
            label="كلمة المرور السهلة"
            value={temporaryPassword}
            onChange={setTemporaryPassword}
            dir="ltr"
            placeholder="مثال: Najm-4821!"
          />
          <Select label="الدور / الصلاحيات" value={role} onChange={setRole} options={roles} />
          <Select label="الحالة" value={status} onChange={setStatus} options={statuses} />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <NavyButton type="button" onClick={fillGeneratedCredentials} className="px-4 py-2 text-sm">
            توليد اسم مستخدم + كلمة مرور سهلة
          </NavyButton>
          <GoldButton
            type="button"
            onClick={() => void createUser()}
            disabled={loading || name.trim().length < 2}
            className=""
          >
            {loading ? "جار الحفظ..." : "إنشاء الحساب وحفظه"}
          </GoldButton>
        </div>

        <div className="mt-5 rounded-[var(--r-md)] border border-[var(--gold-border)] bg-[var(--gold-ghost)] p-4">
          <p className="text-sm font-semibold text-[var(--navy)]">
            صلاحيات الدور: {roleLabel(role)}
          </p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {permissionPreview.map((p) => (
              <li
                key={p.key}
                className="rounded-md border border-[var(--gold-border)] bg-ivory px-2.5 py-1 text-xs font-medium text-[var(--navy)]"
              >
                {p.label}
              </li>
            ))}
          </ul>
        </div>

        {reveal ? (
          <div className="mt-5 rounded-[var(--r-lg)] border-2 border-[var(--gold)] bg-ivory p-5">
            <p className="font-display-ar text-base font-bold text-[var(--navy)]">بيانات الدخول — احفظها الآن</p>
            <dl className="mt-3 grid gap-2 text-sm leading-7 text-[var(--ink)]">
              <div className="flex flex-wrap justify-between gap-2">
                <dt className="text-[var(--ink-60)]">اسم المستخدم</dt>
                <dd className="font-mono-legal" dir="ltr">
                  {reveal.username || "—"}
                </dd>
              </div>
              <div className="flex flex-wrap justify-between gap-2">
                <dt className="text-[var(--ink-60)]">البريد</dt>
                <dd className="font-mono-legal" dir="ltr">
                  {reveal.email}
                </dd>
              </div>
              <div className="flex flex-wrap justify-between gap-2">
                <dt className="text-[var(--ink-60)]">كلمة المرور</dt>
                <dd className="font-mono-legal font-bold text-[var(--navy)]" dir="ltr">
                  {reveal.password}
                </dd>
              </div>
              <div className="flex flex-wrap justify-between gap-2">
                <dt className="text-[var(--ink-60)]">الدور</dt>
                <dd>{reveal.roleLabel}</dd>
              </div>
            </dl>
            <NavyButton type="button" onClick={() => void copyReveal()} className="mt-4 px-4 py-2 text-sm">
              {copied ? "تم النسخ ✓" : "نسخ بيانات الدخول"}
            </NavyButton>
          </div>
        ) : null}

        {message ? (
          <div className="mt-4">
            <LegalAlert tone="success">{message}</LegalAlert>
          </div>
        ) : null}
        {error ? (
          <div className="mt-4">
            <LegalAlert tone="danger">{error}</LegalAlert>
          </div>
        ) : null}
      </LegalCard>

      <LegalCard title="المستخدمون">
        {users.length === 0 ? (
          <LegalAlert>لا يوجد مستخدمون مسجلون حتى الآن.</LegalAlert>
        ) : (
          <div className="max-h-[68vh] overflow-auto rounded-[var(--r-lg)] border border-[var(--ink-08)]">
            <table className="w-full min-w-[920px] border-collapse text-right text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-[var(--ink-08)] bg-[var(--hakeem-bg-soft)] text-[var(--navy)] [&>th]:px-4 [&>th]:py-3 [&>th]:font-semibold">
                  <th scope="col">الاسم</th>
                  <th scope="col">اسم المستخدم</th>
                  <th scope="col">البريد</th>
                  <th scope="col">الدور</th>
                  <th scope="col">الحالة</th>
                  <th scope="col">إجراء</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const inactive = user.status === "INACTIVE" || user.isActive === false;
                  return (
                    <tr
                      key={user.id}
                      className="border-b border-[var(--ink-04)] transition odd:bg-ivory even:bg-[var(--hakeem-bg-soft)] hover:bg-[var(--gold-ghost)]"
                    >
                      <td className="px-4 py-3 font-semibold text-[var(--navy)]">{user.name}</td>
                      <td className="px-4 py-3 font-mono-legal text-xs text-[var(--ink-70)]" dir="ltr">
                        {user.username || "—"}
                      </td>
                      <td className="px-4 py-3 font-mono-legal text-xs text-[var(--ink-70)]" dir="ltr">
                        {user.email}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={user.role}
                          onChange={(e) => void updateUser(user.id, { role: e.target.value })}
                          className="focus-ring rounded-md border border-[var(--gold-border)] bg-ivory px-2 py-1.5 text-xs"
                        >
                          {roles.map((r) => (
                            <option key={r.value} value={r.value}>
                              {r.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
                          style={
                            inactive
                              ? {
                                  color: "var(--ruby)",
                                  background: "var(--ruby-soft)",
                                  border: "1px solid rgba(140,34,51,0.30)",
                                }
                              : {
                                  color: "var(--emerald)",
                                  background: "var(--emerald-soft)",
                                  border: "1px solid rgba(26,92,65,0.30)",
                                }
                          }
                        >
                          <span aria-hidden>{inactive ? "○" : "●"}</span>
                          {inactive ? "غير نشط" : "نشط"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <NavyButton
                            type="button"
                            onClick={() => void updateUser(user.id, { status: inactive ? "ACTIVE" : "INACTIVE" })}
                            className="px-3 py-2 text-xs"
                          >
                            {inactive ? "تفعيل" : "تعطيل"}
                          </NavyButton>
                          <NavyButton
                            type="button"
                            onClick={() => void updateUser(user.id, { regeneratePassword: true })}
                            className="px-3 py-2 text-xs"
                          >
                            كلمة مرور جديدة
                          </NavyButton>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </LegalCard>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  dir = "rtl",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  dir?: "rtl" | "ltr";
  placeholder?: string;
}) {
  return (
    <label>
      <span className="text-sm font-semibold text-[var(--navy)]">{label}</span>
      <input
        value={value}
        dir={dir}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="focus-ring mt-2 w-full rounded-md border border-[#C69763]/25 px-4 py-3"
      />
    </label>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label>
      <span className="text-sm font-semibold text-[var(--navy)]">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="focus-ring mt-2 w-full rounded-md border border-[#C69763]/25 px-4 py-3"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function roleLabel(role: string) {
  return roles.find((item) => item.value === role)?.label ?? role;
}
