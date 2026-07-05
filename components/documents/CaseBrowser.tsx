"use client";

// منصة الوثائق — واجهة تصفّح مستقلة (تستخدم البنية للنشر فقط).
// التحليل كله محلي في المتصفح؛ الحفظ الدائم اختياري عبر «قضاياي» (قاعدة بيانات المنصة).
// كل التبويبات والجداول تُشتق آلياً من كيانات المصنّف الحتمي — لا بيانات مثبّتة.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  analyzeDocuments,
  buildBm25Index,
  buildMorphLexicon,
  buildStemFamilies,
  bm25Score,
  computeFrequencies,
  computeTermStats,
  convertDateApprox,
  findRanges,
  highlightNeedles,
  isBoilerplateLine,
  legalDocumentReference,
  lightStem,
  matchDoc,
  fixReversedArabicLines,
  normStr,
  occurrences,
  extractKeyFields,
  parseQuery,
  queryStems,
  segmentDocument,
  setMorphLexicon,
  suspectWords,
  type AnalyzedDocument,
  type DocumentInput,
  type ParsedQuery
} from "@/lib/modules/document-inspection";
import { extractFromFile } from "@/lib/modules/document-inspection/file-extract";
import {
  ClipboardIcon,
  FlagIcon,
  FolderIcon,
  LockIcon,
  NoteIcon,
  SaveIcon,
  ScanIcon,
  SparkIcon,
  TableIcon,
  TagIcon,
  TrashIcon,
  UploadIcon
} from "@/components/ui/HakeemIcons";
import { isImageExtension } from "@/lib/modules/document-inspection/ocr";
import styles from "./casebrowser.module.css";

type ThemeKey = "" | "dark" | "paper";
type SortKey = "relevance" | "none" | "date" | "title" | "type";
type ViewKey =
  | "docs"
  | "quotes"
  | "timeline"
  | "deeds"
  | "amounts"
  | "laws"
  | "milestones"
  | "stats"
  | "terms"
  | "freq";

const VIEWS: Array<{ key: ViewKey; label: string }> = [
  { key: "docs", label: "المستندات" },
  { key: "quotes", label: "المقتطفات" },
  { key: "timeline", label: "الخط الزمني" },
  { key: "deeds", label: "الصكوك" },
  { key: "amounts", label: "المبالغ" },
  { key: "laws", label: "الأنظمة" },
  { key: "milestones", label: "المحطات" },
  { key: "stats", label: "إحصاءات" },
  { key: "terms", label: "المصطلحات" },
  { key: "freq", label: "الأكثر تكراراً" }
];

const FLAG_OPTIONS = ["مهم", "روجع", "يحتاج مراجعة"];

interface Quote {
  text: string;
  code: string;
  title: string;
  date: string;
}

interface LockedPayload {
  locked: true;
  salt: string;
  iv: string;
  ct: string;
}

function esc(s: string): string {
  return (s || "").replace(/[&<>]/g, (c) => (({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }) as Record<string, string>)[c]);
}

function reEsc(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function csvCell(s: string): string {
  return `"${String(s ?? "").replace(/"/g, '""')}"`;
}

function download(name: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function b64(u: ArrayBuffer | Uint8Array): string {
  const arr = u instanceof Uint8Array ? u : new Uint8Array(u);
  let s = "";
  for (let i = 0; i < arr.length; i += 1) s += String.fromCharCode(arr[i]);
  return btoa(s);
}

function b64d(s: string): Uint8Array {
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}

async function deriveKey(password: string, salt: Uint8Array, usage: KeyUsage): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const km = await crypto.subtle.importKey("raw", enc.encode(password), { name: "PBKDF2" }, false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: 150000, hash: "SHA-256" },
    km,
    { name: "AES-GCM", length: 256 },
    false,
    [usage]
  );
}

// ── تلوين النص: كيانات + مصطلحات + كلمات غير واضحة (منقول من v2) ──

interface ColorizeOptions {
  color: boolean;
  susp: boolean;
  terms: boolean;
}

function makeColorizer(
  doc: AnalyzedDocument,
  opts: ColorizeOptions,
  stemToTerm: Map<string, { term: string; category: string }>,
  suspSet: Set<string>,
  lightStemFn: (w: string) => string
): (escaped: string) => string {
  const termsOn = opts.terms && stemToTerm.size > 0;
  const suspOn = opts.susp && suspSet.size > 0;
  if (!opts.color && !suspOn && !termsOn) return (s) => s;
  const names = opts.color
    ? doc.entities
        .filter((e) => e.kind === "party")
        .map((e) => reEsc(esc(e.value)))
        .sort((a, b) => b.length - a.length)
    : [];
  const nameAlt = names.length ? names.join("|") : "(?!)";
  const re = new RegExp(
    `(${nameAlt})` +
      `|((?:[٠-٩]|\\d)[٠-٩\\d.,٬]*\\s*(?:ريال|ر\\.?س|مليون|مليار|ألف|الف|﷼))` +
      `|(\\d{1,2}\\s*[/\\-]\\s*\\d{1,2}\\s*[/\\-]\\s*\\d{2,4}|[٠-٩\\d]{3,4}\\s*[/\\-]\\s*[٠-٩\\d]{1,2}\\s*[/\\-]\\s*[٠-٩\\d]{1,2}|\\d{3,4}\\s*هـ|\\d{4}\\s*م)` +
      `|((?:[٠-٩]|\\d){6,})` +
      `|([ء-ي]{2,})`,
    "g"
  );
  return (s) =>
    s.replace(re, (m, party, amt, date, num, word) => {
      if (word !== undefined && word !== "") {
        const nw = normStr(word);
        if (termsOn) {
          const hit = stemToTerm.get(lightStemFn(nw));
          if (hit) return `<mark class="${styles.term}" title="مصطلح مفتاحي: ${esc(hit.category)}">${m}</mark>`;
        }
        if (suspOn && suspSet.has(nw)) {
          return `<u class="${styles.susp}" title="كلمة غير واضحة — تحتاج مراجعة">${m}</u>`;
        }
        return m;
      }
      if (!opts.color) return m;
      const cls = party ? styles.eParty : amt ? styles.eAmt : date ? styles.eDate : styles.eNum;
      return `<span class="${cls}">${m}</span>`;
    });
}

function renderDocHtml(
  doc: AnalyzedDocument,
  needles: string[],
  colorize: (escaped: string) => string
): string {
  const text = doc.rawText || "(لا يوجد نص)";
  const ranges = findRanges(text, needles);
  let out = "";
  let k = 0;
  for (let c = 0; c < text.length; ) {
    if (k < ranges.length && c === ranges[k][0]) {
      out += `<mark>${esc(text.slice(ranges[k][0], ranges[k][1]))}</mark>`;
      c = ranges[k][1];
      k += 1;
    } else {
      const nextStart = k < ranges.length ? ranges[k][0] : text.length;
      out += colorize(esc(text.slice(c, nextStart)));
      c = nextStart;
    }
  }
  const lines = out.split("\n");
  const rawLines = text.split("\n");
  return lines
    .map((l, i) => {
      const raw = (rawLines[i] ?? "").trim();
      if (/^\[\s*صفح[ةه]\s*\d+\s*\]/.test(raw)) {
        return `<div style="text-align:center;color:var(--mut);font-size:12px;border-top:1px dashed var(--line);margin:12px 0 6px;padding-top:5px">${esc(raw.replace(/^\[\s*|\s*\]$/g, ""))}</div>`;
      }
      const boiler = isBoilerplateLine(raw) ? " boiler" : "";
      return `<div class="ln${boiler}"><span class="lno">${i + 1}</span><span class="lc">${l}</span></div>`;
    })
    .join("");
}

/** التاريخ الهجري أولاً (أم القرى) والميلادي مسانداً — وفق دليل الهوية */
function formatHijri(iso: string): string {
  try {
    return new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura", { dateStyle: "medium" }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

export function CaseBrowser() {
  // الوثائق: تعيش في ذاكرة الجلسة فقط
  const [inputs, setInputs] = useState<DocumentInput[]>([]);
  const docs = useMemo(() => analyzeDocuments(inputs), [inputs]);

  // تفضيلات القراءة
  const [fontSize, setFontSize] = useState(18);
  const [lineHeight, setLineHeight] = useState(1.9);
  const [fontFamily, setFontFamily] = useState(
    "'Traditional Arabic','Simplified Arabic','Arabic Typesetting','Amiri',serif"
  );
  const [justify, setJustify] = useState(true);
  const [reading, setReading] = useState(false);
  const [theme, setTheme] = useState<ThemeKey>("");
  const [showLines, setShowLines] = useState(false);
  const [hideHdr, setHideHdr] = useState(false);

  // البحث والتصفية
  const [query, setQuery] = useState("");
  const [rootOn, setRootOn] = useState(true);
  const [morphReady, setMorphReady] = useState(false);
  const [colorOn, setColorOn] = useState(true);
  const [suspOn, setSuspOn] = useState(true);
  const [termsOn, setTermsOn] = useState(true);
  const [typeFilter, setTypeFilter] = useState("");
  const [sort, setSort] = useState<SortKey>("relevance");
  const [grouped, setGrouped] = useState(false);
  const [onlyFlagged, setOnlyFlagged] = useState(false);
  const [allResults, setAllResults] = useState(false);

  // الحالة التفاعلية (ذاكرة الجلسة)
  const [currentCode, setCurrentCode] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [flags, setFlags] = useState<Map<string, string>>(new Map());
  const [notes, setNotes] = useState<Map<string, string>>(new Map());
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [view, setView] = useState<ViewKey>("docs");
  const [compare, setCompare] = useState<[string, string] | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportScope, setExportScope] = useState<"selected" | "match" | "all">("selected");
  const [includeText, setIncludeText] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftText, setDraftText] = useState("");
  const [copied, setCopied] = useState("");
  const [markIdx, setMarkIdx] = useState(-1);
  const [markCount, setMarkCount] = useState(0);

  // «قضاياي» — الحفظ الدائم في قاعدة بيانات المنصة (اختياري)
  const [savedCases, setSavedCases] = useState<Array<{ id: string; title: string; docCount: number; updatedAt: string }>>([]);
  const [casesOpen, setCasesOpen] = useState(false);
  const [loadedCaseId, setLoadedCaseId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [fileBusy, setFileBusy] = useState(false);
  const [ocrProgress, setOcrProgress] = useState("");
  // القراءة السحابية (Gemini) — مفتاح مركزي واحد وتفضيل موحّد مع البحث السريع (نفس الكوكي)
  const [cloudAvail, setCloudAvail] = useState(false);
  const [cloudOcrOn, setCloudOcrOn] = useState(false);

  // Google Drive
  const [driveConfigured, setDriveConfigured] = useState(false);
  const [driveConnected, setDriveConnected] = useState(false);
  const [driveOpen, setDriveOpen] = useState(false);
  const [driveFiles, setDriveFiles] = useState<Array<{ id: string; name: string; mimeType: string }>>([]);
  const [driveQuery, setDriveQuery] = useState("");
  const [driveBusy, setDriveBusy] = useState(false);

  const pendingMark = useRef<number | "first" | "last">("first");
  const txtRef = useRef<HTMLDivElement | null>(null);
  const mainRef = useRef<HTMLElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const selpopRef = useRef<HTMLButtonElement | null>(null);

  // ── الفهارس المشتقة ──
  const haystacks = useMemo(() => docs.map((d) => normStr(`${d.title} \n ${d.rawText}`)), [docs]);
  const families = useMemo(() => buildStemFamilies(docs), [docs]);
  const bm25 = useMemo(() => buildBm25Index(haystacks), [haystacks]);
  const termStats = useMemo(() => computeTermStats(docs), [docs]);
  const freq = useMemo(() => computeFrequencies(docs), [docs]);
  const suspByDoc = useMemo(() => docs.map((d) => suspectWords(d.rawText)), [docs]);

  const parsed: ParsedQuery = useMemo(() => parseQuery(query.trim()), [query]);
  const fams = rootOn ? families : null;

  // المعجم الصرفي (جذر→صيغ) يُحمَّل مرّة من public/doc-lexicon.json ويُفعّل التوسعة الصرفية للبحث.
  useEffect(() => {
    let cancelled = false;
    fetch("/doc-lexicon.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((json: { roots?: Record<string, string[]> } | null) => {
        if (cancelled || !json?.roots) return;
        setMorphLexicon(buildMorphLexicon(json.roots));
        setMorphReady(true);
      })
      .catch(() => {
        /* البحث يعمل بالتجذيع الخفيف دون المعجم إن تعذّر الجلب */
      });
    return () => {
      cancelled = true;
      setMorphLexicon(null);
    };
  }, []);

  const filtered = useMemo(() => {
    let list = docs.filter((d, i) => {
      if (typeFilter && d.type.name !== typeFilter) return false;
      if (onlyFlagged && !flags.has(d.code)) return false;
      if (parsed.empty) return true;
      return matchDoc(parsed, haystacks[i], fams);
    });
    if (sort === "relevance" && !parsed.empty) {
      const stems = queryStems(parsed);
      if (stems.length) {
        const scores = new Map(list.map((d) => [d.code, bm25Score(bm25, docs.indexOf(d), stems)]));
        list = [...list].sort((a, b) => (scores.get(b.code) ?? 0) - (scores.get(a.code) ?? 0));
      }
    } else if (sort === "date") list = [...list].sort((a, b) => (a.hijriDate ?? "").localeCompare(b.hijriDate ?? ""));
    else if (sort === "title") list = [...list].sort((a, b) => a.title.localeCompare(b.title, "ar"));
    else if (sort === "type") list = [...list].sort((a, b) => a.type.name.localeCompare(b.type.name, "ar"));
    return list;
  }, [docs, haystacks, parsed, fams, typeFilter, onlyFlagged, sort, bm25, flags, morphReady]);

  const current = docs.find((d) => d.code === currentCode) ?? null;
  const needles = useMemo(() => (parsed.empty ? [] : highlightNeedles(parsed, fams)), [parsed, fams, morphReady]);

  const types = useMemo(() => {
    const m = new Map<string, number>();
    docs.forEach((d) => m.set(d.type.name, (m.get(d.type.name) ?? 0) + 1));
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0], "ar"));
  }, [docs]);

  // ── نص الوثيقة المعروضة ──
  const docHtml = useMemo(() => {
    if (!current) return "";
    const di = docs.indexOf(current);
    const colorize = makeColorizer(
      current,
      { color: colorOn, susp: suspOn, terms: termsOn },
      termStats.stemToTerm,
      suspByDoc[di] ?? new Set(),
      lightStem
    );
    return renderDocHtml(current, needles, colorize);
  }, [current, docs, needles, colorOn, suspOn, termsOn, termStats, suspByDoc]);

  // تنقّل المطابقات
  const collectMarks = useCallback((): HTMLElement[] => {
    if (!txtRef.current) return [];
    return Array.from(txtRef.current.querySelectorAll("mark")).filter(
      (m) => !m.classList.contains(styles.term)
    ) as HTMLElement[];
  }, []);

  const gotoMark = useCallback(
    (i: number) => {
      const marks = collectMarks();
      if (!marks.length) return;
      setMarkIdx(((i % marks.length) + marks.length) % marks.length);
    },
    [collectMarks]
  );

  useEffect(() => {
    const marks = collectMarks();
    setMarkCount(marks.length);
    if (marks.length) {
      const p = pendingMark.current;
      const target = typeof p === "number" ? Math.min(p, marks.length - 1) : p === "last" ? marks.length - 1 : 0;
      setMarkIdx(target);
    } else setMarkIdx(-1);
    pendingMark.current = "first";
  }, [docHtml, collectMarks]);

  // إبراز المطابقة الحالية بلون مستقل (برتقالي) — يُعاد تطبيقه بعد أي إعادة بناء لنصّ القارئ،
  // لأن التظليل يُحقَن عبر innerHTML فتُستبدل عُقَد <mark> ويُمحى الصنف المُضاف يدوياً.
  useEffect(() => {
    const marks = collectMarks();
    if (!marks.length || markIdx < 0) return;
    const idx = Math.min(markIdx, marks.length - 1);
    marks.forEach((m) => m.classList.remove(styles.cur));
    marks[idx].classList.add(styles.cur);
  }, [markIdx, docHtml, collectMarks]);

  // التمرير إلى المطابقة الحالية عند التنقّل فقط (لا عند كل إعادة رسم)
  useEffect(() => {
    const marks = collectMarks();
    if (marks.length && markIdx >= 0) {
      marks[Math.min(markIdx, marks.length - 1)].scrollIntoView({ block: "center" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markIdx]);

  const openDoc = useCallback((code: string, at: number | "first" | "last" = "first") => {
    pendingMark.current = at;
    setCompare(null);
    setCurrentCode(code);
    if (mainRef.current) mainRef.current.scrollTop = 0;
  }, []);

  // فتح أول نتيجة عند تغيّر البحث
  useEffect(() => {
    if (parsed.empty) return;
    const t = setTimeout(() => {
      if (!filtered.length) return;
      const stillMatches = current && filtered.some((d) => d.code === current.code);
      if (!stillMatches) openDoc(filtered[0].code);
    }, 160);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, rootOn]);

  const navNext = useCallback(() => {
    if (markCount && markIdx < markCount - 1) return gotoMark(markIdx + 1);
    if (filtered.length < 2) return gotoMark(0);
    const i = filtered.findIndex((d) => d.code === currentCode);
    openDoc(filtered[(i + 1 + filtered.length) % filtered.length].code, "first");
  }, [markCount, markIdx, filtered, currentCode, gotoMark, openDoc]);

  const navPrev = useCallback(() => {
    if (markCount && markIdx > 0) return gotoMark(markIdx - 1);
    if (filtered.length < 2) return gotoMark(markCount - 1);
    const i = filtered.findIndex((d) => d.code === currentCode);
    openDoc(filtered[(i - 1 + filtered.length) % filtered.length].code, "last");
  }, [markCount, markIdx, filtered, currentCode, gotoMark, openDoc]);

  // اختصارات لوحة المفاتيح: / بحث · n/N مطابقة · r قراءة · j/k تنقّل
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName ?? "";
      if (/INPUT|TEXTAREA|SELECT/.test(tag)) return;
      if (e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key === "n") gotoMark(markIdx + 1);
      else if (e.key === "N") gotoMark(markIdx - 1);
      else if (e.key === "r") setReading((v) => !v);
      else if (e.key === "j" || e.key === "k") {
        if (!filtered.length) return;
        let i = filtered.findIndex((d) => d.code === currentCode);
        i = e.key === "j" ? Math.min(filtered.length - 1, i + 1) : Math.max(0, i - 1);
        if (filtered[i]) openDoc(filtered[i].code);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [filtered, currentCode, markIdx, gotoMark, openDoc]);

  // ── المقتطفات: تحديد نص → حفظ ──
  useEffect(() => {
    const onUp = () => {
      const pop = selpopRef.current;
      if (!pop) return;
      const sel = window.getSelection();
      const txt = sel?.toString().trim() ?? "";
      if (txt && txt.length > 1 && current && txtRef.current && sel && txtRef.current.contains(sel.anchorNode)) {
        const rc = sel.getRangeAt(0).getBoundingClientRect();
        pop.style.top = `${window.scrollY + rc.top - 34}px`;
        pop.style.left = `${window.scrollX + rc.left}px`;
        pop.style.display = "block";
        pop.dataset.txt = txt;
      } else pop.style.display = "none";
    };
    document.addEventListener("mouseup", onUp);
    return () => document.removeEventListener("mouseup", onUp);
  }, [current]);

  function saveQuote() {
    const pop = selpopRef.current;
    const txt = pop?.dataset.txt;
    if (!txt || !current) return;
    setQuotes((q) => [...q, { text: txt, code: current.code, title: current.title, date: new Date().toISOString().slice(0, 10) }]);
    if (pop) pop.style.display = "none";
  }

  // ── إدارة الوثائق ──
  function addDocument() {
    const title = draftTitle.trim();
    const rawText = draftText.trim();
    if (!title || rawText.length < 20) return;
    const next = [...inputs, { title, rawText }];
    setInputs(next);
    setDraftTitle("");
    setDraftText("");
    setAddOpen(false);
    const analyzed = analyzeDocuments(next);
    setCurrentCode(analyzed[analyzed.length - 1].code);
  }

  function parseLoadedDocs(payload: unknown): DocumentInput[] {
    const arr = Array.isArray(payload)
      ? payload
      : typeof payload === "object" && payload !== null && Array.isArray((payload as { docs?: unknown[] }).docs)
        ? ((payload as { docs: unknown[] }).docs)
        : null;
    if (!arr) throw new Error("bad");
    return arr
      .map((item) => {
        if (typeof item !== "object" || item === null) return null;
        const o = item as Record<string, unknown>;
        const title = typeof o.title === "string" ? o.title : "";
        const text =
          typeof o.rawText === "string" ? o.rawText : typeof o.full_text === "string" ? o.full_text : typeof o.text === "string" ? o.text : "";
        if (!title || !text) return null;
        return { title, rawText: text };
      })
      .filter((x): x is DocumentInput => x !== null);
  }

  function addExtracted(title: string, rawText: string) {
    const next = [...inputs, { title, rawText }];
    setInputs(next);
    const analyzed = analyzeDocuments(next);
    setCurrentCode(analyzed[analyzed.length - 1].code);
  }

  // ── Google Drive ──
  const refreshDriveStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/doc-platform/drive/status");
      const json = (await res.json()) as { configured?: boolean; connected?: boolean };
      setDriveConfigured(Boolean(json.configured));
      setDriveConnected(Boolean(json.connected));
    } catch {
      /* تجاهل */
    }
  }, []);

  useEffect(() => {
    void refreshDriveStatus();
    // إشعار العودة من ربط Drive
    const params = new URLSearchParams(window.location.search);
    const drive = params.get("drive");
    if (drive) {
      if (drive === "connected") {
        setStatusMsg("✓ تم ربط Google Drive");
        setDriveOpen(true);
      } else if (drive === "unconfigured") setStatusMsg("⚠ تكامل Drive غير مُهيّأ بعد");
      else setStatusMsg("⚠ تعذّر ربط Drive");
      setTimeout(() => setStatusMsg(""), 5000);
      window.history.replaceState(null, "", "/documents/app");
    }
  }, [refreshDriveStatus]);

  const loadDriveFiles = useCallback(async (q?: string) => {
    setDriveBusy(true);
    try {
      const res = await fetch(`/api/doc-platform/drive/files${q ? `?q=${encodeURIComponent(q)}` : ""}`);
      if (res.status === 401) {
        setDriveConnected(false);
        return;
      }
      const json = (await res.json()) as { files?: Array<{ id: string; name: string; mimeType: string }> };
      setDriveFiles(json.files ?? []);
    } catch {
      /* تجاهل */
    } finally {
      setDriveBusy(false);
    }
  }, []);

  function openDrive() {
    if (!driveConnected) {
      window.location.href = "/api/doc-platform/drive/auth";
      return;
    }
    setDriveOpen(true);
    void loadDriveFiles();
  }

  async function importFromDrive(file: { id: string; name: string; mimeType: string }) {
    setDriveBusy(true);
    try {
      const res = await fetch("/api/doc-platform/drive/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(file)
      });
      const json = (await res.json()) as { title?: string; rawText?: string; bytesBase64?: string; ext?: string; error?: string };
      if (!res.ok) {
        window.alert(json.error ?? "تعذّر الاستيراد");
        return;
      }
      if (typeof json.rawText === "string") {
        if (json.rawText.trim().length < 5) {
          window.alert("المستند فارغ أو بلا نص.");
          return;
        }
        addExtracted(json.title ?? file.name, json.rawText);
        setStatusMsg(`✓ استُورد «${json.title ?? file.name}» من Drive`);
        setTimeout(() => setStatusMsg(""), 4000);
        setDriveOpen(false);
      } else if (json.bytesBase64 && json.ext) {
        // PDF/DOCX: استخرجه في المتصفح (نفس خطّ الرفع، بما فيه OCR للـ PDF الممسوح)
        const bytes = Uint8Array.from(atob(json.bytesBase64), (c) => c.charCodeAt(0));
        const blobFile = new File([bytes], `${json.title ?? file.name}.${json.ext}`);
        setDriveOpen(false);
        await handleLoadFile(blobFile);
      }
    } finally {
      setDriveBusy(false);
    }
  }

  // تهيئة القراءة السحابية عند الفتح (نفس مصدر البحث السريع)
  useEffect(() => {
    fetch("/api/doc-tool/ocr")
      .then((r) => r.json())
      .then((d: { configured?: boolean }) => {
        setCloudAvail(Boolean(d.configured));
        if (d.configured) setCloudOcrOn(/(?:^|; )docToolCloudOcr=1/.test(document.cookie));
      })
      .catch(() => setCloudAvail(false));
  }, []);

  function toggleCloudOcr(on: boolean) {
    setCloudOcrOn(on);
    document.cookie = `docToolCloudOcr=${on ? "1" : "0"}; path=/; max-age=31536000; samesite=lax`;
  }

  /** قراءة سحابية فائقة الدقة (Gemini) — الـ PDF يُرسل صفحاتٍ كصور (رؤية حقيقية
      تتجاوز طبقات النص المعطوبة)؛ null عند الفشل ليسقط للمحلي */
  async function cloudRead(file: File): Promise<string | null> {
    try {
      const { cloudOcrImage, cloudOcrPdfPages } = await import("@/lib/modules/doc-tool/cloud-ocr");
      if ((file.name.split(".").pop() ?? "").toLowerCase() === "pdf") {
        return await cloudOcrPdfPages(await file.arrayBuffer(), (label) => setOcrProgress(label));
      }
      return await cloudOcrImage(file, (label) => setOcrProgress(label));
    } catch {
      return null;
    }
  }

  async function handleLoadFile(file: File) {
    const ext = (file.name.split(".").pop() ?? "").toLowerCase();
    const baseName = file.name.replace(/\.[^.]+$/, "");

    // صورة ممسوحة → سحابي فائق الدقة أولاً (إن فُعِّل)، والمحلي احتياط
    if (isImageExtension(ext)) {
      setFileBusy(true);
      if (cloudAvail && cloudOcrOn) {
        const cloudText = await cloudRead(file);
        if (cloudText) {
          addExtracted(baseName, cloudText);
          setStatusMsg("✓ قُرئت سحابياً (Gemini) — راجع الأرقام والمبالغ يدوياً");
          setTimeout(() => setStatusMsg(""), 6500);
          setFileBusy(false);
          setOcrProgress("");
          return;
        }
        setOcrProgress("السحابي غير متاح — متابعة بالمحلي…");
      }
      setOcrProgress("تحضير محرّك القراءة الضوئية…");
      try {
        const { ocrImage, translateOcrStatus } = await import("@/lib/modules/document-inspection/ocr");
        const { text, confidence } = await ocrImage(file, (info) =>
          setOcrProgress(`${translateOcrStatus(info.status)} ${Math.round((info.progress || 0) * 100)}٪`)
        );
        if (text.trim().length < 5) throw new Error("لم يُقرأ نص من الصورة — تأكد من وضوحها");
        const fixed = fixReversedArabicLines(text);
        addExtracted(baseName, fixed.text);
        const corr = fixed.corrected.length ? ` · صُحِّح ${fixed.corrected.length} سطر معكوس` : "";
        setStatusMsg(`✓ قُرئت الصورة ضوئياً محلياً (ثقة ${Math.round(confidence)}٪)${corr}`);
        setTimeout(() => setStatusMsg(""), 5500);
      } catch (error) {
        window.alert(error instanceof Error ? error.message : "تعذّرت القراءة الضوئية");
      } finally {
        setFileBusy(false);
        setOcrProgress("");
      }
      return;
    }

    // PDF / DOCX / TXT: استخراج النص محلياً في المتصفح ثم إضافته كوثيقة
    if (ext === "pdf" || ext === "docx" || ext === "txt" || ext === "md") {
      setFileBusy(true);
      try {
        const extracted = await extractFromFile(file);
        addExtracted(extracted.title, extracted.rawText);
        setStatusMsg(extracted.warning ? `⚠ ${extracted.warning}` : `✓ استُخرج نص «${extracted.title}» محلياً`);
        setTimeout(() => setStatusMsg(""), 5000);
      } catch (error) {
        // PDF ممسوح ضوئياً أو بطبقة نصّ معطوبة → اعرض خيار تشغيل OCR
        const msg = error instanceof Error ? error.message : "";
        if (ext === "pdf" && (msg.includes("ممسوح") || msg.includes("OCR"))) {
          // المسار السحابي أولاً عند تفعيله — أسرع وأدق لهذه الحالات، والمحلي احتياط
          if (cloudAvail && cloudOcrOn) {
            const cloudText = await cloudRead(file);
            if (cloudText) {
              addExtracted(baseName, cloudText);
              setStatusMsg("✓ قُرئ الـ PDF سحابياً (Gemini) — راجع الأرقام والمبالغ يدوياً");
              setTimeout(() => setStatusMsg(""), 6500);
              setFileBusy(false);
              setOcrProgress("");
              return;
            }
            setOcrProgress("");
          }
          const prompt = msg.includes("معطوبة")
            ? "طبقة نصّ هذا الـ PDF معطوبة فتخرج رموزاً غير صحيحة. هل تشغّل القراءة الضوئية OCR في متصفحك لنصّ سليم؟ قد تستغرق دقيقة للصفحة."
            : "هذا PDF ممسوح ضوئياً (صور). هل تشغّل القراءة الضوئية OCR في متصفحك؟ قد تستغرق دقيقة للصفحة.";
          if (window.confirm(prompt)) {
            setOcrProgress("تحضير محرّك القراءة الضوئية…");
            try {
              const buffer = await file.arrayBuffer();
              const { ocrScannedPdf, translateOcrStatus } = await import("@/lib/modules/document-inspection/ocr");
              const { text, avgConfidence } = await ocrScannedPdf(buffer, (info) =>
                setOcrProgress(`صفحة ${info.page}/${info.pages} — ${translateOcrStatus(info.status)} ${Math.round((info.progress || 0) * 100)}٪`)
              );
              if (text.replace(/\[صفحة \d+\]/g, "").trim().length < 10) throw new Error("لم يُقرأ نص واضح من المسح");
              const fixed = fixReversedArabicLines(text);
              addExtracted(baseName, fixed.text);
              const corr = fixed.corrected.length ? ` · صُحِّح ${fixed.corrected.length} سطر معكوس` : "";
              setStatusMsg(`✓ قُرئ الـ PDF ضوئياً محلياً (ثقة ${Math.round(avgConfidence)}٪)${corr}`);
              setTimeout(() => setStatusMsg(""), 6500);
            } catch (ocrErr) {
              window.alert(ocrErr instanceof Error ? ocrErr.message : "تعذّرت القراءة الضوئية");
            } finally {
              setOcrProgress("");
            }
          }
        } else {
          window.alert(msg || "تعذّر استخراج النص من الملف");
        }
      } finally {
        setFileBusy(false);
      }
      return;
    }
    const text = await file.text();
    try {
      const start = text.indexOf("{");
      const startArr = text.indexOf("[");
      const from = startArr >= 0 && (startArr < start || start < 0) ? startArr : start;
      const payload: unknown = JSON.parse(text.slice(from));
      if (typeof payload === "object" && payload !== null && (payload as LockedPayload).locked === true) {
        const locked = payload as LockedPayload;
        const pw = window.prompt("الملف مقفل — أدخل كلمة المرور:");
        if (pw == null) return;
        try {
          const key = await deriveKey(pw, b64d(locked.salt), "decrypt");
          const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64d(locked.iv) as BufferSource }, key, b64d(locked.ct) as BufferSource);
          const inner: unknown = JSON.parse(new TextDecoder().decode(pt));
          setInputs(parseLoadedDocs(inner));
          setCurrentCode(null);
          return;
        } catch {
          window.alert("كلمة مرور خاطئة.");
          return;
        }
      }
      const loaded = parseLoadedDocs(payload);
      if (!loaded.length) throw new Error("empty");
      setInputs(loaded);
      setCurrentCode(null);
    } catch {
      window.alert("ملف غير صالح — يُتوقّع JSON يحوي docs:[{title, rawText}] أو ملفاً مقفلاً من هذه الواجهة.");
    }
  }

  async function lockAndDownload() {
    if (!inputs.length) {
      window.alert("لا وثائق للقفل.");
      return;
    }
    const pw = window.prompt("اختر كلمة مرور لتشفير نسخة مقفلة من الوثائق:");
    if (!pw) return;
    try {
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const key = await deriveKey(pw, salt, "encrypt");
      const ct = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv: iv as BufferSource },
        key,
        new TextEncoder().encode(JSON.stringify({ docs: inputs }))
      );
      const payload: LockedPayload = { locked: true, salt: b64(salt), iv: b64(iv), ct: b64(ct) };
      download("وثائق_مقفلة.json", JSON.stringify(payload), "application/json;charset=utf-8");
      window.alert("أُنشئت نسخة مقفلة (AES-GCM). افتحها من زر «رفع ملف» وستُطلب كلمة المرور.");
    } catch {
      window.alert("تعذّر التشفير في هذا المتصفح.");
    }
  }

  // ── «قضاياي»: حفظ دائم اختياري في قاعدة بيانات المنصة (كوكي مساحة عمل، بلا حساب) ──

  const prefsLoaded = useRef(false);

  const refreshSavedCases = useCallback(async (): Promise<unknown> => {
    try {
      const res = await fetch("/api/doc-platform/cases");
      const json: unknown = await res.json();
      const o = (typeof json === "object" && json !== null ? json : {}) as Record<string, unknown>;
      if (Array.isArray(o.cases)) {
        setSavedCases(o.cases as Array<{ id: string; title: string; docCount: number; updatedAt: string }>);
      }
      return o;
    } catch {
      return null;
    }
  }, []);

  // عند الفتح: جلب القضايا المحفوظة + تطبيق التفضيلات المحفوظة
  useEffect(() => {
    void (async () => {
      const o = (await refreshSavedCases()) as Record<string, unknown> | null;
      const p = o?.prefs;
      if (p && typeof p === "object") {
        const prefs = p as Record<string, unknown>;
        if (typeof prefs.fontSize === "number") setFontSize(prefs.fontSize);
        if (typeof prefs.lineHeight === "number") setLineHeight(prefs.lineHeight);
        if (typeof prefs.fontFamily === "string") setFontFamily(prefs.fontFamily);
        if (typeof prefs.justify === "boolean") setJustify(prefs.justify);
        if (prefs.theme === "" || prefs.theme === "dark" || prefs.theme === "paper") setTheme(prefs.theme);
      }
      prefsLoaded.current = true;
    })();
  }, [refreshSavedCases]);

  // حفظ التفضيلات تلقائياً (بعد التحميل الأول)
  useEffect(() => {
    if (!prefsLoaded.current) return;
    const t = setTimeout(() => {
      void fetch("/api/doc-platform/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prefs: { fontSize, lineHeight, fontFamily, justify, theme } })
      }).catch(() => undefined);
    }, 900);
    return () => clearTimeout(t);
  }, [fontSize, lineHeight, fontFamily, justify, theme]);

  function collectAnnotations() {
    return {
      notes: Object.fromEntries(notes),
      flags: Object.fromEntries(flags),
      quotes
    };
  }

  async function saveCase() {
    if (!inputs.length) {
      window.alert("لا وثائق للحفظ.");
      return;
    }
    const currentTitle = loadedCaseId ? savedCases.find((c) => c.id === loadedCaseId)?.title : undefined;
    const title = window.prompt("اسم القضية:", currentTitle ?? "قضيتي");
    if (title == null) return;
    setSaving(true);
    try {
      const res = await fetch("/api/doc-platform/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId: loadedCaseId, title, docs: inputs, annotations: collectAnnotations() })
      });
      const json: unknown = await res.json();
      const o = (typeof json === "object" && json !== null ? json : {}) as Record<string, unknown>;
      if (!res.ok) {
        window.alert(typeof o.error === "string" ? o.error : "تعذّر الحفظ");
        return;
      }
      if (typeof o.id === "string") setLoadedCaseId(o.id);
      setStatusMsg("✓ حُفظت القضية في حسابك على المنصة");
      setTimeout(() => setStatusMsg(""), 4000);
      void refreshSavedCases();
    } finally {
      setSaving(false);
    }
  }

  async function loadCase(id: string) {
    const res = await fetch(`/api/doc-platform/cases/${id}`);
    const json: unknown = await res.json();
    const o = (typeof json === "object" && json !== null ? json : {}) as Record<string, unknown>;
    if (!res.ok) {
      window.alert(typeof o.error === "string" ? o.error : "تعذّر التحميل");
      return;
    }
    const loaded = parseLoadedDocs(o.docs);
    if (!loaded.length) {
      window.alert("القضية المحفوظة فارغة.");
      return;
    }
    setInputs(loaded);
    setCurrentCode(null);
    setLoadedCaseId(id);
    const ann = (typeof o.annotations === "object" && o.annotations !== null ? o.annotations : {}) as Record<string, unknown>;
    setNotes(new Map(Object.entries((ann.notes as Record<string, string>) ?? {})));
    setFlags(new Map(Object.entries((ann.flags as Record<string, string>) ?? {})));
    setQuotes(Array.isArray(ann.quotes) ? (ann.quotes as Quote[]) : []);
    setCasesOpen(false);
  }

  async function deleteCase(id: string) {
    if (!window.confirm("حذف هذه القضية المحفوظة نهائياً؟")) return;
    await fetch(`/api/doc-platform/cases/${id}`, { method: "DELETE" }).catch(() => undefined);
    if (loadedCaseId === id) setLoadedCaseId(null);
    void refreshSavedCases();
  }

  // ── التصدير ──
  const scopeDocs = useCallback((): AnalyzedDocument[] => {
    if (exportScope === "all") return docs;
    if (exportScope === "match") return filtered;
    return docs.filter((d) => selected.has(d.code));
  }, [exportScope, docs, filtered, selected]);

  function buildExportHtml(list: AnalyzedDocument[], incText: boolean, word: boolean): string {
    const ns = word
      ? '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">'
      : '<!DOCTYPE html><html lang="ar" dir="rtl">';
    const p: string[] = [
      ns,
      '<head><meta http-equiv="Content-Type" content="text/html; charset=utf-8"><title>مستندات مفحوصة</title>',
      word ? "<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View></w:WordDocument></xml><![endif]-->" : "",
      "<style>body{font-family:Tahoma,Arial,sans-serif;color:#111;margin:24px;line-height:1.8;direction:rtl;text-align:right}",
      "h2{font-size:15px;margin:0 0 6px}table{border-collapse:collapse;margin:6px 0}td,th{border:1px solid #ccc;padding:4px 8px;font-size:12px;text-align:right}th{background:#eef}",
      ".txt{white-space:pre-wrap;word-break:break-word;font-size:12.5px;border-top:1px solid #eee;margin-top:8px;padding-top:8px}",
      ".doc+.doc{page-break-before:always}.note{color:#7c2d12}@media print{.noprint{display:none}}</style></head><body dir=\"rtl\" lang=\"ar\">",
      word ? "" : '<div class="noprint" style="margin-bottom:10px"><button onclick="window.print()" style="padding:8px 16px;cursor:pointer">اطبع / احفظ PDF</button></div>',
      `<h1 style="font-size:18px">مستندات مفحوصة — عدد: ${list.length}</h1>`,
      '<p class="note">مخرج آلي يحتاج مراجعة بشرية</p>'
    ];
    list.forEach((d, i) => {
      const rows = [
        ["النوع", d.type.name],
        ["الجهة", d.issuer.name],
        ["الرمز", d.code],
        ["التاريخ", d.hijriDate ?? ""],
        ["جودة القراءة", `${d.quality.score}%`]
      ]
        .filter(([, v]) => v)
        .map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`)
        .join("");
      p.push(`<div class="doc"${word && i > 0 ? ' style="page-break-before:always"' : ""}><h2>${esc(d.title)}</h2>`);
      if (rows) p.push(`<table>${rows}</table>`);
      if (incText) p.push(`<div class="txt">${esc(d.rawText || "(لا نص)")}</div>`);
      p.push("</div>");
    });
    p.push("</body></html>");
    return p.join("");
  }

  function doExport(kind: "word" | "print" | "html" | "csv" | "quotes") {
    if (kind === "quotes") {
      const head = ["نوع", "النص", "المستند", "التاريخ"];
      const lines = ["﻿" + head.map(csvCell).join(",")];
      quotes.forEach((q) => lines.push(["مقتطف", q.text, q.title, q.date].map(csvCell).join(",")));
      notes.forEach((v, code) =>
        lines.push(["ملاحظة", v, docs.find((d) => d.code === code)?.title ?? code, ""].map(csvCell).join(","))
      );
      flags.forEach((v, code) =>
        lines.push([`علم: ${v}`, "", docs.find((d) => d.code === code)?.title ?? code, ""].map(csvCell).join(","))
      );
      download("مقتطفات_وملاحظات.csv", lines.join("\r\n"), "text/csv;charset=utf-8");
      setExportOpen(false);
      return;
    }
    const list = scopeDocs();
    if (!list.length) {
      window.alert("لا مستندات في النطاق المحدد.");
      return;
    }
    if (kind === "csv") {
      const head = ["العنوان", "النوع", "الجهة", "الرمز", "التاريخ", "الجودة", "العلم", "ملاحظة"];
      const lines = ["﻿" + head.map(csvCell).join(",")];
      list.forEach((d) =>
        lines.push(
          [d.title, d.type.name, d.issuer.name, d.code, d.hijriDate ?? "", `${d.quality.score}%`, flags.get(d.code) ?? "", notes.get(d.code) ?? ""]
            .map(csvCell)
            .join(",")
        )
      );
      download("بطاقات_المستندات.csv", lines.join("\r\n"), "text/csv;charset=utf-8");
    } else if (kind === "word") {
      download("مستندات_مفحوصة.doc", buildExportHtml(list, includeText, true), "application/msword");
    } else if (kind === "html") {
      download("مستندات_مفحوصة.html", buildExportHtml(list, includeText, false), "text/html;charset=utf-8");
    } else if (kind === "print") {
      const w = window.open("", "_blank");
      if (!w) {
        window.alert("اسمح بالنوافذ المنبثقة أو استخدم تنزيل HTML.");
        return;
      }
      w.document.open();
      w.document.write(buildExportHtml(list, includeText, false));
      w.document.close();
    }
    setExportOpen(false);
  }

  async function copyToClipboard(label: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(""), 1400);
    } catch {
      window.alert("تعذّر النسخ في هذا المتصفح.");
    }
  }

  // ── الجداول المشتقة ──
  const derived = useMemo(() => {
    const timeline: Array<{ date: string; doc: AnalyzedDocument }> = [];
    const deeds: Array<{ deed: string; doc: AnalyzedDocument }> = [];
    const amounts: Array<{ amount: string; value: number; doc: AnalyzedDocument }> = [];
    const laws = new Map<string, { count: number; docs: Set<string> }>();
    for (const d of docs) {
      for (const e of d.entities) {
        if (e.kind === "date") timeline.push({ date: e.value, doc: d });
        else if (e.kind === "deed") deeds.push({ deed: e.value, doc: d });
        else if (e.kind === "amount") {
          const v = Number(normStr(e.value).replace(/[^\d]/g, "")) || 0;
          amounts.push({ amount: e.value, value: v, doc: d });
        } else if (e.kind === "law") {
          const key = e.value.trim();
          let l = laws.get(key);
          if (!l) {
            l = { count: 0, docs: new Set() };
            laws.set(key, l);
          }
          l.count += 1;
          l.docs.add(d.code);
        }
      }
    }
    timeline.sort((a, b) => normStr(a.date).localeCompare(normStr(b.date)));
    amounts.sort((a, b) => b.value - a.value);
    return { timeline, deeds, amounts, laws: Array.from(laws.entries()).sort((a, b) => b[1].count - a[1].count) };
  }, [docs]);

  const applyFilterAndGo = useCallback((updater: () => void) => {
    updater();
    setView("docs");
  }, []);

  // ── عناصر مساعدة للعرض ──
  const qualityBadge = (d: AnalyzedDocument) => (
    <span className={`${styles.qb} ${d.quality.grade === "high" ? styles.qbG : d.quality.grade === "medium" ? styles.qbW : styles.qbR}`}>
      {d.quality.score}%
    </span>
  );
  const qualityDot = (d: AnalyzedDocument) => (
    <span
      className={`${styles.dot} ${d.quality.grade === "high" ? styles.dotOk : d.quality.grade === "medium" ? styles.dotWarn : styles.dotBad}`}
      title={d.quality.label}
    />
  );

  const stems = useMemo(() => (parsed.empty ? [] : queryStems(parsed)), [parsed]);
  const hitCount = useCallback(
    (d: AnalyzedDocument) => {
      if (!stems.length) return 0;
      const tf = bm25.tf[docs.indexOf(d)] ?? {};
      return stems.reduce((acc, s) => acc + (tf[s] ?? 0), 0);
    },
    [stems, bm25, docs]
  );

  function docItem(d: AnalyzedDocument, idx: number) {
    const hits = hitCount(d);
    return (
      <div
        key={d.code}
        role="listitem"
        tabIndex={0}
        className={`${styles.item} ${currentCode === d.code && !compare ? styles.itemActive : ""}`}
        onClick={() => openDoc(d.code)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openDoc(d.code);
          }
        }}
        aria-label={`${idx + 1}. ${d.title}، جودة ${d.quality.score} بالمئة`}
      >
        <input
          type="checkbox"
          checked={selected.has(d.code)}
          aria-label="تحديد الوثيقة"
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => {
            const next = new Set(selected);
            if (e.target.checked) next.add(d.code);
            else next.delete(d.code);
            setSelected(next);
          }}
        />
        <div style={{ flex: 1 }}>
          <div className={styles.itemT}>
            <span className={styles.num}>{idx + 1}</span> {notes.has(d.code) ? <NoteIcon size={12} /> : null}{notes.has(d.code) ? " " : ""}
            {d.title} {qualityDot(d)} {qualityBadge(d)}{" "}
            {hits > 0 ? <span className={styles.hitb}>{hits} مطابقة</span> : null}
          </div>
          <div className={styles.itemS}>
            {d.type.name}
            {d.hijriDate ? ` · ${d.hijriDate}` : ""}
            {flags.has(d.code) ? <span className={styles.flag}> <FlagIcon size={12} /> {flags.get(d.code)}</span> : null}
          </div>
        </div>
      </div>
    );
  }

  const compareDocs = compare ? compare.map((c) => docs.find((d) => d.code === c)).filter(Boolean) as AnalyzedDocument[] : [];

  function statsBars(
    title: string,
    entries: Array<[string, number]>,
    onClickKey?: (k: string) => void,
    barClass?: string,
    suffix?: (k: string, v: number) => string
  ) {
    const mx = Math.max(1, ...entries.map(([, v]) => v));
    return (
      <div key={title}>
        <h3>{title}</h3>
        {entries.map(([k, v]) => (
          <div key={k} className={styles.sbar}>
            <button
              type="button"
              className={`lbl ${styles.sbar ? "" : ""}`}
              style={{
                width: 170,
                flex: "none",
                cursor: onClickKey ? "pointer" : "default",
                textAlign: "start",
                background: "none",
                border: "none",
                color: "inherit",
                font: "inherit",
                padding: 0,
                textDecoration: onClickKey ? "underline dotted" : "none"
              }}
              onClick={onClickKey ? () => onClickKey(k) : undefined}
            >
              {k}
            </button>
            <span className={`bb ${barClass ?? ""}`} style={{ height: 16, background: barClass ? "#7c3aed" : "var(--accent)", borderRadius: 4, minWidth: 3, width: Math.max(3, (260 * v) / mx) }} />
            <span style={{ color: "var(--mut)", fontSize: 12 }}>{suffix ? suffix(k, v) : v}</span>
          </div>
        ))}
      </div>
    );
  }

  // ── JSX ──
  return (
    <div
      className={`${styles.root} ${theme === "dark" ? styles.dark : ""} ${theme === "paper" ? styles.paper : ""} ${reading ? styles.reading : ""} ${showLines ? styles.lines : ""} ${hideHdr ? styles.hideHdr : ""}`}
      dir="rtl"
      style={
        {
          "--tsize": `${fontSize}px`,
          "--tlh": String(lineHeight),
          "--tfam": fontFamily,
          "--talign": justify ? "justify" : "start"
        } as React.CSSProperties
      }
    >
      <a className={styles.skip} href="#detail">
        تخطّي إلى محتوى الوثيقة
      </a>

      <header className={styles.header} role="banner">
        <span className={styles.brandSeal} aria-hidden="true">
          و
        </span>
        <h1>
          <a href="/documents" className={styles.brandHome}>منصة الوثائق</a>
          <small>· محطة العمل</small>
        </h1>
        <nav className={styles.headNav} aria-label="أقسام منصة الوثائق">
          <a href="/documents">البوابة</a>
          <a href="/documents/tool">البحث السريع</a>
        </nav>
        <span className={styles.banner}>مخرج آلي يحتاج مراجعة بشرية</span>
        <div className={styles.bar} role="toolbar" aria-label="أدوات العرض">
          <span className={styles.grp}>
            نص
            <button onClick={() => setFontSize((v) => Math.max(11, v - 1))}>A−</button>
            <button onClick={() => setFontSize((v) => Math.min(28, v + 1))}>A+</button>
          </span>
          <span className={styles.grp}>
            أسطر
            <button onClick={() => setLineHeight((v) => Math.max(1.2, Math.round((v - 0.1) * 10) / 10))}>−</button>
            <button onClick={() => setLineHeight((v) => Math.min(2.6, Math.round((v + 0.1) * 10) / 10))}>+</button>
          </span>
          <span className={styles.grp}>
            خط
            <select value={fontFamily} onChange={(e) => setFontFamily(e.target.value)} aria-label="نوع الخط">
              <option value="'Traditional Arabic','Simplified Arabic','Arabic Typesetting','Amiri',serif">عربي رسمي (نسخ)</option>
              <option value="inherit">افتراضي</option>
              <option value="'Tahoma',Arial,sans-serif">واضح</option>
              <option value="'Courier New',monospace">ثابت</option>
            </select>
          </span>
          <span className={styles.grp}>
            <label>
              <input type="checkbox" checked={justify} onChange={(e) => setJustify(e.target.checked)} /> ضبط
            </label>
          </span>
          <span className={styles.grp}>
            <label>
              <input type="checkbox" checked={reading} onChange={(e) => setReading(e.target.checked)} /> قراءة
            </label>
          </span>
          <span className={styles.grp}>
            سمة
            <select value={theme} onChange={(e) => setTheme(e.target.value as ThemeKey)} aria-label="السمة">
              <option value="">فاتح</option>
              <option value="dark">ليلي</option>
              <option value="paper">ورقي</option>
            </select>
          </span>
          <span className={styles.grp}>
            <button onClick={lockAndDownload} title="حفظ نسخة مقفلة بكلمة مرور (AES-GCM)">
              <LockIcon size={14} /> قفل
            </button>
          </span>
          {cloudAvail ? (
            <span className={styles.grp}>
              <label
                className={styles.cloudLbl}
                title="يقرأ الصور وPDF الممسوح عبر Gemini بدقة أعلى — تُرسل الوثيقة لخدمة Google، وراجع الأرقام والمبالغ يدوياً. بدونه تبقى القراءة محلية في متصفحك."
              >
                <input type="checkbox" checked={cloudOcrOn} onChange={(e) => toggleCloudOcr(e.target.checked)} />
                <ScanIcon size={13} /> OCR سحابي
              </label>
            </span>
          ) : null}
          <span className={styles.grp}>
            <button
              onClick={() => fileRef.current?.click()}
              title="رفع ملف: PDF، صورة/مسح ضوئي (OCR)، DOCX، TXT، JSON، أو نسخة مقفلة"
              disabled={fileBusy}
            >
              {fileBusy ? "يعالج…" : <><UploadIcon size={14} /> رفع ملف</>}
            </button>
            <button onClick={() => setAddOpen(true)} title="لصق وثيقة جديدة للفحص">
              ＋ إضافة
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.docx,.txt,.md,.js,.json,.png,.jpg,.jpeg,.webp,.bmp,.gif"
              style={{ display: "none" }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleLoadFile(f);
                e.target.value = "";
              }}
            />
          </span>
          <span className={styles.grp}>
            <button onClick={() => void saveCase()} title="حفظ القضية في حسابك على المنصة" disabled={saving}>
              {saving ? "يحفظ…" : <><SaveIcon size={14} /> حفظ</>}
            </button>
            <button
              onClick={() => {
                setCasesOpen(true);
                void refreshSavedCases();
              }}
              title="القضايا المحفوظة"
            >
              <FolderIcon size={14} /> قضاياي ({savedCases.length})
            </button>
            {driveConfigured ? (
              <button onClick={openDrive} title={driveConnected ? "استيراد من Google Drive" : "ربط Google Drive"}>
                {driveConnected ? "▲ استيراد من Drive" : "▲ ربط Drive"}
              </button>
            ) : null}
          </span>
        </div>
        <span className={styles.meta} role="status" aria-live="polite">
          {statusMsg || (docs.length ? `${docs.length} مستند${loadedCaseId ? " — قضية محفوظة" : " — جلسة محلية"}` : "لا وثائق بعد")}
        </span>
      </header>

      {ocrProgress ? (
        <div className={styles.ocrBar} role="status" aria-live="polite">
          <ScanIcon size={14} /> قراءة ضوئية (OCR) في متصفحك — {ocrProgress}
        </div>
      ) : null}

      <div className={styles.tabs} role="tablist">
        {VIEWS.map((v) => (
          <button
            key={v.key}
            role="tab"
            aria-selected={view === v.key}
            className={`${styles.tab} ${view === v.key ? styles.tabActive : ""}`}
            onClick={() => setView(v.key)}
          >
            {v.label}
          </button>
        ))}
      </div>

      {view === "docs" ? (
        <div className={styles.wrap}>
          <aside className={styles.side} role="navigation" aria-label="قائمة الوثائق والبحث">
            <div className={styles.controls}>
              <label htmlFor="cb-q" className={styles.srOnly}>
                بحث في الوثائق
              </label>
              <input
                id="cb-q"
                ref={searchRef}
                type="text"
                placeholder='بحث… (عبارة دقيقة بين "" ، و- قبل كلمة للاستبعاد، وأو للتخيير)'
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (e.shiftKey) navPrev();
                    else navNext();
                  }
                }}
              />
              <div className={styles.srchopts}>
                <label title="يبحث عن اشتقاقات الكلمة (نفس الجذع الصرفي)">
                  <input type="checkbox" checked={rootOn} onChange={(e) => setRootOn(e.target.checked)} /> اشتقاق
                </label>
                <label title="تلوين المبالغ/التواريخ/الأطراف/الأرقام">
                  <input type="checkbox" checked={colorOn} onChange={(e) => setColorOn(e.target.checked)} /> تلوين
                </label>
                <label title="تحديد الكلمات غير الواضحة (تحتاج مراجعة بشرية)">
                  <input type="checkbox" checked={suspOn} onChange={(e) => setSuspOn(e.target.checked)} /> غير الواضح
                </label>
                <label title="إخفاء أسطر الترويسات">
                  <input type="checkbox" checked={hideHdr} onChange={(e) => setHideHdr(e.target.checked)} /> إخفاء الترويسات
                </label>
                <label title="تظليل المصطلحات القانونية المفتاحية">
                  <input type="checkbox" checked={termsOn} onChange={(e) => setTermsOn(e.target.checked)} /> مصطلحات
                </label>
              </div>
              <div className={styles.row}>
                <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} aria-label="تصفية بالنوع">
                  <option value="">كل الأنواع</option>
                  {types.map(([t, n]) => (
                    <option key={t} value={t}>
                      {t} ({n})
                    </option>
                  ))}
                </select>
                <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="الترتيب">
                  <option value="relevance">الترتيب: الصلة (BM25)</option>
                  <option value="none">الأصل</option>
                  <option value="date">التاريخ</option>
                  <option value="title">الأبجدية</option>
                  <option value="type">النوع</option>
                </select>
              </div>
              <div className={styles.row}>
                <label>
                  <input type="checkbox" checked={grouped} onChange={(e) => setGrouped(e.target.checked)} /> تجميع حسب النوع
                </label>
                <label>
                  <input type="checkbox" checked={onlyFlagged} onChange={(e) => setOnlyFlagged(e.target.checked)} /> المعلّمة فقط
                </label>
                <label title="عرض كل المطابقات عبر الوثائق مع مقتطف">
                  <input type="checkbox" checked={allResults} onChange={(e) => setAllResults(e.target.checked)} /> كل النتائج
                </label>
              </div>
              <div className={styles.row}>
                <button onClick={() => setSelected(new Set(filtered.map((d) => d.code)))}>تحديد المطابق</button>
                <button onClick={() => setSelected(new Set())}>إلغاء</button>
                <button className={styles.btnExport} onClick={() => setExportOpen(true)}>
                  تصدير ▾
                </button>
                <button
                  title="قارن وثيقتين محدّدتين جنباً إلى جنب"
                  onClick={() => {
                    const ids = Array.from(selected);
                    if (ids.length !== 2) {
                      window.alert("حدّد وثيقتين بالضبط للمقارنة.");
                      return;
                    }
                    setCompare([ids[0], ids[1]]);
                  }}
                >
                  ⇄ قارن
                </button>
                <span className={styles.selcount}>المحدد: {selected.size}</span>
              </div>
              <div className={styles.count} role="status" aria-live="polite">
                {docs.length === 0
                  ? ""
                  : filtered.length === docs.length
                    ? `${filtered.length} وثيقة`
                    : `${filtered.length} من ${docs.length} وثيقة`}
              </div>
            </div>
            <div className={styles.list} role={docs.length ? "list" : undefined} aria-label="نتائج الوثائق">
              {docs.length === 0 ? (
                <div className={styles.empty} style={{ padding: "0 14px" }}>
                  لا وثائق بعد.
                  <br />
                  أضف وثيقة (＋ إضافة) أو افتح ملف وثائق (رفع ملف).
                </div>
              ) : allResults && !parsed.empty ? (
                filtered.flatMap((d) => {
                  const occ = occurrences(d.rawText, needles);
                  if (!occ.length) return [];
                  return [
                    <div key={`${d.code}-h`} className={styles.grphead} onClick={() => openDoc(d.code, 0)}>
                      {d.title.slice(0, 58)} ({occ.length})
                    </div>,
                    ...occ.map((o) => (
                      <div key={`${d.code}-${o.i}`} className={styles.item} onClick={() => openDoc(d.code, o.i)}>
                        <div className={styles.snippet}>
                          {o.pre}
                          <mark>{o.hit}</mark>
                          {o.post}
                        </div>
                      </div>
                    ))
                  ];
                })
              ) : grouped ? (
                Array.from(
                  filtered.reduce((m, d) => {
                    const arr = m.get(d.type.name) ?? [];
                    arr.push(d);
                    m.set(d.type.name, arr);
                    return m;
                  }, new Map<string, AnalyzedDocument[]>())
                )
                  .sort((a, b) => a[0].localeCompare(b[0], "ar"))
                  .flatMap(([tp, arr]) => [
                    <div key={`g-${tp}`} className={styles.grphead}>
                      {tp} ({arr.length})
                    </div>,
                    ...arr.map((d) => docItem(d, docs.indexOf(d)))
                  ])
              ) : filtered.length ? (
                filtered.map((d) => docItem(d, docs.indexOf(d)))
              ) : (
                <div className={styles.empty}>لا نتائج.</div>
              )}
            </div>
          </aside>

          <main id="detail" ref={mainRef} className={styles.main} role="main" tabIndex={-1}>
            {compare && compareDocs.length === 2 ? (
              <div className={styles.cmpWrap}>
                {compareDocs.map((d) => {
                  const di = docs.indexOf(d);
                  const colorize = makeColorizer(
                    d,
                    { color: colorOn, susp: suspOn, terms: termsOn },
                    termStats.stemToTerm,
                    suspByDoc[di] ?? new Set(),
                    lightStem
                  );
                  return (
                    <div key={d.code} className={styles.cmpCol}>
                      <div className={styles.txthead}>{d.title.slice(0, 60)}</div>
                      <div className={styles.txt} dangerouslySetInnerHTML={{ __html: colorize(esc(d.rawText || "(لا نص)")) }} />
                    </div>
                  );
                })}
              </div>
            ) : current ? (
              <>
                <div className={styles.card}>
                  <h2>{current.title}</h2>
                  <div className={styles.kv}>
                    <b>النوع</b>
                    <div>{current.type.name}</div>
                    <b>الجهة</b>
                    <div>{current.issuer.name}</div>
                    <b>الرمز الهرمي</b>
                    <div style={{ direction: "ltr", textAlign: "end" }}>{current.code}</div>
                    {current.hijriDate ? (
                      <>
                        <b>التاريخ</b>
                        <div>
                          {current.hijriDate}{" "}
                          {convertDateApprox(current.hijriDate) ? (
                            <span className={styles.kvNote}>— {convertDateApprox(current.hijriDate)}</span>
                          ) : null}
                        </div>
                      </>
                    ) : null}
                  </div>
                  {(["party", "amount", "date", "deed", "law"] as const).map((kind) => {
                    const items = current.entities.filter((e) => e.kind === kind);
                    if (!items.length) return null;
                    const labels = { party: "الأطراف", amount: "مبالغ", date: "تواريخ", deed: "أرقام صكوك", law: "أنظمة ومواد" };
                    return (
                      <div key={kind} className={styles.entRow}>
                        <b>{labels[kind]}:</b>
                        <span className={styles.chips}>
                          {items.map((e, i) => (
                            <span key={i} onClick={() => setQuery(`"${e.value}"`)}>
                              {e.value}
                            </span>
                          ))}
                        </span>
                      </div>
                    );
                  })}
                  {(() => {
                    const seg = segmentDocument(current.rawText, current.issuer.code);
                    const fields = extractKeyFields(current, seg);
                    return (
                      <>
                        {fields.length ? (
                          <div className={styles.entRow}>
                            <b><ClipboardIcon size={13} /> حقول {current.type.name}:</b>
                            <div className={styles.kv} style={{ marginTop: 4 }}>
                              {fields.map((f) => (
                                <div key={f.label} style={{ display: "contents" }}>
                                  <b>{f.label}</b>
                                  <div>{f.value}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}
                        {seg.headerLines.length || seg.footerLines.length ? (
                          <div className={styles.entRow}>
                            <b><TableIcon size={13} /> البنية:</b>{" "}
                            {seg.headerLines.length ? <span className={styles.tag}>ترويسة ({seg.headerLines.length} سطر)</span> : null}{" "}
                            {seg.footerLines.length ? <span className={styles.tag}>تذييل/توثيق ({seg.footerLines.length} سطر)</span> : null}
                          </div>
                        ) : null}
                      </>
                    );
                  })()}
                  {(() => {
                    const bd = termStats.byDoc[docs.indexOf(current)] ?? {};
                    const ks = Object.keys(bd).sort((a, b) => bd[b] - bd[a]);
                    if (!ks.length) return null;
                    return (
                      <div className={styles.entRow}>
                        <b><TagIcon size={13} /> مصطلحات بارزة:</b>{" "}
                        {ks.slice(0, 10).map((k) => (
                          <span key={k} className={styles.tchip} onClick={() => setQuery(k)}>
                            {k} <b>({bd[k]})</b>
                          </span>
                        ))}
                      </div>
                    );
                  })()}
                  <div className={`${styles.qcbox} ${current.quality.grade === "high" ? styles.qcOk : styles.qcWarn}`}>
                    جودة القراءة: {current.quality.score}% — {current.quality.label}
                    {(suspByDoc[docs.indexOf(current)]?.size ?? 0) > 0
                      ? ` · كلمات غير واضحة: ${suspByDoc[docs.indexOf(current)].size}`
                      : ""}
                  </div>
                  <div className={styles.actions}>
                    <button
                      onClick={() =>
                        void copyToClipboard(
                          "ask",
                          `حلّل المستند التالي. المطلوب: لخّصه، واستخرج الطلبات والأسانيد، وأبرز أي مخاطر. تذكير: مساعدة آلية تحتاج مراجعة قانونية.\n\nالعنوان: ${current.title}\n\nالنص:\n${current.rawText}`
                        )
                      }
                    >
                      {copied === "ask" ? "✓ انسخه في مساعدك" : <><SparkIcon size={13} /> جهّز سؤالاً للتحليل</>}
                    </button>
                    <button onClick={() => void copyToClipboard("copy", current.rawText)}>
                      {copied === "copy" ? "✓ نُسخ" : <><ClipboardIcon size={13} /> نسخ النص</>}
                    </button>
                    <select
                      value={flags.get(current.code) ?? ""}
                      onChange={(e) => {
                        const next = new Map(flags);
                        if (e.target.value) next.set(current.code, e.target.value);
                        else next.delete(current.code);
                        setFlags(next);
                      }}
                      aria-label="علم الوثيقة"
                    >
                      <option value="">— علم —</option>
                      {FLAG_OPTIONS.map((f) => (
                        <option key={f}>{f}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => {
                        const v = window.prompt("ملاحظتك على هذا المستند:", notes.get(current.code) ?? "");
                        if (v === null) return;
                        const next = new Map(notes);
                        if (v) next.set(current.code, v);
                        else next.delete(current.code);
                        setNotes(next);
                      }}
                    >
                      <NoteIcon size={13} /> ملاحظة
                    </button>
                    <button
                      onClick={() => {
                        if (!window.confirm("حذف هذه الوثيقة من الجلسة؟")) return;
                        const idx = docs.indexOf(current);
                        setInputs(inputs.filter((_, i) => i !== idx));
                        setCurrentCode(null);
                      }}
                    >
                      <TrashIcon size={13} /> حذف
                    </button>
                  </div>
                  {notes.has(current.code) ? <div className={styles.noteBox}><NoteIcon size={13} /> {notes.get(current.code)}</div> : null}
                </div>

                <div className={`${styles.card} ${styles.cardBare}`}>
                  <div className={styles.txthead}>
                    النص الكامل
                    <span className="sp" style={{ marginInlineStart: "auto" }} />
                    <button onClick={navPrev} aria-label="المطابقة السابقة">
                      ▲
                    </button>
                    <span className={styles.mInfo} role="status" aria-live="polite">
                      {markCount ? `${markIdx + 1} من ${markCount}` : "—"}
                    </span>
                    <button onClick={navNext} aria-label="المطابقة التالية">
                      ▼
                    </button>
                    <button onClick={() => setShowLines((v) => !v)} aria-label="إظهار/إخفاء أرقام الأسطر">
                      #أسطر
                    </button>
                  </div>
                  <div ref={txtRef} className={styles.txt} dangerouslySetInnerHTML={{ __html: docHtml }} />
                </div>
              </>
            ) : (
              <div className={styles.empty}>
                {docs.length ? "اختر مستنداً لعرض بطاقته ونصّه الكامل." : "أضف وثيقتك الأولى من زر «＋ إضافة» في الأعلى — يُصنَّف نوعها وجهتها وتُستخرج كياناتها فوراً في متصفحك دون إرسالها لأي خادم."}
              </div>
            )}
          </main>
        </div>
      ) : view === "quotes" ? (
        <div className={styles.quotesView}>
          <h3>المقتطفات والملاحظات</h3>
          <div style={{ marginBottom: 8 }}>
            <button className={styles.tab} onClick={() => doExport("quotes")}>
              تصدير CSV
            </button>
          </div>
          {!quotes.length && !notes.size ? (
            <div className={styles.empty}>لا مقتطفات بعد. حدّد نصاً داخل أي مستند ثم اضغط «حفظ كمقتطف».</div>
          ) : null}
          {quotes.map((q, i) => (
            <div key={i} className={styles.quote}>
              «{q.text}»
              <div className="src" style={{ color: "var(--mut)", fontSize: 11.5, marginTop: 4 }}>
                — {q.title} · {q.date}{" "}
                <button
                  style={{ border: "none", background: "none", color: "var(--accent)", cursor: "pointer", fontSize: 11.5 }}
                  onClick={() => setQuotes(quotes.filter((_, j) => j !== i))}
                >
                  حذف
                </button>
              </div>
            </div>
          ))}
          {Array.from(notes.entries()).map(([code, note]) => (
            <div key={code} className={styles.quote}>
              <NoteIcon size={12} /> {note}
              <div style={{ color: "var(--mut)", fontSize: 11.5, marginTop: 4 }}>— {docs.find((d) => d.code === code)?.title ?? code}</div>
            </div>
          ))}
        </div>
      ) : view === "stats" ? (
        <div className={styles.statwrap}>
          {docs.length === 0 ? (
            <div className={styles.empty}>لا وثائق بعد.</div>
          ) : (
            <>
              {statsBars(
                `حسب النوع (${docs.length} وثيقة) — اضغط للتصفية`,
                types.map(([t, n]) => [t, n] as [string, number]).sort((a, b) => b[1] - a[1]),
                (k) => applyFilterAndGo(() => setTypeFilter(k))
              )}
              {statsBars(
                "حسب السنة الهجرية",
                Array.from(
                  docs.reduce((m, d) => m.set(d.hijriYear === "0000" ? "بدون تاريخ" : d.hijriYear, (m.get(d.hijriYear === "0000" ? "بدون تاريخ" : d.hijriYear) ?? 0) + 1), new Map<string, number>())
                ).sort((a, b) => b[1] - a[1])
              )}
              {statsBars(
                "حسب الجودة",
                Array.from(
                  docs.reduce((m, d) => {
                    const k = d.quality.grade === "high" ? "عالية" : d.quality.grade === "medium" ? "متوسطة" : "تحتاج مراجعة";
                    return m.set(k, (m.get(k) ?? 0) + 1);
                  }, new Map<string, number>())
                ).sort((a, b) => b[1] - a[1])
              )}
            </>
          )}
        </div>
      ) : view === "terms" ? (
        <div className={styles.statwrap}>
          {!termStats.concepts.length ? (
            <div className={styles.empty}>لا مصطلحات — أضف وثائق أولاً.</div>
          ) : (
            <>
              <h3>المصطلحات القانونية المفتاحية حسب الفئة — اضغط أي مصطلح للبحث عنه ({termStats.concepts.length} مصطلحاً)</h3>
              {Array.from(new Set(termStats.concepts.map((c) => c.category))).map((cat) => (
                <div key={cat}>
                  <h3 className={styles.statCat}>{cat}</h3>
                  {termStats.concepts
                    .filter((c) => c.category === cat)
                    .map((c) => {
                      const mx = termStats.concepts[0]?.count || 1;
                      return (
                        <div key={c.term} className={styles.sbar}>
                          <button
                            type="button"
                            style={{ width: 110, flex: "none", textAlign: "start", background: "none", border: "none", color: "inherit", font: "inherit", padding: 0, cursor: "pointer", textDecoration: "underline dotted" }}
                            onClick={() => applyFilterAndGo(() => setQuery(c.term))}
                          >
                            {c.term}
                          </button>
                          <span style={{ height: 16, background: "#7c3aed", borderRadius: 4, minWidth: 4, width: Math.max(4, (260 * c.count) / mx) }} />
                          <span style={{ color: "var(--mut)", fontSize: 12 }}>
                            {c.count} مرة · {c.docCount} وثيقة
                          </span>
                        </div>
                      );
                    })}
                </div>
              ))}
            </>
          )}
        </div>
      ) : view === "freq" ? (
        <div className={styles.statwrap}>
          {!freq.length ? (
            <div className={styles.empty}>لا بيانات — أضف وثائق أولاً.</div>
          ) : (
            <>
              <h3>الكلمات الأكثر تكراراً (مجمّعة بمختلف صيغها، بلا أسماء الأطراف) — اضغط أي كلمة للبحث ({freq.length} مجموعة)</h3>
              {freq.map((r) => (
                <div key={r.word} className={styles.sbar}>
                  <button
                    type="button"
                    title={r.forms.join("، ")}
                    style={{ width: 130, flex: "none", textAlign: "start", background: "none", border: "none", color: "inherit", font: "inherit", padding: 0, cursor: "pointer", textDecoration: "underline dotted" }}
                    onClick={() => applyFilterAndGo(() => setQuery(r.word))}
                  >
                    {r.word}
                  </button>
                  <span style={{ height: 16, background: "var(--accent)", borderRadius: 4, minWidth: 4, width: Math.max(4, (260 * r.count) / (freq[0].count || 1)) }} />
                  <span style={{ color: "var(--mut)", fontSize: 12 }}>
                    {r.count} مرة · {r.docCount} وثيقة
                  </span>
                </div>
              ))}
            </>
          )}
        </div>
      ) : (
        <div className={styles.tableView}>
          {view === "timeline" ? (
            derived.timeline.length ? (
              <table>
                <thead>
                  <tr>
                    <th>التاريخ</th>
                    <th>الوثيقة</th>
                    <th>النوع</th>
                  </tr>
                </thead>
                <tbody>
                  {derived.timeline.map((r, i) => (
                    <tr key={i}>
                      <td>{r.date}</td>
                      <td>
                        <button style={{ background: "none", border: "none", color: "var(--accent)", cursor: "pointer", font: "inherit", padding: 0 }} onClick={() => applyFilterAndGo(() => openDoc(r.doc.code))}>
                          {r.doc.title}
                        </button>
                      </td>
                      <td>{r.doc.type.name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className={styles.empty}>لا تواريخ مستخرَجة بعد.</div>
            )
          ) : view === "deeds" ? (
            derived.deeds.length ? (
              <table>
                <thead>
                  <tr>
                    <th>رقم الصك</th>
                    <th>الوثيقة</th>
                    <th>النوع</th>
                  </tr>
                </thead>
                <tbody>
                  {derived.deeds.map((r, i) => (
                    <tr key={i}>
                      <td style={{ fontFamily: "monospace" }}>{r.deed}</td>
                      <td>
                        <button style={{ background: "none", border: "none", color: "var(--accent)", cursor: "pointer", font: "inherit", padding: 0 }} onClick={() => applyFilterAndGo(() => openDoc(r.doc.code))}>
                          {r.doc.title}
                        </button>
                      </td>
                      <td>{r.doc.type.name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className={styles.empty}>لا أرقام صكوك مستخرَجة بعد.</div>
            )
          ) : view === "amounts" ? (
            derived.amounts.length ? (
              <>
                <h4>أكبر المبالغ (رسم)</h4>
                <div className={styles.bars}>
                  {derived.amounts.slice(0, 12).map((r, i) => (
                    <div key={i} className="b" style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                      <span style={{ width: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.amount}</span>
                      <span style={{ height: 14, background: "var(--accent)", borderRadius: 3, width: Math.max(2, (260 * r.value) / (derived.amounts[0].value || 1)) }} />
                    </div>
                  ))}
                </div>
                <table>
                  <thead>
                    <tr>
                      <th>المبلغ</th>
                      <th>الوثيقة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {derived.amounts.map((r, i) => (
                      <tr key={i}>
                        <td>{r.amount}</td>
                        <td>
                          <button style={{ background: "none", border: "none", color: "var(--accent)", cursor: "pointer", font: "inherit", padding: 0 }} onClick={() => applyFilterAndGo(() => openDoc(r.doc.code))}>
                            {r.doc.title}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            ) : (
              <div className={styles.empty}>لا مبالغ مستخرَجة بعد.</div>
            )
          ) : view === "laws" ? (
            derived.laws.length ? (
              <table>
                <thead>
                  <tr>
                    <th>النظام / المادة</th>
                    <th>مرات الورود</th>
                    <th>عدد الوثائق</th>
                  </tr>
                </thead>
                <tbody>
                  {derived.laws.map(([law, info]) => (
                    <tr key={law}>
                      <td>
                        <button style={{ background: "none", border: "none", color: "var(--accent)", cursor: "pointer", font: "inherit", padding: 0 }} onClick={() => applyFilterAndGo(() => setQuery(`"${law}"`))}>
                          {law}
                        </button>
                      </td>
                      <td>{info.count}</td>
                      <td>{info.docs.size}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className={styles.empty}>لا إحالات نظامية مستخرَجة بعد.</div>
            )
          ) : (
            // المحطات — دورة الحياة الإجرائية من المرجع
            <table>
              <thead>
                <tr>
                  <th>المرحلة</th>
                  <th>الحدث</th>
                  <th>مخرجاتها المعتادة</th>
                  <th>وثائق الجلسة المطابقة</th>
                </tr>
              </thead>
              <tbody>
                {legalDocumentReference.lifecycle.map((stage) => {
                  const outputNames = stage.outputs.map(
                    (code) => legalDocumentReference.doc_types.find((t) => t.code === code)?.name ?? code
                  );
                  const matching = docs.filter((d) => stage.outputs.includes(d.type.code));
                  return (
                    <tr key={stage.stage}>
                      <td>
                        {stage.stage}. {stage.name}
                      </td>
                      <td>{stage.event}</td>
                      <td>{outputNames.join("، ")}</td>
                      <td>
                        {matching.length
                          ? matching.map((d) => (
                              <button key={d.code} style={{ display: "block", background: "none", border: "none", color: "var(--accent)", cursor: "pointer", font: "inherit", padding: 0, textAlign: "start" }} onClick={() => applyFilterAndGo(() => openDoc(d.code))}>
                                {d.title}
                              </button>
                            ))
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      <button ref={selpopRef} className={styles.selpop} style={{ display: "none" }} onClick={saveQuote}>
        ＋ حفظ كمقتطف
      </button>

      {exportOpen ? (
        <div className={styles.modal} onClick={(e) => e.target === e.currentTarget && setExportOpen(false)}>
          <div className={styles.panel}>
            <button className="x" style={{ float: "left", border: "none", background: "none", cursor: "pointer", fontSize: 18, color: "var(--mut)" }} onClick={() => setExportOpen(false)}>
              ×
            </button>
            <h3>تصدير المستندات</h3>
            <div className="opt" style={{ margin: "8px 0", fontSize: 14 }}>
              <b>النطاق:</b>
              <label style={{ display: "flex", gap: 5, alignItems: "center", margin: "3px 0", cursor: "pointer" }}>
                <input type="radio" checked={exportScope === "selected"} onChange={() => setExportScope("selected")} /> المحدد ({selected.size})
              </label>
              <label style={{ display: "flex", gap: 5, alignItems: "center", margin: "3px 0", cursor: "pointer" }}>
                <input type="radio" checked={exportScope === "match"} onChange={() => setExportScope("match")} /> المطابق ({filtered.length})
              </label>
              <label style={{ display: "flex", gap: 5, alignItems: "center", margin: "3px 0", cursor: "pointer" }}>
                <input type="radio" checked={exportScope === "all"} onChange={() => setExportScope("all")} /> الكل ({docs.length})
              </label>
            </div>
            <div className="opt" style={{ margin: "8px 0", fontSize: 14 }}>
              <label style={{ display: "flex", gap: 5, alignItems: "center", cursor: "pointer" }}>
                <input type="checkbox" checked={includeText} onChange={(e) => setIncludeText(e.target.checked)} /> تضمين النص الكامل
              </label>
            </div>
            <div className={styles.acts}>
              <button onClick={() => doExport("word")}>Word</button>
              <button onClick={() => doExport("print")}>طباعة / PDF</button>
              <button className={styles.tab} onClick={() => doExport("html")}>
                HTML
              </button>
              <button className={styles.tab} onClick={() => doExport("csv")}>
                بطاقات CSV
              </button>
              <button className={styles.tab} onClick={() => doExport("quotes")}>
                المقتطفات/الملاحظات
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {addOpen ? (
        <div className={styles.modal} onClick={(e) => e.target === e.currentTarget && setAddOpen(false)}>
          <div className={styles.panel}>
            <button style={{ float: "left", border: "none", background: "none", cursor: "pointer", fontSize: 18, color: "var(--mut)" }} onClick={() => setAddOpen(false)}>
              ×
            </button>
            <h3>إضافة وثيقة للفحص</h3>
            <p className={styles.hint}>
              يُصنَّف النوع والجهة ويُولَّد الرمز وتُستخرج الكيانات فوراً في متصفحك — دون إرسال النص لأي خادم ودون أي تخزين.
            </p>
            <label className={styles.fieldLbl}>عنوان الوثيقة</label>
            <input type="text" value={draftTitle} onChange={(e) => setDraftTitle(e.target.value)} placeholder="مثال: صك حكم — نزاع تنفيذ عقد توريد" />
            <label className={styles.fieldLbl}>نص الوثيقة (يشمل الترويسة إن وجدت)</label>
            <textarea value={draftText} onChange={(e) => setDraftText(e.target.value)} placeholder="المملكة العربية السعودية · وزارة العدل · …" />
            <div className={styles.acts}>
              <button onClick={addDocument} disabled={!draftTitle.trim() || draftText.trim().length < 20}>
                فحص وإضافة
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {casesOpen ? (
        <div className={styles.modal} onClick={(e) => e.target === e.currentTarget && setCasesOpen(false)}>
          <div className={styles.panel}>
            <button
              style={{ float: "left", border: "none", background: "none", cursor: "pointer", fontSize: 18, color: "var(--mut)" }}
              onClick={() => setCasesOpen(false)}
            >
              ×
            </button>
            <h3><FolderIcon size={15} /> قضاياي المحفوظة</h3>
            <p className={styles.hint}>تُحفظ القضايا في قاعدة بيانات المنصة مرتبطةً بهذا المتصفح، وتشمل الوثائق والملاحظات والأعلام والمقتطفات.</p>
            {savedCases.length === 0 ? (
              <div className={styles.empty} style={{ margin: "24px 0" }}>
                لا قضايا محفوظة بعد — أضف وثائق ثم اضغط «حفظ».
              </div>
            ) : (
              savedCases.map((c) => (
                <div key={c.id} className={styles.quote}>
                  <b>{c.title}</b> — {c.docCount} وثيقة
                  <div style={{ color: "var(--mut)", fontSize: 11.5, marginTop: 4, display: "flex", gap: 12 }}>
                    <span title={c.updatedAt.slice(0, 10)}>{formatHijri(c.updatedAt)}</span>
                    <button
                      style={{ border: "none", background: "none", color: "var(--accent)", cursor: "pointer", fontSize: 12 }}
                      onClick={() => void loadCase(c.id)}
                    >
                      فتح
                    </button>
                    <button
                      style={{ border: "none", background: "none", color: "#b91c1c", cursor: "pointer", fontSize: 12 }}
                      onClick={() => void deleteCase(c.id)}
                    >
                      حذف
                    </button>
                    {loadedCaseId === c.id ? <span>← المفتوحة الآن</span> : null}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}

      {driveOpen ? (
        <div className={styles.modal} onClick={(e) => e.target === e.currentTarget && setDriveOpen(false)}>
          <div className={styles.panel}>
            <button
              style={{ float: "left", border: "none", background: "none", cursor: "pointer", fontSize: 18, color: "var(--mut)" }}
              onClick={() => setDriveOpen(false)}
            >
              ×
            </button>
            <h3>▲ استيراد من Google Drive</h3>
            <p className={styles.hint}>مستندات Google تُستورد نصاً مباشرةً؛ ملفات PDF وWord تُنزَّل وتُستخرج في متصفحك (مع OCR للممسوح).</p>
            <div style={{ display: "flex", gap: 6, margin: "10px 0" }}>
              <input
                type="text"
                placeholder="بحث بالاسم…"
                value={driveQuery}
                onChange={(e) => setDriveQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void loadDriveFiles(driveQuery)}
                style={{ flex: 1, border: "1px solid var(--line)", borderRadius: 8, padding: "8px 10px", background: "var(--pane)", color: "inherit" }}
              />
              <button className={styles.tab} onClick={() => void loadDriveFiles(driveQuery)}>
                بحث
              </button>
            </div>
            {driveBusy ? (
              <div className={styles.empty} style={{ margin: "16px 0" }}>
                ⏳ جارٍ…
              </div>
            ) : driveFiles.length === 0 ? (
              <div className={styles.empty} style={{ margin: "16px 0" }}>
                لا ملفات — جرّب البحث أو تأكّد من وجود مستندات في Drive.
              </div>
            ) : (
              driveFiles.map((f) => (
                <div key={f.id} className={styles.quote} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 13, wordBreak: "break-word" }}>{f.name}</span>
                  <button className={styles.tab} style={{ flex: "none" }} disabled={driveBusy} onClick={() => void importFromDrive(f)}>
                    استيراد
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
