import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';

// إعداد العميل باستخدام مفتاح الـ API من بيئة العمل لضمان الأمان
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

/**
 * خدمة تحويل الوثائق (صور/PDF) إلى نصوص باستخدام Gemini
 * @param {string} filePath - المسار المحلي للملف المرفوع
 * @param {string} modelType - نوع النموذج ('flash' للوثائق العادية، 'pro' للخط اليدوي والمعقد)
 * @returns {Promise<string>} - النص العربي المستخرج
 */
export async function extractTextFromDocument(filePath, modelType = 'flash') {
  try {
    // 1. التأكد من وجود الملف
    if (!fs.existsSync(filePath)) {
      throw new Error(`الملف غير موجود في المسار المحدد: ${filePath}`);
    }

    // 2. تحديد نوع الملف (Mime Type) تلقائياً بناءً على الامتداد
    const ext = path.extname(filePath).toLowerCase();
    let mimeType = 'image/jpeg';
    
    if (ext === '.png') mimeType = 'image/png';
    else if (ext === '.pdf') mimeType = 'application/pdf';
    else if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg';
    else throw new Error('صيغة الملف غير مدعومة. يرجى رفع صورة أو ملف PDF.');

    // 3. تحويل الملف إلى Base64
    const fileBuffer = fs.readFileSync(filePath);
    const base64Data = fileBuffer.toString('base64');

    // 4. اختيار النموذج المناسب بناءً على رغبة المستخدم أو جودة الوثيقة
    const selectedModel = modelType === 'pro' ? 'gemini-2.5-pro' : 'gemini-2.5-flash';

    // توجيهٌ صارم بسلامةٍ قانونية: لا تصحيح للأرقام/المبالغ/التواريخ/أرقام الصكوك/الأعلام،
    // تُنقل حرفياً و[غير واضح] بدل التخمين — مطابقٌ لمسار الويب في المنصّة.
    const OCR_PROMPT =
      'أنت محرّك OCR احترافي للمستندات الرسمية والقانونية العربية. استخرج كل النصوص بأعلى دقة:\n' +
      '1) حافظ على التنسيق: الفقرات والأعمدة والجداول وترتيب الأسطر.\n' +
      '2) ضع الترويسات والهوامش في سياقها دون تداخل مع المتن.\n' +
      '3) تنبيه حاسم (وثيقة قانونية): لا تُصحِّح ولا تُخمِّن الأرقامَ والمبالغَ والتواريخَ الهجرية وأرقامَ الصكوك ' +
      'والأعلامَ وأسماءَ الأطراف — انقلها حرفياً كما تراها؛ إن تعذّرت قراءة رقم فاكتب [غير واضح] بدل تخمينه.\n' +
      '4) أخرِج النص الخام مباشرة دون مقدمات أو تعليقات.';

    // إعدادات التوليد: حرارة منخفضة + سقف مخرجات مرتفع + تعطيل «التفكير» على flash
    // (OCR إدراكٌ لا استدلال؛ التفكير يبتلع رصيد المخرجات فيُرجِع نصّاً فارغاً/مبتوراً).
    const config = {
      temperature: 0.1,
      topP: 0.95,
      maxOutputTokens: 16384,
      ...(modelType === 'pro' ? {} : { thinkingConfig: { thinkingBudget: 0 } })
    };

    // 5. إرسال الطلب لـ Gemini
    const response = await ai.models.generateContent({
      model: selectedModel,
      contents: [
        {
          inlineData: {
            data: base64Data,
            mimeType: mimeType
          }
        },
        OCR_PROMPT
      ],
      config,
    });

    // 6. إعادة النص المستخرج
    return response.text;

  } catch (error) {
    console.error('خطأ في خدمة استخراج النصوص (Gemini OCR Service):', error.message);
    throw error;
  }
}
