/**
 * prompts.ts — نصوص الاستخراج والتدقيق (نقيّة). استخراج لا توليد؛ المدقّق مستقلّ.
 */

const CARD_SCHEMA_BLOCK = `{
  "disputeType": "نوع النزاع (مقاولة، بيع، شركة، أوراق تجارية، إفلاس، وكالة، ...)",
  "claims": [{ "text": "الطلب كما ورد", "outcome": "قُبل | قُبل جزئيًا | رُفض | لم يُفصل" }],
  "defenses": [{ "text": "الدفع", "type": "شكلي | موضوعي", "outcome": "قُبل | رُفض | لم يُرد عليه" }],
  "appliedArticles": [{ "system": "اسم النظام كما في الحكم", "article": "رقم المادة", "quote": "الجملة الحاملة للذكر" }],
  "result": "الحكم النهائي موجزًا",
  "resultCategory": "للمدعي كاملًا | جزئيًا | رفض الدعوى | عدم اختصاص | عدم قبول | شطب/ترك",
  "amounts": { "claimed": null, "awarded": null },
  "court": { "circuit": "الدائرة إن ذُكرت", "degree": "ابتدائي | استئناف", "year": "سنة الحكم هـ/م كما وردت" },
  "confidence": 0.0
}`;

/** نصّ استخراج البطاقة من حكم واحد. */
export function buildExtractPrompt(judgmentText: string, caseRef: string): { system: string; user: string } {
  const system = [
    "أنت محلّل قضائي دقيق داخل منصة حكيم.",
    "مهمتك استخراج بطاقة وصفية محايدة من نصّ حكم تجاري — استخراج لا توليد.",
    "قواعد صارمة:",
    "١) كل قيمة من نصّ الحكم فقط؛ الحقل غير الموجود = null (لا تخمين ولا استنتاج).",
    "٢) لا تلخّص الوقائع ولا تعلّق ولا ترجّح — بطاقة محايدة.",
    "٣) أرقام المواد وأسماء الأنظمة كما وردت حرفيًّا في الحكم.",
    "٤) في appliedArticles: quote يجب أن تكون جملة منقولة حرفيًّا من نصّ الحكم (لا إعادة صياغة).",
    "٥) أعِد JSON نظيفًا فقط بلا markdown ولا نصّ خارج الكائن، وبهذا المخطّط حصرًا.",
  ].join("\n");

  const user = [
    `نصّ الحكم (المرجع ${caseRef}):`,
    "«««",
    judgmentText,
    "»»»",
    "",
    "أعِد بطاقة JSON بهذا المخطّط حصرًا:",
    CARD_SCHEMA_BLOCK,
  ].join("\n");

  return { system, user };
}

/** نصّ التدقيق المستقلّ: يتحقّق حقلًا حقلًا من إسناد كل قيمة للنصّ. */
export function buildVerifyPrompt(judgmentText: string, cardJson: string): { system: string; user: string } {
  const system = [
    "أنت مدقّق قضائي مستقلّ. أمامك بطاقة استُخرجت من حكم.",
    "تحقّق حقلًا حقلًا: هل كل قيمة مسندة فعلًا إلى نصّ الحكم؟",
    "اعتبر القيمة غير متّفقة إن كانت مُختلَقة، أو غير موجودة في النصّ، أو مُعاد صياغتها بما يغيّر المعنى، أو تصنيفًا خاطئًا.",
    "أعِد JSON فقط: { \"agreed\": true|false, \"disagreements\": [{ \"field\": \"اسم الحقل\", \"reason\": \"السبب\" }] }.",
    "agreed=true فقط إذا كانت كل الحقول مسندة للنصّ.",
  ].join("\n");

  const user = [
    "نصّ الحكم:",
    "«««",
    judgmentText,
    "»»»",
    "",
    "البطاقة المستخرَجة:",
    cardJson,
    "",
    "أعِد نتيجة التدقيق JSON فقط.",
  ].join("\n");

  return { system, user };
}

export type VerifyResult = { agreed: boolean; disagreements: Array<{ field: string; reason: string }> };

/** يحلّل ردّ المدقّق. عند الغموض → agreed=false (تحفّظ لصالح المراجعة). */
export function parseVerify(raw: string): VerifyResult {
  try {
    const s = (raw || "").replace(/```json?/gi, "").replace(/```/g, "").trim();
    const start = s.indexOf("{");
    const end = s.lastIndexOf("}");
    const obj = JSON.parse(start !== -1 && end > start ? s.slice(start, end + 1) : s);
    const agreed = obj.agreed === true;
    const disagreements = Array.isArray(obj.disagreements)
      ? obj.disagreements
          .map((d: unknown) => {
            const o = (d ?? {}) as Record<string, unknown>;
            return { field: String(o.field ?? "?"), reason: String(o.reason ?? "") };
          })
          .slice(0, 20)
      : [];
    return { agreed, disagreements };
  } catch {
    return { agreed: false, disagreements: [{ field: "_parse", reason: "تعذّر تحليل ردّ المدقّق" }] };
  }
}
