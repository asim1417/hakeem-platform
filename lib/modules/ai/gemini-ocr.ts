// OCR سحابي عالي الدقة عبر Gemini — مقتبس من tools/gemini-ocr-service (وحدة المستخدم).
// خادمي فقط: المفتاح GEMINI_API_KEY لا يصل المتصفح. يُستدعى عبر /api/doc-tool/ocr.
// خيار اختياري صراحةً — الافتراضي يبقى OCR المحلي في المتصفح (الملف لا يغادر الجهاز).

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

// التوجيه الأمثل للاستخراج العربي المرتّب — كما ورد في وحدة المستخدم
const OCR_PROMPT =
  "قم بقراءة هذه الوثيقة واستخراج كافة النصوص العربية والإنجليزية منها بدقة عالية. " +
  "حافظ على ترتيب الأسطر، وتنسيق الفقرات، والجداول إن وجدت، دون أي تفسير أو مقدمات منك.";

export const GEMINI_OCR_MIME_TYPES = ["image/png", "image/jpeg", "application/pdf"] as const;
export type GeminiOcrMime = (typeof GEMINI_OCR_MIME_TYPES)[number];

/** flash للوثائق العادية (سريع واقتصادي) · pro للخط اليدوي والمعقد */
export type GeminiOcrModel = "flash" | "pro";

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
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new Error("GEMINI_API_KEY غير مضبوط");

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
