"use client";

import { useState } from "react";

type UserItem = {
  id: string;
  name: string;
  email: string;
  role: string;
  status?: string;
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
        body: JSON.stringify({ name, email, role, status })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.message ?? "تعذر إنشاء المستخدم.");
      setUsers((current) => [payload.user as UserItem, ...current]);
      setName("");
      setEmail("");
      setRole("TRAINEE");
      setStatus("ACTIVE");
      setMessage("تم إنشاء المستخدم بنجاح.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر إنشاء المستخدم.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-md border border-black/10 bg-white p-5">
        <h2 className="text-xl font-bold text-olive">إضافة مستخدم</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Field label="الاسم" value={name} onChange={setName} />
          <Field label="البريد الإلكتروني" value={email} onChange={setEmail} />
          <Select label="الدور" value={role} onChange={setRole} options={roles} />
          <Select label="الحالة" value={status} onChange={setStatus} options={statuses} />
        </div>
        <button
          type="button"
          onClick={() => void createUser()}
          disabled={loading || name.trim().length < 2 || !email.includes("@")} 
          className="focus-ring mt-4 rounded-md bg-olive px-5 py-3 text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "جار الحفظ..." : "إضافة مستخدم"}
        </button>
        {message ? <p className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 p-4 text-emerald-700">{message}</p> : null}
        {error ? <p className="mt-4 rounded-md border border-red-200 bg-red-50 p-4 text-red-700">{error}</p> : null}
        <p className="mt-4 text-xs leading-6 text-gray-500">
          لا يتم إنشاء كلمات مرور في هذه المرحلة. المستخدمون للتنظيم الداخلي إلى حين تفعيل Auth لاحقًا.
        </p>
      </section>

      <section className="rounded-md border border-black/10 bg-white p-5">
        <h2 className="text-xl font-bold text-olive">المستخدمون</h2>
        {users.length === 0 ? (
          <p className="mt-4 rounded-md bg-sand p-4 text-gray-700">لا يوجد مستخدمون مسجلون حتى الآن.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[720px] text-right text-sm">
              <thead className="bg-sand text-olive">
                <tr>
                  <th className="px-4 py-3">الاسم</th>
                  <th className="px-4 py-3">البريد</th>
                  <th className="px-4 py-3">الدور</th>
                  <th className="px-4 py-3">الحالة</th>
                  <th className="px-4 py-3">تاريخ الإضافة</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-t border-black/10">
                    <td className="px-4 py-3 font-semibold text-olive">{user.name}</td>
                    <td className="px-4 py-3">{user.email}</td>
                    <td className="px-4 py-3">{roleLabel(user.role)}</td>
                    <td className="px-4 py-3">{user.status === "INACTIVE" ? "غير نشط" : "نشط"}</td>
                    <td className="px-4 py-3">{new Date(user.createdAt).toLocaleString("ar-SA")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label>
      <span className="text-sm font-semibold text-olive">{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} className="focus-ring mt-2 w-full rounded-md border border-black/10 px-4 py-3" />
    </label>
  );
}

function Select({
  label,
  value,
  onChange,
  options
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label>
      <span className="text-sm font-semibold text-olive">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="focus-ring mt-2 w-full rounded-md border border-black/10 px-4 py-3">
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
