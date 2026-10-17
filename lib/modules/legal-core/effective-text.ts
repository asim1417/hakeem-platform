/**
 * المصدر الواحد للنص الساري للمادة.
 *
 * النص المعروض في أي مكان = textAsOf(content, unit_version, asOf ?? الآن).
 * المادة الملغاة (آخر سجل تحقق «ملغاة») لا تُعرض نصًّا ساريًا: يُعاد سطر الإلغاء وسنده.
 * article_versions لا تُستعمل هنا: هي للقراءة التاريخية فقط.
 *
 * حدود معروفة:
 * - سجل الإلغاء بلا تاريخ إلغاء، فيُطبَّق الإلغاء على أي asOf (حتى الماضي)، ويغلب أي نسخة.
 * - تعذّر قراءة الجدولين = النص المحفوظ (سقوط آمن كما في verification-read).
 */
import { prisma } from "@/lib/prisma";
import {
  citationFlagsFromVerification,
  textAsOf,
  type UnitVersionRecord,
  type VerificationRecord,
} from "./verified-status";
import { latestVerifications, unitVersionsFor } from "./verification-read";

export interface EffectiveArticleText {
  articleId: string;
  /** النص الساري، أو سطر الإلغاء إن كانت المادة ملغاة. */
  text: string;
  /** النص المحفوظ في legal_articles.content كما ورد (للقراءة التاريخية). */
  originalText: string;
  repealed: boolean;
  /** حالة آخر سجل تحقق، أو «الحالة قيد التحقق من المصدر». */
  status: string;
  source: "unit_version" | "original" | "repeal";
  versionId: string | null;
  validFrom: string | null;
  validTo: string | null;
  evidenceInstrument: string | null;
  evidenceUrl: string | null;
  /** سطر الاستناد: النسخة وتاريخها، أو الإلغاء وسنده. */
  basis: string;
}

const day = (iso: string | null) => (iso ? iso.slice(0, 10) : null);

export function repealLine(verification: VerificationRecord | null): string {
  const instrument = verification?.evidenceInstrument?.trim();
  return instrument ? `أُلغيت هذه المادة بموجب ${instrument}` : "أُلغيت هذه المادة";
}

/** دالة نقية: تختار النص الساري لمادة واحدة من نصها الأصلي ونسخها وسجل تحققها. */
export function resolveEffectiveText(input: {
  articleId: string;
  baseText: string;
  versions: UnitVersionRecord[];
  verification: VerificationRecord | null;
  asOf?: Date;
}): EffectiveArticleText {
  const asOf = input.asOf ?? new Date();
  const flags = citationFlagsFromVerification(input.verification);
  const base = input.baseText ?? "";

  if (flags.repealed) {
    return {
      articleId: input.articleId,
      text: repealLine(input.verification),
      originalText: base,
      repealed: true,
      status: flags.statusLabel,
      source: "repeal",
      versionId: null,
      validFrom: null,
      validTo: null,
      evidenceInstrument: input.verification?.evidenceInstrument ?? null,
      evidenceUrl: input.verification?.evidenceUrl ?? null,
      basis: repealLine(input.verification),
    };
  }

  const picked = textAsOf(base, input.versions, asOf);
  const v = picked.version;
  let basis = "النص الأصلي المحفوظ (بلا نسخة مؤرخة بعد)";
  if (v) {
    basis = `معدّلة بموجب ${v.evidenceInstrument ?? "أداة تعديل"} — سارية من ${day(v.validFrom)}`;
    if (picked.validTo) basis += ` حتى ${day(picked.validTo)}`;
  }
  return {
    articleId: input.articleId,
    text: picked.text,
    originalText: base,
    repealed: false,
    // نسخة سارية سند كافٍ: لا «قيد التحقق» على مادة معدّلة بأداة معروفة.
    status: v && !flags.inForce ? "ساري" : flags.statusLabel,
    source: v ? "unit_version" : "original",
    versionId: v?.id ?? null,
    validFrom: v?.validFrom ?? null,
    validTo: picked.validTo,
    evidenceInstrument: v?.evidenceInstrument ?? input.verification?.evidenceInstrument ?? null,
    evidenceUrl: v?.evidenceUrl ?? input.verification?.evidenceUrl ?? null,
    basis,
  };
}

/** دفعة واحدة: نسخ وسجلات تحقق كل المواد باستعلامين. */
export async function effectiveArticleTexts(
  articles: Array<{ id: string; content: string | null }>,
  asOf?: Date,
): Promise<Map<string, EffectiveArticleText>> {
  const out = new Map<string, EffectiveArticleText>();
  if (!articles.length) return out;
  const ids = Array.from(new Set(articles.map((a) => a.id)));
  const [versions, verifications] = await Promise.all([
    unitVersionsFor(ids),
    latestVerifications("unit", ids),
  ]);
  for (const a of articles) {
    out.set(
      a.id,
      resolveEffectiveText({
        articleId: a.id,
        baseText: a.content ?? "",
        versions: versions.get(a.id) ?? [],
        verification: verifications.get(a.id) ?? null,
        asOf,
      }),
    );
  }
  return out;
}

/** بالمعرّفات فقط: يقرأ النص الأصلي ثم يطبّق المصدر الواحد. */
export async function effectiveArticleText(articleIds: string[], asOf?: Date): Promise<Map<string, EffectiveArticleText>> {
  if (!articleIds.length) return new Map();
  const rows = await prisma.legalArticle
    .findMany({ where: { id: { in: articleIds } }, select: { id: true, content: true } })
    .catch(() => [] as Array<{ id: string; content: string | null }>);
  return effectiveArticleTexts(rows, asOf);
}


/**
 * يطبّق المصدر الواحد على صفوف مواد: النص الساري مكان content، والحالة من سجل التحقق
 * («ملغاة» للملغاة، «معدّلة» لمادة لها نسخة سارية). الصف بلا سجلات يبقى كما هو.
 */
export async function applyEffectiveText<T extends { id: string; content: string | null; status?: string | null }>(
  rows: T[],
  asOf?: Date,
): Promise<T[]> {
  if (!rows.length) return rows;
  const effective = await effectiveArticleTexts(rows, asOf).catch(() => new Map<string, EffectiveArticleText>());
  return rows.map((row) => {
    const e = effective.get(row.id);
    if (!e || e.source === "original") return row;
    return { ...row, content: e.text, status: e.repealed ? "ملغاة" : "معدّلة" };
  });
}
