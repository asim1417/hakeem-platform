// ─────────────────────────────────────────────────────────────────────────────
// المحقّق (المرحلة ٤) [حرج] — الحارس ضد التلفيق: كل استشهاد يُتحقَّق عبر verify_citation؛
// المُختلَق (غير المؤصَّل في النواة) يُحجَب؛ المؤصَّل يُوسَم بدرجة يقين. لا حكم جازم في اجتهاد.
// المُتحقِّق قابل للحقن (validator) — فيُختبَر «حقن استشهاد وهمي → يُحجَب» دون قاعدة بيانات.
// ─────────────────────────────────────────────────────────────────────────────
import { validateLegalCitation } from "@/lib/modules/legal-core/legal-citation-guard";

export interface CitationCandidate {
  articleId?: string;
  systemName?: string;
  articleNumber?: number;
  quote?: string;
}

export interface VerifiedCitation extends CitationCandidate {
  verified: true;
  citationLabel: string;
  certainty: "high" | "medium";
}

export interface VerificationOutcome {
  verified: VerifiedCitation[];
  blocked: Array<{ candidate: CitationCandidate; reason: string }>;
}

/** توقيع المُتحقِّق — الافتراضي يستعلم القاعدة؛ يُحقَن في الاختبار. */
export type CitationValidator = (
  input: { articleId?: string; systemName?: string; articleNumber?: number }
) => Promise<{ ok: true; articleId: string; systemName: string; articleNumber: number; citationLabel: string } | { ok: false; message: string }>;

/**
 * يتحقّق من قائمة استشهادات مرشّحة. كل مرشّح يمرّ على المُتحقِّق:
 *   • مؤصَّل → verified مع citationLabel ودرجة يقين (high إن كان بمُعرّف صريح، وإلا medium).
 *   • غير مؤصَّل → blocked مع سبب (يُحجَب، لا يظهر في المخرَج).
 */
export async function verifyCitations(
  candidates: CitationCandidate[],
  validator: CitationValidator = validateLegalCitation
): Promise<VerificationOutcome> {
  const verified: VerifiedCitation[] = [];
  const blocked: VerificationOutcome["blocked"] = [];

  for (const c of candidates) {
    // لا مفتاح تأصيل إطلاقًا → مرشّح ملفَّق يُحجَب فورًا.
    if (!c.articleId && !(c.systemName && typeof c.articleNumber === "number")) {
      blocked.push({ candidate: c, reason: "استشهاد بلا مُعرّف/نظام+رقم — غير قابل للتأصيل" });
      continue;
    }
    const r = await validator({ articleId: c.articleId, systemName: c.systemName, articleNumber: c.articleNumber }).catch(
      () => ({ ok: false as const, message: "تعذّر التحقّق" })
    );
    if (r.ok) {
      verified.push({
        ...c,
        articleId: r.articleId,
        systemName: r.systemName,
        articleNumber: r.articleNumber,
        verified: true,
        citationLabel: r.citationLabel,
        certainty: c.articleId ? "high" : "medium",
      });
    } else {
      blocked.push({ candidate: c, reason: r.message });
    }
  }
  return { verified, blocked };
}

/** هل المخرَج مؤصَّل بالكامل؟ (لا استشهاد محجوب مُستخدَم) — للامتناع عند غياب السند. */
export function isGrounded(outcome: VerificationOutcome): boolean {
  return outcome.verified.length > 0;
}
