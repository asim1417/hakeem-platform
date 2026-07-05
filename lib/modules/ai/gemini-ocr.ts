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
    const res = await fetch(`${GEMINI_BASE}?key=${encodeURIComponent(plainKey.trim())}&pageSize=1`, {
      method: "GET",
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

// التوجيه الأمثل للاستخراج العربي المرتّب — كما ورد في وحدة المستخدم
const OCR_PROMPT =
  "قم بقراءة هذه الوثيقة واستخراج كافة النصوص العربية والإنجليزية منها بدقة عالية. " +
  "حافظ على ترتيب الأسطر، وتنسيق الفقرات، والجداول إن وجدت، دون أي تفسير أو مقدمات منك.";

export const GEMINI_OCR_MIME_TYPES = ["image/png", "image/jpeg", "application/pdf"] as const;
export type GeminiOcrMime = (typeof GEMINI_OCR_MIME_TYPES)[number];

/** flash للوثائق العادية (سريع واقتصادي) · pro للخط اليدوي والمعقد */
export type GeminiOcrModel = "flash" | "pro";

/** توافقية: فحص بيئة فقط (متزامن). الفحص الكامل عبر getGeminiOcrStatus. */
export function isGeminiOcrConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  error?: { message?: string };
}

export async function extractTextWithGemini(
  data: Buffer,
  mimeType: GeminiOcrMime,
  modelType: GeminiOcrModel = "flash"
): Promise<string> {
  const { key: apiKey } = await resolveGeminiOcrKey();
  if (!apiKey) throw new Error("مفتاح Gemini غير مضبوط — أضفه من إعدادات منصة الوثائق");

  const model = modelType === "pro" ? "gemini-2.5-pro" : "gemini-2.5-flash";
  const res = await fetch(`${GEMINI_BASE}/${model}:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { inline_data: { data: data.toString("base64"), mime_type: mimeType } },
            { text: OCR_PROMPT }
          ]
        }
      ]
    })
  });

  const json = (await res.json()) as GeminiResponse;
  if (!res.ok) {
    throw new Error(json.error?.message ?? `Gemini أعاد ${res.status}`);
  }
  const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  if (!text.trim()) throw new Error("لم يُعِد Gemini نصاً — تأكد من وضوح الوثيقة");
  return text.trim();
}
