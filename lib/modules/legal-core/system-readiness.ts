import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizeArabic, parseArabicOrdinal } from "./arabic-ordinal";

export type ReadinessSeverity = "BLOCKER" | "WARNING";
export type ReadinessIssue = {
  code: string;
  severity: ReadinessSeverity;
  message: string;
  details?: Record<string, unknown>;
};

export type CouncilDecisionRef = { number: string; hijriDate: string | null };

export type SystemReadinessReport = {
  systemId: string;
  systemName: string;
  status: "NOT_READY" | "REVIEW_REQUIRED" | "READY";
  checkedAt: string;
  articleCount: number;
  documentCount: number;
  councilDecisionRefs: CouncilDecisionRef[];
  issues: ReadinessIssue[];
  metrics: Record<string, number | string | boolean | null>;
};

const OFFICIAL_HOSTS = new Set([
  "ncar.gov.sa", "www.ncar.gov.sa",
  "laws.boe.gov.sa", "boe.gov.sa", "www.boe.gov.sa",
  "uqn.gov.sa", "www.uqn.gov.sa",
]);

function digitsToLatin(value: string): string {
  const ar = "٠١٢٣٤٥٦٧٨٩";
  const fa = "۰۱۲۳۴۵۶۷۸۹";
  return value.replace(/[٠-٩۰-۹]/g, (d) => {
    const ai = ar.indexOf(d);
    if (ai >= 0) return String(ai);
    return String(fa.indexOf(d));
  });
}

export function normalizeInstrumentNumber(value: string | null | undefined): string {
  return digitsToLatin(value ?? "")
    .replace(/[()（）]/g, "")
    .replace(/\s+/g, "")
    .replace(/[ـ،,]/g, "")
    .trim()
    .toLowerCase();
}

export function normalizeHijriDate(value: string | null | undefined): string {
  return digitsToLatin(value ?? "")
    .replace(/هـ|ه/g, "")
    .replace(/[.\-]/g, "/")
    .replace(/\s+/g, "")
    .replace(/\/{2,}/g, "/")
    .trim();
}

export function extractCouncilDecisionRefs(text: string): CouncilDecisionRef[] {
  const normalized = digitsToLatin(text);
  const refs = new Map<string, CouncilDecisionRef>();
  const patterns = [
    /قرار\s+مجلس\s+الوزراء\s+رقم\s*\(?\s*([0-9]+(?:\s*\/\s*[0-9]+)*)\s*\)?\s*(?:و?تاريخ|بتاريخ)\s*([0-9]{1,4}\s*\/\s*[0-9]{1,2}\s*\/\s*[0-9]{2,4})\s*هـ?/gu,
    /قرار\s+مجلس\s+الوزراء\s+رقم\s*\(?\s*([0-9]+(?:\s*\/\s*[0-9]+)*)\s*\)?/gu,
  ];
  for (const pattern of patterns) {
    for (const match of normalized.matchAll(pattern)) {
      const number = normalizeInstrumentNumber(match[1]);
      if (!number) continue;
      const date = match[2] ? normalizeHijriDate(match[2]) : null;
      const existing = refs.get(number);
      if (!existing || (!existing.hijriDate && date)) refs.set(number, { number, hijriDate: date });
    }
  }
  return [...refs.values()];
}

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function isOfficialUrl(raw: string | null): boolean {
  if (!raw) return false;
  try {
    const u = new URL(raw);
    return u.protocol === "https:" && OFFICIAL_HOSTS.has(u.hostname.toLowerCase());
  } catch {
    return false;
  }
}

function normalizedStartsWith(actual: string, expected: string): boolean {
  return normalizeArabic(actual).trim().startsWith(normalizeArabic(expected).trim());
}

function canonicalLegalText(value: string): string {
  return normalizeArabic(value)
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function officialArticleSlices(units: Array<{ unitType: string; number: string | null; path: string; ordinal: number; textRaw: string }>): Map<number, string> {
  const sorted = [...units].sort((a, b) => a.ordinal - b.ordinal);
  const out = new Map<number, string>();
  for (const unit of sorted) {
    if (unit.unitType !== "ARTICLE" || !unit.number) continue;
    const n = Number(unit.number);
    if (!Number.isFinite(n) || n <= 0) continue;
    const subtree = sorted
      .filter((candidate) => candidate.path === unit.path || candidate.path.startsWith(unit.path + "/"))
      .map((candidate) => candidate.textRaw)
      .join("");
    if (subtree.trim()) out.set(n, subtree);
  }
  return out;
}

const KNOWN_LAW_GUARDS: Record<string, {
  expectedCount: number;
  anchors: Array<[number, string, string]>;
}> = {
  "نظام المعاملات المدنية": {
    expectedCount: 721,
    anchors: [
      [236, "إذا تعدد المدينون", "تعدد المدينين"],
      [237, "إذا تعدد الدائنون", "المادة التي كان سقوطها سبب الزحف السابق"],
      [238, "للدائن أن يحيل حقه", "حوالة الحق"],
      [466, "إذا أخل المقاول", "إعذار المقاول وطلب الفسخ"],
      [469, "يلتزم صاحب العمل بالوفاء بالأجر", "أجر الأجزاء المنجزة"],
      [475, "ينتهي عقد المقاولة", "انتهاء عقد المقاولة"],
      [721, "يُعمل بهذا النظام", "النفاذ"],
    ],
  },
};

function addIssue(issues: ReadinessIssue[], code: string, severity: ReadinessSeverity, message: string, details?: Record<string, unknown>) {
  issues.push({ code, severity, message, ...(details ? { details } : {}) });
}

function documentReconstructs(doc: { rawText: string; units: Array<{ textRaw: string; ordinal: number }> }): boolean {
  return [...doc.units].sort((a, b) => a.ordinal - b.ordinal).map((u) => u.textRaw).join("") === doc.rawText;
}

function inspectProvenance(
  issues: ReadinessIssue[],
  doc: { id: string; docType: string; sourceUrl: string | null; sourceCode: string | null; contentSha256: string | null; verificationStatus: string; rawText: string },
  label: string,
) {
  if (!isOfficialUrl(doc.sourceUrl)) {
    addIssue(issues, "OFFICIAL_SOURCE_MISSING", "BLOCKER", `${label}: لا يوجد رابط مصدر رسمي معتمد.`, { documentId: doc.id, sourceUrl: doc.sourceUrl });
  }
  if (!doc.sourceCode) {
    addIssue(issues, "SOURCE_CODE_MISSING", "BLOCKER", `${label}: رمز المصدر الرسمي غير مسجل.`, { documentId: doc.id });
  }
  const hash = sha256(doc.rawText);
  if (!doc.contentSha256 || doc.contentSha256 !== hash) {
    addIssue(issues, "SOURCE_HASH_MISMATCH", "BLOCKER", `${label}: بصمة SHA-256 مفقودة أو لا تطابق النص المخزن.`, {
      documentId: doc.id,
      stored: doc.contentSha256,
      calculated: hash,
    });
  }
  if (doc.verificationStatus === "UNVERIFIED" || doc.verificationStatus === "REVIEW_REQUIRED") {
    addIssue(issues, "DOCUMENT_NOT_VERIFIED", "BLOCKER", `${label}: الوثيقة لم تجتز تحقق المصدر.`, {
      documentId: doc.id,
      verificationStatus: doc.verificationStatus,
    });
  }
}

export async function auditSystemReadiness(systemId: string): Promise<SystemReadinessReport> {
  const system = await prisma.legalSystem.findUnique({
    where: { id: systemId },
    select: {
      id: true,
      name: true,
      articleCount: true,
      articles: {
        where: { articleNumber: { gt: 0 } },
        orderBy: { articleNumber: "asc" },
        select: {
          id: true,
          articleNumber: true,
          title: true,
          content: true,
          royalDecree: true,
          status: true,
        },
      },
      documents: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          docType: true,
          number: true,
          hijriDate: true,
          rawText: true,
          sourceGuid: true,
          sourceUrl: true,
          sourceCode: true,
          sourceDocumentId: true,
          contentSha256: true,
          verificationStatus: true,
          units: {
            orderBy: { ordinal: "asc" },
            select: { id: true, unitType: true, ordinal: true, number: true, labelAr: true, textRaw: true, path: true },
          },
        },
      },
    },
  });
  if (!system) throw new Error(`SYSTEM_NOT_FOUND:${systemId}`);

  const issues: ReadinessIssue[] = [];
  const articles = system.articles;
  const documents = system.documents;
  const nums = articles.map((a) => a.articleNumber);
  const max = nums.length ? Math.max(...nums) : 0;
  const numberSet = new Set(nums);
  const gaps: number[] = [];
  for (let n = 1; n <= max; n++) if (!numberSet.has(n)) gaps.push(n);

  if (!articles.length) addIssue(issues, "NO_ARTICLES", "BLOCKER", "لا توجد مواد نظامية موجبة الرقم.");
  if (gaps.length) addIssue(issues, "ARTICLE_NUMBER_GAPS", "BLOCKER", `يوجد فراغ في تسلسل المواد: ${gaps.slice(0, 20).join(", ")}`, { gaps: gaps.slice(0, 100) });
  if (system.articleCount !== articles.length) {
    addIssue(issues, "ARTICLE_COUNT_DRIFT", "BLOCKER", "عداد legal_systems.articleCount لا يساوي العدد الفعلي للمواد.", {
      stored: system.articleCount, actual: articles.length,
    });
  }

  let parsedTitles = 0;
  const titleMismatches: Array<{ stored: number; titleSays: number }> = [];
  const textHashes = new Map<string, number[]>();
  for (const article of articles) {
    if (!article.content.trim()) addIssue(issues, "EMPTY_ARTICLE", "BLOCKER", `المادة ${article.articleNumber} بلا نص.`);
    const parsed = parseArabicOrdinal(article.title ?? "");
    if (parsed !== null) {
      parsedTitles++;
      if (parsed !== article.articleNumber) titleMismatches.push({ stored: article.articleNumber, titleSays: parsed });
    }
    const h = sha256(normalizeArabic(article.content).trim());
    textHashes.set(h, [...(textHashes.get(h) ?? []), article.articleNumber]);
  }
  if (titleMismatches.length) {
    addIssue(issues, "ARTICLE_NUMBER_TITLE_MISMATCH", "BLOCKER", "رقم مادة لا يطابق الرقم الوارد في عنوانها؛ هذا نمط زحف/انزياح.", {
      mismatches: titleMismatches.slice(0, 50),
    });
  }
  for (const ns of textHashes.values()) {
    if (ns.length > 1) addIssue(issues, "DUPLICATE_ARTICLE_TEXT", "BLOCKER", `نص مكرر حرفياً/تطبيعياً في المواد: ${ns.join(", ")}`, { articleNumbers: ns });
  }

  const guard = KNOWN_LAW_GUARDS[system.name];
  if (guard) {
    if (articles.length !== guard.expectedCount) {
      addIssue(issues, "KNOWN_LAW_COUNT_MISMATCH", "BLOCKER", `${system.name}: العدد ${articles.length} لا يطابق المرجع الحاكم ${guard.expectedCount}.`);
    }
    for (const [n, head, label] of guard.anchors) {
      const actual = articles.find((a) => a.articleNumber === n)?.content ?? "";
      if (!normalizedStartsWith(actual, head)) {
        addIssue(issues, "KNOWN_LAW_ANCHOR_MISMATCH", "BLOCKER", `${system.name}: مرساة المادة ${n} لا تطابق «${label}»؛ احتمال زحف أو نص خاطئ.`, {
          articleNumber: n, expectedHead: head, actualHead: actual.slice(0, 100),
        });
      }
    }
  }

  const systemDocs = documents.filter((d) => d.docType === "SYSTEM_TEXT");
  if (!systemDocs.length) {
    addIssue(issues, "SYSTEM_TEXT_DOCUMENT_MISSING", "BLOCKER", "النص الرسمي الكامل للنظام غير محفوظ كوثيقة SYSTEM_TEXT.");
  } else {
    const doc = systemDocs[systemDocs.length - 1];
    inspectProvenance(issues, doc, "نص النظام");
    if (!documentReconstructs(doc)) addIssue(issues, "SYSTEM_TEXT_RECONSTRUCTION_FAILED", "BLOCKER", "وحدات نص النظام لا تعيد تكوين النص الرسمي حرفياً.");
    const articleUnits = doc.units.filter((u) => u.unitType === "ARTICLE");
    const unitNumbers = articleUnits.map((u) => Number(u.number)).filter((n) => Number.isFinite(n) && n > 0);
    if (unitNumbers.length && unitNumbers.length !== articles.length) {
      addIssue(issues, "SYSTEM_TEXT_ARTICLE_COUNT_MISMATCH", "BLOCKER", "عدد وحدات ARTICLE في الوثيقة الرسمية لا يساوي عدد legal_articles.", {
        documentArticles: unitNumbers.length, legalArticles: articles.length,
      });
    }

    if (unitNumbers.length) {
      const officialSlices = officialArticleSlices(doc.units);
      const dbNumbers = new Set(articles.map((a) => a.articleNumber));
      const officialNumbers = new Set(officialSlices.keys());
      const missingInDb = [...officialNumbers].filter((n) => !dbNumbers.has(n));
      const missingInOfficial = [...dbNumbers].filter((n) => !officialNumbers.has(n));
      if (missingInDb.length || missingInOfficial.length) {
        addIssue(issues, "SYSTEM_TEXT_NUMBER_SET_MISMATCH", "BLOCKER", "مجموعة أرقام المواد في النص الرسمي لا تطابق مجموعة أرقام legal_articles.", {
          officialOnly: missingInDb.slice(0, 100),
          databaseOnly: missingInOfficial.slice(0, 100),
        });
      }

      const textMismatches: Array<{ articleNumber: number; databaseHead: string; officialHead: string }> = [];
      for (const article of articles) {
        const official = officialSlices.get(article.articleNumber);
        if (!official || article.content.trim().length < 15) continue;
        const dbText = canonicalLegalText(article.content);
        const officialText = canonicalLegalText(official);
        if (dbText.length >= 20 && !officialText.includes(dbText)) {
          textMismatches.push({
            articleNumber: article.articleNumber,
            databaseHead: article.content.slice(0, 100),
            officialHead: official.slice(0, 140),
          });
        }
      }
      if (textMismatches.length) {
        addIssue(issues, "ARTICLE_OFFICIAL_TEXT_MISMATCH", "BLOCKER", "نص مادة في legal_articles لا يطابق المادة ذات الرقم نفسه في النص الرسمي؛ قد يكون زحفاً أو نسخة قديمة.", {
          count: textMismatches.length,
          mismatches: textMismatches.slice(0, 50),
        });
      }
    }
  }

  const looksLikeStatute = /^نظام\b/u.test(system.name.trim());
  const royalDecrees = documents.filter((d) => d.docType === "ROYAL_DECREE");
  const otherApproval = documents.filter((d) => d.docType === "COUNCIL_DECISION" || d.docType === "AGENCY_DECISION");
  const articleMentionsRoyal = articles.some((a) => Boolean(a.royalDecree?.trim()));

  if ((looksLikeStatute || articleMentionsRoyal) && !royalDecrees.length) {
    addIssue(issues, "ROYAL_DECREE_MISSING", "BLOCKER", "النظام يحتاج مرسومه الملكي كاملاً، وليس رقم المرسوم في حقل المادة فقط.");
  } else if (!royalDecrees.length && !otherApproval.length) {
    addIssue(issues, "APPROVAL_INSTRUMENT_MISSING", "BLOCKER", "لا توجد أداة اعتماد/إصدار رسمية مرتبطة بالنظام.");
  }

  const councilRefs: CouncilDecisionRef[] = [];
  for (const decree of royalDecrees) {
    inspectProvenance(issues, decree, `المرسوم الملكي ${decree.number ?? ""}`.trim());
    if (!documentReconstructs(decree)) addIssue(issues, "ROYAL_DECREE_RECONSTRUCTION_FAILED", "BLOCKER", "وحدات المرسوم لا تعيد تكوين نصه حرفياً.", { documentId: decree.id });

    const types = new Set(decree.units.map((u) => u.unitType));
    if (!types.has("INSTRUMENT_OPENING")) addIssue(issues, "ROYAL_DECREE_OPENING_MISSING", "BLOCKER", "مقدمة/افتتاحية المرسوم الملكي غير محفوظة أو لم تُحلل.", { documentId: decree.id });
    if (!types.has("RECITAL")) addIssue(issues, "ROYAL_DECREE_RECITALS_MISSING", "BLOCKER", "استنادات «بناءً على/بعد الاطلاع» في المرسوم مفقودة.", { documentId: decree.id });
    if (!types.has("INSTRUMENT_CLAUSE")) addIssue(issues, "ROYAL_DECREE_CLAUSES_MISSING", "BLOCKER", "بنود منطوق المرسوم غير محفوظة؛ قد تتضمن أحكاماً موضوعية مستقلة.", { documentId: decree.id });
    if (!types.has("SIGNATURE")) addIssue(issues, "ROYAL_DECREE_SIGNATURE_UNPARSED", "WARNING", "توقيع/خاتمة المرسوم لم تُلتقط كوحدة مستقلة.", { documentId: decree.id });

    const refs = extractCouncilDecisionRefs(decree.rawText);
    for (const ref of refs) if (!councilRefs.some((r) => r.number === ref.number)) councilRefs.push(ref);
    if (!refs.length) {
      addIssue(issues, "CABINET_DECISION_REFERENCE_NOT_FOUND", "WARNING", "لم يُستخرج من المرسوم مرجع قرار مجلس الوزراء؛ يلزم التحقق من اكتمال الديباجة أو من طبيعة أداة الإصدار.", { documentId: decree.id });
    }
  }

  const cabinetDocs = documents.filter((d) => d.docType === "COUNCIL_DECISION");
  for (const ref of councilRefs) {
    const match = cabinetDocs.find((d) => normalizeInstrumentNumber(d.number) === ref.number);
    if (!match) {
      addIssue(issues, "CABINET_DECISION_MISSING", "BLOCKER", `قرار مجلس الوزراء رقم ${ref.number} المشار إليه في المرسوم غير محفوظ كوثيقة مستقلة.`, {
        number: ref.number, hijriDate: ref.hijriDate,
      });
      continue;
    }
    inspectProvenance(issues, match, `قرار مجلس الوزراء ${match.number ?? ref.number}`);
    if (!documentReconstructs(match)) addIssue(issues, "CABINET_DECISION_RECONSTRUCTION_FAILED", "BLOCKER", "وحدات قرار مجلس الوزراء لا تعيد تكوين النص حرفياً.", { documentId: match.id });
    if (!/مجلس\s+الوزراء/u.test(match.rawText)) addIssue(issues, "CABINET_DECISION_IDENTITY_WEAK", "BLOCKER", "الوثيقة المصنفة قرار مجلس الوزراء لا تحمل هوية القرار في نصها.", { documentId: match.id });
    if (!match.units.some((u) => u.unitType === "INSTRUMENT_CLAUSE")) {
      addIssue(issues, "CABINET_DECISION_CLAUSES_MISSING", "BLOCKER", "منطوق قرار مجلس الوزراء لم يُحفظ/يُحلل كاملاً.", { documentId: match.id });
    }
    if (ref.hijriDate && match.hijriDate && normalizeHijriDate(match.hijriDate) !== ref.hijriDate) {
      addIssue(issues, "CABINET_DECISION_DATE_MISMATCH", "BLOCKER", "تاريخ قرار مجلس الوزراء لا يطابق التاريخ المشار إليه في المرسوم.", {
        decreeReference: ref.hijriDate, documentDate: match.hijriDate,
      });
    }
  }

  const blockers = issues.filter((i) => i.severity === "BLOCKER").length;
  const warnings = issues.filter((i) => i.severity === "WARNING").length;
  const status: SystemReadinessReport["status"] = blockers ? "NOT_READY" : warnings ? "REVIEW_REQUIRED" : "READY";

  return {
    systemId: system.id,
    systemName: system.name,
    status,
    checkedAt: new Date().toISOString(),
    articleCount: articles.length,
    documentCount: documents.length,
    councilDecisionRefs: councilRefs,
    issues,
    metrics: {
      storedArticleCount: system.articleCount,
      maxArticleNumber: max,
      gaps: gaps.length,
      parsedOrdinalTitles: parsedTitles,
      ordinalTitleCoverage: articles.length ? Number((parsedTitles / articles.length).toFixed(4)) : 0,
      royalDecrees: royalDecrees.length,
      cabinetDecisions: cabinetDocs.length,
      systemTexts: systemDocs.length,
      blockers,
      warnings,
    },
  };
}

export async function persistSystemReadiness(report: SystemReadinessReport): Promise<void> {
  await prisma.legalSystem.update({
    where: { id: report.systemId },
    data: {
      launchStatus: report.status,
      launchValidatedAt: new Date(report.checkedAt),
      launchIssues: report.issues as Prisma.InputJsonValue,
      completeness: report.status === "READY" ? "COMPLETE" : "IN_PROGRESS",
    },
  });
}
