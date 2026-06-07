"use client";

import { useState } from "react";
import { GoldButton, LegalAlert, LegalCard, NavyButton } from "@/components/ui/legal";

type UserItem = {
  id: string;
  name: string;
  email: string;
  role: string;
  status?: string;
  isActive?: boolean;
  createdAt: string;
};

const roles = [
  { value: "SYSTEM_ADMIN", label: "مدير النظام" },
  { value: "LAWYER", label: "محامٍ" },
  { value: "TRAINER", label: "مدرب / مشرف" },
  { value: "TRAINEE", label: "متدرب" }
];

const statuses = [
  { value: "ACTIVE", label: "نشط" },
  { value: "INACTIVE", label: "غير نشط" }
];

export function AdminUsersManager({ initialUsers }: { initialUsers: UserItem[] }) {
  const [users, setUsers] = useState(initialUsers);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("TRAINEE");
  const [status, setStatus] = useState("ACTIVE");
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function createUser() {
    setLoading(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ name, email, role, status, temporaryPassword: temporaryPassword || undefined })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.message ?? "تعذر إنشاء المستخدم.");
      setUsers((current) => [payload.user as UserItem, ...current]);
      setName("");
      setEmail("");
      setRole("TRAINEE");
      setStatus("ACTIVE");
      setTemporaryPassword("");
      setMessage(`تم إنشاء المستخدم. كلمة المرور المؤقتة: ${payload.user.temporaryPassword}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر إنشاء المستخدم.");
    } finally {
      setLoading(false);
    }
  }

  async function updateUser(id: string, payload: { role?: string; status?: string }) {
    setError("");
    setMessage("");
    const response = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload)
    });
    const body = await response.json();
    if (!response.ok) {
      setError(body?.message ?? "تعذر تحديث المستخدم.");
      return;
    }
    setUsers((current) => current.map((user) => (user.id === id ? { ...user, ...body.user } : user)));
    setMessage("تم تحديث المستخدم بنجاح.");
  }

  return (
    <div className="space-y-6">
      <LegalCard title="إضافة مستخدم" eyebrow="مصادقة فعلية">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <Field label="الاسم" value={name} onChange={setName} />
          <Field label="البريد الإلكتروني" value={email} onChange={setEmail} dir="ltr" />
          <Field label="كلمة مرور مؤقتة" value={temporaryPassword} onChange={setTemporaryPassword} dir="ltr" placeholder="اختياري، يولد تلقائيًا" />
          <Select label="الدور" value={role} onChange={setRole} options={roles} />
          <Select label="الحالة" value={status} onChange={setStatus} options={statuses} />
        </div>
        <GoldButton type="button" onClick={() => void createUser()} disabled={loading || name.trim().length < 2 || !email.includes("@")} className="mt-4">
          {loading ? "جار الحفظ..." : "إضافة مستخدم"}
        </GoldButton>
        {message ? <div className="mt-4"><LegalAlert tone="success">{message}</LegalAlert></div> : null}
        {error ? <div className="mt-4"><LegalAlert tone="danger">{error}</LegalAlert></div> : null}
      </LegalCard>

      <LegalCard title="المستخدمون">
        {users.length === 0 ? (
          <LegalAlert>لا يوجد مستخدمون مسجلون حتى الآن.</LegalAlert>
        ) : (
          <div className="max-h-[68vh] overflow-auto rounded-[var(--r-lg)] border border-[var(--ink-08)]">
            <table className="w-full min-w-[820px] border-collapse text-right text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-[var(--ink-08)] bg-[var(--hakeem-bg-soft)] text-[var(--navy)] [&>th]:px-4 [&>th]:py-3 [&>th]:font-semibold">
                  <th>الاسم</th>
                  <th>البريد</th>
                  <th>الدور</th>
                  <th>الحالة</th>
                  <th>تاريخ الإضافة</th>
                  <th>إجراء</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const inactive = user.status === "INACTIVE" || user.isActive === false;
                  return (
                  <tr key={user.id} className="border-b border-[var(--ink-04)] transition odd:bg-white even:bg-[var(--hakeem-bg-soft)] hover:bg-[var(--gold-ghost)]">
                    <td className="px-4 py-3 font-semibold text-[var(--navy)]">{user.name}</td>
                    <td className="px-4 py-3 font-mono-legal text-xs text-[var(--ink-70)]" dir="ltr">{user.email}</td>
                    <td className="px-4 py-3 text-[var(--ink-70)]">{roleLabel(user.role)}</td>
                    <td className="px-4 py-3">
                      <span
                        className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
                        style={
                          inactive
                            ? { color: "var(--ruby)", background: "var(--ruby-soft)", border: "1px solid rgba(140,34,51,0.30)" }
                            : { color: "var(--emerald)", background: "var(--emerald-soft)", border: "1px solid rgba(26,92,65,0.30)" }
                        }
                      >
                        <span aria-hidden>{inactive ? "○" : "●"}</span>
                        {inactive ? "غير نشط" : "نشط"}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono-legal text-xs text-[var(--ink-60)]">{new Date(user.createdAt).toLocaleString("ar-SA")}</td>
                    <td className="px-4 py-3">
                      <NavyButton
                        type="button"
                        onClick={() => void updateUser(user.id, { status: inactive ? "ACTIVE" : "INACTIVE" })}
                        className="px-3 py-2 text-xs"
                      >
                        {inactive ? "تفعيل" : "تعطيل"}
                      </NavyButton>
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

function Field({ label, value, onChange, dir = "rtl", placeholder }: { label: string; value: string; onChange: (value: string) => void; dir?: "rtl" | "ltr"; placeholder?: string }) {
  return (
    <label>
      <span className="text-sm font-semibold text-[#0B1F3A]">{label}</span>
      <input value={value} dir={dir} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} className="focus-ring mt-2 w-full rounded-md border border-[#C09B5A]/25 px-4 py-3" />
    </label>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }> }) {
  return (
    <label>
      <span className="text-sm font-semibold text-[#0B1F3A]">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="focus-ring mt-2 w-full rounded-md border border-[#C09B5A]/25 px-4 py-3">
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
