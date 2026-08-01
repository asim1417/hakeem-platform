// ذاكرة قراءةٍ ضوئيةٍ بمفتاح البصمة (content-hash) — محايدة البيئة (متصفح + خادم).
//
// المبدأ (كما في المنصّات العالمية): الصفحة نفسها لا تُقرأ ضوئيًّا مرّتين. نحسب بصمة
// SHA-256 لبايتات صورة/صفحة، ونخزّن ناتج القراءة مفتاحًا بها. الصفحات المتطابقة —
// صفحاتٌ بيضاء، ترويسات/أختام مكرّرة، أو إعادة رفع الملف نفسه — تُستردّ فورًا بلا نداء
// سحابيّ. مكسبٌ صرفٌ في الزمن والكلفة، وآمنٌ: الإخفاق يعني قراءةً جديدة لا خطأً.
//
// نقيّة وحتمية: لا حالة عامّة مخفيّة إلا ذاكرةً محدودة الحجم (إخلاءٌ بترتيب الإدخال).

/** يحسب بصمة SHA-256 (hex) لبايتات — عبر Web Crypto المتاح في المتصفح وNode 20+. */
export async function hashBytes(bytes: Uint8Array): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error("Web Crypto غير متاح في هذه البيئة");
  // نسخةٌ محكمةٌ بمخزنٍ بحجم البايتات المنطقيّة تمامًا — تحترم أيّ إزاحةٍ/طولٍ في العرض،
  // وبمخزن ArrayBuffer صريح (لا ArrayBufferLike) فتُقبل مصدرًا لـ digest بلا لبسٍ نوعيّ.
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const digest = await subtle.digest("SHA-256", copy.buffer);
  const arr = new Uint8Array(digest);
  let hex = "";
  for (let i = 0; i < arr.length; i += 1) hex += arr[i].toString(16).padStart(2, "0");
  return hex;
}

export interface OcrCache {
  get(key: string): string | undefined;
  set(key: string, value: string): void;
  readonly size: number;
}

/**
 * ذاكرةٌ محدودة الحجم بإخلاءٍ بترتيب الإدخال (FIFO). كافية لتكرار الصفحات داخل الوثيقة
 * وعبر المهام في خادمٍ طويل العمر، بلا نموٍّ غير محدود. لا تُخزَّن نصوصٌ فارغة (لا فائدة
 * من تخزين إخفاق، ولإتاحة إعادة المحاولة). القيم نصٌّ مقروء فقط — لا بيانات شخصية خام.
 */
export class MemoryOcrCache implements OcrCache {
  private readonly map = new Map<string, string>();
  private readonly max: number;

  constructor(max = 5_000) {
    this.max = Math.max(1, max);
  }

  get(key: string): string | undefined {
    return this.map.get(key);
  }

  set(key: string, value: string): void {
    if (!value || !value.trim()) return; // لا نخزّن إخفاقًا/فراغًا
    if (this.map.has(key)) this.map.delete(key); // حدّث ترتيب الإدخال
    this.map.set(key, value);
    while (this.map.size > this.max) {
      const oldest = this.map.keys().next().value;
      if (oldest === undefined) break;
      this.map.delete(oldest);
    }
  }

  get size(): number {
    return this.map.size;
  }
}

/** ذاكرةٌ فارغة (لا تخزّن ولا تُصيب) — للاستعمال حين يكون العلم مطفأً بلا فروعٍ إضافية. */
export const NULL_OCR_CACHE: OcrCache = {
  get: () => undefined,
  set: () => undefined,
  size: 0,
};
