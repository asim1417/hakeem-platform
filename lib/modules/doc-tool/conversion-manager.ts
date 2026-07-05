// مدير المعالجة المستمرة — يعيش خارج دورة حياة React (singleton على مستوى الوحدة).
// المشكلة: القراءة السحابية الطويلة (نصف ساعة لمعجم) تتوقف عند الانتقال بين شاشات
// المنصّة لأن المكوّن يُفكَّك. الحل: تشغيل المهمة هنا — لا تتأثر بتفكيك أي مكوّن،
// فتستمر أثناء التنقّل بين البوابة/البحث السريع/محطة العمل، ويُبلَّغ المشتركون بالتقدّم.
//
// ملاحظة متصفح: هذا يصمد أمام التنقّل داخل التطبيق (SPA) لأن الوحدة لا تُعاد تحميلها.
// إغلاق التبويب كلياً يوقف أي JS (قيد المتصفح) — للدفعات التي تصمد أمام الإغلاق
// استخدم سكربت الخادم tools/gemini-ocr-service.

import type { CloudPdfOptions } from "./cloud-ocr";

export type ConversionPhase = "idle" | "running" | "done" | "error" | "canceled";

export interface ConversionState {
  phase: ConversionPhase;
  title: string; // اسم الوثيقة قيد المعالجة
  label: string; // رسالة التقدّم الحالية
  done: number; // صفحات منجزة
  total: number; // إجمالي الصفحات المطلوبة
  failed: number; // صفحات متعذرة
  resultText: string | null; // النص النهائي عند الاكتمال
  running: string | null; // ترويسات مفصولة
  error: string | null;
  startedAt: number | null;
}

type Listener = (state: ConversionState) => void;

const initial: ConversionState = {
  phase: "idle",
  title: "",
  label: "",
  done: 0,
  total: 0,
  failed: 0,
  resultText: null,
  running: null,
  error: null,
  startedAt: null
};

let state: ConversionState = { ...initial };
const listeners = new Set<Listener>();
let cancelFlag = false;

function emit() {
  for (const l of listeners) l(state);
}
function patch(p: Partial<ConversionState>) {
  state = { ...state, ...p };
  emit();
}

export function subscribeConversion(fn: Listener): () => void {
  listeners.add(fn);
  fn(state); // دفعة أولى بالحالة الراهنة (لالتقاط مهمة جارية عند العودة للشاشة)
  return () => listeners.delete(fn);
}

export function getConversionState(): ConversionState {
  return state;
}

export function isConversionRunning(): boolean {
  return state.phase === "running";
}

export function cancelConversion() {
  if (state.phase === "running") cancelFlag = true;
}

/** يمسح حالة انتهت (done/error/canceled) ليختفي المؤشر */
export function clearConversion() {
  if (state.phase !== "running") {
    state = { ...initial };
    emit();
  }
}

export interface StartConversionArgs {
  title: string;
  buffer: ArrayBuffer;
  options: CloudPdfOptions;
  /**
   * نصّ أساسي بعلامات [صفحة N] (الصفحات الرقمية السليمة) — إن وُجد، تُدمج القراءة
   * السحابية للصفحات الممسوحة داخله محلَّ علاماتها، فلا نرمي النصّ الرقميّ السليم.
   */
  baseText?: string;
  /** يُستدعى عند الاكتمال بالنص النهائي — لحفظه/إضافته كوثيقة */
  onComplete: (result: { text: string; running: string | null; failed: number }) => void | Promise<void>;
}

/**
 * يبدأ قراءة PDF سحابية مُدارة تستمر عبر التنقّل. يرفض البدء إن كانت مهمة جارية.
 * التقدّم يصل المشتركين عبر subscribeConversion.
 */
export async function startConversion(args: StartConversionArgs): Promise<void> {
  if (state.phase === "running") return; // مهمة واحدة في آن
  cancelFlag = false;
  patch({
    phase: "running",
    title: args.title,
    label: "التجهيز…",
    done: 0,
    total: 0,
    failed: 0,
    resultText: null,
    running: null,
    error: null,
    startedAt: Date.now()
  });

  try {
    const { cloudOcrPdfPages } = await import("./cloud-ocr");
    const result = await cloudOcrPdfPages(
      args.buffer,
      (label) => {
        // نستخرج done/total من الرسالة إن وُجدا، ونحدّث اللصيقة دائماً
        const m = label.match(/(\d+)\s*\/\s*(\d+)/);
        patch({
          label,
          done: m ? Number(m[1]) : state.done,
          total: m ? Number(m[2]) : state.total
        });
      },
      { ...args.options, shouldCancel: () => cancelFlag } as CloudPdfOptions
    );

    if (cancelFlag) {
      patch({ phase: "canceled", label: "أُلغيت المعالجة" });
      return;
    }
    if (!result) {
      patch({ phase: "error", error: "تعذّرت القراءة السحابية — تحقّق من المفتاح أو الاتصال", label: "" });
      return;
    }

    // ادمج الصفحات المقروءة سحابياً في النصّ الرقميّ الأساسي (إن وُجد) بدل استبداله كلّه.
    let merged = result.text;
    if (args.baseText) {
      const { mergeScannedPages } = await import("@/lib/modules/document-inspection/file-extract");
      merged = mergeScannedPages(args.baseText, result.text);
    }
    const { separateRunningLines } = await import("./extract");
    const sep = separateRunningLines(merged);
    patch({
      phase: "done",
      label: result.failed.length ? `اكتمل — ${result.failed.length} صفحة متعذرة` : "اكتملت المعالجة",
      failed: result.failed.length,
      resultText: sep.body,
      running: sep.running ?? null
    });
    await args.onComplete({ text: sep.body, running: sep.running ?? null, failed: result.failed.length });
  } catch (err) {
    patch({ phase: "error", error: err instanceof Error ? err.message : "خطأ غير متوقع", label: "" });
  }
}
