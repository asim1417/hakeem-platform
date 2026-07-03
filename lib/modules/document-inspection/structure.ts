// تحليل بنية الوثيقة: فصل الترويسة/المتن/التذييل (الهوامش)، واستخراج حقول حسب النوع.
// يوازي ما تفعله محرّكات Document AI الكبرى (تحليل تخطيط + استخراج حسب النوع)،
// لكن حتمياً وبلا شبكة، ومستنداً إلى المرجع التشغيلي (key_fields, header_pattern).

import { legalDocumentReference } from "./reference";
import { isBoilerplateLine, normStr } from "./search";
import type { AnalyzedDocument, Issuer } from "./types";

// ── إشارات الترويسة والتذييل ──

const HEADER_SIGNALS = ["المملكه العربيه السعوديه", "وزاره العدل", "بسم الله الرحمن الرحيم", "الحمد لله"].map(normStr);

const FOOTER_SIGNALS = [
  "رمز التحقق",
  "رقم الوثيقه",
  "التوقيع",
  "الختم",
  "حرر في",
  "صفحه",
  "ص .",
  "موثق",
  "كاتب العدل",
  "امين السجل"
].map(normStr);

// مصطلحات ترويسة عامة تظهر في المتن أيضاً — تُستبعد من كشف الترويسة
const GENERIC_HEADER_STOP = ["الدائره", "رقم الصك", "رقم القضيه", "الدايره"].map(normStr);

// بدايات المتن: عند ظهور أيّها تتوقّف الترويسة
const BODY_START = ["حكمت", "انه في", "انه بتاريخ", "بناء علي", "وبعد", "اتفق", "تقدم", "نفيد", "الحمد لله وبعد"].map(normStr);

function issuerHeaderTerms(issuerCode: string): string[] {
  const issuer = legalDocumentReference.issuers.find((i: Issuer) => i.code === issuerCode);
  if (!issuer) return [];
  return issuer.header_pattern.map(normStr).filter((t) => !GENERIC_HEADER_STOP.includes(t));
}

function isBodyStart(line: string): boolean {
  const n = normStr(line);
  return BODY_START.some((b) => n.startsWith(b) || n.includes(` ${b} `));
}

function lineHasAny(line: string, needles: string[]): boolean {
  const n = normStr(line);
  return needles.some((needle) => needle && n.includes(needle));
}

export interface DocumentStructure {
  headerLines: string[]; // منطقة الترويسة (الهامش العلوي)
  bodyText: string; // المتن الفعلي
  footerLines: string[]; // منطقة التذييل (الهامش السفلي/التوثيق)
  /** فهارس أسطر الترويسة والتذييل (0-based) لتظليلها/إخفائها في العرض */
  headerIndexes: number[];
  footerIndexes: number[];
}

/** يفصل الوثيقة إلى ترويسة/متن/تذييل بالاعتماد على نمط ترويسة الجهة وإشارات التوثيق */
export function segmentDocument(rawText: string, issuerCode: string): DocumentStructure {
  const lines = rawText.split("\n");
  const headerTerms = [...HEADER_SIGNALS, ...issuerHeaderTerms(issuerCode)];

  // الترويسة: أسطر أولى تحمل إشارات الترويسة أو boilerplate، حتى أول سطر متن جوهري.
  const headerIndexes: number[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i].trim();
    if (!raw) {
      if (headerIndexes.length) headerIndexes.push(i);
      continue;
    }
    if (isBodyStart(raw)) break; // بدأ المتن — أوقف الترويسة
    if (i < Math.max(6, lines.length * 0.25) && (lineHasAny(raw, headerTerms) || isBoilerplateLine(raw))) {
      headerIndexes.push(i);
    } else break;
  }

  // التذييل: أسطر أخيرة تحمل إشارات التوثيق/التوقيع/الصفحة.
  const footerIndexes: number[] = [];
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const raw = lines[i].trim();
    if (!raw) {
      if (footerIndexes.length) footerIndexes.push(i);
      continue;
    }
    if (i > lines.length * 0.6 && lineHasAny(raw, FOOTER_SIGNALS)) {
      footerIndexes.push(i);
    } else break;
  }

  const headerSet = new Set(headerIndexes);
  const footerSet = new Set(footerIndexes);
  const headerLines = headerIndexes.map((i) => lines[i].trim()).filter(Boolean);
  const footerLines = footerIndexes
    .slice()
    .sort((a, b) => a - b)
    .map((i) => lines[i].trim())
    .filter(Boolean);
  const bodyText = lines
    .filter((_, i) => !headerSet.has(i) && !footerSet.has(i))
    .join("\n")
    .trim();

  return { headerLines, bodyText, footerLines, headerIndexes, footerIndexes };
}

/** يزيل «أثاث الصفحة» المتكرّر عبر صفحات PDF (ترويسة/تذييل يتكرّران) */
export function removePageFurniture(rawText: string): string {
  const pages = rawText.split(/\n?\[صفحة \d+\]\n?/).filter((p) => p.trim());
  if (pages.length < 3) return rawText; // لا فائدة قبل 3 صفحات
  const firstLines = new Map<string, number>();
  const lastLines = new Map<string, number>();
  for (const page of pages) {
    const ls = page.split("\n").map((l) => l.trim()).filter(Boolean);
    if (ls.length) {
      firstLines.set(normStr(ls[0]), (firstLines.get(normStr(ls[0])) ?? 0) + 1);
      lastLines.set(normStr(ls[ls.length - 1]), (lastLines.get(normStr(ls[ls.length - 1])) ?? 0) + 1);
    }
  }
  const repeatedTop = new Set([...firstLines].filter(([, c]) => c >= pages.length * 0.6).map(([k]) => k));
  const repeatedBottom = new Set([...lastLines].filter(([, c]) => c >= pages.length * 0.6).map(([k]) => k));
  if (!repeatedTop.size && !repeatedBottom.size) return rawText;
  return pages
    .map((page) => {
      const ls = page.split("\n");
      let start = 0;
      let end = ls.length;
      while (start < end && (!ls[start].trim() || repeatedTop.has(normStr(ls[start])))) start += 1;
      while (end > start && (!ls[end - 1].trim() || repeatedBottom.has(normStr(ls[end - 1])))) end -= 1;
      return ls.slice(start, end).join("\n");
    })
    .join("\n\n")
    .trim();
}

// ── استخراج الحقول حسب نوع الوثيقة (كل نوع نموذجه) ──

export interface KeyField {
  label: string;
  value: string;
}

function firstMatch(text: string, re: RegExp): string | null {
  const m = text.match(re);
  return m ? (m[1] ?? m[0]).trim() : null;
}

/** يستخرج قيمة حقل واحد باسمه المرجعي، معتمداً على الكيانات المستخرَجة والنص */
function fieldValue(doc: AnalyzedDocument, label: string, structure: DocumentStructure): string | null {
  const parties = doc.entities.filter((e) => e.kind === "party").map((e) => e.value);
  const amounts = doc.entities.filter((e) => e.kind === "amount").map((e) => e.value);
  const deeds = doc.entities.filter((e) => e.kind === "deed").map((e) => e.value);
  const laws = doc.entities.filter((e) => e.kind === "law").map((e) => e.value);
  const body = structure.bodyText || doc.rawText;

  switch (label) {
    case "رقم الصك":
    case "رقم الوثيقة":
    case "رقم الوثيقه":
      return deeds[0] ?? firstMatch(doc.rawText, /(?:رقم\s+(?:الصك|الوثيقة|الوكالة|القضية)|صك\s+رقم)\s*[:：]?\s*([٠-٩\d]{3,})/);
    case "رمز التحقّق":
      return firstMatch(structure.footerLines.join(" ") || doc.rawText, /رمز\s+التحقق\s*[:：]?\s*([A-Za-z٠-٩\d]{4,})/);
    case "الدائرة":
      return firstMatch(doc.rawText, /الدائر[ةه]\s+([^\s،.\n]{2,20})/);
    case "التاريخ":
      return doc.hijriDate;
    case "الأطراف":
      return parties.length ? parties.join(" / ") : null;
    case "المدّعي":
      return firstMatch(body, /(?:المقام[ةه]|المرفوع[ةه]|المقدم[ةه])\s+من\s+(.{3,60}?)(?=\s+(?:ضدّ?|تجاه))/) ?? parties[0] ?? null;
    case "المدّعى عليه":
      return firstMatch(body, /(?:ضدّ?|تجاه)\s+(.{3,60}?)(?=\s*[،,.:؛\n]|\s+في\s|$)/) ?? parties[1] ?? null;
    case "الموكّل":
      return parties[0] ?? null;
    case "الوكيل":
      return parties[1] ?? null;
    case "المرسِل":
      return parties[0] ?? null;
    case "المرسَل إليه":
      return parties[1] ?? null;
    case "المبلغ":
    case "الثمن":
      return amounts.length ? `${amounts[0]} ريال` : null;
    case "الأسانيد النظامية":
      return laws.length ? laws.join(" · ") : null;
    case "المنطوق":
      return firstMatch(body, /(?:لذا\s+)?حكمت\s+الدائر[ةه][^.]*?(?:[.]|$)/) ?? firstMatch(body, /المنطوق\s*[:：]?\s*([^.]{5,180})/);
    case "الجهة":
    case "الجهة الموجَّه إليها":
    case "الجهة الموجّه إليها":
      return doc.issuer.code !== "UNK" ? doc.issuer.name : null;
    case "الموضوع":
      return firstMatch(body, /(?:في\s+شأن|بخصوص|الموضوع\s*[:：])\s*(.{5,80}?)(?=[،.\n]|$)/);
    case "المهلة":
      return firstMatch(body, /خلال\s+(.{2,30}?)(?=[،.\n]|$)/);
    default:
      return null;
  }
}

/** يستخرج حقول الوثيقة وفق نموذج نوعها في المرجع (تفريق حقيقي بين الأنواع) */
export function extractKeyFields(doc: AnalyzedDocument, structure?: DocumentStructure): KeyField[] {
  const docType = legalDocumentReference.doc_types.find((t) => t.code === doc.type.code);
  if (!docType) return [];
  const seg = structure ?? segmentDocument(doc.rawText, doc.issuer.code);
  const out: KeyField[] = [];
  const seen = new Set<string>();
  for (const label of docType.key_fields) {
    const value = fieldValue(doc, label, seg);
    if (value && !seen.has(label)) {
      seen.add(label);
      out.push({ label, value });
    }
  }
  return out;
}

/** مكوّنات بنية النوع (من المرجع) لعرض «ما الذي يُتوقَّع في هذا النوع» */
export function expectedStructure(typeCode: string): string[] {
  const docType = legalDocumentReference.doc_types.find((t) => t.code === typeCode);
  return docType ? docType.structure : [];
}
