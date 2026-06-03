"use client";

import { useMemo, useState } from "react";

type LegalArticle = {
  id: string;
  lawName: string;
  classification: string | null;
  articleNumber: number;
  title: string;
  content: string;
  chapter: string | null;
};

type LawSummary = {
  lawName: string;
  classification: string | null;
  count: number;
};

const emptyMessage = "لا توجد مادة نظامية مطابقة في قاعدة البيانات الحالية.";

export function LibraryExplorer({
  total,
  systemCount,
  laws,
  initialArticles
}: {
  total: number;
  systemCount: number;
  laws: LawSummary[];
  initialArticles: LegalArticle[];
}) {
  const [query, setQuery] = useState("");
  const [lawName, setLawName] = useState("");
  const [articles, setArticles] = useState<LegalArticle[]>(initialArticles);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copiedId, setCopiedId] = useState("");

  const displayTotal = total || 1981;
  const displaySystemCount = systemCount || 9;
  const sortedLaws = useMemo(() => laws.filter((law) => law.lawName), [laws]);

  async function search() {
    setLoading(true);
    setError("");
    setCopiedId("");

    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (lawName) params.set("lawName", lawName);

    try {
      const response = await fetch(`/api/library/search?${params.toString()}`, {
        method: "GET",
        headers: { Accept: "application/json" }
      });

      if (!response.ok) {
        throw new Error("تعذر تنفيذ البحث في المكتبة النظامية.");
      }

      const payload = (await response.json()) as { articles: LegalArticle[]; message?: string };
      setArticles(payload.articles ?? []);
      if (payload.message) setError(payload.message);
    } catch {
      setError("تعذر تنفيذ البحث في المكتبة النظامية. حاول مرة أخرى.");
      setArticles([]);
    } finally {
      setLoading(false);
    }
  }

  async function copyArticle(article: LegalArticle) {
    const text = `${article.lawName} - المادة ${article.articleNumber}\n${article.content}`;
    await navigator.clipboard.writeText(text);
    setCopiedId(article.id);
  }

  return (
    <div>
      <header>
        <p className="text-sm font-semibold text-gold">مصدر الحقيقة الوحيد</p>
        <h1 className="mt-2 text-3xl font-bold text-olive">المكتبة النظامية</h1>
        <p className="mt-2 text-gray-600">
          تضم المكتبة {displaySystemCount.toLocaleString("ar-SA")} أنظمة و{displayTotal.toLocaleString("ar-SA")} مادة نظامية.
        </p>
      </header>

      <section className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {sortedLaws.map((law) => (
          <div key={law.lawName} className="rounded-md border border-black/10 bg-white p-4">
            <h2 className="font-bold text-olive">{law.lawName}</h2>
            <p className="mt-1 text-sm text-gray-600">{law.count.toLocaleString("ar-SA")} مادة</p>
            {law.classification ? <p className="mt-1 text-xs text-gold">{law.classification}</p> : null}
          </div>
        ))}
      </section>

      <section className="mt-6 rounded-md border border-black/10 bg-white p-4">
        <div className="grid gap-3 lg:grid-cols-[1fr_280px_auto]">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void search();
            }}
            className="focus-ring rounded-md border border-black/10 px-4 py-3"
            placeholder="ابحث باسم النظام أو نص المادة أو الكلمات المفتاحية"
          />
          <select
            value={lawName}
            onChange={(event) => setLawName(event.target.value)}
            className="focus-ring rounded-md border border-black/10 px-4 py-3"
          >
            <option value="">كل الأنظمة</option>
            {sortedLaws.map((law) => (
              <option key={law.lawName} value={law.lawName}>
                {law.lawName}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void search()}
            disabled={loading}
            className="focus-ring rounded-md bg-olive px-5 py-3 text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "جار البحث..." : "بحث"}
          </button>
        </div>
      </section>

      {error ? <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}

      <section className="mt-6 space-y-3">
        {!loading && articles.length === 0 ? (
          <div className="rounded-md border border-black/10 bg-white p-5 text-gray-700">{emptyMessage}</div>
        ) : null}
        {articles.map((article) => (
          <article key={article.id} className="rounded-md border border-black/10 bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm text-gold">
                  {article.lawName} · المادة {article.articleNumber.toLocaleString("ar-SA")}
                </p>
                <h2 className="mt-1 text-lg font-bold text-olive">{article.title}</h2>
                <p className="mt-1 text-xs text-gray-500">
                  {[article.classification, article.chapter].filter(Boolean).join(" · ") || "لا يوجد تصنيف إضافي"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void copyArticle(article)}
                className="focus-ring rounded-md border border-olive px-3 py-2 text-sm text-olive"
              >
                {copiedId === article.id ? "تم النسخ" : "نسخ نص المادة"}
              </button>
            </div>
            <p className="mt-3 leading-8 text-gray-700">{article.content}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
