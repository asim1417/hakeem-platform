"use client";

// محطة الفحص القانوني — هوية «أمان»
// ثلاثة ألواح: الفهرس والبحث يميناً، القراءة في الوسط، بطاقة الوثيقة وكياناتها وجودتها يساراً.
// كل ما يُعرض هنا مخرجات المصنّف الحتمي (lib/modules/document-inspection) — لا توليد ولا اختلاق.

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  analyzeDocuments,
  legalDocumentReference,
  normalizeForMatch,
  SAMPLE_CASE,
  SAMPLE_DOCUMENT_INPUTS,
  type AnalyzedDocument,
  type DocumentInput,
  type EntityKind,
  type QualityGrade,
  type TextSegment
} from "@/lib/modules/document-inspection";
import styles from "./workstation.module.css";

const STORAGE_KEY = "hakeem.document-inspection.imported.v1";

type FilterKey = "all" | "rulings" | "contracts" | "review";

const FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: "all", label: "الكل" },
  { key: "rulings", label: "أحكام" },
  { key: "contracts", label: "عقود" },
  { key: "review", label: "تحتاج مراجعة" }
];

const ENTITY_CLASS: Record<EntityKind, string> = {
  party: styles.eParty,
  amount: styles.eAmt,
  date: styles.eDate,
  law: styles.eLaw,
  deed: styles.eDeed
};

const SPINE_CLASS: Record<QualityGrade, string> = {
  high: styles.spineG,
  medium: styles.spineW,
  review: styles.spineR
};

function toArabicDigits(value: string | number): string {
  return String(value).replace(/[0-9]/g, (d) => "٠١٢٣٤٥٦٧٨٩"[Number(d)]);
}

function parseAmount(value: string): number {
  const ascii = value.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(/[,٬\s]/g, "");
  const parsed = Number(ascii);
  return Number.isFinite(parsed) ? parsed : 0;
}

function loadImported(): DocumentInput[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is DocumentInput =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as DocumentInput).title === "string" &&
        typeof (item as DocumentInput).rawText === "string"
    );
  } catch {
    return [];
  }
}

function matchesFilter(doc: AnalyzedDocument, filter: FilterKey): boolean {
  switch (filter) {
    case "all":
      return true;
    case "rulings":
      return doc.type.code === "HKM";
    case "contracts":
      return doc.type.code === "AQD" || doc.type.code === "WKL";
    case "review":
      return doc.quality.grade === "review";
  }
}

function paragraphClass(segments: TextSegment[]): string | undefined {
  const text = segments.map((s) => s.text).join("").trim();
  if (text === "بسم الله الرحمن الرحيم") return `${styles.pCenter}`;
  if (text.startsWith("المملكة العربية السعودية") && text.length < 120) return `${styles.pSub}`;
  return undefined;
}

function lifecycleStageOf(doc: AnalyzedDocument): string | null {
  const docType = legalDocumentReference.doc_types.find((t) => t.code === doc.type.code);
  return docType ? docType.lifecycle_stage : null;
}

const CheckIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M4 12l6 6L20 6" />
  </svg>
);

export function DocumentWorkstation() {
  const [imported, setImported] = useState<DocumentInput[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [showImport, setShowImport] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftText, setDraftText] = useState("");
  const [importError, setImportError] = useState<string | null>(null);

  useEffect(() => {
    setImported(loadImported());
    setHydrated(true);
  }, []);

  const docs = useMemo(
    () => analyzeDocuments([...SAMPLE_DOCUMENT_INPUTS, ...imported]),
    [imported]
  );
  const importedCodes = useMemo(
    () => new Set(docs.slice(SAMPLE_DOCUMENT_INPUTS.length).map((d) => d.code)),
    [docs]
  );

  const visibleDocs = useMemo(() => {
    const normalizedQuery = normalizeForMatch(query);
    return docs.filter((doc) => {
      if (!matchesFilter(doc, filter)) return false;
      if (!normalizedQuery) return true;
      return (
        normalizeForMatch(doc.title).includes(normalizedQuery) ||
        normalizeForMatch(doc.rawText).includes(normalizedQuery) ||
        doc.code.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [docs, filter, query]);

  const selected =
    docs.find((d) => d.code === selectedCode) ?? visibleDocs[0] ?? docs[0] ?? null;

  const stats = useMemo(() => {
    const deeds = new Set(
      docs.flatMap((d) => d.entities.filter((e) => e.kind === "deed").map((e) => normalizeForMatch(e.value)))
    );
    const maxAmount = Math.max(
      0,
      ...docs.flatMap((d) => d.entities.filter((e) => e.kind === "amount").map((e) => parseAmount(e.value)))
    );
    return {
      total: docs.length,
      deeds: deeds.size,
      maxAmountMillions: Math.round(maxAmount / 1_000_000),
      review: docs.filter((d) => d.quality.grade === "review").length
    };
  }, [docs]);

  function persist(next: DocumentInput[]) {
    setImported(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // التخزين المحلي غير متاح (وضع خاص) — تبقى الوثائق لهذه الجلسة فقط
    }
  }

  function handleImport(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = draftTitle.trim();
    const rawText = draftText.trim();
    if (!title || rawText.length < 20) {
      setImportError("أدخل عنواناً ونصاً لا يقل عن ٢٠ حرفاً.");
      return;
    }
    const next = [...imported, { title, rawText }];
    persist(next);
    const analyzed = analyzeDocuments([...SAMPLE_DOCUMENT_INPUTS, ...next]);
    const added = analyzed[analyzed.length - 1];
    setSelectedCode(added.code);
    setDraftTitle("");
    setDraftText("");
    setImportError(null);
    setShowImport(false);
  }

  function handleRemove(code: string) {
    const offset = docs.findIndex((d) => d.code === code) - SAMPLE_DOCUMENT_INPUTS.length;
    if (offset < 0) return;
    const next = imported.filter((_, i) => i !== offset);
    persist(next);
    if (selectedCode === code) setSelectedCode(null);
  }

  const qualityBadgeClass =
    selected?.quality.grade === "high" ? styles.qGood : selected?.quality.grade === "medium" ? styles.qWarn : styles.qRisk;

  const entityGroups = useMemo(() => {
    if (!selected) return null;
    const byKind = (kind: EntityKind) => selected.entities.filter((e) => e.kind === kind);
    return {
      parties: byKind("party"),
      amounts: byKind("amount"),
      dates: byKind("date"),
      laws: byKind("law"),
      deeds: byKind("deed")
    };
  }, [selected]);

  return (
    <div className={styles.root} dir="rtl">
      <div className={styles.topbar}>
        <div className={styles.topbarIn}>
          <div className={styles.brand}>
            <span className={styles.seal} aria-hidden="true">
              أ
            </span>
            <b>أمان</b>
            <span>· الفحص القانوني</span>
          </div>
          <nav className={styles.topnav} aria-label="روابط">
            <a href="#station">محطة العمل</a>
            <Link href="/dashboard">العودة إلى حكيم</Link>
          </nav>
        </div>
      </div>

      <header className={styles.cover}>
        <div className={styles.coverIn}>
          <span className={styles.eyebrow}>محطة فحص الوثائق — قراءة وفهرسة وتحقّق</span>
          <h1>ملف القضية، مقروءًا ومُفهرسًا ومُحقَّقًا</h1>
          <p className={styles.lede}>
            كل وثيقة لها كعبٌ في الفهرس، وختمُ تحقّقٍ نحاسي، ومؤشر جودةٍ ظاهر. التصنيف والترميز يجريان
            وفق المرجع التشغيلي المشتق من الدليل المرجعي للمستندات القانونية السعودية — بلا أي توليد.
          </p>
          <div className={styles.casebar} aria-label="بيانات القضية">
            <span className={styles.chip}>
              القضية <b className={styles.num}>{toArabicDigits(SAMPLE_CASE.number)}</b>
            </span>
            <span className={styles.chip}>{SAMPLE_CASE.subject}</span>
            <span className={styles.chip}>{SAMPLE_CASE.court}</span>
            <span className={`${styles.chip} ${styles.chipNote}`}>{SAMPLE_CASE.disclaimer}</span>
          </div>
          <div className={styles.stats} role="list">
            <div className={styles.stat} role="listitem">
              <div className={`${styles.statV} ${styles.num}`}>{toArabicDigits(stats.total)}</div>
              <div className={styles.statL}>وثيقة مُفهرسة</div>
            </div>
            <div className={styles.stat} role="listitem">
              <div className={`${styles.statV} ${styles.num}`}>{toArabicDigits(stats.deeds)}</div>
              <div className={styles.statL}>صكٌّ مرصود</div>
            </div>
            <div className={styles.stat} role="listitem">
              <div className={`${styles.statV} ${styles.num}`}>
                {toArabicDigits(stats.maxAmountMillions)}
                <small> مليون ر.س</small>
              </div>
              <div className={styles.statL}>أعلى مبلغ محل النزاع</div>
            </div>
            <div className={styles.stat} role="listitem">
              <div className={`${styles.statV} ${styles.num}`}>
                {toArabicDigits(stats.review)}
                <small> وثائق</small>
              </div>
              <div className={styles.statL}>تحتاج مراجعة</div>
            </div>
          </div>
        </div>
      </header>

      <main className={styles.wrap}>
        <div className={styles.sectionHead} id="station">
          <span className={styles.sectionK}>01</span>
          <h2>محطة العمل</h2>
          <p>ثلاثة ألواح: الفهرس والبحث يمينًا، القراءة في الوسط، بطاقة الوثيقة وكياناتها وجودتها يسارًا.</p>
        </div>

        <section className={styles.station} aria-label="محطة العمل">
          <aside className={styles.index} aria-label="فهرس الوثائق والبحث">
            <div className={styles.indexHd}>
              <h3>
                <span className={styles.dot} aria-hidden="true" /> فهرس القضية
              </h3>
              <div className={styles.search}>
                <span className={styles.searchIc} aria-hidden="true">
                  ⌕
                </span>
                <input
                  type="search"
                  aria-label="ابحث في وثائق القضية"
                  placeholder="ابحث في العناوين والنصوص والرموز…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
            </div>
            <div className={styles.filters} role="group" aria-label="تصفية">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  className={styles.pill}
                  aria-pressed={filter === f.key}
                  onClick={() => setFilter(f.key)}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className={styles.list} role="list">
              {visibleDocs.length === 0 ? (
                <p className={styles.emptyList}>لا وثائق مطابقة للبحث أو التصفية الحالية.</p>
              ) : (
                visibleDocs.map((doc) => (
                  <button
                    key={doc.code}
                    type="button"
                    role="listitem"
                    className={`${styles.leaf} ${selected?.code === doc.code ? styles.leafOn : ""}`}
                    aria-current={selected?.code === doc.code ? "true" : undefined}
                    onClick={() => setSelectedCode(doc.code)}
                  >
                    <span className={`${styles.spine} ${SPINE_CLASS[doc.quality.grade]}`} aria-hidden="true" />
                    <span className={styles.leafT}>
                      <h4>{doc.title}</h4>
                      <span className={styles.leafMeta}>
                        <span className={styles.leafType}>{doc.type.name}</span>
                        {doc.hijriDate ? (
                          <span className={styles.num}>{doc.hijriDate}</span>
                        ) : doc.quality.grade === "review" ? (
                          <span className={styles.leafRisk}>جودة منخفضة</span>
                        ) : null}
                        {importedCodes.has(doc.code) ? (
                          <span
                            className={styles.removeBtn}
                            role="button"
                            tabIndex={0}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemove(doc.code);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.stopPropagation();
                                handleRemove(doc.code);
                              }
                            }}
                          >
                            حذف
                          </span>
                        ) : null}
                      </span>
                    </span>
                    {doc.verified ? (
                      <span className={styles.verified} title="مُحقَّقة">
                        <CheckIcon />
                      </span>
                    ) : (
                      <span />
                    )}
                  </button>
                ))
              )}
            </div>
            <button type="button" className={styles.addBtn} onClick={() => setShowImport((v) => !v)}>
              {showImport ? "إغلاق نموذج الإضافة" : "+ إضافة وثيقة للفحص"}
            </button>
          </aside>

          <article className={styles.reader} aria-label="قارئ الوثيقة">
            {selected ? (
              <>
                <div className={styles.readerHd}>
                  <span className={styles.docid}>{selected.code}</span>
                  <h3>{selected.title}</h3>
                  <span className={`${styles.qBadge} ${qualityBadgeClass}`}>
                    جودة القراءة {toArabicDigits(selected.quality.score)}٪
                  </span>
                </div>
                <div className={styles.page}>
                  {selected.paragraphs.map((segments, pi) => (
                    <p key={pi} className={paragraphClass(segments)}>
                      {segments.map((segment, si) =>
                        segment.kind ? (
                          <mark key={si} className={ENTITY_CLASS[segment.kind]}>
                            {segment.text}
                          </mark>
                        ) : (
                          <span key={si}>{segment.text}</span>
                        )
                      )}
                    </p>
                  ))}
                </div>
              </>
            ) : (
              <div className={styles.page}>
                <p>اختر وثيقة من الفهرس لقراءتها.</p>
              </div>
            )}
          </article>

          <aside className={styles.inspector} aria-label="بطاقة الوثيقة وكياناتها">
            {selected && entityGroups ? (
              <>
                <div className={styles.card}>
                  <div className={styles.cardHd}>
                    <i aria-hidden="true" /> بطاقة التعريف
                  </div>
                  <div className={styles.kv}>
                    <span className={styles.kvK}>النوع</span>
                    <span className={styles.kvV}>{selected.type.name}</span>
                  </div>
                  <div className={styles.kv}>
                    <span className={styles.kvK}>الجهة</span>
                    <span className={styles.kvV}>{selected.issuer.name}</span>
                  </div>
                  <div className={styles.kv}>
                    <span className={styles.kvK}>الرمز الهرمي</span>
                    <span className={`${styles.kvV} ${styles.kvMono}`}>{selected.code}</span>
                  </div>
                  <div className={styles.kv}>
                    <span className={styles.kvK}>التاريخ</span>
                    <span className={`${styles.kvV} ${styles.num}`}>{selected.hijriDate ?? "غير مستخرَج"}</span>
                  </div>
                  {lifecycleStageOf(selected) ? (
                    <div className={styles.kv}>
                      <span className={styles.kvK}>المرحلة الإجرائية</span>
                      <span className={styles.kvV}>{lifecycleStageOf(selected)}</span>
                    </div>
                  ) : null}
                </div>

                <div className={styles.card}>
                  <div className={styles.cardHd}>
                    <i aria-hidden="true" /> الكيانات المستخرَجة
                  </div>
                  {entityGroups.parties.length > 0 ? (
                    <div className={styles.ent}>
                      <h4>الأطراف</h4>
                      <div className={styles.tags}>
                        {entityGroups.parties.map((e, i) => (
                          <span key={i} className={`${styles.tag} ${styles.tagParty}`}>
                            {e.value}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {entityGroups.amounts.length + entityGroups.dates.length > 0 ? (
                    <div className={styles.ent}>
                      <h4>المبالغ · التواريخ</h4>
                      <div className={styles.tags}>
                        {entityGroups.amounts.map((e, i) => (
                          <span key={`a${i}`} className={`${styles.tag} ${styles.tagAmt} ${styles.num}`}>
                            {e.value} ر.س
                          </span>
                        ))}
                        {entityGroups.dates.map((e, i) => (
                          <span key={`d${i}`} className={`${styles.tag} ${styles.tagDate} ${styles.num}`}>
                            {e.value}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {entityGroups.laws.length + entityGroups.deeds.length > 0 ? (
                    <div className={styles.ent}>
                      <h4>الأنظمة · الصكوك</h4>
                      <div className={styles.tags}>
                        {entityGroups.laws.map((e, i) => (
                          <span key={`l${i}`} className={`${styles.tag} ${styles.tagLaw}`}>
                            {e.value}
                          </span>
                        ))}
                        {entityGroups.deeds.map((e, i) => (
                          <span key={`k${i}`} className={`${styles.tag} ${styles.tagLaw} ${styles.num}`}>
                            صك {e.value}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {selected.topics.length > 0 ? (
                    <div className={styles.ent}>
                      <h4>موضوعات المكنز</h4>
                      <div className={styles.tags}>
                        {selected.topics.map((topic) => (
                          <span key={topic} className={styles.tag}>
                            {topic}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {selected.entities.length === 0 ? (
                    <div className={styles.ent}>
                      <h4>لا كيانات مستخرَجة من هذا النص</h4>
                    </div>
                  ) : null}
                </div>

                <div className={styles.card}>
                  <div className={styles.cardHd}>
                    <i aria-hidden="true" /> مؤشر الجودة
                  </div>
                  <div className={styles.qmeter}>
                    <div className={styles.qRow}>
                      <span>درجة القراءة</span>
                      <span className={styles.num}>
                        {toArabicDigits(selected.quality.score)} / ١٠٠
                      </span>
                    </div>
                    <div className={styles.bar}>
                      <div
                        className={`${styles.fill} ${
                          selected.quality.grade === "high"
                            ? styles.fillG
                            : selected.quality.grade === "medium"
                              ? styles.fillW
                              : styles.fillR
                        }`}
                        style={{ width: `${selected.quality.score}%` }}
                      />
                    </div>
                    <div
                      className={`${styles.grade} ${
                        selected.quality.grade === "high"
                          ? styles.gradeG
                          : selected.quality.grade === "medium"
                            ? styles.gradeW
                            : styles.gradeR
                      }`}
                    >
                      تقدير: {selected.quality.label}
                    </div>
                  </div>
                </div>

                <div className={styles.card}>
                  <div className={styles.cardHd}>
                    <i aria-hidden="true" /> التحقّق من الأصالة
                  </div>
                  <div className={`${styles.verifyState} ${selected.verified ? styles.gradeG : styles.gradeW}`}>
                    {selected.verified ? "مُتحقَّق عبر منصة الجهة" : "لم يُتحقَّق بعد"}
                  </div>
                  <ol className={styles.verifyList}>
                    {legalDocumentReference.verification.steps.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                </div>
              </>
            ) : null}
          </aside>
        </section>

        {showImport ? (
          <section className={styles.importPanel} aria-label="إضافة وثيقة">
            <h3>إضافة وثيقة للفحص</h3>
            <p>
              الصق نص الوثيقة كما هو — يُصنَّف النوع والجهة وتُستخرج الكيانات ويُولَّد الرمز الهرمي فوريًا في
              متصفحك، دون إرسال النص إلى أي خادم. {hydrated ? "تُحفظ الوثائق المضافة محليًا في جهازك فقط." : ""}
            </p>
            <form onSubmit={handleImport}>
              <label className={styles.field}>
                <span>عنوان الوثيقة</span>
                <input
                  type="text"
                  value={draftTitle}
                  onChange={(e) => setDraftTitle(e.target.value)}
                  placeholder="مثال: صك حكم — نزاع تنفيذ عقد توريد"
                />
              </label>
              <label className={styles.field}>
                <span>نص الوثيقة (يشمل الترويسة إن وجدت)</span>
                <textarea
                  rows={7}
                  value={draftText}
                  onChange={(e) => setDraftText(e.target.value)}
                  placeholder="المملكة العربية السعودية · وزارة العدل · …"
                />
              </label>
              <div className={styles.importActions}>
                <button type="submit" className={styles.primaryBtn}>
                  فحص وإضافة إلى الفهرس
                </button>
                <button
                  type="button"
                  className={styles.ghostBtn}
                  onClick={() => {
                    setShowImport(false);
                    setImportError(null);
                  }}
                >
                  إلغاء
                </button>
                {importError ? <span className={styles.importHint}>{importError}</span> : null}
              </div>
            </form>
          </section>
        ) : null}
      </main>

      <footer className={styles.footer}>
        <div>
          محطة الفحص القانوني · هوية <b>أمان</b> البصرية — ضمن منصة حكيم
        </div>
        <p className={styles.legal}>
          جميع الأسماء والأرقام والمبالغ في وثائق العينة افتراضية لأغراض العرض فقط، ولا تمثل قضية حقيقية.
          <br />
          كل مخرجات المحطة «مساعدة آلية تحتاج مراجعة المحامي»، وليست رأيًا قانونيًا نهائيًا، ولا تدّعي المنظومة
          التحقّق من الأصالة بذاتها.
        </p>
      </footer>
    </div>
  );
}
