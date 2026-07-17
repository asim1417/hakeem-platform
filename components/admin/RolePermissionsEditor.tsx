"use client";

import { useState } from "react";
import type { RoleMatrix } from "@/lib/modules/auth/role-admin";

export function RolePermissionsEditor({ initialMatrix }: { initialMatrix: RoleMatrix[] }) {
  const [matrix, setMatrix] = useState(initialMatrix);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function toggle(role: string, permission: string, grant: boolean) {
    setBusy(`${role}:${permission}`);
    setError(null);
    try {
      const res = await fetch("/api/admin/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, permission, grant }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.message ?? "تعذّر الحفظ.");
      } else if (Array.isArray(data.matrix)) {
        setMatrix(data.matrix);
      }
    } catch {
      setError("تعذّر الاتصال بالخادم.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div dir="rtl">
      {error && <div className="mb-4 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      <p className="mb-4 text-sm leading-7 text-muted">
        الصلاحيات <span className="font-semibold text-olive">الأساسية</span> مقفلة (لا تُسحب)، ويمكن
        <span className="font-semibold text-emerald-700"> منح صلاحيات إضافية</span> لكل دور — يحترمها التحقق الخادمي (canUser) مباشرةً.
      </p>
      <div className="grid gap-4 xl:grid-cols-2">
        {matrix.map((row) => (
          <article key={row.role} className="rounded-lg border border-gray-200 bg-ivory p-4">
            <div className="flex items-center gap-2">
              <span className="rounded bg-gold/10 px-2 py-0.5 text-xs text-gold">{row.role}</span>
              <h3 className="text-lg font-bold text-olive">{row.label}</h3>
              <span className="ms-auto text-xs text-muted">
                {row.cells.filter((c) => c.effective).length}/{row.cells.length} فعّالة
              </span>
            </div>
            <ul className="mt-3 space-y-1">
              {row.cells.map((cell) => {
                const id = `${row.role}:${cell.permission}`;
                return (
                  <li key={cell.permission} className="flex items-center gap-2 border-t border-gray-100 py-1.5 text-sm">
                    <span className={cell.effective ? "text-ink" : "text-muted"}>{cell.label}</span>
                    {cell.locked ? (
                      <span className="ms-auto rounded bg-surface px-2 py-0.5 text-xs text-muted">أساسية 🔒</span>
                    ) : (
                      <button
                        type="button"
                        disabled={busy === id}
                        onClick={() => toggle(row.role, cell.permission, !cell.granted)}
                        className={`ms-auto rounded px-3 py-1.5 text-xs ${
                          cell.granted ? "bg-emerald-50 text-emerald-700" : "bg-surface text-muted"
                        } ${busy === id ? "opacity-50" : ""}`}
                      >
                        {busy === id ? "..." : cell.granted ? "ممنوحة ✓ (اسحب)" : "امنح +"}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </article>
        ))}
      </div>
    </div>
  );
}
