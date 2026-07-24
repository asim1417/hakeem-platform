"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  BUILTIN_PAGE_META,
  type BuiltinPageKey,
  type CustomSitePage,
  type SiteConfig,
  type SiteTheme,
} from "@/lib/modules/site/defaults";

type Props = {
  initialConfig: SiteConfig;
  initialPages: CustomSitePage[];
};

const THEME_FIELDS: Array<{ key: keyof SiteTheme; label: string }> = [
  { key: "navy", label: "الأزرق الداكن (هوية)" },
  { key: "gold", label: "الذهبي" },
  { key: "bg", label: "خلفية الصفحة" },
  { key: "paper", label: "لون الورق" },
  { key: "ink", label: "لون النص" },
];

export function AdminSiteManager({ initialConfig, initialPages }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [config, setConfig] = useState<SiteConfig>(initialConfig);
  const [pages, setPages] = useState<CustomSitePage[]>(initialPages);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const [newTitle, setNewTitle] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [newBody, setNewBody] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  function patchHome<K extends keyof SiteConfig["home"]>(
    key: K,
    value: SiteConfig["home"][K],
  ) {
    setConfig((c) => ({ ...c, home: { ...c.home, [key]: value } }));
  }

  function patchTheme(key: keyof SiteTheme, value: string) {
    setConfig((c) => ({ ...c, theme: { ...c.theme, [key]: value } }));
  }

  function togglePage(key: BuiltinPageKey, enabled: boolean) {
    setConfig((c) => ({ ...c, pages: { ...c.pages, [key]: enabled } }));
  }

  function saveConfig() {
    startTransition(async () => {
      setMsg("");
      setErr("");
      try {
        const res = await fetch("/api/admin/site", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ config }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          config?: SiteConfig;
          error?: string;
        };
        if (!res.ok || !data.ok || !data.config) {
          setErr(data.error || "تعذّر الحفظ.");
          return;
        }
        setConfig(data.config);
        setMsg("تم حفظ إعدادات الموقع.");
        router.refresh();
      } catch {
        setErr("خطأ شبكة.");
      }
    });
  }

  function createPage() {
    startTransition(async () => {
      setMsg("");
      setErr("");
      try {
        const res = await fetch("/api/admin/site/pages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: newTitle,
            slug: newSlug || undefined,
            body: newBody,
            enabled: true,
          }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          page?: CustomSitePage;
          error?: string;
        };
        if (!res.ok || !data.ok || !data.page) {
          setErr(data.error || "تعذّر إنشاء الصفحة.");
          return;
        }
        setPages((p) => [data.page!, ...p.filter((x) => x.id !== data.page!.id)]);
        setNewTitle("");
        setNewSlug("");
        setNewBody("");
        setMsg(`أُنشئت الصفحة: /p/${data.page.slug}`);
        router.refresh();
      } catch {
        setErr("خطأ شبكة.");
      }
    });
  }

  function savePage(page: CustomSitePage) {
    startTransition(async () => {
      setMsg("");
      setErr("");
      try {
        const res = await fetch(`/api/admin/site/pages/${page.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: page.title,
            slug: page.slug,
            body: page.body,
            enabled: page.enabled,
          }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          page?: CustomSitePage;
          error?: string;
        };
        if (!res.ok || !data.ok || !data.page) {
          setErr(data.error || "تعذّر تحديث الصفحة.");
          return;
        }
        setPages((list) =>
          list.map((p) => (p.id === data.page!.id ? data.page! : p)),
        );
        setEditingId(null);
        setMsg("تم تحديث الصفحة.");
        router.refresh();
      } catch {
        setErr("خطأ شبكة.");
      }
    });
  }

  function removePage(id: string) {
    if (!confirm("حذف هذه الصفحة نهائياً؟")) return;
    startTransition(async () => {
      setMsg("");
      setErr("");
      try {
        const res = await fetch(`/api/admin/site/pages/${id}`, {
          method: "DELETE",
        });
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          error?: string;
        };
        if (!res.ok || !data.ok) {
          setErr(data.error || "تعذّر الحذف.");
          return;
        }
        setPages((list) => list.filter((p) => p.id !== id));
        setMsg("حُذفت الصفحة.");
        router.refresh();
      } catch {
        setErr("خطأ شبكة.");
      }
    });
  }

  return (
    <div className="mt-6 space-y-8">
      {(msg || err) && (
        <p
          className={
            err
              ? "rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
              : "rounded-md border border-[rgba(14,52,53,0.12)] bg-[#FFFcf7] px-3 py-2 text-sm text-[#0E3435]"
          }
          role="status"
        >
          {err || msg}
        </p>
      )}

      <section className="space-y-4">
        <h2 className="text-xl font-bold text-[#0E3435]">الألوان والهوية</h2>
        <p className="text-sm leading-7 text-[rgba(14,52,53,0.7)]">
          تُحقَن كمتغيرات CSS على كل الصفحات. القيم الافتراضية تطابق هوية حكيم الحالية.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {THEME_FIELDS.map((f) => (
            <label key={f.key} className="block text-sm">
              <span className="mb-1 block font-semibold text-[#0E3435]">{f.label}</span>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={
                    /^#[0-9a-fA-F]{6}$/.test(config.theme[f.key])
                      ? config.theme[f.key]
                      : "#0E3435"
                  }
                  onChange={(e) => patchTheme(f.key, e.target.value)}
                  className="h-10 w-12 cursor-pointer rounded border border-[rgba(14,52,53,0.15)] bg-white"
                  aria-label={f.label}
                />
                <input
                  type="text"
                  value={config.theme[f.key]}
                  onChange={(e) => patchTheme(f.key, e.target.value)}
                  className="min-h-[44px] flex-1 rounded-md border border-[rgba(14,52,53,0.15)] bg-white px-3 font-mono text-sm"
                  dir="ltr"
                />
              </div>
            </label>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-bold text-[#0E3435]">نصوص الصفحة الرئيسية</h2>
        <div className="grid gap-3">
          {(
            [
              ["brandName", "اسم العلامة"],
              ["tagline", "الشعار الفرعي"],
              ["headline", "العنوان الرئيسي"],
              ["lede", "الفقرة التعريفية"],
              ["ctaPrimary", "زر أساسي"],
              ["ctaSecondary", "زر ثانوي"],
              ["footnote", "هامش تحت الأزرار"],
              ["disclaimer", "التنبيه المهني"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="block text-sm">
              <span className="mb-1 block font-semibold text-[#0E3435]">{label}</span>
              {key === "lede" || key === "disclaimer" || key === "footnote" ? (
                <textarea
                  value={config.home[key]}
                  onChange={(e) => patchHome(key, e.target.value)}
                  rows={key === "disclaimer" ? 3 : 2}
                  className="w-full rounded-md border border-[rgba(14,52,53,0.15)] bg-white px-3 py-2 text-sm leading-7"
                />
              ) : (
                <input
                  type="text"
                  value={config.home[key]}
                  onChange={(e) => patchHome(key, e.target.value)}
                  className="min-h-[44px] w-full rounded-md border border-[rgba(14,52,53,0.15)] bg-white px-3 text-sm"
                />
              )}
            </label>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-bold text-[#0E3435]">تفعيل الصفحات المدمجة</h2>
        <ul className="space-y-2">
          {BUILTIN_PAGE_META.map((p) => (
            <li
              key={p.key}
              className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-[rgba(14,52,53,0.1)] bg-[#FFFcf7] px-3 py-3"
            >
              <div>
                <p className="font-semibold text-[#0E3435]">{p.label}</p>
                <p className="text-xs text-[rgba(14,52,53,0.55)]" dir="ltr">
                  {p.path}
                </p>
              </div>
              <label className="inline-flex min-h-[44px] items-center gap-2 text-sm font-semibold text-[#0E3435]">
                <input
                  type="checkbox"
                  checked={config.pages[p.key] !== false}
                  onChange={(e) => togglePage(p.key, e.target.checked)}
                  className="h-4 w-4"
                />
                مفعّلة
              </label>
            </li>
          ))}
        </ul>
        <p className="text-xs leading-6 text-[rgba(14,52,53,0.55)]">
          إيقاف الصفحة يعيد 404 للزوار — مسارات الدخول ولوحة التحكم والإدارة لا تتأثر.
        </p>
      </section>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={saveConfig}
          className="inline-flex min-h-[44px] items-center rounded-md bg-[#0E3435] px-4 py-2 text-sm font-semibold text-[#FFFcf7] disabled:opacity-50"
        >
          حفظ الإعدادات
        </button>
        <a
          href="/"
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-[44px] items-center rounded-md border border-[rgba(14,52,53,0.15)] bg-white px-4 py-2 text-sm font-semibold text-[#0E3435]"
        >
          معاينة الرئيسية
        </a>
      </div>

      <section className="space-y-4 border-t border-[rgba(14,52,53,0.1)] pt-8">
        <h2 className="text-xl font-bold text-[#0E3435]">صفحات مخصّصة</h2>
        <p className="text-sm leading-7 text-[rgba(14,52,53,0.7)]">
          تُنشَر على <span dir="ltr">/p/&#123;slug&#125;</span> — نص عادي فقط (بلا HTML) لحماية الزوار.
        </p>

        <div className="space-y-3 rounded-md border border-[rgba(14,52,53,0.1)] bg-white p-4">
          <label className="block text-sm">
            <span className="mb-1 block font-semibold">العنوان</span>
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="min-h-[44px] w-full rounded-md border border-[rgba(14,52,53,0.15)] px-3"
              placeholder="مثال: عن المنصة"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-semibold">الرابط (اختياري)</span>
            <input
              value={newSlug}
              onChange={(e) => setNewSlug(e.target.value)}
              className="min-h-[44px] w-full rounded-md border border-[rgba(14,52,53,0.15)] px-3 font-mono"
              dir="ltr"
              placeholder="about"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-semibold">المحتوى</span>
            <textarea
              value={newBody}
              onChange={(e) => setNewBody(e.target.value)}
              rows={5}
              className="w-full rounded-md border border-[rgba(14,52,53,0.15)] px-3 py-2 leading-7"
            />
          </label>
          <button
            type="button"
            disabled={pending || !newTitle.trim()}
            onClick={createPage}
            className="inline-flex min-h-[44px] items-center rounded-md bg-[#0E3435] px-4 py-2 text-sm font-semibold text-[#FFFcf7] disabled:opacity-50"
          >
            إنشاء صفحة
          </button>
        </div>

        <ul className="space-y-3">
          {pages.length === 0 ? (
            <li className="text-sm text-[rgba(14,52,53,0.55)]">لا صفحات مخصّصة بعد.</li>
          ) : (
            pages.map((page) => {
              const editing = editingId === page.id;
              return (
                <li
                  key={page.id}
                  className="rounded-md border border-[rgba(14,52,53,0.1)] bg-[#FFFcf7] p-4"
                >
                  {editing ? (
                    <div className="space-y-2">
                      <input
                        value={page.title}
                        onChange={(e) =>
                          setPages((list) =>
                            list.map((p) =>
                              p.id === page.id
                                ? { ...p, title: e.target.value }
                                : p,
                            ),
                          )
                        }
                        className="min-h-[44px] w-full rounded-md border border-[rgba(14,52,53,0.15)] bg-white px-3"
                      />
                      <input
                        value={page.slug}
                        onChange={(e) =>
                          setPages((list) =>
                            list.map((p) =>
                              p.id === page.id
                                ? { ...p, slug: e.target.value }
                                : p,
                            ),
                          )
                        }
                        className="min-h-[44px] w-full rounded-md border border-[rgba(14,52,53,0.15)] bg-white px-3 font-mono"
                        dir="ltr"
                      />
                      <textarea
                        value={page.body}
                        onChange={(e) =>
                          setPages((list) =>
                            list.map((p) =>
                              p.id === page.id
                                ? { ...p, body: e.target.value }
                                : p,
                            ),
                          )
                        }
                        rows={4}
                        className="w-full rounded-md border border-[rgba(14,52,53,0.15)] bg-white px-3 py-2 leading-7"
                      />
                      <label className="inline-flex items-center gap-2 text-sm font-semibold">
                        <input
                          type="checkbox"
                          checked={page.enabled}
                          onChange={(e) =>
                            setPages((list) =>
                              list.map((p) =>
                                p.id === page.id
                                  ? { ...p, enabled: e.target.checked }
                                  : p,
                              ),
                            )
                          }
                        />
                        مفعّلة
                      </label>
                      <div className="flex flex-wrap gap-2 pt-1">
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => savePage(page)}
                          className="min-h-[40px] rounded-md bg-[#0E3435] px-3 text-sm font-semibold text-[#FFFcf7] disabled:opacity-50"
                        >
                          حفظ
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(null);
                            setPages(initialPages);
                          }}
                          className="min-h-[40px] rounded-md border border-[rgba(14,52,53,0.15)] bg-white px-3 text-sm font-semibold"
                        >
                          إلغاء
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-[#0E3435]">{page.title}</p>
                        <a
                          href={`/p/${page.slug}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-semibold text-[#8B6914]"
                          dir="ltr"
                        >
                          /p/{page.slug}
                        </a>
                        <p className="mt-1 text-xs text-[rgba(14,52,53,0.55)]">
                          {page.enabled ? "مفعّلة" : "متوقفة"}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingId(page.id)}
                          className="min-h-[40px] rounded-md border border-[rgba(14,52,53,0.15)] bg-white px-3 text-sm font-semibold"
                        >
                          تعديل
                        </button>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => removePage(page.id)}
                          className="min-h-[40px] rounded-md border border-red-200 bg-white px-3 text-sm font-semibold text-red-700 disabled:opacity-50"
                        >
                          حذف
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })
          )}
        </ul>
      </section>
    </div>
  );
}
