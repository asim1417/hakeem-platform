// OCR سحابي عالي الدقة عبر Gemini — مقتبس من tools/gemini-ocr-service (وحدة المستخدم).
// خادمي فقط: المفتاح لا يصل المتصفح. يُستدعى عبر /api/doc-tool/ocr.
// خيار اختياري صراحةً — الافتراضي يبقى OCR المحلي في المتصفح (الملف لا يغادر الجهاز).
//
// مصدر المفتاح (بالأولوية):
//  1) قاعدة البيانات app_settings["gemini_ocr_key"] — يُضاف من واجهة منصة الوثائق
//     (للمدير فقط)، مشفّراً AES-256-GCM بنفس آلية إعداد الذكاء المركزي.
//  2) متغير البيئة GEMINI_API_KEY.

import { prisma } from "@/lib/prisma";
import { encryptSecret, decryptSecret, ensureSettingsTable } from "@/lib/modules/ai/ai-config";

const OCR_KEY_SETTING = "gemini_ocr_key";

type StoredOcrKey = { apiKeyEnc?: string };

async function readStoredOcrKey(): Promise<string | null> {
  try {
    const row = await prisma.appSetting.findUnique({ where: { key: OCR_KEY_SETTING } });
    const value = row?.value as StoredOcrKey | undefined;
    if (!value?.apiKeyEnc) return null;
    return decryptSecret(value.apiKeyEnc);
  } catch {
    return null; // لا جدول بعد / لا اتصال قاعدة → بيئة
  }
}

export type GeminiOcrKeySource = "db" | "env" | "none";

/** المفتاح الفعّال ومصدره — قاعدة البيانات أولاً ثم البيئة. */
export async function resolveGeminiOcrKey(): Promise<{ key: string | null; source: GeminiOcrKeySource }> {
  const stored = await readStoredOcrKey();
  if (stored) return { key: stored, source: "db" };
  const env = process.env.GEMINI_API_KEY?.trim();
  if (env) return { key: env, source: "env" };
  return { key: null, source: "none" };
}

/** حالة الخدمة للعرض — دون كشف المفتاح (آخر 4 خانات فقط). */
export async function getGeminiOcrStatus(): Promise<{ configured: boolean; source: GeminiOcrKeySource; keyMasked: string | null }> {
  const { key, source } = await resolveGeminiOcrKey();
  return {
    configured: Boolean(key),
    source,
    keyMasked: key ? "…" + key.slice(-4) : null
  };
}

/** حفظ المفتاح مشفّراً في قاعدة البيانات (من واجهة منصة الوثائق — مدير فقط). */
export async function saveGeminiOcrKey(plainKey: string): Promise<{ ok: boolean; message?: string }> {
  const key = plainKey.trim();
  if (key.length < 20 || key.length > 200) return { ok: false, message: "صيغة المفتاح غير صالحة." };
  try {
    await ensureSettingsTable();
    const value: StoredOcrKey = { apiKeyEnc: encryptSecret(key) };
    await prisma.appSetting.upsert({
      where: { key: OCR_KEY_SETTING },
      create: { key: OCR_KEY_SETTING, value },
      update: { value }
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "تعذّر الحفظ." };
  }
}

/** إزالة المفتاح المخزّن (يبقى مفتاح البيئة إن وُجد). */
export async function clearGeminiOcrKey(): Promise<{ ok: boolean }> {
  try {
    await prisma.appSetting.delete({ where: { key: OCR_KEY_SETTING } });
  } catch {
    /* غير موجود أصلاً */
  }
  return { ok: true };
}

/** اختبار خفيف للمفتاح قبل الحفظ — استعلام قائمة النماذج (لا يستهلك توليداً). */
export async function testGeminiOcrKey(plainKey: string): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await fetch(`${GEMINI_BASE}?pageSize=1`, {
      method: "GET",
      headers: { "x-goog-api-key": plainKey.trim() },
      signal: AbortSignal.timeout(10_000)
    });
    if (res.ok) return { ok: true, message: "المفتاح صالح — الخدمة السحابية جاهزة." };
    const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    if (res.status === 400 || res.status === 401 || res.status === 403) {
      return { ok: false, message: "المفتاح مرفوض من Google — تحقق منه ومن تفعيل Generative Language API." };
    }
    return { ok: false, message: body?.error?.message ?? `Google أعاد ${res.status}` };
  } catch {
    return { ok: false, message: "تعذّر الوصول لخدمة Google — تحقق من اتصال الخادم." };
  }
}

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

// توجيه احترافي صارم — دقة قصوى مع سلامة قانونية: التصحيح للنص السردي فقط،
// والأرقام والمبالغ والتواريخ والأعلام تُنقَل حرفياً كما رُئيت (لا "تصحيح" يخترع قيمة).
const OCR_PROMPT =
  "أنت محرّك OCR احترافي عالي المستوى للمستندات الرسمية والقانونية العربية. " +
  "استخرج كل النصوص من هذه الوثيقة بأعلى دقة ممكنة، ملتزماً بالقواعد التالية:\n" +
  "1) حافظ على التنسيق الأصلي: الفقرات والأعمدة والجداول وترتيب الأسطر.\n" +
  "2) تعرّف على الترويسات والهوامش الجانبية والسفلية وضَعها في سياقها دون تداخل مع المتن.\n" +
  "3) للنص السردي غير الواضح بسبب جودة التصوير: استعِن بسياق الجملة العربية لقراءته بدقة.\n" +
  "4) تنبيه حاسم (وثيقة قانونية): لا تُصحِّح ولا تُخمِّن الأرقامَ والمبالغَ والتواريخَ الهجرية " +
  "وأرقامَ الصكوك والأعلامَ وأسماءَ الأطراف — انقلها حرفياً كما تراها تماماً حتى لو بدت غريبة؛ " +
  "إن تعذّرت قراءة رقم فاكتب مكانه [غير واضح] بدل تخمينه.\n" +
  "5) الخط اليدوي المعقّد: حلّله بعناية فائقة.\n" +
  "6) ترقيم الأسطر الهامشي: بعض الوثائق القضائية تحمل أرقام أسطر متسلسلة في الهامش " +
  "(1، 2، 3…) — هذه ليست من متن الوثيقة؛ لا تنسخها ولا تدمجها مع بدايات الأسطر أبداً.\n" +
  "7) أخرِج النص الخام مباشرة دون أي مقدمات أو تعليقات منك.";

// إعدادات التوليد لكل نموذج. حرارةٌ منخفضة جداً تمنع التأليف. والأهمّ:
// - maxOutputTokens أقصى ما يسمح به النموذج (65536): المدخل قد يكون PDF كاملاً
//   متعدّد الصفحات (طلب واحد بدل طلبٍ لكل صفحة) — السقف الأدنى كان يبتر الطويل.
// - thinkingBudget=0 على flash: OCR مهمّة إدراكٍ لا استدلال؛ «التفكير» يستهلك رصيد
//   المخرجات (فيعيد نصّاً فارغاً/مبتوراً) ويبطّئ الاستجابة. تعطيله يعطي نسخاً مباشراً
//   أدقّ وأسرع. (gemini-2.5-pro لا يقبل 0 — نتركه على التفكير الديناميكي للخط اليدوي.)
export function genConfig(modelType: GeminiOcrModel) {
  return {
    temperature: 0.1,
    topP: 0.95,
    maxOutputTokens: 65536,
    ...(modelType === "flash" ? { thinkingConfig: { thinkingBudget: 0 } } : {})
  };
}

export const GEMINI_OCR_MIME_TYPES = ["image/png", "image/jpeg", "application/pdf"] as const;
export type GeminiOcrMime = (typeof GEMINI_OCR_MIME_TYPES)[number];

/** flash للوثائق العادية (سريع واقتصادي) · pro للخط اليدوي والمعقد */
export type GeminiOcrModel = "flash" | "pro";

/** توافقية: فحص بيئة فقط (متزامن). الفحص الكامل عبر getGeminiOcrStatus. */
export function isGeminiOcrConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> }; finishReason?: string }>;
  error?: {
    message?: string;
    status?: string;
    details?: Array<{
      "@type"?: string;
      violations?: Array<{ quotaId?: string; quotaMetric?: string }>;
      retryDelay?: string;
    }>;
  };
}

/**
 * خطأ Gemini المُبنى — يحمل تمييزاً صريحاً بين حدّ معدلٍ عابر (يُجدي الانتظار
 * والإعادة) وحصةٍ يومية مستهلَكة (PerDay — لا طائل من إعادة المحاولة اليوم؛
 * الحلّ الوحيد تفعيل الفوترة أو الانتظار للغد)، بالإضافة لمهلة الانتظار الحقيقية
 * التي يرسلها Google نفسه (RetryInfo.retryDelay) بدل تخمين ثابت.
 */
export class GeminiApiError extends Error {
  dailyLimitExceeded: boolean;
  retryDelaySec: number | null;
  constructor(message: string, opts: { dailyLimitExceeded?: boolean; retryDelaySec?: number | null } = {}) {
    super(message);
    this.name = "GeminiApiError";
    this.dailyLimitExceeded = opts.dailyLimitExceeded ?? false;
    this.retryDelaySec = opts.retryDelaySec ?? null;
  }
}

/**
 * ينزع أرقام الأسطر الهامشية التي دمجها OCR ببداية السطر رغم التوجيه — تُعرف
 * بنمطٍ مستحيل في النص الأصيل: أرقام غربية (رقم الهامش) ملتصقة مباشرةً بأرقام
 * هندية (رقم البند الأصلي: ٦. ٧.…) في أول السطر، مثل «9٦. التقرير الطبي».
 * لا يمسّ أي رقمٍ سليم: النمط المختلط المتلاصق لا يرد في الكتابة العربية الأصيلة.
 */
export function stripMarginLineNumbers(text: string): string {
  return text.replace(/^(\d{1,3})(?=[٠-٩]{1,3}\s*[.،)\-–])/gm, "");
}

export async function extractTextWithGemini(
  data: Buffer,
  mimeType: GeminiOcrMime,
  modelType: GeminiOcrModel = "flash"
): Promise<string> {
  const { key: apiKey } = await resolveGeminiOcrKey();
  if (!apiKey) throw new Error("مفتاح Gemini غير مضبوط — أضفه من إعدادات منصة الوثائق");

  const model = modelType === "pro" ? "gemini-2.5-pro" : "gemini-2.5-flash";
  const res = await fetch(`${GEMINI_BASE}/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { inline_data: { data: data.toString("base64"), mime_type: mimeType } },
            { text: OCR_PROMPT }
          ]
        }
      ],
      generationConfig: genConfig(modelType)
    })
  });

  const json = (await res.json()) as GeminiResponse;
  if (!res.ok) {
    const details = json.error?.details ?? [];
    const dailyLimitExceeded = details.some((d) =>
      d.violations?.some((v) => /perday/i.test(v.quotaId ?? "") || /perday/i.test(v.quotaMetric ?? ""))
    );
    const retryDelayRaw = details.find((d) => typeof d.retryDelay === "string")?.retryDelay;
    const retryDelaySec = retryDelayRaw ? Number.parseFloat(retryDelayRaw) || null : null;
    if (dailyLimitExceeded) {
      throw new GeminiApiError(
        "استُهلكت حصتك اليومية المجانية من Google لهذا النموذج (Free Tier) — فعّل الفوترة من Google AI Studio لرفع الحدّ، أو أعد المحاولة غداً.",
        { dailyLimitExceeded: true, retryDelaySec }
      );
    }
    throw new GeminiApiError(json.error?.message ?? `Gemini أعاد ${res.status}`, { retryDelaySec });
  }
  const candidate = json.candidates?.[0];
  const text = candidate?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  if (!text.trim()) {
    // MAX_TOKENS بلا نصّ = ابتُلع الرصيد في التفكير/الطول — نُبلّغ بوضوح بدل «فارغ» غامض
    if (candidate?.finishReason === "MAX_TOKENS") {
      throw new Error("انقطعت استجابة Gemini قبل النصّ (حدّ المخرجات) — أُعيدت الصفحة");
    }
    throw new Error("لم يُعِد Gemini نصاً — تأكد من وضوح الوثيقة");
  }
  return stripMarginLineNumbers(text.trim());
}
