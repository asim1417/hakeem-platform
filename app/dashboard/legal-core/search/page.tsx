import Link from "next/link";
import { BookMarked, ChevronLeft, ChevronRight, ExternalLink, FileArchive, Search } from "lucide-react";
import { requirePagePermission } from "@/lib/modules/auth/session";
import { type ArabicSearchType } from "@/lib/modules/legal-core/arabic-morphology";
import { searchLegalCore } from "@/lib/modules/legal-core/legal-retrieval";
import { listAllSystems } from "@/lib/modules/library/library-service";
import { LegalCopyButton } from "@/components/LegalCopyButton";
import { LegalFavoriteButton } from "@/components/LegalFavoriteButton";
import { HighlightedSearchText, joinSearchTerms } from "@/components/SearchHighlight";
import { LegalCoreCard, LegalCoreFilterPanel, LegalCorePageHeader, LegalCoreShell, LegalTopicBadge } from "@/components/legal-core";

export const dynamic = "force-dynamic";

const searchTypes: Array<{ value: ArabicSearchType; label: string; hint: string }> = [
  { value: "contains", label: "ضمن النص", hint: "يبحث في النظام والمادة والنص والكلمات" },
  { value: "exact", label: "مطابق", hint: "يطابق العبارة كما كتبت" },
  { value: "derivatives", label: "اشتقاقات", hint: "يوسع البحث بمشتقات عربية محتملة" },
  { value: "root", label: "جذر", hint: "يستفيد من مرشحات الجذر" },
  { value: "stem", label: "ساق", hint: "يزيل بعض السوابق واللواحق" },
  { value: "affixes", label: "سوابق ولواحق", hint: "يعالج ال، و، ب، ل، ات، ون..." }
];

const legalCategories = [
  "مدني",
  "تجاري",
  "عمالي",
  "أحوال شخصية",
  "إثبات",
  "مرافعات",
  "تنفيذ",
  "شركات",
  "إفلاس",
  "تحكيم",
  "جزائي",
  "إداري",
  "زكوي وضريبي",
  "أوقاف",
  "عقاري"
];

const searchFields = [
  ["systemTitle", "عنوان النظام"],
  ["articleNumber", "رقم المادة"],
  ["title", "عنوان المادة"],
  ["content", "نص المادة"],
  ["keywords", "الكلمات المفتاحية"],
  ["classification", "التصنيف"]
];

export default async function LegalCoreSearchPage({
  searchParams
}: {
  searchParams: { q?: string; system?: string; systemIds?: string; category?: string; searchType?: string; sourceType?: string; fields?: string | string[]; page?: string };
}) {
  await requirePagePermission("LEGAL_CORE_VIEW");

  const query = searchParams.q ?? "";
  const selectedSystem = searchParams.systemIds ?? searchParams.system ?? "";
  const selectedCategory = searchParams.category ?? "";
  const selectedSourceType = searchParams.sourceType ?? "article";
  const selectedSearchType = normalizeSearchType(searchParams.searchType);
  const selectedFields = normalizeParamList(searchParams.fields);
  const page = Number(searchParams.page ?? 1);

  const [systems, response] = await Promise.all([
    listAllSystems(),
    searchLegalCore({
      query,
      searchType: selectedSearchType,
      systemIds: selectedSystem ? [selectedSystem] : undefined,
      categoryIds: selectedCategory ? [selectedCategory] : undefined,
      sourceTypes: selectedSourceType ? [selectedSourceType] : undefined,
      fields: selectedFields,
      page: Number.isFinite(page) ? page : 1,
      limit: 30,
      includeMatchedParagraphs: true,
      includeRelatedTerms: true,
      semantic: true
    }).catch(() => ({
      query,
      searchType: selectedSearchType,
      total: 0,
      exhaustive: true,
      page: 1,
      limit: 30,
      relatedTerms: [],
      results: [],
      message: "تعذر تنفيذ البحث القانوني حاليًا."
    }))
  ]);

  // ── ترقيم النتائج: يُتيح تصفّح **كل** النتائج (الإجماليّ الحقيقي + الترقيم العميق من النواة). ──
  const limit = 30;
  const totalPages = Math.max(1, Math.ceil(response.total / limit));
  const currentPage = Math.min(Math.max(Number.isFinite(page) ? page : 1, 1), totalPages);
  const firstShown = response.total === 0 ? 0 : (currentPage - 1) * limit + 1;
  const lastShown = Math.min(currentPage * limit, response.total);

  // يبني رابط صفحة مع الحفاظ على كل معاملات البحث الحالية.
  const pageHref = (p: number) => {
    const sp = new URLSearchParams();
    if (query) sp.set("q", query);
    sp.set("searchType", selectedSearchType);
    if (selectedSystem) sp.set("systemIds", selectedSystem);
    if (selectedCategory) sp.set("category", selectedCategory);
    if (selectedSourceType) sp.set("sourceType", selectedSourceType);
    for (const f of selectedFields) sp.append("fields", f);
    sp.set("page", String(p));
    return `/dashboard/legal-core/search?${sp.toString()}`;
  };

  return (
    <LegalCoreShell>
      <div className="space-y-7">
        <LegalCorePageHeader
          title="البحث القانوني المتقدم"
          description="القلب التشغيلي للنواة القانونية في حكيم: بحث مطابق، ضمن النص، بالاشتقاقات والجذر والساق والسوابق واللواحق، مع نتائج قابلة للاستشهاد ولا تأتي إلا من قاعدة البيانات."
          actions={
            <Link className="btn btn-gold" href="/dashboard/legal-core">
              <BookMarked size={16} />
              العودة للنواة القانونية
            </Link>
          }
        />

        <form action="/dashboard/legal-core/search" className="rounded-[var(--r-xl)] border border-[var(--gold-border)] bg-[var(--paper)] p-5 shadow-[var(--sh-xs)]">
          <div className="grid gap-3 xl:grid-cols-[1fr_220px_240px_auto]">
            <label className="relative">
              <Search className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--gold)]" />
              <input
                name="q"
                defaultValue={query}
                className="w-full rounded-[var(--r-md)] border border-[var(--ink-15)] bg-[var(--parchment)] py-3 pl-4 pr-12 leading-7 outline-none focus:border-[var(--gold)]"
                placeholder="مثال: فسخ العقد، التعويض، الإثبات، اختصاص المحكمة..."
              />
            </label>
            <select name="searchType" defaultValue={selectedSearchType} className="rounded-[var(--r-md)] border border-[var(--ink-15)] bg-[var(--parchment)] px-4 py-3 outline-none focus:border-[var(--gold)]">
              {searchTypes.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
            <select name="systemIds" defaultValue={selectedSystem} className="rounded-[var(--r-md)] border border-[var(--ink-15)] bg-[var(--parchment)] px-4 py-3 outline-none focus:border-[var(--gold)]">
              <option value="">كل الأنظمة</option>
              {systems.map((system) => (
                <option key={system.id} value={system.id}>
                  {system.name}
                </option>
              ))}
            </select>
            <button className="btn btn-gold min-w-[150px]" type="submit">
              <Search size={16} />
              بحث
            </button>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            <select name="category" defaultValue={selectedCategory} className="rounded-[var(--r-md)] border border-[var(--ink-15)] bg-[var(--parchment)] px-4 py-3 outline-none focus:border-[var(--gold)]">
              <option value="">كل الأقسام القانونية</option>
              {legalCategories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
            <select name="sourceType" defaultValue={selectedSourceType} className="rounded-[var(--r-md)] border border-[var(--ink-15)] bg-[var(--parchment)] px-4 py-3 outline-none focus:border-[var(--gold)]">
              <option value="article">مادة نظامية</option>
              <option value="hoqoqi_sql">مصدر حقوقي المستورد</option>
              <option value="explanation" disabled>شرح - لاحقًا</option>
              <option value="judgment" disabled>حكم - لاحقًا</option>
              <option value="comparative" disabled>قانون مقارن - لاحقًا</option>
            </select>
            <div className="rounded-[var(--r-md)] border border-[var(--ink-08)] bg-white/55 px-4 py-3 text-sm text-[var(--ink-60)]">
              نطاق البحث: {selectedFields.length ? selectedFields.map(fieldLabel).join("، ") : "كل الحقول القانونية"}
            </div>
          </div>

          <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {searchFields.map(([value, label]) => (
              <label key={value} className="flex items-center gap-2 rounded-[var(--r-md)] border border-[var(--ink-08)] bg-white/55 px-3 py-2 text-sm text-[var(--ink-70)]">
                <input name="fields" type="checkbox" value={value} defaultChecked={!selectedFields.length || selectedFields.includes(value)} />
                {label}
              </label>
            ))}
          </div>
        </form>

        <div className="grid gap-5 xl:grid-cols-[320px_1fr]">
          <LegalCoreFilterPanel>
            <FilterItem label="نوع البحث" value={searchTypes.find((item) => item.value === selectedSearchType)?.label ?? "ضمن النص"} />
            <FilterItem label="النظام" value={systems.find((system) => system.id === selectedSystem)?.name ?? "كل الأنظمة"} />
            <FilterItem label="القسم القانوني" value={selectedCategory || "كل الأقسام"} />
            <FilterItem label="نوع المصدر" value={selectedSourceType === "hoqoqi_sql" ? "حقوقي المستورد" : "مادة نظامية"} />
            <div className="rounded-[var(--r-md)] border border-[var(--gold-border)] bg-[var(--gold-ghost)] p-3">
              <p className="font-display-ar text-xs font-bold text-[var(--gold)]">خيارات لغوية</p>
              <p className="mt-1 text-sm leading-7 text-[var(--ink-70)]">
                المعالجة الحالية تطبيعية وقابلة للتطوير لاحقًا باستعمال جداول nouns و verbs عند استيراد حقوقي.
              </p>
            </div>
          </LegalCoreFilterPanel>

          <LegalCoreCard
            title="نتائج البحث"
            subtitle={
              response.total > limit
                ? `${response.total.toLocaleString("ar-SA")} نتيجة — عرض ${firstShown.toLocaleString("ar-SA")}–${lastShown.toLocaleString("ar-SA")}`
                : `${response.total.toLocaleString("ar-SA")} نتيجة مطابقة في قاعدة البيانات الحالية`
            }
          >
            <div className="mb-4 flex flex-wrap gap-2">
              <LegalTopicBadge tone="emerald">النتائج من legal_articles فقط</LegalTopicBadge>
              <LegalTopicBadge>لا توليد لمواد غير موجودة</LegalTopicBadge>
              {response.total > 0 ? (
                response.exhaustive === false ? (
                  <LegalTopicBadge tone="amber">استعلام واسع — ترتيب مُقرَّب</LegalTopicBadge>
                ) : (
                  <LegalTopicBadge tone="emerald">كل النتائج قابلة للتصفّح</LegalTopicBadge>
                )
              ) : null}
              {response.relatedTerms.length ? <LegalTopicBadge tone="amber">مصطلحات موسعة: {response.relatedTerms.slice(0, 5).join("، ")}</LegalTopicBadge> : null}
            </div>

            {response.results.length ? (
              <div className="space-y-4">
                {response.results.map((article) => {
                  const st = statusBadge(article.status);
                  return (
                  <article key={article.articleId} className="rounded-[var(--r-xl)] border border-[var(--ink-08)] bg-[var(--paper)] p-5 shadow-[var(--sh-xs)]">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-mono-legal text-sm text-[var(--gold)]">
                          {article.systemName} | المادة {article.articleNumber.toLocaleString("ar-SA")}
                        </p>
                        <h2 className="mt-2 font-display-ar text-lg font-bold text-[var(--navy)]">{article.articleTitle}</h2>
                        <p className="mt-1 text-xs text-[var(--ink-60)]">
                          {[article.classification, article.chapter].filter(Boolean).join(" | ") || "غير مصنف تفصيليًا"}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <LegalTopicBadge>{matchTypeLabel(article.matchType)}</LegalTopicBadge>
                        <LegalTopicBadge tone="emerald">مادة نظامية</LegalTopicBadge>
                        {st ? <LegalTopicBadge tone={st.tone}>{st.label}</LegalTopicBadge> : null}
                      </div>
                    </div>

                    <p className="mt-4 rounded-[var(--r-lg)] border border-[var(--ink-08)] bg-white/55 p-4 font-judicial text-lg leading-9 text-[var(--ink)]">
                      <HighlightedSearchText text={article.snippet} terms={joinSearchTerms(query, article.matchedTerms)} />
                    </p>

                    {article.matchedParagraphs.length ? (
                      <div className="mt-3 space-y-2">
                        <p className="font-display-ar text-xs font-bold text-[var(--gold)]">فقرات مطابقة</p>
                        {article.matchedParagraphs.slice(0, 2).map((paragraph, index) => (
                          <p key={`${article.articleId}-${index}`} className="rounded-[var(--r-md)] bg-[var(--gold-ghost)] p-3 text-sm leading-7 text-[var(--ink-70)]">
                            <HighlightedSearchText text={paragraph} terms={joinSearchTerms(query, article.matchedTerms)} />
                          </p>
                        ))}
                      </div>
                    ) : null}

                    <div className="mt-5 flex flex-wrap gap-2">
                      <Link className="btn btn-gold" href={article.internalUrl}>
                        <ExternalLink size={16} />
                        فتح المادة
                      </Link>
                      <LegalCopyButton text={article.citationLabel} label="نسخ الاستشهاد" />
                      <LegalFavoriteButton />
                      <LegalFavoriteButton label="إضافة النص كاملًا" />
                      <button className="btn btn-outline" type="button" title="سيتم ربط الملفات الداعمة عند تفعيل مستودع المرفقات للنواة القانونية.">
                        <FileArchive size={16} />
                        ملفات داعمة لاحقًا
                      </button>
                    </div>
                  </article>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-[var(--r-lg)] border border-dashed border-[var(--gold-border)] bg-[var(--gold-ghost)] p-6 text-center font-display-ar text-[var(--navy)]">
                {response.message ?? "لم يتم العثور على نتائج مطابقة في قاعدة البيانات الحالية."}
              </div>
            )}

            {totalPages > 1 ? (
              <nav className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--ink-08)] pt-4" aria-label="ترقيم النتائج">
                <p className="text-sm text-[var(--ink-60)]">
                  عرض {firstShown.toLocaleString("ar-SA")}–{lastShown.toLocaleString("ar-SA")} من {response.total.toLocaleString("ar-SA")}
                </p>
                <div className="flex items-center gap-2">
                  {currentPage > 1 ? (
                    <Link className="btn btn-outline" href={pageHref(currentPage - 1)}>
                      <ChevronRight size={16} /> السابق
                    </Link>
                  ) : (
                    <span className="btn btn-outline pointer-events-none opacity-40" aria-disabled="true">
                      <ChevronRight size={16} /> السابق
                    </span>
                  )}
                  <span className="px-2 text-sm text-[var(--ink-70)]">
                    صفحة {currentPage.toLocaleString("ar-SA")} من {totalPages.toLocaleString("ar-SA")}
                  </span>
                  {currentPage < totalPages ? (
                    <Link className="btn btn-outline" href={pageHref(currentPage + 1)}>
                      التالي <ChevronLeft size={16} />
                    </Link>
                  ) : (
                    <span className="btn btn-outline pointer-events-none opacity-40" aria-disabled="true">
                      التالي <ChevronLeft size={16} />
                    </span>
                  )}
                </div>
              </nav>
            ) : null}
          </LegalCoreCard>
        </div>
      </div>
    </LegalCoreShell>
  );
}

function FilterItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--r-md)] border border-[var(--ink-08)] bg-white/55 p-3">
      <p className="font-display-ar text-xs font-bold text-[var(--gold)]">{label}</p>
      <p className="mt-1 text-sm text-[var(--ink-70)]">{value}</p>
    </div>
  );
}

function normalizeSearchType(value?: string): ArabicSearchType {
  return searchTypes.some((item) => item.value === value) ? (value as ArabicSearchType) : "contains";
}

function normalizeParamList(value?: string | string[]) {
  if (!value) return [];
  return (Array.isArray(value) ? value : [value]).flatMap((item) => item.split(",")).map((item) => item.trim()).filter(Boolean);
}

function fieldLabel(field: string) {
  return searchFields.find(([value]) => value === field)?.[1] ?? field;
}

function matchTypeLabel(type: string) {
  const item = searchTypes.find((entry) => entry.value === type);
  return item?.label ?? "عام";
}

// شارة حالة المادة (نظير Citator): سارية/معدّلة/منسوخة/موقوفة. تُعرض فقط عند توفّر قيمة
// معروفة — القيم غير المعروفة تُترك بلا شارة تفادياً للتضليل (الحالة الكاملة على خارطة الطريق).
function statusBadge(status: string | null): { label: string; tone: "emerald" | "amber" | "ruby" } | null {
  if (!status) return null;
  const s = status.trim().toUpperCase();
  if (["ACTIVE", "IN_FORCE", "VALID", "سارية", "سار", "نافذ", "نافذة"].includes(s)) return { label: "سارية", tone: "emerald" };
  if (["AMENDED", "MODIFIED", "معدلة", "معدّلة", "معدل"].includes(s)) return { label: "معدّلة", tone: "amber" };
  if (["REPEALED", "CANCELLED", "CANCELED", "منسوخة", "ملغاة", "ملغي"].includes(s)) return { label: "منسوخة", tone: "ruby" };
  if (["SUSPENDED", "موقوفة", "معلقة"].includes(s)) return { label: "موقوفة", tone: "amber" };
  return null;
}
